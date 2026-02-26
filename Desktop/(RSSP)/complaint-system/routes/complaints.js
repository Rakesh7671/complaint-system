const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../database');
const { analyzeComplaint } = require('../ai-engine');
const { authMiddleware } = require('./auth');
const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads')),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `complaint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
        next();
    };
}

// POST /api/complaints - Submit complaint
router.post('/', authMiddleware, requireRole('student'), upload.single('image'), (req, res) => {
    const { title, description, category, priority, sentiment_label, sentiment_score, assigned_dept, ai_confidence, ai_tags } = req.body;

    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
    }

    // Run AI if not provided from frontend
    let aiResult;
    if (category && priority) {
        aiResult = { category, priority, sentiment: { label: sentiment_label || 'Neutral', score: parseFloat(sentiment_score) || 0 }, assignedDept: assigned_dept, confidence: parseFloat(ai_confidence) || 0.5, tags: ai_tags || '' };
    } else {
        aiResult = analyzeComplaint(title, description);
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const result = db.prepare(`
    INSERT INTO complaints (student_id, title, description, category, priority, sentiment_label, sentiment_score, assigned_dept, status, image_path, ai_confidence, ai_tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)
  `).run(
        req.user.id, title, description,
        aiResult.category, aiResult.priority,
        aiResult.sentiment.label, aiResult.sentiment.score,
        aiResult.assignedDept, imagePath,
        aiResult.confidence, aiResult.tags
    );

    // Notify relevant dept admins
    let deptAdmins;
    if (aiResult.assignedDept) {
        // Map assigned dept name back to role dept
        const deptKeyword = aiResult.category === 'Exams' ? 'Examination' : aiResult.category;
        deptAdmins = db.prepare(`SELECT id FROM users WHERE role = 'dept_admin' AND department LIKE ?`).all(`%${deptKeyword}%`);
    }
    const superAdmins = db.prepare(`SELECT id FROM users WHERE role = 'super_admin'`).all();
    const notifyUsers = [...(deptAdmins || []), ...superAdmins];
    const insertNotif = db.prepare(`INSERT INTO notifications (user_id, message, complaint_id) VALUES (?, ?, ?)`);
    for (const u of notifyUsers) {
        insertNotif.run(u.id, `New ${aiResult.priority} priority complaint: "${title}"`, result.lastInsertRowid);
    }

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Complaint submitted successfully', complaint });
});

// GET /api/complaints - List complaints
router.get('/', authMiddleware, (req, res) => {
    const { status, category, priority, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '';
    const params = [];

    if (req.user.role === 'student') {
        whereClause = 'WHERE c.student_id = ?';
        params.push(req.user.id);
    } else if (req.user.role === 'dept_admin') {
        // Map department name to category
        const dept = req.user.department || '';
        whereClause = `WHERE (c.assigned_dept LIKE ? OR c.category = ?)`;
        params.push(`%${dept}%`, dept);
    }
    // super_admin sees all

    if (status) {
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'c.status = ?';
        params.push(status);
    }
    if (category) {
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'c.category = ?';
        params.push(category);
    }
    if (priority) {
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'c.priority = ?';
        params.push(priority);
    }

    const complaints = db.prepare(`
    SELECT c.*, u.name as student_name, u.college_id, u.email as student_email
    FROM complaints c
    JOIN users u ON c.student_id = u.id
    ${whereClause}
    ORDER BY 
      CASE c.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
      c.created_at DESC
    LIMIT ? OFFSET ?
  `).all([...params, parseInt(limit), offset]);

    const total = db.prepare(`SELECT COUNT(*) as count FROM complaints c ${whereClause}`).get(params);
    res.json({ complaints, total: total.count, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/complaints/:id - Get single complaint
router.get('/:id', authMiddleware, (req, res) => {
    const complaint = db.prepare(`
    SELECT c.*, u.name as student_name, u.college_id, u.email as student_email
    FROM complaints c
    JOIN users u ON c.student_id = u.id
    WHERE c.id = ?
  `).get(req.params.id);

    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    // Access control
    if (req.user.role === 'student' && complaint.student_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const responses = db.prepare(`
    SELECT r.*, u.name as admin_name, u.role as admin_role
    FROM responses r
    JOIN users u ON r.admin_id = u.id
    WHERE r.complaint_id = ?
    ORDER BY r.created_at ASC
  `).all(req.params.id);

    const feedback = db.prepare('SELECT * FROM feedback WHERE complaint_id = ?').get(req.params.id);
    res.json({ ...complaint, responses, feedback });
});

// PATCH /api/complaints/:id/status - Update status (admin only)
router.patch('/:id/status', authMiddleware, requireRole('dept_admin', 'super_admin'), (req, res) => {
    const { status } = req.body;
    if (!['Pending', 'In Progress', 'Resolved'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    db.prepare(`UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(status, req.params.id);

    // Notify student
    db.prepare(`INSERT INTO notifications (user_id, message, complaint_id) VALUES (?, ?, ?)`).run(
        complaint.student_id,
        `Your complaint "${complaint.title}" status changed to ${status}.`,
        complaint.id
    );

    res.json({ message: 'Status updated', status });
});

// POST /api/complaints/:id/respond - Add admin response
router.post('/:id/respond', authMiddleware, requireRole('dept_admin', 'super_admin'), (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Response message is required' });

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    const result = db.prepare(
        'INSERT INTO responses (complaint_id, admin_id, message) VALUES (?, ?, ?)'
    ).run(req.params.id, req.user.id, message);

    // Notify student
    db.prepare(`INSERT INTO notifications (user_id, message, complaint_id) VALUES (?, ?, ?)`).run(
        complaint.student_id,
        `Admin responded to your complaint "${complaint.title}".`,
        complaint.id
    );

    const response = db.prepare(`
    SELECT r.*, u.name as admin_name FROM responses r
    JOIN users u ON r.admin_id = u.id WHERE r.id = ?
  `).get(result.lastInsertRowid);

    res.status(201).json({ message: 'Response added', response });
});

// POST /api/complaints/:id/feedback - Submit feedback
router.post('/:id/feedback', authMiddleware, requireRole('student'), (req, res) => {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    if (complaint.student_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (complaint.status !== 'Resolved') return res.status(400).json({ error: 'Feedback only allowed for resolved complaints' });

    const existing = db.prepare('SELECT id FROM feedback WHERE complaint_id = ?').get(req.params.id);
    if (existing) return res.status(409).json({ error: 'Feedback already submitted' });

    db.prepare('INSERT INTO feedback (complaint_id, student_id, rating, comment) VALUES (?, ?, ?, ?)').run(req.params.id, req.user.id, rating, comment || '');
    res.status(201).json({ message: 'Feedback submitted, thank you!' });
});

module.exports = router;
