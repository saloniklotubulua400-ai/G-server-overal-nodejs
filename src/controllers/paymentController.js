// ==========================================
// ELLITES DIGITAL SERVICES
// PAYMENT CONTROLLER
// ==========================================

const axios = require("axios");
const crypto = require("crypto");

const { db } = require("../config/firebase");

// ==========================================
// CREATE FLUTTERWAVE PAYMENT
// ==========================================

const initializePayment = async (req, res, next) => {
    try {
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "orderId is required"
            });
        }

        // --------------------------------------
        // GET ORDER
        // --------------------------------------

        const orderRef = db
            .collection("orders")
            .doc(orderId);

        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const order = orderDoc.data();

        // --------------------------------------
        // SECURITY: ORDER OWNERSHIP
        // --------------------------------------

        if (order.userId !== req.user.uid) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to pay for this order"
            });
        }

        // --------------------------------------
        // ORDER STATUS VALIDATION
        // --------------------------------------

        if (order.status === "cancelled") {
            return res.status(400).json({
                success: false,
                message: "Cancelled orders cannot be paid"
            });
        }

        if (order.status === "completed") {
            return res.status(400).json({
                success: false,
                message: "Order has already been completed"
            });
        }

        if (order.paymentStatus === "successful") {
            return res.status(400).json({
                success: false,
                message: "Order has already been paid"
            });
        }

        // --------------------------------------
        // CREATE UNIQUE PAYMENT REFERENCE
        // --------------------------------------

        const txRef =
            `ELS-${order.id}-${crypto.randomUUID()}`;

        // --------------------------------------
        // FLUTTERWAVE PAYMENT REQUEST
        // --------------------------------------

        const response = await axios.post(
            "https://api.flutterwave.com/v3/payments",
            {
                tx_ref: txRef,

                amount: order.amount,

                currency: order.currency,

                redirect_url:
                    process.env.FLW_REDIRECT_URL,

                customer: {
                    email:
                        order.customerEmail ||
                        req.user.email,

                    phonenumber:
                        order.phoneNumber || undefined
                },

                customizations: {
                    title: "Ellites Digital Services",

                    description:
                        `Payment for ${order.productName}`
                },

                payment_options:
                    order.currency === "KES"
                        ? "card, mpesa"
                        : "card",

                meta: {
                    orderId: order.id,
                    userId: req.user.uid
                }
            },
            {
                headers: {
                    Authorization:
                        `Bearer ${process.env.FLW_SECRET_KEY}`,

                    "Content-Type":
                        "application/json"
                }
            }
        );

        // --------------------------------------
        // SAVE PAYMENT INFORMATION
        // --------------------------------------

        const now =
            new Date().toISOString();

        await orderRef.update({
            paymentReference: txRef,
            paymentStatus: "pending",
            updatedAt: now
        });

        // --------------------------------------
        // RESPONSE
        // --------------------------------------

        return res.status(200).json({
            success: true,
            message: "Payment initialized successfully",
            data: {
                orderId: order.id,
                paymentReference: txRef,
                paymentLink: response.data?.data?.link || null
            }
        });

    } catch (error) {

        console.error(
            "INITIALIZE PAYMENT ERROR:",
            error.response?.data ||
            error.message
        );

        return res.status(502).json({
            success: false,
            message: "Unable to initialize payment",
            error:
                error.response?.data?.message ||
                error.message
        });
    }
};


// ==========================================
// VERIFY FLUTTERWAVE TRANSACTION
// ==========================================

const verifyPayment = async (req, res, next) => {
    try {

        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const { transactionId } = req.params;

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: "transactionId is required"
            });
        }

        // --------------------------------------
        // ASK FLUTTERWAVE FOR TRANSACTION
        // --------------------------------------

        const response = await axios.get(
            `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
            {
                headers: {
                    Authorization:
                        `Bearer ${process.env.FLW_SECRET_KEY}`,

                    "Content-Type":
                        "application/json"
                }
            }
        );

        const payment =
            response.data?.data;

        if (!payment) {
            return res.status(400).json({
                success: false,
                message: "Payment information unavailable"
            });
        }

        // --------------------------------------
        // FIND ORDER USING TX REF
        // --------------------------------------

        const txRef = payment.tx_ref;

        const snapshot = await db
            .collection("orders")
            .where(
                "paymentReference",
                "==",
                txRef
            )
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                message: "Order associated with payment not found"
            });
        }

        const orderDoc =
            snapshot.docs[0];

        const order =
            orderDoc.data();

        // --------------------------------------
        // OWNERSHIP CHECK
        // --------------------------------------

        if (order.userId !== req.user.uid) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to verify this payment"
            });
        }

        // --------------------------------------
        // VERIFY CRITICAL VALUES
        // --------------------------------------

        const amountMatches =
            Number(payment.amount) ===
            Number(order.amount);

        const currencyMatches =
            payment.currency ===
            order.currency;

        const referenceMatches =
            payment.tx_ref ===
            order.paymentReference;

        const successful =
            payment.status === "successful";

        // Flutterwave recommends verifying status,
        // amount, currency and transaction reference
        // before confirming payment.
        if (
            !successful ||
            !amountMatches ||
            !currencyMatches ||
            !referenceMatches
        ) {

            await orderDoc.ref.update({
                paymentStatus: "failed",
                updatedAt:
                    new Date().toISOString()
            });

            return res.status(400).json({
                success: false,
                message: "Payment verification failed",
                data: {
                    status: payment.status,
                    amountMatches,
                    currencyMatches,
                    referenceMatches
                }
            });
        }

        // --------------------------------------
        // PAYMENT SUCCESSFUL
        // --------------------------------------

        await orderDoc.ref.update({
            paymentStatus: "successful",
            paymentReference: order.paymentReference,
            providerReference:
                payment.flw_ref || null,
            updatedAt:
                new Date().toISOString()
        });

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            data: {
                orderId: order.id,
                transactionId: payment.id,
                reference: payment.tx_ref,
                flutterwaveReference:
                    payment.flw_ref || null,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status
            }
        });

    } catch (error) {

        console.error(
            "VERIFY PAYMENT ERROR:",
            error.response?.data ||
            error.message
        );

        return res.status(502).json({
            success: false,
            message: "Unable to verify payment",
            error:
                error.response?.data?.message ||
                error.message
        });
    }
};


// ==========================================
// EXPORT
// ==========================================

module.exports = {
    initializePayment,
    verifyPayment
};