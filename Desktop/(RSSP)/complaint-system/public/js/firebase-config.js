// ===== FIREBASE CONFIGURATION =====
// GrievEase - Firebase Authentication Setup

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBTD_ZrX-SSd6eVNEWfaB98bHWSNKyRP-E",
    authDomain: "fir-demo-90f79.firebaseapp.com",
    projectId: "fir-demo-90f79",
    storageBucket: "fir-demo-90f79.firebasestorage.app",
    messagingSenderId: "388352631458",
    appId: "1:388352631458:web:400a5769ade1fcf3f4edfb",
    measurementId: "G-3L2N1Z95NY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
