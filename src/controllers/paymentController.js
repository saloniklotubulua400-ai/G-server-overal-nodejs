
// ==========================================
// ELLITES DIGITAL SERVICES
// PAYD PAYMENT CONTROLLER
// ==========================================
//
// Exports:
//   - initializePayment
//   - verifyPayment
//   - paydWebhook
//
// IMPORTANT:
// Payd endpoint names, authentication format, request fields,
// response fields, and webhook signature format MUST match
// the official Payd API documentation.
//
// Required .env:
//
// PAYD_BASE_URL=YOUR_PAYD_BASE_URL
// PAYD_API_KEY=YOUR_PAYD_API_KEY
// PAYD_RECIPIENT_ID=YOUR_PAYD_RECIPIENT_ID
// PAYD_WEBHOOK_SECRET=YOUR_PAYD_WEBHOOK_SECRET
// PAYD_SIGNATURE_HEADER=x-payd-signature
//
// ==========================================

const axios = require("axios");
const crypto = require("crypto");
const { db } = require("../config/firebase");

// ==========================================
// CONFIGURATION
// ==========================================

const PAYD_BASE_URL = process.env.PAYD_BASE_URL;

const PAYD_API_KEY = process.env.PAYD_API_KEY;

const PAYD_RECIPIENT_ID = process.env.PAYD_RECIPIENT_ID;

const PAYD_WEBHOOK_SECRET = process.env.PAYD_WEBHOOK_SECRET;

const PAYD_SIGNATURE_HEADER =
    process.env.PAYD_SIGNATURE_HEADER || "x-payd-signature";

// ==========================================
// PAYMENT STATUSES
// ==========================================

const SUCCESS_STATUSES = [
    "successful",
    "success",
    "completed",
    "paid"
];

const FAILED_STATUSES = [
    "failed",
    "cancelled",
    "canceled",
    "expired",
    "declined"
];

// ==========================================
// HELPERS
// ==========================================

const now = () => new Date().toISOString();

const fail = (res, status, message) => {
    return res.status(status).json({
        success: false,
        message
    });
};

const logError = (label, error) => {
    console.error(`\n${label}`);

    if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Provider response:", error.response.data);
    } else {
        console.error("Error:", error.message);
    }
};

const isPaydConfigured = () => {
    return Boolean(
        PAYD_BASE_URL &&
        PAYD_API_KEY
    );
};

// ==========================================
// PAYD HEADERS
// ==========================================
//
// IMPORTANT:
// Confirm the authentication format in Payd's
// official API documentation.
//
// Current implementation assumes:
// Authorization: Bearer <API_KEY>
// ==========================================

const getPaydHeaders = () => ({
    Authorization: `Bearer ${PAYD_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json"
});

// ==========================================
// CREATE PAYD CLIENT
// ==========================================

const paydClient = axios.create({
    baseURL: PAYD_BASE_URL,
    timeout: 30000,
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
    }
});

// ==========================================
// GET PAYMENT FROM PAYD
// ==========================================
//
// IMPORTANT:
// Confirm this endpoint in Payd documentation.
//
// Current assumption:
// GET /payments/:providerReference
// ==========================================

const getPaydPayment = async (providerReference) => {
    const response = await paydClient.get(
        `/payments/${encodeURIComponent(providerReference)}`,
        {
            headers: getPaydHeaders()
        }
    );

    return response.data?.data || response.data || {};
};

// ==========================================
// EXTRACT PAYMENT STATUS
// ==========================================

const extractPaymentStatus = (payment) => {
    return String(
        payment?.status ||
        payment?.payment_status ||
        payment?.paymentStatus ||
        ""
    ).toLowerCase();
};

// ==========================================
// CHECK PAYMENT AMOUNT
// ==========================================

const isAmountCorrect = (payment, order) => {
    const providerAmount = Number(payment?.amount);
    const orderAmount = Number(order?.amount);

    if (!Number.isFinite(providerAmount)) {
        return false;
    }

    if (!Number.isFinite(orderAmount)) {
        return false;
    }

    return Math.abs(providerAmount - orderAmount) < 0.01;
};

// ==========================================
// CHECK PAYMENT CURRENCY
// ==========================================

const isCurrencyCorrect = (payment, order) => {
    const providerCurrency = String(
        payment?.currency || ""
    ).toUpperCase();

    const orderCurrency = String(
        order?.currency || "KES"
    ).toUpperCase();

    return providerCurrency === orderCurrency;
};

// ==========================================
// CONFIRM PAYMENT WITH PAYD
// ==========================================
//
// This function:
// 1. Reads the order
// 2. Gets the payment from Payd
// 3. Checks status
// 4. Checks amount
// 5. Checks currency
// 6. Updates Firestore
//
// It is used by both:
// - verifyPayment
// - paydWebhook
//
// ==========================================

const confirmPaymentWithPayd = async (orderRef) => {
    return db.runTransaction(async (transaction) => {

        const orderSnapshot = await transaction.get(orderRef);

        if (!orderSnapshot.exists) {
            return {
                error: "Order not found"
            };
        }

        const order = {
            id: orderSnapshot.id,
            ...orderSnapshot.data()
        };

        // --------------------------------------
        // Already successfully paid
        // --------------------------------------

        if (order.paymentStatus === "successful") {
            return {
                order,
                status: "successful",
                alreadyProcessed: true
            };
        }

        // --------------------------------------
        // Payment must have been initialized
        // --------------------------------------

        if (!order.providerReference) {
            return {
                error: "No Payd payment reference exists for this order"
            };
        }

        // --------------------------------------
        // Ask Payd for the actual payment
        // --------------------------------------

        const payment = await getPaydPayment(
            order.providerReference
        );

        const status = extractPaymentStatus(payment);

        // --------------------------------------
        // Validate amount
        // --------------------------------------

        const amountOk = isAmountCorrect(
            payment,
            order
        );

        // --------------------------------------
        // Validate currency
        // --------------------------------------

        const currencyOk = isCurrencyCorrect(
            payment,
            order
        );

        // --------------------------------------
        // Successful payment
        // --------------------------------------

        if (
            SUCCESS_STATUSES.includes(status) &&
            amountOk &&
            currencyOk
        ) {
            const timestamp = now();

            transaction.update(orderRef, {
                paymentStatus: "successful",
                providerStatus: status,
                paidAt: timestamp,
                updatedAt: timestamp
            });

            return {
                order,
                payment,
                status: "successful"
            };
        }

        // --------------------------------------
        // Failed payment
        // --------------------------------------

        if (FAILED_STATUSES.includes(status)) {
            transaction.update(orderRef, {
                paymentStatus: "failed",
                providerStatus: status,
                updatedAt: now()
            });

            return {
                order,
                payment,
                status: "failed"
            };
        }

        // --------------------------------------
        // Payment still pending
        // --------------------------------------

        transaction.update(orderRef, {
            paymentStatus: "pending",
            providerStatus: status || "unknown",
            updatedAt: now()
        });

        return {
            order,
            payment,
            status: "pending",
            amountOk,
            currencyOk
        };
    });
};

// ==========================================
// 1. INITIALIZE PAYMENT
// ==========================================
//
// POST /api/v1/payments/initialize
//
// Body:
//
// {
//     "orderId": "YOUR_ORDER_ID"
// }
//
// ==========================================

const initializePayment = async (req, res) => {
    try {

        // --------------------------------------
        // Authentication
        // --------------------------------------

        if (!req.user?.uid) {
            return fail(
                res,
                401,
                "Authentication required"
            );
        }

        // --------------------------------------
        // Payd configuration
        // --------------------------------------

        if (!isPaydConfigured()) {
            console.error(
                "Missing PAYD_BASE_URL or PAYD_API_KEY"
            );

            return fail(
                res,
                500,
                "Payment gateway is not configured"
            );
        }

        // --------------------------------------
        // Validate request
        // --------------------------------------

        const { orderId } = req.body;

        if (!orderId) {
            return fail(
                res,
                400,
                "orderId is required"
            );
        }

        // --------------------------------------
        // Get order
        // --------------------------------------

        const orderRef = db
            .collection("orders")
            .doc(orderId);

        const orderSnapshot = await orderRef.get();

        if (!orderSnapshot.exists) {
            return fail(
                res,
                404,
                "Order not found"
            );
        }

        const order = {
            id: orderSnapshot.id,
            ...orderSnapshot.data()
        };

        // --------------------------------------
        // Verify ownership
        // --------------------------------------

        if (order.userId !== req.user.uid) {
            return fail(
                res,
                403,
                "You are not allowed to pay for this order"
            );
        }

        // --------------------------------------
        // Check order status
        // --------------------------------------

        if (order.status === "cancelled") {
            return fail(
                res,
                400,
                "Cancelled orders cannot be paid"
            );
        }

        if (order.status === "completed") {
            return fail(
                res,
                400,
                "Order has already been completed"
            );
        }

        if (order.paymentStatus === "successful") {
            return fail(
                res,
                400,
                "Order has already been paid"
            );
        }

        // --------------------------------------
        // Reuse pending payment
        // --------------------------------------

        if (
            order.paymentStatus === "pending" &&
            order.providerReference &&
            order.paymentLink
        ) {
            return res.status(200).json({
                success: true,
                message: "Existing pending payment returned",
                data: {
                    orderId: order.id,
                    paymentReference:
                        order.paymentReference,
                    provider: "payd",
                    providerReference:
                        order.providerReference,
                    status:
                        order.providerStatus || "pending",
                    paymentLink:
                        order.paymentLink
                }
            });
        }

        // --------------------------------------
        // Validate amount
        // --------------------------------------

        const amount = Number(order.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            return fail(
                res,
                400,
                "Invalid order amount"
            );
        }

        // --------------------------------------
        // Recipient
        // --------------------------------------

        const recipient =
            order.recipient ||
            PAYD_RECIPIENT_ID;

        if (!recipient) {
            return fail(
                res,
                500,
                "Payment recipient is not configured"
            );
        }

        // --------------------------------------
        // Currency
        // --------------------------------------

        const currency = String(
            order.currency || "KES"
        ).toUpperCase();

        // --------------------------------------
        // Generate internal reference
        // --------------------------------------

        const paymentReference =
            `ELS-${order.id}-${crypto.randomUUID()}`;

        // ======================================
        // PAYD REQUEST
        // ======================================
        //
        // IMPORTANT:
        // Confirm these fields against Payd docs.
        // ======================================

        const paymentPayload = {
            amount,
            currency,
            recipient,
            description:
                `Payment for ${
                    order.productName ||
                    "Ellites Digital Services order"
                }`,
            reference: paymentReference,
            metadata: {
                orderId: order.id
            }
        };

        console.log(
            "\n========== PAYD INITIALIZATION =========="
        );

        console.log({
            orderId: order.id,
            amount,
            currency,
            reference: paymentReference
        });

        // --------------------------------------
        // Send request to Payd
        // --------------------------------------

        const response = await paydClient.post(
            "/payments",
            paymentPayload,
            {
                headers: getPaydHeaders()
            }
        );

        // --------------------------------------
        // Read Payd response
        // --------------------------------------

        const paydResponse =
            response.data?.data ||
            response.data ||
            {};

        const providerReference =
            paydResponse.id ||
            paydResponse.payment_id ||
            paydResponse.paymentId ||
            paydResponse.reference ||
            null;

        const providerStatus =
            paydResponse.status ||
            paydResponse.payment_status ||
            paydResponse.paymentStatus ||
            "pending";

        const paymentLink =
            paydResponse.payment_url ||
            paydResponse.paymentUrl ||
            paydResponse.checkout_url ||
            paydResponse.checkoutUrl ||
            paydResponse.url ||
            null;

        // --------------------------------------
        // Provider reference is required
        // --------------------------------------

        if (!providerReference) {

            console.error(
                "Payd returned no provider payment reference."
            );

            console.error(
                "Payd response:",
                response.data
            );

            return fail(
                res,
                502,
                "Payment provider returned an unexpected response"
            );
        }

        // --------------------------------------
        // Save payment information
        // --------------------------------------

        await orderRef.update({

            paymentReference,

            paymentProvider: "payd",

            providerReference,

            providerStatus,

            paymentLink,

            paymentStatus: "pending",

            updatedAt: now()
        });

        // --------------------------------------
        // Response
        // --------------------------------------

        return res.status(200).json({

            success: true,

            message:
                "Payment initialized successfully",

            data: {

                orderId: order.id,

                paymentReference,

                provider: "payd",

                providerReference,

                status: providerStatus,

                paymentLink
            }
        });

    } catch (error) {

        logError(
            "PAYD INITIALIZE ERROR:",
            error
        );

        return fail(
            res,
            502,
            "Unable to initialize payment"
        );
    }
};

// ==========================================
// 2. VERIFY PAYMENT
// ==========================================
//
// GET /api/v1/payments/verify/:orderId
//
// ==========================================

const verifyPayment = async (req, res) => {

    try {

        // --------------------------------------
        // Authentication
        // --------------------------------------

        if (!req.user?.uid) {
            return fail(
                res,
                401,
                "Authentication required"
            );
        }

        // --------------------------------------
        // Configuration
        // --------------------------------------

        if (!isPaydConfigured()) {
            return fail(
                res,
                500,
                "Payment gateway is not configured"
            );
        }

        // --------------------------------------
        // Order ID
        // --------------------------------------

        const { orderId } = req.params;

        if (!orderId) {
            return fail(
                res,
                400,
                "orderId is required"
            );
        }

        // --------------------------------------
        // Get order
        // --------------------------------------

        const orderRef = db
            .collection("orders")
            .doc(orderId);

        const orderSnapshot =
            await orderRef.get();

        if (!orderSnapshot.exists) {
            return fail(
                res,
                404,
                "Order not found"
            );
        }

        const order = orderSnapshot.data();

        // --------------------------------------
        // Ownership
        // --------------------------------------

        if (order.userId !== req.user.uid) {
            return fail(
                res,
                403,
                "You are not allowed to verify this payment"
            );
        }

        // --------------------------------------
        // Verify with Payd
        // --------------------------------------

        const result =
            await confirmPaymentWithPayd(
                orderRef
            );

        if (result.error) {
            return fail(
                res,
                400,
                result.error
            );
        }

        // --------------------------------------
        // Pending
        // --------------------------------------

        if (result.status === "pending") {

            return res.status(200).json({

                success: true,

                message:
                    "Payment is still pending",

                data: {
                    orderId,
                    status: "pending"
                }
            });
        }

        // --------------------------------------
        // Failed
        // --------------------------------------

        if (result.status === "failed") {

            return res.status(400).json({

                success: false,

                message:
                    "Payment verification failed",

                data: {
                    orderId,
                    status: "failed"
                }
            });
        }

        // --------------------------------------
        // Successful
        // --------------------------------------

        return res.status(200).json({

            success: true,

            message:
                "Payment verified successfully",

            data: {

                orderId,

                reference:
                    result.order.paymentReference,

                provider: "payd",

                status: "successful"
            }
        });

    } catch (error) {

        logError(
            "PAYD VERIFY ERROR:",
            error
        );

        return fail(
            res,
            502,
            "Unable to verify payment"
        );
    }
};

// ==========================================
// 3. PAYD WEBHOOK
// ==========================================
//
// POST /api/v1/payments/webhook
//
// IMPORTANT:
// This route MUST receive the raw request body
// before express.json() parses it.
//
// Example:
//
// router.post(
//     "/webhook",
//     express.raw({ type: "application/json" }),
//     paydWebhook
// );
//
// ==========================================

const paydWebhook = async (req, res) => {

    try {

        // --------------------------------------
        // Configuration
        // --------------------------------------

        if (
            !PAYD_WEBHOOK_SECRET ||
            !PAYD_BASE_URL ||
            !PAYD_API_KEY
        ) {

            console.error(
                "Payd webhook configuration is missing"
            );

            return res.sendStatus(500);
        }

        // --------------------------------------
        // Raw request body
        // --------------------------------------

        const rawBody = req.body;

        if (!Buffer.isBuffer(rawBody)) {

            console.error(
                "Payd webhook requires a raw Buffer body"
            );

            return res.sendStatus(400);
        }

        // --------------------------------------
        // Signature
        // --------------------------------------

        const receivedSignature =
            req.headers[
                PAYD_SIGNATURE_HEADER.toLowerCase()
            ];

        if (!receivedSignature) {

            console.error(
                "Payd webhook signature missing"
            );

            return res.sendStatus(401);
        }

        // ======================================
        // SIGNATURE VERIFICATION
        // ======================================
        //
        // IMPORTANT:
        // This assumes:
        // HMAC-SHA256 + hexadecimal output.
        //
        // Confirm with Payd documentation.
        // ======================================

        const expectedSignature =
            crypto
                .createHmac(
                    "sha256",
                    PAYD_WEBHOOK_SECRET
                )
                .update(rawBody)
                .digest("hex");

        const receivedBuffer =
            Buffer.from(
                String(receivedSignature)
            );

        const expectedBuffer =
            Buffer.from(
                expectedSignature
            );

        if (
            receivedBuffer.length !==
            expectedBuffer.length
        ) {
            return res.sendStatus(401);
        }

        if (
            !crypto.timingSafeEqual(
                receivedBuffer,
                expectedBuffer
            )
        ) {
            console.error(
                "Invalid Payd webhook signature"
            );

            return res.sendStatus(401);
        }

        // --------------------------------------
        // Parse webhook
        // --------------------------------------

        let event;

        try {

            event = JSON.parse(
                rawBody.toString("utf8")
            );

        } catch (parseError) {

            console.error(
                "Invalid Payd webhook JSON"
            );

            return res.sendStatus(400);
        }

        const data =
            event?.data ||
            event;

        // --------------------------------------
        // Extract identifiers
        // --------------------------------------

        const providerReference =
            data?.id ||
            data?.payment_id ||
            data?.paymentId;

        const reference =
            data?.reference;

        // --------------------------------------
        // Find order
        // --------------------------------------

        let snapshot = {
            empty: true
        };

        // Search using Payd payment ID
        if (providerReference) {

            snapshot =
                await db
                    .collection("orders")
                    .where(
                        "providerReference",
                        "==",
                        providerReference
                    )
                    .limit(1)
                    .get();
        }

        // Search using our reference
        if (
            snapshot.empty &&
            reference
        ) {

            snapshot =
                await db
                    .collection("orders")
                    .where(
                        "paymentReference",
                        "==",
                        reference
                    )
                    .limit(1)
                    .get();
        }

        // --------------------------------------
        // Unknown payment
        // --------------------------------------
        //
        // Return 200 so Payd does not repeatedly
        // send a webhook for a payment that does
        // not belong to our system.
        // --------------------------------------

        if (snapshot.empty) {

            console.warn(
                "Payd webhook received for unknown payment:",
                {
                    providerReference,
                    reference
                }
            );

            return res.sendStatus(200);
        }

        // --------------------------------------
        // NEVER trust webhook status directly
        // --------------------------------------
        //
        // Ask Payd for the actual payment status.
        // --------------------------------------

        const orderRef =
            snapshot.docs[0].ref;

        await confirmPaymentWithPayd(
            orderRef
        );

        // --------------------------------------
        // Success
        // --------------------------------------

        return res.sendStatus(200);

    } catch (error) {

        logError(
            "PAYD WEBHOOK ERROR:",
            error
        );

        // 500 tells Payd that it should retry.
        return res.sendStatus(500);
    }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {

    initializePayment,

    verifyPayment,

    paydWebhook

};
