
// ==========================================
// ELLITES DIGITAL SERVICES - SERVER
// ==========================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

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

const PORT = Number(process.env.PORT) || 5000;

const API_VERSION = "v1";

const API_PREFIX = `/api/${API_VERSION}`;

// ==========================================
// SECURITY
// ==========================================

app.use(
    helmet({
        crossOriginResourcePolicy: false
    })
);

// ==========================================
// CORS
// ==========================================

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

// ==========================================
// BODY PARSING
// ==========================================

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);

// ==========================================
// REQUEST LOGGER
// ==========================================

app.use((req, res, next) => {

    const start = Date.now();

    res.on("finish", () => {

        const duration = Date.now() - start;

        console.log(
            `[REQUEST] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
        );
    });

    next();
});

// ==========================================
// ROOT
// ==========================================

app.get("/", (req, res) => {

    res.status(200).json({
        success: true,
        application: "Ellites Digital Services",
        message: "Welcome to Ellites Digital Services API",
        version: "1.0.0",
        apiVersion: API_VERSION,
        status: "online",
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// API INFORMATION
// ==========================================

app.get(API_PREFIX, (req, res) => {

    res.status(200).json({

        success: true,

        application: "Ellites Digital Services",

        version: API_VERSION,

        status: "online",

        timestamp: new Date().toISOString(),

        services: [
            "airtime",
            "data",
            "esim",
            "giftcards",
            "utilities"
        ],

        endpoints: {

            health: `${API_PREFIX}/health`,

            auth: `${API_PREFIX}/auth`,

            users: `${API_PREFIX}/users`,

            products: `${API_PREFIX}/products`,

            orders: `${API_PREFIX}/orders`,

            transactions: `${API_PREFIX}/transactions`,

            payments: `${API_PREFIX}/payments`,

            admin: `${API_PREFIX}/admin`
        }
    });
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get(`${API_PREFIX}/health`, async (req, res) => {

    const health = {

        application: "Ellites Digital Services",

        apiVersion: API_VERSION,

        server: "healthy",

        database: "unknown",

        provider: {

            dtone: {
                configured: Boolean(
                    process.env.DTONE_API_KEY &&
                    process.env.DTONE_API_SECRET &&
                    process.env.DTONE_BASE_URL
                ),

                environment:
                    process.env.DTONE_BASE_URL?.includes("preprod")
                        ? "pre-production"
                        : "production"
            }
        },

        timestamp: new Date().toISOString()
    };

    try {

        await db
            .collection("system")
            .doc("health")
            .set({

                application: "Ellites Digital Services",

                status: "healthy",

                timestamp: new Date().toISOString()
            });

        health.database = "connected";

        res.status(200).json({
            success: true,
            ...health
        });

    } catch (error) {

        console.error(
            "[HEALTH] Firebase check failed:",
            error.message
        );

        health.database = "disconnected";

        res.status(503).json({
            success: false,
            ...health,
            error: error.message
        });
    }
});

// ==========================================
// API ROUTES
// ==========================================

// Authentication
app.use(
    `${API_PREFIX}/auth`,
    authRoutes
);

// Users
app.use(
    `${API_PREFIX}/users`,
    userRoutes
);

// Products
app.use(
    `${API_PREFIX}/products`,
    productRoutes
);

// Orders
app.use(
    `${API_PREFIX}/orders`,
    orderRoutes
);

// Transactions
app.use(
    `${API_PREFIX}/transactions`,
    transactionRoutes
);

// Payments
app.use(
    `${API_PREFIX}/payments`,
    paymentRoutes
);

// Admin
app.use(
    `${API_PREFIX}/admin`,
    adminRoutes
);

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message: "Route not found",

        path: req.originalUrl,

        method: req.method,

        timestamp: new Date().toISOString()
    });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {

    console.error("");
    console.error("==========================================");
    console.error("SERVER ERROR");
    console.error("==========================================");
    console.error(err);
    console.error("==========================================");
    console.error("");

    const statusCode =
        Number(err.statusCode) || 500;

    const response = {

        success: false,

        message:
            statusCode === 500
                ? "Internal server error"
                : err.message,

        timestamp: new Date().toISOString()
    };

    // Only expose stack traces during development
    if (
        process.env.NODE_ENV === "development"
    ) {
        response.error = err.message;
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
});

// ==========================================
// START SERVER
// ==========================================

const server = app.listen(
    PORT,
    () => {

        console.log("");
        console.log("==========================================");
        console.log("       ELLITES DIGITAL SERVICES");
        console.log("==========================================");
        console.log("");

        console.log(
            `Server:      http://localhost:${PORT}`
        );

        console.log(
            `API:         http://localhost:${PORT}${API_PREFIX}`
        );

        console.log(
            `Health:      http://localhost:${PORT}${API_PREFIX}/health`
        );

        console.log("");

        console.log(
            `Auth:        ${API_PREFIX}/auth`
        );

        console.log(
            `Users:       ${API_PREFIX}/users`
        );

        console.log(
            `Products:    ${API_PREFIX}/products`
        );

        console.log(
            `Orders:      ${API_PREFIX}/orders`
        );

        console.log(
            `Transactions:${API_PREFIX}/transactions`
        );

        console.log(
            `Payments:    ${API_PREFIX}/payments`
        );

        console.log(
            `Admin:       ${API_PREFIX}/admin`
        );

        console.log("");

        console.log(
            `Environment: ${process.env.NODE_ENV || "development"}`
        );

        console.log(
            `DT One:      ${
                process.env.DTONE_API_KEY &&
                process.env.DTONE_API_SECRET
                    ? "configured"
                    : "not configured"
            }`
        );

        console.log(
            `DT One URL:  ${
                process.env.DTONE_BASE_URL || "not configured"
            }`
        );

        console.log(
            "Database:    checked through /health"
        );

        console.log(
            "Status:      ONLINE"
        );

        console.log("");

        console.log("==========================================");
        console.log("");
    }
);

// ==========================================
// SERVER ERROR
// ==========================================

server.on("error", (error) => {

    if (error.code === "EADDRINUSE") {

        console.error("");
        console.error(
            `Port ${PORT} is already in use.`
        );
        console.error(
            "Stop the other server or change PORT in .env."
        );
        console.error("");

    } else {

        console.error(
            "Server failed to start:",
            error
        );
    }
});

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

const shutdown = (signal) => {

    console.log("");
    console.log(
        `[SERVER] ${signal} received.`
    );

    console.log(
        "[SERVER] Shutting down..."
    );

    server.close(() => {

        console.log(
            "[SERVER] Ellites server stopped."
        );

        process.exit(0);
    });
};

process.on("SIGINT", () => {
    shutdown("SIGINT");
});

process.on("SIGTERM", () => {
    shutdown("SIGTERM");
});
