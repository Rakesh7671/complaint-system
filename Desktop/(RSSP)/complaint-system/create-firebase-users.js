/**
 * create-firebase-users.js
 * Creates all demo GrievEase accounts in Firebase Auth
 * Run with: node create-firebase-users.js
 */

const https = require('https');

const API_KEY = 'AIzaSyBTD_ZrX-SSd6eVNEWfaB98bHWSNKyRP-E';
const SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

// All demo accounts: { email, password, name }
const demoUsers = [
    // ── Admins ──
    { email: 'superadmin@college.edu', password: 'Admin@123', name: 'Dr. Rajesh Kumar' },
    { email: 'academics@college.edu', password: 'Admin@123', name: 'Prof. Anita Sharma' },
    { email: 'hostel@college.edu', password: 'Admin@123', name: 'Mr. Suresh Patel' },
    { email: 'transport@college.edu', password: 'Admin@123', name: 'Ms. Priya Singh' },
    { email: 'infrastructure@college.edu', password: 'Admin@123', name: 'Er. Vikram Nair' },
    // ── Students ──
    { email: 'amit@student.edu', password: 'Student@123', name: 'Amit Verma' },
    { email: 'pooja@student.edu', password: 'Student@123', name: 'Pooja Rao' },
];

function post(url, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const urlObj = new URL(url);
        const opts = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        };
        const req = https.request(opts, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch { resolve({ status: res.statusCode, data: body }); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function updateDisplayName(idToken, displayName) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`;
    await post(url, { idToken, displayName });
}

async function createUser(user) {
    const res = await post(SIGNUP_URL, {
        email: user.email,
        password: user.password,
        returnSecureToken: true
    });

    if (res.status === 200) {
        // Set display name
        await updateDisplayName(res.data.idToken, user.name);
        console.log(`  ✅ Created: ${user.email} (${user.name})`);
        return true;
    } else {
        const errMsg = res.data?.error?.message || 'Unknown error';
        if (errMsg === 'EMAIL_EXISTS') {
            console.log(`  ⚠️  Already exists: ${user.email}`);
        } else {
            console.log(`  ❌ Failed: ${user.email} → ${errMsg}`);
        }
        return false;
    }
}

async function main() {
    console.log('\n🔥 GrievEase – Firebase User Registration');
    console.log('==========================================');
    console.log(`Registering ${demoUsers.length} demo accounts...\n`);

    let created = 0, skipped = 0, failed = 0;
    for (const user of demoUsers) {
        const ok = await createUser(user);
        if (ok) created++;
        else skipped++;
    }

    console.log('\n==========================================');
    console.log(`✅ Created: ${created}  |  ⚠️  Skipped (exist): ${skipped}  |  ❌ Failed: ${failed}`);
    console.log('\n🎉 All accounts are ready in Firebase Auth!');
    console.log('   Users can now log in with Firebase Authentication.\n');
}

main().catch(console.error);
