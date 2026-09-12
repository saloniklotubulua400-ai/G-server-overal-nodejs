// ==========================================
// ELLITES DIGITAL SERVICES
// TRANSACTION ROUTES
// ==========================================

const express = require("express");

const {
    createTransaction,
    getTransactions,
    getTransactionById,
    updateTransactionStatus
} = require("../controllers/transactionController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

// ==========================================
// CUSTOMER + ADMIN
// ==========================================

// Create transaction
router.post(
    "/",
    authenticate,
    createTransaction
);

// Get transactions
// Customer → own transactions
// Admin → all transactions
router.get(
    "/",
    authenticate,
    getTransactions
);

// Get transaction by ID
// Customer → own transaction
// Admin → any transaction
router.get(
    "/:id",
    authenticate,
    getTransactionById
);

// ==========================================
// ADMIN
// ==========================================

// Update transaction status
router.patch(
    "/:id/status",
    authenticate,
    updateTransactionStatus
);

module.exports = router;