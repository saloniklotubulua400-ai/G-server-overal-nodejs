const { db } = require("../config/firebase");

const adminOnly = async (req, res, next) => {
    try {
        // Check authentication
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        // Get current user from Firestore
        const userDoc = await db
            .collection("users")
            .doc(req.user.uid)
            .get();

        if (!userDoc.exists) {
            return res.status(401).json({
                success: false,
                message: "User account not found"
            });
        }

        const user = userDoc.data();

        // Check current role
        if (user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required"
            });
        }

        // Attach role to request
        req.user.role = user.role;

        next();

    } catch (error) {
        console.error("ADMIN MIDDLEWARE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Authorization failed"
        });
    }
};

module.exports = adminOnly;