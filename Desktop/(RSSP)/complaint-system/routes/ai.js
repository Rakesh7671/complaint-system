const express = require('express');
const { analyzeComplaint } = require('../ai-engine');
const { authMiddleware } = require('./auth');
const router = express.Router();

// POST /api/ai/analyze - Live AI analysis
router.post('/analyze', (req, res) => {
    const { title, description } = req.body;
    if (!title && !description) return res.status(400).json({ error: 'Title or description required' });
    const result = analyzeComplaint(title || '', description || '');
    res.json(result);
});

module.exports = router;
