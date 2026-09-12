const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/authMiddleware");

const {
    initializePayment,
    verifyPayment
} = require("../controllers/paymentController");

// ==========================================
// PAYMENT ROUTES
// ==========================================

// Initialize payment
router.post(
    "/initialize",
    authenticate,
    initializePayment
);

// Verify payment
router.get(
    "/verify/:transactionId",
    authenticate,
    verifyPayment
);

module.exports = router;