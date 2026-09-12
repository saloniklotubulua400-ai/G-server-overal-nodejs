const express = require("express");

const router = express.Router();

const {
  register,
  login,
  me,
} = require("../controllers/authController");

const authenticate = require("../middleware/authMiddleware");

// Authentication
router.post("/register", register);
router.post("/login", login);

// Current authenticated user
router.get("/me", authenticate, me);

// API information
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Ellites authentication API",
  });
});

module.exports = router;
