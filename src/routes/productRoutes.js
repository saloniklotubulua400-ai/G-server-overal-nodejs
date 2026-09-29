
const express = require("express");

const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
} = require("../controllers/productController");

const authenticate = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

// ==========================================
// PUBLIC PRODUCT CATALOGUE
// ==========================================

// Get all active products
router.get("/", getProducts);

// Get a single product
router.get("/:id", getProductById);


// ==========================================
// ADMIN PRODUCT OPERATIONS
// ==========================================

// Create product
router.post(
    "/",
    authenticate,
    adminOnly,
    createProduct
);

// Update product
router.patch(
    "/:id",
    authenticate,
    adminOnly,
    updateProduct
);

// Deactivate product
router.delete(
    "/:id",
    authenticate,
    adminOnly,
    deleteProduct
);


// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;