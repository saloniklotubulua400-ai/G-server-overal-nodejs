// ==========================================
// ELLITES PROVIDER SERVICE
// ==========================================

const providerService = {

    // ======================================
    // AIRTIME
    // ======================================

    async buyAirtime({
        phoneNumber,
        amount,
        currency = "KES"
    }) {

        console.log("[PROVIDER] Airtime request");

        return {
            success: true,
            provider: "mock",
            service: "airtime",
            status: "successful",

            reference: `AIR-${Date.now()}`,

            phoneNumber,
            amount,
            currency,

            message: "Airtime request processed successfully"
        };
    },

    // ======================================
    // DATA BUNDLE
    // ======================================

    async buyData({
        phoneNumber,
        productId,
        amount,
        currency = "KES"
    }) {

        console.log("[PROVIDER] Data request");

        return {
            success: true,
            provider: "mock",
            service: "data",
            status: "successful",

            reference: `DATA-${Date.now()}`,

            phoneNumber,
            productId,
            amount,
            currency,

            message: "Data bundle request processed successfully"
        };
    },

    // ======================================
    // ESIM
    // ======================================

    async buyEsim({
        productId,
        amount,
        currency = "KES"
    }) {

        console.log("[PROVIDER] eSIM request");

        return {
            success: true,
            provider: "mock",
            service: "esim",
            status: "successful",

            reference: `ESIM-${Date.now()}`,

            productId,
            amount,
            currency,

            message: "eSIM request processed successfully"
        };
    },

    // ======================================
    // GIFT CARD
    // ======================================

    async buyGiftCard({
        productId,
        amount,
        currency = "KES"
    }) {

        console.log("[PROVIDER] Gift card request");

        return {
            success: true,
            provider: "mock",
            service: "giftcard",
            status: "successful",

            reference: `GIFT-${Date.now()}`,

            productId,
            amount,
            currency,

            message: "Gift card request processed successfully"
        };
    },

    // ======================================
    // UTILITY
    // ======================================

    async payUtility({
        service,
        accountNumber,
        amount,
        currency = "KES"
    }) {

        console.log("[PROVIDER] Utility request");

        return {
            success: true,
            provider: "mock",
            service: "utilities",
            status: "successful",

            reference: `UTIL-${Date.now()}`,

            utility: service,
            accountNumber,
            amount,
            currency,

            message: "Utility payment processed successfully"
        };
    }

};

module.exports = providerService;