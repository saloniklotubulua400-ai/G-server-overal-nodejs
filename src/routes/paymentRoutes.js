// ==========================================
// ELLITES DIGITAL SERVICES - PAYMENT ROUTES
// Mounted at /api/payments (see server.js)
// ==========================================

const express = require("express");
const router = express.Router();

const {
    initializePayment,
    verifyPayment,
    paydWebhook
} = require("../controllers/paymentController");

// Adjust this path/name to match your auth middleware.
// It must set req.user.uid
const { protect } = require("../middleware/authMiddleware");

// Start a payment for an order
// POST /api/payments/initialize   body: { orderId }
router.post("/initialize", protect, initializePayment);

// Check a payment's status
// GET /api/payments/verify/:orderId
router.get("/verify/:orderId", protect, verifyPayment);

// Payd calls this automatically (no login, protected by signature check)
// POST /api/payments/webhook
// The raw body parser for this path is set in server.js
router.post("/webhook", paydWebhook);

module.exports = router;