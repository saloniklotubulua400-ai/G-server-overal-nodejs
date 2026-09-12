const express = require("express");

const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
} = require("../controllers/productController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

// Public product catalogue
router.get("/", getProducts);

router.get("/:id", getProductById);

// Admin operations
router.post("/", authenticate, createProduct);

router.patch("/:id", authenticate, updateProduct);

router.delete("/:id", authenticate, deleteProduct);

module.exports = router;