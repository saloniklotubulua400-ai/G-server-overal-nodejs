// ==========================================
// ELLITES DIGITAL SERVICES
// ORDER CONTROLLER
// ==========================================

const { db } = require("../config/firebase");
const providerService = require("../services/providerService");

// ==========================================
// GET CURRENT USER
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
// GET PRODUCT FROM FIRESTORE
// ==========================================

const getProduct = async (productId) => {
    if (!productId) {
        return null;
    }

    const productDoc = await db
        .collection("products")
        .doc(productId)
        .get();

    if (!productDoc.exists) {
        return null;
    }

    return {
        id: productDoc.id,
        ...productDoc.data()
    };
};

// ==========================================
// GENERATE ORDER ID
// ==========================================

const generateOrderId = () => {
    return `ELS-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;
};

// ==========================================
// CREATE ORDER
// ==========================================

const createOrder = async (req, res, next) => {
    try {
        // ------------------------------------------
        // AUTHENTICATION
        // ------------------------------------------

        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        // ------------------------------------------
        // REQUEST DATA
        // ------------------------------------------

        const {
            productId,
            phoneNumber,
            amount,
            currency
        } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "productId is required"
            });
        }

        // ------------------------------------------
        // GET PRODUCT FROM FIRESTORE
        // ------------------------------------------

        const product = await getProduct(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // ------------------------------------------
        // PRODUCT STATUS
        // ------------------------------------------

        if (product.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "Product is currently unavailable"
            });
        }

        // ------------------------------------------
        // AMOUNT
        // ------------------------------------------

        const orderAmount = Number(
            amount ?? product.amount
        );

        if (
            !Number.isFinite(orderAmount) ||
            orderAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            });
        }

        // ------------------------------------------
        // MIN/MAX AMOUNT
        // ------------------------------------------

        if (
            product.minAmount !== undefined &&
            orderAmount < Number(product.minAmount)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Minimum amount is ${product.minAmount}`
            });
        }

        if (
            product.maxAmount !== undefined &&
            orderAmount > Number(product.maxAmount)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Maximum amount is ${product.maxAmount}`
            });
        }

        // ------------------------------------------
        // PHONE NUMBER VALIDATION
        // ------------------------------------------

        const phoneRequiredCategories = [
            "airtime",
            "data"
        ];

        if (
            phoneRequiredCategories.includes(product.category) &&
            !phoneNumber
        ) {
            return res.status(400).json({
                success: false,
                message: "phoneNumber is required"
            });
        }

        // ------------------------------------------
        // CURRENCY
        // ------------------------------------------

        const orderCurrency =
            currency ||
            product.currency ||
            "KES";

        // ------------------------------------------
        // CREATE ORDER
        // ------------------------------------------

        const orderId = generateOrderId();

        const now = new Date().toISOString();

        const order = {
            id: orderId,

            // Customer
            userId: req.user.uid,
            customerEmail: req.user.email || null,

            // Product
            productId: product.id,
            productName: product.name || null,
            category: product.category || null,
            country: product.country || null,

            // Destination
            phoneNumber: phoneNumber || null,

            // Financial
            amount: orderAmount,
            currency: orderCurrency,

            // Order status
            status: "pending",

            // Provider
            provider: product.provider || null,
            providerStatus: "pending",
            providerReference: null,

            // Payment
            paymentStatus: "pending",
            paymentReference: null,

            // Timestamps
            createdAt: now,
            updatedAt: now
        };

        // ------------------------------------------
        // SAVE TO FIRESTORE
        // ------------------------------------------

        await db
            .collection("orders")
            .doc(orderId)
            .set(order);

        // ------------------------------------------
        // RESPONSE
        // ------------------------------------------

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            data: order
        });

    } catch (error) {
        console.error(
            "CREATE ORDER ERROR:",
            error
        );

        next(error);
    }
};

// ==========================================
// GET ORDERS
//
// Customer → own orders
// Admin    → all orders
// ==========================================

const getOrders = async (req, res, next) => {
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

        // ------------------------------------------
        // ADMIN
        // ------------------------------------------

        if (currentUser.role === "admin") {
            snapshot = await db
                .collection("orders")
                .orderBy("createdAt", "desc")
                .get();
        }

        // ------------------------------------------
        // CUSTOMER
        // ------------------------------------------

        else {
            snapshot = await db
                .collection("orders")
                .where(
                    "userId",
                    "==",
                    req.user.uid
                )
                .get();
        }

        const orders = snapshot.docs.map(
            doc => ({
                id: doc.id,
                ...doc.data()
            })
        );

        // Firestore query for customers may not
        // return chronological order.
        if (currentUser.role !== "admin") {
            orders.sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            );
        }

        return res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });

    } catch (error) {
        console.error(
            "GET ORDERS ERROR:",
            error
        );

        next(error);
    }
};

// ==========================================
// GET ORDER BY ID
// ==========================================

const getOrderById = async (req, res, next) => {
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

        const orderDoc = await db
            .collection("orders")
            .doc(req.params.id)
            .get();

        if (!orderDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const order = {
            id: orderDoc.id,
            ...orderDoc.data()
        };

        // ------------------------------------------
        // CUSTOMER OWNERSHIP
        // ------------------------------------------

        if (
            currentUser.role !== "admin" &&
            order.userId !== req.user.uid
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to access this order"
            });
        }

        return res.status(200).json({
            success: true,
            data: order
        });

    } catch (error) {
        console.error(
            "GET ORDER ERROR:",
            error
        );

        next(error);
    }
};

// ==========================================
// PROCESS ORDER
// ADMIN ONLY
// ==========================================

const processOrder = async (req, res, next) => {
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
                    "Only administrators can process orders"
            });
        }

        const orderRef = db
            .collection("orders")
            .doc(req.params.id);

        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const order = {
            id: orderDoc.id,
            ...orderDoc.data()
        };

        // ------------------------------------------
        // ORDER STATUS VALIDATION
        // ------------------------------------------

        if (order.status === "cancelled") {
            return res.status(400).json({
                success: false,
                message:
                    "Cancelled order cannot be processed"
            });
        }

        if (order.status === "completed") {
            return res.status(400).json({
                success: false,
                message:
                    "Order has already been completed"
            });
        }

        if (order.status === "processing") {
            return res.status(400).json({
                success: false,
                message:
                    "Order is already being processed"
            });
        }

        // ------------------------------------------
        // GET PRODUCT
        // ------------------------------------------

        const product = await getProduct(
            order.productId
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message:
                    "Product associated with order not found"
            });
        }

        // ------------------------------------------
        // MARK PROCESSING
        // ------------------------------------------

        const processingTime =
            new Date().toISOString();

        await orderRef.update({
            status: "processing",
            providerStatus: "processing",
            updatedAt: processingTime
        });

        // ------------------------------------------
        // PROVIDER REQUEST
        // ------------------------------------------

        let result;

        switch (product.category) {

            case "airtime":

                result =
                    await providerService.buyAirtime({
                        phoneNumber: order.phoneNumber,
                        amount: order.amount,
                        currency: order.currency
                    });

                break;

            case "data":

                result =
                    await providerService.buyData({
                        phoneNumber: order.phoneNumber,
                        productId: order.productId,
                        amount: order.amount,
                        currency: order.currency
                    });

                break;

            case "esim":

                result =
                    await providerService.buyEsim({
                        productId: order.productId,
                        amount: order.amount,
                        currency: order.currency
                    });

                break;

            case "giftcards":

                result =
                    await providerService.buyGiftCard({
                        productId: order.productId,
                        amount: order.amount,
                        currency: order.currency
                    });

                break;

            case "utilities":

                result =
                    await providerService.payUtility({
                        service: order.productId,
                        accountNumber: order.phoneNumber,
                        amount: order.amount,
                        currency: order.currency
                    });

                break;

            default:

                throw new Error(
                    `Unsupported product category: ${product.category}`
                );
        }

        // ------------------------------------------
        // UPDATE ORDER RESULT
        // ------------------------------------------

        const completedTime =
            new Date().toISOString();

        if (result && result.success) {

            await orderRef.update({
                status: "completed",
                providerStatus: "successful",
                providerReference:
                    result.reference || null,
                updatedAt: completedTime
            });

        } else {

            await orderRef.update({
                status: "failed",
                providerStatus: "failed",
                updatedAt: completedTime
            });
        }

        // ------------------------------------------
        // GET UPDATED ORDER
        // ------------------------------------------

        const updatedOrderDoc =
            await orderRef.get();

        return res.status(200).json({
            success: Boolean(
                result && result.success
            ),
            message:
                result?.message ||
                "Order processing completed",
            data: {
                order: {
                    id: updatedOrderDoc.id,
                    ...updatedOrderDoc.data()
                },
                provider: result || null
            }
        });

    } catch (error) {

        console.error(
            "PROCESS ORDER ERROR:",
            error
        );

        // Try to mark order as failed
        try {
            if (req.params.id) {
                await db
                    .collection("orders")
                    .doc(req.params.id)
                    .update({
                        status: "failed",
                        providerStatus: "failed",
                        updatedAt:
                            new Date().toISOString()
                    });
            }
        } catch (updateError) {
            console.error(
                "FAILED TO UPDATE ORDER:",
                updateError.message
            );
        }

        next(error);
    }
};

// ==========================================
// CANCEL ORDER
//
// Customer → own pending order
// Admin    → any pending order
// ==========================================

const cancelOrder = async (req, res, next) => {
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

        const orderRef = db
            .collection("orders")
            .doc(req.params.id);

        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const order = {
            id: orderDoc.id,
            ...orderDoc.data()
        };

        // ------------------------------------------
        // OWNERSHIP
        // ------------------------------------------

        if (
            currentUser.role !== "admin" &&
            order.userId !== req.user.uid
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to cancel this order"
            });
        }

        // ------------------------------------------
        // STATUS
        // ------------------------------------------

        if (order.status !== "pending") {
            return res.status(400).json({
                success: false,
                message:
                    "Only pending orders can be cancelled"
            });
        }

        // ------------------------------------------
        // CANCEL
        // ------------------------------------------

        const now =
            new Date().toISOString();

        await orderRef.update({
            status: "cancelled",
            updatedAt: now
        });

        const updatedOrderDoc =
            await orderRef.get();

        return res.status(200).json({
            success: true,
            message:
                "Order cancelled successfully",
            data: {
                id: updatedOrderDoc.id,
                ...updatedOrderDoc.data()
            }
        });

    } catch (error) {

        console.error(
            "CANCEL ORDER ERROR:",
            error
        );

        next(error);
    }
};

// ==========================================
// EXPORT CONTROLLERS
// ==========================================

module.exports = {
    createOrder,
    getOrders,
    getOrderById,
    processOrder,
    cancelOrder
};