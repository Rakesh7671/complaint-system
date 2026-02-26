const express = require('express');
const db = require('../database');
const { authMiddleware } = require('./auth');
const router = express.Router();

function requireAdmin(req, res, next) {
    if (!['dept_admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
}

function getWhereClause(role, department) {
    if (role === 'super_admin') return { where: '', params: [] };
    const deptKeyword = department || '';
    return {
        where: `WHERE (c.assigned_dept LIKE ? OR c.category = ?)`,
        params: [`%${deptKeyword}%`, deptKeyword]
    };
}

// GET /api/analytics/overview
router.get('/overview', authMiddleware, requireAdmin, (req, res) => {
    const { where, params } = getWhereClause(req.user.role, req.user.department);

    const total = db.prepare(`SELECT COUNT(*) as count FROM complaints c ${where}`).get(params).count;

    const byStatus = db.prepare(`SELECT status, COUNT(*) as count FROM complaints c ${where} GROUP BY status`).all(params);
    const byCategory = db.prepare(`SELECT category, COUNT(*) as count FROM complaints c ${where} GROUP BY category ORDER BY count DESC`).all(params);
    const byPriority = db.prepare(`SELECT priority, COUNT(*) as count FROM complaints c ${where} GROUP BY priority`).all(params);
    const bySentiment = db.prepare(`SELECT sentiment_label, COUNT(*) as count FROM complaints c ${where} GROUP BY sentiment_label`).all(params);

    // Average resolution time (hours)
    const avgResolution = db.prepare(`
    SELECT AVG((julianday(updated_at) - julianday(created_at)) * 24) as avg_hours
    FROM complaints c ${where} ${where ? 'AND' : 'WHERE'} status = 'Resolved'
  `).get(params.length ? [...params] : []);

    // Recent complaints (last 7 days)
    const recentParams = [...params];
    const recent = db.prepare(`
    SELECT COUNT(*) as count FROM complaints c ${where}
    ${where ? 'AND' : 'WHERE'} created_at >= datetime('now', '-7 days')
  `).get(recentParams);

    res.json({
        total,
        byStatus,
        byCategory,
        byPriority,
        bySentiment,
        avgResolutionHours: avgResolution?.avg_hours ? parseFloat(avgResolution.avg_hours.toFixed(1)) : 0,
        recentCount: recent.count
    });
});

// GET /api/analytics/department
router.get('/department', authMiddleware, requireAdmin, (req, res) => {
    const stats = db.prepare(`
    SELECT
      assigned_dept as department,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
      SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN priority = 'High' THEN 1 ELSE 0 END) as high_priority,
      AVG(CASE WHEN status = 'Resolved' THEN (julianday(updated_at) - julianday(created_at)) * 24 ELSE NULL END) as avg_resolution_hours
    FROM complaints
    WHERE assigned_dept IS NOT NULL
    GROUP BY assigned_dept
    ORDER BY total DESC
  `).all();

    const result = stats.map(s => ({
        ...s,
        resolutionRate: s.total > 0 ? parseFloat(((s.resolved / s.total) * 100).toFixed(1)) : 0,
        avg_resolution_hours: s.avg_resolution_hours ? parseFloat(s.avg_resolution_hours.toFixed(1)) : null
    }));

    res.json(result);
});

// GET /api/analytics/trends
router.get('/trends', authMiddleware, requireAdmin, (req, res) => {
    const monthlyTrends = db.prepare(`
    SELECT 
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved
    FROM complaints
    WHERE created_at >= datetime('now', '-6 months')
    GROUP BY month
    ORDER BY month ASC
  `).all();

    const topIssues = db.prepare(`
    SELECT category, COUNT(*) as count, 
      AVG(CASE WHEN priority = 'High' THEN 3 WHEN priority = 'Medium' THEN 2 ELSE 1 END) as avg_priority_score
    FROM complaints
    GROUP BY category
    ORDER BY count DESC
    LIMIT 7
  `).all();

    const recentHighPriority = db.prepare(`
    SELECT c.*, u.name as student_name FROM complaints c
    JOIN users u ON c.student_id = u.id
    WHERE c.priority = 'High' AND c.status != 'Resolved'
    ORDER BY c.created_at DESC
    LIMIT 5
  `).all();

    res.json({ monthlyTrends, topIssues, recentHighPriority });
});

module.exports = router;
