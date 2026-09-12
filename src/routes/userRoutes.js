const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Users API is ready"
    });
});

router.get("/:id", (req, res) => {
    res.json({
        success: true,
        message: "User endpoint is ready",
        userId: req.params.id
    });
});

module.exports = router;