
// ==========================================
// ELLITES DIGITAL SERVICES
// PAYD PAYMENT SERVICE
// ==========================================

const axios = require("axios");

// ------------------------------------------
// GET PAYD CONFIGURATION
// ------------------------------------------

const getPaydConfig = () => {
    const baseUrl = process.env.PAYD_BASE_URL;
    const apiKey = process.env.PAYD_API_KEY;

    if (!baseUrl) {
        throw new Error("PAYD_BASE_URL is not configured");
    }

    if (!apiKey) {
        throw new Error("PAYD_API_KEY is not configured");
    }

    return {
        baseUrl: baseUrl.replace(/\/+$/, ""),
        apiKey
    };
};

// ------------------------------------------
// CREATE PAYD CLIENT
// ------------------------------------------

const createPaydClient = () => {
    const { baseUrl, apiKey } = getPaydConfig();

    return axios.create({
        baseURL: baseUrl,

        timeout: 30000,

        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",

            // IMPORTANT:
            // This authentication format must match
            // the PAYD API documentation.
            Authorization: `Bearer ${apiKey}`
        }
    });
};

// ------------------------------------------
// INITIALIZE PAYMENT
// ------------------------------------------

const initializePayment = async (paymentData) => {
    try {
        if (!paymentData || typeof paymentData !== "object") {
            throw new Error(
                "Payment data must be an object"
            );
        }

        const client = createPaydClient();

        const response = await client.post(
            "/payments/initialize",
            paymentData
        );

        return response.data;

    } catch (error) {
        console.error(
            "=========================================="
        );

        console.error(
            "PAYD INITIALIZE PAYMENT ERROR"
        );

        console.error(
            "=========================================="
        );

        console.error(
            "Status:",
            error.response?.status || "N/A"
        );

        console.error(
            "Response:",
            error.response?.data || error.message
        );

        throw error;
    }
};

// ------------------------------------------
// VERIFY PAYMENT
// ------------------------------------------

const verifyPayment = async (reference) => {
    try {
        if (!reference) {
            throw new Error(
                "Payment reference is required"
            );
        }

        const client = createPaydClient();

        const response = await client.get(
            `/payments/verify/${encodeURIComponent(reference)}`
        );

        return response.data;

    } catch (error) {
        console.error(
            "=========================================="
        );

        console.error(
            "PAYD VERIFY PAYMENT ERROR"
        );

        console.error(
            "=========================================="
        );

        console.error(
            "Status:",
            error.response?.status || "N/A"
        );

        console.error(
            "Response:",
            error.response?.data || error.message
        );

        throw error;
    }
};

// ------------------------------------------
// GET PAYMENT STATUS
// ------------------------------------------

const getPaymentStatus = async (reference) => {
    try {
        if (!reference) {
            throw new Error(
                "Payment reference is required"
            );
        }

        const client = createPaydClient();

        const response = await client.get(
            `/payments/status/${encodeURIComponent(reference)}`
        );

        return response.data;

    } catch (error) {
        console.error(
            "=========================================="
        );

        console.error(
            "PAYD PAYMENT STATUS ERROR"
        );

        console.error(
            "=========================================="
        );

        console.error(
            "Status:",
            error.response?.status || "N/A"
        );

        console.error(
            "Response:",
            error.response?.data || error.message
        );

        throw error;
    }
};

// ------------------------------------------
// EXPORT
// ------------------------------------------

module.exports = {
    initializePayment,
    verifyPayment,
    getPaymentStatus
};
