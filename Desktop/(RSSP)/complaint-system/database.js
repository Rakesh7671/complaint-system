const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'complaints.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    department TEXT,
    college_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Others',
    priority TEXT NOT NULL DEFAULT 'Medium',
    sentiment_label TEXT DEFAULT 'Neutral',
    sentiment_score REAL DEFAULT 0,
    assigned_dept TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    image_path TEXT,
    ai_confidence REAL DEFAULT 0,
    ai_tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id INTEGER NOT NULL,
    admin_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id),
    FOREIGN KEY (admin_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id INTEGER UNIQUE NOT NULL,
    student_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    complaint_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed demo data if not already present
const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (existingUsers.count === 0) {
  const salt = bcrypt.genSaltSync(10);

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, department, college_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Super Admin
  insertUser.run('Dr. Rajesh Kumar', 'superadmin@college.edu', bcrypt.hashSync('Admin@123', salt), 'super_admin', 'Administration', 'SA001');

  // Department Admins
  insertUser.run('Prof. Anita Sharma', 'academics@college.edu', bcrypt.hashSync('Admin@123', salt), 'dept_admin', 'Academics', 'DA001');
  insertUser.run('Mr. Suresh Patel', 'hostel@college.edu', bcrypt.hashSync('Admin@123', salt), 'dept_admin', 'Hostel', 'DA002');
  insertUser.run('Ms. Priya Singh', 'transport@college.edu', bcrypt.hashSync('Admin@123', salt), 'dept_admin', 'Transport', 'DA003');
  insertUser.run('Er. Vikram Nair', 'infrastructure@college.edu', bcrypt.hashSync('Admin@123', salt), 'dept_admin', 'Infrastructure', 'DA004');

  // Students
  insertUser.run('Amit Verma', 'amit@student.edu', bcrypt.hashSync('Student@123', salt), 'student', null, 'STU2024001');
  insertUser.run('Pooja Rao', 'pooja@student.edu', bcrypt.hashSync('Student@123', salt), 'student', null, 'STU2024002');

  // Seed some sample complaints
  const insertComplaint = db.prepare(`
    INSERT INTO complaints (student_id, title, description, category, priority, sentiment_label, sentiment_score, assigned_dept, status, ai_confidence, ai_tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
  `);

  insertComplaint.run(6, 'Hostel water supply issue', 'There is no water supply in Block C hostel for the past 3 days. Students are facing severe difficulties.', 'Hostel', 'High', 'Negative', -0.72, 'Hostel Management', 'Resolved', 0.91, 'water,hostel,supply', '-10 days', '-5 days');
  insertComplaint.run(7, 'Wi-Fi not working in library', 'The library Wi-Fi has been down for a week. Unable to do research and download academic resources.', 'Infrastructure', 'Medium', 'Negative', -0.55, 'Infrastructure', 'In Progress', 0.87, 'wifi,internet,library', '-7 days', '-2 days');
  insertComplaint.run(6, 'Exam timetable clash', 'Two exams are scheduled on the same day and time slot which is impossible to attend simultaneously.', 'Exams', 'High', 'Negative', -0.68, 'Examination Cell', 'Pending', 0.93, 'exam,timetable,clash', '-3 days', '-3 days');
  insertComplaint.run(7, 'Bus timing issues', 'The college bus from sector 15 departs 20 minutes early causing many students to miss it daily.', 'Transport', 'Medium', 'Negative', -0.45, 'Transport', 'Pending', 0.89, 'bus,timing,transport', '-1 days', '-1 days');
  insertComplaint.run(6, 'Faculty absent frequently', 'Professor for Advanced Algorithms has been absent 8 out of last 12 classes without any substitute arrangement.', 'Faculty', 'High', 'Negative', -0.61, 'Academics', 'In Progress', 0.85, 'faculty,absent,class', '-5 days', '-1 days');

  // Add response to resolved complaint
  const insertResponse = db.prepare(`INSERT INTO responses (complaint_id, admin_id, message, created_at) VALUES (?, ?, ?, datetime('now', ?))`);
  insertResponse.run(1, 3, 'We have identified the issue with the main pipeline. Repairs have been completed and water supply has been restored. Apologies for the inconvenience.', '-3 days');

  // Add feedback for resolved complaint
  const insertFeedback = db.prepare(`INSERT INTO feedback (complaint_id, student_id, rating, comment) VALUES (?, ?, ?, ?)`);
  insertFeedback.run(1, 6, 4, 'Issue was resolved quickly once reported. Thank you for the prompt action.');

  // Notifications
  const insertNotif = db.prepare(`INSERT INTO notifications (user_id, message, complaint_id, is_read, created_at) VALUES (?, ?, ?, ?, datetime('now', ?))`);
  insertNotif.run(6, 'Your complaint "Hostel water supply issue" has been resolved!', 1, 0, '-3 days');
  insertNotif.run(7, 'Your complaint "Wi-Fi not working in library" status changed to In Progress.', 2, 0, '-2 days');
  insertNotif.run(6, 'Admin responded to your complaint "Faculty absent frequently".', 5, 0, '-1 days');

  console.log('✅ Database seeded with demo data');
}

module.exports = db;
