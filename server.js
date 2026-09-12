// ==========================================
// ELLITES DIGITAL SERVICES - SERVER
// ==========================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { db } = require("./src/config/firebase");

// ==========================================
// ROUTES
// ==========================================

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const productRoutes = require("./src/routes/productRoutes");
const orderRoutes = require("./src/routes/orderRoutes");
const transactionRoutes = require("./src/routes/transactionRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const adminRoutes = require("./src/routes/adminRoutes");

// ==========================================
// EXPRESS APP
// ==========================================

const app = express();

const PORT = process.env.PORT || 5000;

// ==========================================
// GLOBAL MIDDLEWARE
// ==========================================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

// ==========================================
// ROOT
// ==========================================

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        application: "Ellites Digital Services",
        message: "Welcome to Ellites Digital Services API",
        version: "1.0.0",
        status: "online"
    });
});

// ==========================================
// API V1 INFORMATION
// ==========================================

app.get("/api/v1", (req, res) => {
    res.status(200).json({
        success: true,
        application: "Ellites Digital Services",
        version: "v1",
        status: "online",

        services: [
            "airtime",
            "data",
            "esim",
            "giftcards",
            "utilities"
        ],

        endpoints: {
            health: "/api/v1/health",
            auth: "/api/v1/auth",
            users: "/api/v1/users",
            products: "/api/v1/products",
            orders: "/api/v1/orders",
            transactions: "/api/v1/transactions",
            payments: "/api/v1/payments",
            admin: "/api/v1/admin"
        }
    });
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/v1/health", async (req, res) => {
    try {
        await db.collection("system").doc("health").set({
            application: "Ellites Digital Services",
            status: "healthy",
            timestamp: new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            application: "Ellites Digital Services",
            apiVersion: "v1",
            status: "healthy",
            database: "connected",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Firebase health check failed:", error.message);

        res.status(503).json({
            success: false,
            application: "Ellites Digital Services",
            apiVersion: "v1",
            status: "unhealthy",
            database: "disconnected",
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ==========================================
// API V1 ROUTES
// ==========================================

// Authentication
app.use(
    "/api/v1/auth",
    authRoutes
);

// Users
app.use(
    "/api/v1/users",
    userRoutes
);

// Products
app.use(
    "/api/v1/products",
    productRoutes
);

// Orders
app.use(
    "/api/v1/orders",
    orderRoutes
);

// Transactions
app.use(
    "/api/v1/transactions",
    transactionRoutes
);

// Payments
app.use(
    "/api/v1/payments",
    paymentRoutes
);

// Admin
app.use(
    "/api/v1/admin",
    adminRoutes
);

// ==========================================
// 404 - ROUTE NOT FOUND
// ==========================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.originalUrl,
        method: req.method
    });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {

    console.error("==========================================");
    console.error("SERVER ERROR");
    console.error("==========================================");
    console.error(err);
    console.error("==========================================");

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal server error"
    });
});

// ==========================================
// START SERVER
// ==========================================

const server = app.listen(PORT, () => {

    console.log("");
    console.log("==========================================");
    console.log("       ELLITES DIGITAL SERVICES");
    console.log("==========================================");
    console.log("");
    console.log(`Server:      http://localhost:${PORT}`);
    console.log(`API:         http://localhost:${PORT}/api/v1`);
    console.log(`Health:      http://localhost:${PORT}/api/v1/health`);
    console.log("");
    console.log(`Auth:        http://localhost:${PORT}/api/v1/auth`);
    console.log(`Users:       http://localhost:${PORT}/api/v1/users`);
    console.log(`Products:    http://localhost:${PORT}/api/v1/products`);
    console.log(`Orders:      http://localhost:${PORT}/api/v1/orders`);
    console.log(`Transactions:http://localhost:${PORT}/api/v1/transactions`);
    console.log(`Payments:    http://localhost:${PORT}/api/v1/payments`);
    console.log(`Admin:       http://localhost:${PORT}/api/v1/admin`);
    console.log("");
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log("Database:    connected");
    console.log("Status:      ONLINE");
    console.log("");
    console.log("==========================================");
    console.log("");
});

// ==========================================
// SERVER ERROR
// ==========================================

server.on("error", (error) => {

    if (error.code === "EADDRINUSE") {

        console.error("");
        console.error(`Port ${PORT} is already in use.`);
        console.error("Stop the other server or change PORT in .env.");
        console.error("");

    } else {

        console.error("Server failed to start:", error);
    }
});

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

process.on("SIGINT", () => {

    console.log("");
    console.log("Shutting down Ellites server...");

    server.close(() => {

        console.log("Ellites server stopped.");
        process.exit(0);

    });
});