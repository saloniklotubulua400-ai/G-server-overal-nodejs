// ==========================================
// ELLITES DIGITAL SERVICES
// ORDER ROUTES
// ==========================================

const express = require("express");

const {
    createOrder,
    getOrders,
    getOrderById,
    cancelOrder,
    processOrder
} = require("../controllers/orderController");

// Authentication middleware
const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

// ==========================================
// AUTHENTICATED ORDER ROUTES
// ==========================================

// Create order
router.post("/", authenticate, createOrder);

// Get orders
// Customer → own orders
// Admin → all orders
router.get("/", authenticate, getOrders);

// Get single order
router.get("/:id", authenticate, getOrderById);

// Cancel order
router.patch("/:id/cancel", authenticate, cancelOrder);

// Process order
// Controller checks that the user is an admin
router.post("/:id/process", authenticate, processOrder);

module.exports = router;