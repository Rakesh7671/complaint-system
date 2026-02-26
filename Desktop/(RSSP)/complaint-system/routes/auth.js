const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Middleware to verify JWT
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// POST /api/auth/register
router.post('/register', (req, res) => {
    const { name, email, password, college_id } = req.body;
    if (!name || !email || !password || !college_id) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const existingId = db.prepare('SELECT id FROM users WHERE college_id = ?').get(college_id);
    if (existingId) return res.status(409).json({ error: 'College ID already registered' });

    const password_hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
        'INSERT INTO users (name, email, password_hash, role, college_id) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email, password_hash, 'student', college_id);

    const token = jwt.sign(
        { id: result.lastInsertRowid, role: 'student', name, email },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.status(201).json({
        message: 'Registration successful',
        token,
        user: { id: result.lastInsertRowid, name, email, role: 'student', college_id }
    });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
        { id: user.id, role: user.role, name: user.name, email: user.email, department: user.department },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({
        message: 'Login successful',
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, college_id: user.college_id }
    });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT id, name, email, role, department, college_id, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

// GET /api/auth/notifications
router.get('/notifications', authMiddleware, (req, res) => {
    const notifs = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(req.user.id);
    res.json(notifs);
});

// PATCH /api/auth/notifications/:id/read
router.patch('/notifications/:id/read', authMiddleware, (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Marked as read' });
});

// PATCH /api/auth/notifications/read-all
router.patch('/notifications/read-all', authMiddleware, (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'All marked as read' });
});

module.exports = { router, authMiddleware };
