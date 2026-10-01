// ==========================================
// ELLITES DIGITAL SERVICES - PAYD PAYMENT CONTROLLER
// ==========================================
// Exports: initializePayment, verifyPayment, paydWebhook
//
// REQUIRED .env:
//   PAYD_BASE_URL=<exact base URL from Payd docs>
//   PAYD_API_KEY=<your NEW key>
//   PAYD_RECIPIENT_ID=<recipient/account id from Payd>
//   PAYD_WEBHOOK_SECRET=<webhook signing secret from Payd>
//   PAYD_SIGNATURE_HEADER=x-payd-signature   (check Payd docs)
//
// Lines marked "CHECK DOCS" must match Payd's documentation.
// ==========================================

const axios = require("axios");
const crypto = require("crypto");
const { db } = require("../config/firebase");

const PAYD_BASE_URL = process.env.PAYD_BASE_URL; // no guessed default

const paydHeaders = () => ({
    Authorization: `Bearer ${process.env.PAYD_API_KEY}`,
    "Content-Type": "application/json"
});

const isConfigured = () =>
    Boolean(PAYD_BASE_URL && process.env.PAYD_API_KEY);

const SUCCESS_STATUSES = ["successful", "success", "completed", "paid"];
const FAILED_STATUSES = ["failed", "cancelled", "canceled", "expired", "declined"];

const now = () => new Date().toISOString();

const fail = (res, status, message) =>
    res.status(status).json({ success: false, message });

// Log full provider errors on the server, never send them to the client
const logError = (label, error) =>
    console.error(label, error.response?.data || error.message);

// ==========================================
// SHARED: ask Payd for the real payment status
// and update the order. Used by verify + webhook.
// ==========================================

const confirmWithPayd = async (orderRef) => {
    return db.runTransaction(async (t) => {
        const snap = await t.get(orderRef);
        if (!snap.exists) return { error: "Order not found" };

        const order = { id: snap.id, ...snap.data() };

        // Already settled: do nothing (idempotent)
        if (order.paymentStatus === "successful") {
            return { order, status: "successful", alreadyDone: true };
        }

        if (!order.providerReference) {
            return { error: "No payment started for this order" };
        }

        // CHECK DOCS: verification endpoint
        const response = await axios.get(
            `${PAYD_BASE_URL}/payments/${order.providerReference}`,
            { headers: paydHeaders(), timeout: 30000 }
        );

        const payment = response.data?.data || response.data || {};
        const status = String(
            payment.status || payment.payment_status || ""
        ).toLowerCase();

        const amountOk =
            Math.abs(Number(payment.amount) - Number(order.amount)) < 0.01;
        const currencyOk =
            String(payment.currency || "").toUpperCase() ===
            String(order.currency || "KES").toUpperCase();

        if (SUCCESS_STATUSES.includes(status) && amountOk && currencyOk) {
            t.update(orderRef, {
                paymentStatus: "successful",
                providerStatus: status,
                paidAt: now(),
                updatedAt: now()
            });
            return { order, status: "successful", payment };
        }

        const newStatus = FAILED_STATUSES.includes(status)
            ? "failed"
            : "pending";

        t.update(orderRef, {
            paymentStatus: newStatus,
            providerStatus: status || "unknown",
            updatedAt: now()
        });

        return {
            order,
            status: newStatus,
            mismatch: SUCCESS_STATUSES.includes(status) && !(amountOk && currencyOk)
        };
    });
};

// ==========================================
// 1. INITIALIZE PAYMENT
// POST /payments/initialize   body: { orderId }
// ==========================================

const initializePayment = async (req, res) => {
    try {
        if (!req.user?.uid) return fail(res, 401, "Authentication required");

        if (!isConfigured()) {
            console.error("Payd env vars missing (PAYD_BASE_URL / PAYD_API_KEY)");
            return fail(res, 500, "Payment gateway is not configured");
        }

        const { orderId } = req.body;
        if (!orderId) return fail(res, 400, "orderId is required");

        const orderRef = db.collection("orders").doc(orderId);
        const orderDoc = await orderRef.get();
        if (!orderDoc.exists) return fail(res, 404, "Order not found");

        // FIX: Firestore .data() has no id, so add it from the document
        const order = { id: orderDoc.id, ...orderDoc.data() };

        if (order.userId !== req.user.uid) {
            return fail(res, 403, "You are not allowed to pay for this order");
        }
        if (order.status === "cancelled") {
            return fail(res, 400, "Cancelled orders cannot be paid");
        }
        if (order.status === "completed") {
            return fail(res, 400, "Order has already been completed");
        }
        if (order.paymentStatus === "successful") {
            return fail(res, 400, "Order has already been paid");
        }

        // Prevent duplicate payments: reuse an existing pending one
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
                    paymentReference: order.paymentReference,
                    provider: "payd",
                    providerReference: order.providerReference,
                    status: order.providerStatus || "pending",
                    paymentLink: order.paymentLink
                }
            });
        }

        const amount = Number(order.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return fail(res, 400, "Invalid order amount");
        }

        const recipient = order.recipient || process.env.PAYD_RECIPIENT_ID;
        if (!recipient) return fail(res, 500, "Payment recipient is not configured");

        const currency = String(order.currency || "KES").toUpperCase();
        const paymentReference = `ELS-${order.id}-${crypto.randomUUID()}`;

        // CHECK DOCS: field names for reference / metadata
        const paymentData = {
            amount,
            currency,
            recipient,
            description: `Payment for ${order.productName || "Ellites order"}`,
            reference: paymentReference,
            metadata: { orderId: order.id }
        };

        console.log("Initializing Payd payment:", {
            orderId: order.id,
            amount,
            currency,
            reference: paymentReference
        });

        // CHECK DOCS: create-payment endpoint
        const response = await axios.post(
            `${PAYD_BASE_URL}/payments`,
            paymentData,
            { headers: paydHeaders(), timeout: 30000 }
        );

        const payd = response.data?.data || response.data || {};

        const providerReference =
            payd.id || payd.payment_id || payd.reference || null;
        const providerStatus = payd.status || payd.payment_status || "pending";
        const paymentLink =
            payd.payment_url || payd.checkout_url || payd.url || null;

        // Without an id we could never verify this payment later
        if (!providerReference) {
            console.error("Payd response had no payment id:", response.data);
            return fail(res, 502, "Payment provider returned an unexpected response");
        }

        await orderRef.update({
            paymentReference,
            paymentProvider: "payd",
            providerReference,
            providerStatus,
            paymentLink,
            paymentStatus: "pending",
            updatedAt: now()
        });

        return res.status(200).json({
            success: true,
            message: "Payment initialized successfully",
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
        logError("PAYD INITIALIZE ERROR:", error);
        return fail(res, 502, "Unable to initialize payment");
    }
};

// ==========================================
// 2. VERIFY PAYMENT (user-triggered)
// GET /payments/verify/:orderId
// ==========================================

const verifyPayment = async (req, res) => {
    try {
        if (!req.user?.uid) return fail(res, 401, "Authentication required");
        if (!isConfigured()) return fail(res, 500, "Payment gateway is not configured");

        const { orderId } = req.params;
        if (!orderId) return fail(res, 400, "orderId is required");

        const orderRef = db.collection("orders").doc(orderId);
        const orderDoc = await orderRef.get();
        if (!orderDoc.exists) return fail(res, 404, "Order not found");

        if (orderDoc.data().userId !== req.user.uid) {
            return fail(res, 403, "You are not allowed to verify this payment");
        }

        const result = await confirmWithPayd(orderRef);

        if (result.error) return fail(res, 400, result.error);

        if (result.status !== "successful") {
            return res.status(400).json({
                success: false,
                message:
                    result.status === "pending"
                        ? "Payment is still pending"
                        : "Payment verification failed",
                data: { status: result.status }
            });
        }

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            data: {
                orderId: result.order.id,
                reference: result.order.paymentReference,
                provider: "payd",
                status: "successful"
            }
        });
    } catch (error) {
        logError("PAYD VERIFY ERROR:", error);
        return fail(res, 502, "Unable to verify payment");
    }
};

// ==========================================
// 3. WEBHOOK (Payd calls this automatically)
// POST /payments/webhook
//
// IMPORTANT: this route needs the RAW body for
// signature checking. In your router, register it
// BEFORE express.json():
//
//   router.post("/webhook",
//     express.raw({ type: "application/json" }),
//     paydWebhook);
// ==========================================

const paydWebhook = async (req, res) => {
    try {
        const secret = process.env.PAYD_WEBHOOK_SECRET;
        const headerName = (
            process.env.PAYD_SIGNATURE_HEADER || "x-payd-signature"
        ).toLowerCase();

        if (!secret || !isConfigured()) return res.sendStatus(500);

        const rawBody = req.body; // Buffer, thanks to express.raw
        const received = req.headers[headerName];

        if (!Buffer.isBuffer(rawBody) || !received) return res.sendStatus(401);

        // CHECK DOCS: algorithm + format of Payd's signature
        const expected = crypto
            .createHmac("sha256", secret)
            .update(rawBody)
            .digest("hex");

        const a = Buffer.from(String(received));
        const b = Buffer.from(expected);

        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return res.sendStatus(401);
        }

        const event = JSON.parse(rawBody.toString("utf8"));
        const data = event.data || event;

        // Find the order from Payd's payment id or our reference
        const providerRef = data.id || data.payment_id;
        const reference = data.reference;

        let snapshot = { empty: true };

        if (providerRef) {
            snapshot = await db
                .collection("orders")
                .where("providerReference", "==", providerRef)
                .limit(1)
                .get();
        }
        if (snapshot.empty && reference) {
            snapshot = await db
                .collection("orders")
                .where("paymentReference", "==", reference)
                .limit(1)
                .get();
        }

        // Reply 200 so Payd stops retrying for unknown payments
        if (snapshot.empty) return res.sendStatus(200);

        // Never trust the webhook body: re-check with Payd's API
        await confirmWithPayd(snapshot.docs[0].ref);

        return res.sendStatus(200);
    } catch (error) {
        logError("PAYD WEBHOOK ERROR:", error);
        return res.sendStatus(500); // Payd will retry
    }
};

module.exports = { initializePayment, verifyPayment, paydWebhook };