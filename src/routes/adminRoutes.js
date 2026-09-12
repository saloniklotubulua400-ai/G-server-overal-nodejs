const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Ellites Admin API is ready"
    });
});

router.get("/dashboard", (req, res) => {
    res.json({
        success: true,
        message: "Admin dashboard endpoint is ready"
    });
});

module.exports = router;