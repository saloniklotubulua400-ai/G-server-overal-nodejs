// ==========================================
// ELLITES DIGITAL SERVICES
// PESAPAL PAYMENT SERVICE
// ==========================================

const axios = require("axios");

const PESAPAL_ENVIRONMENT =
    process.env.PESAPAL_ENVIRONMENT || "sandbox";

const PESAPAL_BASE_URL =
    PESAPAL_ENVIRONMENT === "live"
        ? "https://pay.pesapal.com/v3"
        : "https://cybqa.pesapal.com/pesapalv3";

const getAccessToken = async () => {
    try {
        if (
            !process.env.PESAPAL_CONSUMER_KEY ||
            !process.env.PESAPAL_CONSUMER_SECRET
        ) {
            throw new Error(
                "Pesapal credentials are not configured"
            );
        }

        const response = await axios.post(
            `${PESAPAL_BASE_URL}/api/Auth/RequestToken`,
            {
                consumer_key:
                    process.env.PESAPAL_CONSUMER_KEY,

                consumer_secret:
                    process.env.PESAPAL_CONSUMER_SECRET
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                }
            }
        );

        if (!response.data?.token) {
            throw new Error(
                "Pesapal did not return an access token"
            );
        }

        return response.data.token;

    } catch (error) {
        console.error(
            "PESAPAL AUTH ERROR:",
            error.response?.data || error.message
        );

        throw error;
    }
};

const registerIPN = async (token, ipnUrl) => {
    try {
        const response = await axios.post(
            `${PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`,
            {
                url: ipnUrl,
                ipn_notification_type: "GET"
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json"
                }
            }
        );

        return response.data;

    } catch (error) {
        console.error(
            "PESAPAL IPN REGISTRATION ERROR:",
            error.response?.data || error.message
        );

        throw error;
    }
};

const submitOrder = async (token, orderData) => {
    try {
        const response = await axios.post(
            `${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`,
            orderData,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json"
                }
            }
        );

        return response.data;

    } catch (error) {
        console.error(
            "PESAPAL ORDER ERROR:",
            error.response?.data || error.message
        );

        throw error;
    }
};

const getTransactionStatus = async (
    token,
    orderTrackingId
) => {
    try {
        const response = await axios.get(
            `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus`,
            {
                params: {
                    orderTrackingId
                },
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json"
                }
            }
        );

        return response.data;

    } catch (error) {
        console.error(
            "PESAPAL STATUS ERROR:",
            error.response?.data || error.message
        );

        throw error;
    }
};

module.exports = {
    getAccessToken,
    registerIPN,
    submitOrder,
    getTransactionStatus
};