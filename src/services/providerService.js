
// ==========================================
// ELLITES DIGITAL SERVICES
// DT ONE PROVIDER SERVICE
// ==========================================

const axios = require("axios");
const crypto = require("crypto");

// ==========================================
// DT ONE CONFIGURATION
// ==========================================

const DTONE_BASE_URL =
    process.env.DTONE_BASE_URL ||
    "https://preprod-dvs-api.dtone.com/v1";

const DTONE_API_KEY = process.env.DTONE_API_KEY;
const DTONE_API_SECRET = process.env.DTONE_API_SECRET;

// ==========================================
// AXIOS CLIENT
// ==========================================

const dtone = axios.create({
    baseURL: DTONE_BASE_URL,
    timeout: 30000,
    auth: {
        username: DTONE_API_KEY,
        password: DTONE_API_SECRET
    },
    headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
    }
});

// ==========================================
// HELPERS
// ==========================================

function generateExternalId(prefix = "ELS") {
    return `${prefix}-${Date.now()}-${crypto
        .randomBytes(4)
        .toString("hex")}`.slice(0, 40);
}

function checkConfiguration() {
    if (!DTONE_API_KEY) {
        throw new Error("DTONE_API_KEY is not configured");
    }

    if (!DTONE_API_SECRET) {
        throw new Error("DTONE_API_SECRET is not configured");
    }

    if (!DTONE_BASE_URL) {
        throw new Error("DTONE_BASE_URL is not configured");
    }
}

function handleProviderError(error) {
    console.error("[DT ONE ERROR]", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        correlationId: error.response?.headers?.["x-correlation-id"],
        message: error.message
    });

    return {
        success: false,
        provider: "dtone",
        status: "failed",
        error: error.response?.data || error.message,
        correlationId:
            error.response?.headers?.["x-correlation-id"] || null
    };
}

// ==========================================
// GET SERVICES
// ==========================================

async function getServices() {
    try {
        checkConfiguration();

        const response = await dtone.get("/services");

        return {
            success: true,
            provider: "dtone",
            services: response.data
        };
    } catch (error) {
        return handleProviderError(error);
    }
}

// ==========================================
// GET PRODUCTS
// ==========================================

async function getProducts({
    serviceId,
    subserviceId,
    countryIsoCode,
    operatorId,
    page = 1,
    perPage = 50
} = {}) {
    try {
        checkConfiguration();

        const params = {
            page,
            per_page: perPage
        };

        if (serviceId) {
            params.service_id = serviceId;
        }

        if (subserviceId) {
            params.subservice_id = subserviceId;
        }

        if (countryIsoCode) {
            params.country_iso_code = countryIsoCode;
        }

        if (operatorId) {
            params.operator_id = operatorId;
        }

        const response = await dtone.get("/products", {
            params
        });

        return {
            success: true,
            provider: "dtone",
            products: response.data
        };
    } catch (error) {
        return handleProviderError(error);
    }
}

// ==========================================
// CREATE TRANSACTION
// ==========================================

async function createTransaction({
    productId,
    externalId,
    creditPartyIdentifier,
    source,
    destination,
    calculationMode,
    metadata = {},
    autoConfirm = true,
    callbackUrl
}) {
    try {
        checkConfiguration();

        if (!productId) {
            throw new Error("productId is required");
        }

        const payload = {
            external_id:
                externalId || generateExternalId("ELS"),

            product_id: Number(productId),

            auto_confirm: autoConfirm,

            metadata
        };

        if (creditPartyIdentifier) {
            payload.credit_party_identifier =
                creditPartyIdentifier;
        }

        if (source) {
            payload.source = source;
        }

        if (destination) {
            payload.destination = destination;
        }

        if (calculationMode) {
            payload.calculation_mode = calculationMode;
        }

        if (callbackUrl) {
            payload.callback_url = callbackUrl;
        }

        const response = await dtone.post(
            "/async/transactions",
            payload
        );

        return {
            success: true,
            provider: "dtone",
            status: response.data?.status || "created",
            reference:
                response.data?.id ||
                response.data?.external_id ||
                payload.external_id,
            transaction: response.data
        };
    } catch (error) {
        return handleProviderError(error);
    }
}

// ==========================================
// AIRTIME
// ==========================================

async function buyAirtime({
    phoneNumber,
    productId,
    amount,
    currency = "KES"
}) {
    console.log("[DT ONE] Airtime request");

    if (!phoneNumber) {
        return {
            success: false,
            provider: "dtone",
            service: "airtime",
            message: "phoneNumber is required"
        };
    }

    if (!productId) {
        return {
            success: false,
            provider: "dtone",
            service: "airtime",
            message: "productId is required"
        };
    }

    return createTransaction({
        productId,

        creditPartyIdentifier: {
            account_number: phoneNumber
        },

        source: {
            amount,
            currency
        },

        metadata: {
            service: "airtime",
            phoneNumber
        }
    });
}

// ==========================================
// DATA BUNDLE
// ==========================================

async function buyData({
    phoneNumber,
    productId,
    amount,
    currency = "KES"
}) {
    console.log("[DT ONE] Data bundle request");

    if (!phoneNumber) {
        return {
            success: false,
            provider: "dtone",
            service: "data",
            message: "phoneNumber is required"
        };
    }

    if (!productId) {
        return {
            success: false,
            provider: "dtone",
            service: "data",
            message: "productId is required"
        };
    }

    return createTransaction({
        productId,

        creditPartyIdentifier: {
            account_number: phoneNumber
        },

        source: {
            amount,
            currency
        },

        metadata: {
            service: "data",
            phoneNumber
        }
    });
}

// ==========================================
// ESIM
// ==========================================

async function buyEsim({
    productId,
    amount,
    currency = "KES"
}) {
    console.log("[DT ONE] eSIM request");

    if (!productId) {
        return {
            success: false,
            provider: "dtone",
            service: "esim",
            message: "productId is required"
        };
    }

    return createTransaction({
        productId,

        metadata: {
            service: "esim",
            amount,
            currency
        }
    });
}

// ==========================================
// GIFT CARD
// ==========================================

async function buyGiftCard({
    productId,
    amount,
    currency = "KES"
}) {
    console.log("[DT ONE] Gift card request");

    if (!productId) {
        return {
            success: false,
            provider: "dtone",
            service: "giftcard",
            message: "productId is required"
        };
    }

    return createTransaction({
        productId,

        metadata: {
            service: "giftcard",
            amount,
            currency
        }
    });
}

// ==========================================
// GET TRANSACTION
// ==========================================

async function getTransaction(transactionId) {
    try {
        checkConfiguration();

        const response = await dtone.get(
            `/transactions/${transactionId}`
        );

        return {
            success: true,
            provider: "dtone",
            transaction: response.data
        };
    } catch (error) {
        return handleProviderError(error);
    }
}

// ==========================================
// EXPORT
// ==========================================

module.exports = {
    getServices,
    getProducts,

    createTransaction,

    buyAirtime,
    buyData,
    buyEsim,
    buyGiftCard,

    getTransaction
};
