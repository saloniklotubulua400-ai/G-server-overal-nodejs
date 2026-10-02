const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required",
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    const decoded = jwt.verify(parts[1], process.env.JWT_SECRET);

    // Make sure req.user.uid always exists (payment code reads it)
    req.user = {
      ...decoded,
      uid: decoded.uid || decoded.id || decoded.userId,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Works with: const protect = require(...)
//             const { protect } = require(...)
//             const { authenticate } = require(...)
module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.protect = authenticate;