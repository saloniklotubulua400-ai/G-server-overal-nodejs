// ==========================================
// ELLITES DIGITAL SERVICES
// TRANSACTION CONTROLLER
// ==========================================

const crypto = require("crypto");
const { db } = require("../config/firebase");

// ==========================================
// HELPER: GET CURRENT USER
// ==========================================

const getCurrentUser = async (uid) => {
    if (!uid) {
        return null;
    }

    const userDoc = await db
        .collection("users")
        .doc(uid)
        .get();

    if (!userDoc.exists) {
        return null;
    }

    return {
        id: userDoc.id,
        ...userDoc.data()
    };
};

// ==========================================
// CREATE TRANSACTION
// ==========================================

const createTransaction = async (req, res, next) => {
    try {

        // Authentication
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const currentUser = await getCurrentUser(
            req.user.uid
        );

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const {
            orderId,
            amount,
            currency = "KES",
            paymentMethod
        } = req.body;

        // Validate fields
        if (
            !orderId ||
            amount === undefined ||
            amount === null ||
            !paymentMethod
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "orderId, amount and paymentMethod are required"
            });
        }

        const transactionAmount = Number(amount);

        if (
            !Number.isFinite(transactionAmount) ||
            transactionAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Amount must be greater than zero"
            });
        }

        // ==========================================
        // FIND ORDER
        // ==========================================

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

        // ==========================================
        // CHECK ORDER OWNERSHIP
        // ==========================================

        if (
            currentUser.role !== "admin" &&
            order.userId !== req.user.uid
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to create a transaction for this order"
            });
        }

        // ==========================================
        // CHECK ORDER STATUS
        // ==========================================

        if (order.status === "cancelled") {
            return res.status(400).json({
                success: false,
                message:
                    "Cannot create transaction for a cancelled order"
            });
        }

        // ==========================================
        // CHECK AMOUNT
        // ==========================================

        if (transactionAmount !== Number(order.amount)) {
            return res.status(400).json({
                success: false,
                message:
                    "Transaction amount does not match order amount"
            });
        }

        // ==========================================
        // CHECK EXISTING TRANSACTION
        // ==========================================

        const existingSnapshot = await db
            .collection("transactions")
            .where("orderId", "==", orderId)
            .limit(1)
            .get();

        if (!existingSnapshot.empty) {
            return res.status(409).json({
                success: false,
                message:
                    "A transaction already exists for this order",
                data: {
                    transaction:
                        existingSnapshot.docs[0].data()
                }
            });
        }

        // ==========================================
        // CREATE TRANSACTION
        // ==========================================

        const transactionId =
            `TXN-${crypto.randomUUID()}`;

        const now = new Date().toISOString();

        const transaction = {
            id: transactionId,

            userId: req.user.uid,

            customerEmail:
                req.user.email ||
                currentUser.email ||
                null,

            orderId,

            productId:
                order.productId || null,

            productName:
                order.productName || null,

            category:
                order.category || null,

            amount: transactionAmount,

            currency,

            paymentMethod,

            status: "pending",

            paymentReference: null,

            providerReference: null,

            createdAt: now,

            updatedAt: now
        };

        // ==========================================
        // SAVE TRANSACTION
        // ==========================================

        await db
            .collection("transactions")
            .doc(transactionId)
            .set(transaction);

        // ==========================================
        // UPDATE ORDER
        // ==========================================

        await orderRef.update({
            paymentStatus: "pending",
            paymentReference: transactionId,
            updatedAt: now
        });

        return res.status(201).json({
            success: true,
            message: "Transaction created successfully",
            data: transaction
        });

    } catch (error) {

        console.error(
            "CREATE TRANSACTION ERROR:",
            error
        );

        next(error);
    }
};

// ==========================================
// GET TRANSACTIONS
//
// Customer → own transactions
// Admin    → all transactions
// ==========================================

const getTransactions = async (req, res, next) => {
    try {

        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const currentUser = await getCurrentUser(
            req.user.uid
        );

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        let snapshot;

        // ADMIN
        if (currentUser.role === "admin") {

            snapshot = await db
                .collection("transactions")
                .get();

        }

        // CUSTOMER
        else {

            snapshot = await db
                .collection("transactions")
                .where(
                    "userId",
                    "==",
                    req.user.uid
                )
                .get();
        }

        const transactions = snapshot.docs.map(
            doc => doc.data()
        );

        transactions.sort(
            (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        );

        return res.status(200).json({
            success: true,
            count: transactions.length,
            data: transactions
        });

    } catch (error) {

        console.error(
            "GET TRANSACTIONS ERROR:",
            error
        );

        next(error);
    }
};

// ==========================================
// GET TRANSACTION BY ID
// ==========================================

const getTransactionById = async (
    req,
    res,
    next
) => {

    try {

        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const currentUser = await getCurrentUser(
            req.user.uid
        );

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const transactionDoc = await db
            .collection("transactions")
            .doc(req.params.id)
            .get();

        if (!transactionDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        const transaction =
            transactionDoc.data();

        // Customer can only access own transaction
        if (
            currentUser.role !== "admin" &&
            transaction.userId !== req.user.uid
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to access this transaction"
            });
        }

        return res.status(200).json({
            success: true,
            data: transaction
        });

    } catch (error) {

        console.error(
            "GET TRANSACTION ERROR:",
            error
        );

        next(error);
    }
};

// ==========================================
// UPDATE TRANSACTION STATUS
//
// ADMIN ONLY
// ==========================================

const updateTransactionStatus = async (
    req,
    res,
    next
) => {

    try {

        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const currentUser = await getCurrentUser(
            req.user.uid
        );

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (currentUser.role !== "admin") {
            return res.status(403).json({
                success: false,
                message:
                    "Only administrators can update transaction status"
            });
        }

        const {
            status,
            paymentReference,
            providerReference
        } = req.body;

        const allowedStatuses = [
            "pending",
            "processing",
            "successful",
            "failed",
            "refunded"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction status",
                allowedStatuses
            });
        }

        const transactionRef = db
            .collection("transactions")
            .doc(req.params.id);

        const transactionDoc =
            await transactionRef.get();

        if (!transactionDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        const transaction =
            transactionDoc.data();

        const now = new Date().toISOString();

        const updateData = {
            status,
            updatedAt: now
        };

        if (paymentReference !== undefined) {
            updateData.paymentReference =
                paymentReference;
        }

        if (providerReference !== undefined) {
            updateData.providerReference =
                providerReference;
        }

        await transactionRef.update(
            updateData
        );

        // ==========================================
        // UPDATE RELATED ORDER
        // ==========================================

        if (transaction.orderId) {

            const orderRef = db
                .collection("orders")
                .doc(transaction.orderId);

            const orderDoc =
                await orderRef.get();

            if (orderDoc.exists) {

                let paymentStatus = "pending";

                if (status === "successful") {
                    paymentStatus = "successful";
                }

                if (status === "failed") {
                    paymentStatus = "failed";
                }

                if (status === "refunded") {
                    paymentStatus = "refunded";
                }

                await orderRef.update({
                    paymentStatus,
                    paymentReference:
                        paymentReference ||
                        transaction.paymentReference ||
                        null,
                    updatedAt: now
                });
            }
        }

        const updatedDoc =
            await transactionRef.get();

        return res.status(200).json({
            success: true,
            message:
                "Transaction status updated successfully",
            data: updatedDoc.data()
        });

    } catch (error) {

        console.error(
            "UPDATE TRANSACTION ERROR:",
            error
        );

        next(error);
    }
};

// ==========================================
// EXPORT
// ==========================================

module.exports = {
    createTransaction,
    getTransactions,
    getTransactionById,
    updateTransactionStatus
};