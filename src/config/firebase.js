// ==========================================
// ELLITES DIGITAL SERVICES
// FIREBASE CONFIGURATION
// ==========================================

require("dotenv").config();

const admin = require("firebase-admin");

// ==========================================
// ENVIRONMENT VARIABLES
// ==========================================

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;

// ==========================================
// VALIDATE CONFIGURATION
// ==========================================

if (
    !FIREBASE_PROJECT_ID ||
    !FIREBASE_CLIENT_EMAIL ||
    !FIREBASE_PRIVATE_KEY
) {
    throw new Error(
        "Firebase configuration is incomplete. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env"
    );
}

// ==========================================
// INITIALIZE FIREBASE
// ==========================================

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        })
    });
}

// ==========================================
// FIRESTORE
// ==========================================

const db = admin.firestore();

module.exports = {
    admin,
    db
};