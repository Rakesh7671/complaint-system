require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { router: authRouter } = require('./routes/auth');
const complaintsRouter = require('./routes/complaints');
const analyticsRouter = require('./routes/analytics');
const aiRouter = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ai', aiRouter);

// SPA fallback for all non-API routes
app.get(/^(?!\/api).*/, (req, res) => {
    const page = req.path.replace('/', '') || 'index';
    const filePath = path.join(__dirname, 'public', `${page}.html`);
    res.sendFile(filePath, (err) => {
        if (err) res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`\n🎓 College Complaint Management System`);
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`\n📋 Demo Accounts:`);
    console.log(`   Super Admin: superadmin@college.edu / Admin@123`);
    console.log(`   Academics Admin: academics@college.edu / Admin@123`);
    console.log(`   Hostel Admin: hostel@college.edu / Admin@123`);
    console.log(`   Student: amit@student.edu / Student@123`);
    console.log(`   Student: pooja@student.edu / Student@123\n`);
});

module.exports = app;
