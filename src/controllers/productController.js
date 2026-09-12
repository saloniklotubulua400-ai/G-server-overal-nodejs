// ==========================================
// ELLITES DIGITAL SERVICES
// PRODUCT CONTROLLER
// ==========================================

const { db } = require("../config/firebase");

// ==========================================
// GET ALL PRODUCTS
// ==========================================

const getProducts = async (req, res, next) => {
    try {
        const snapshot = await db
            .collection("products")
            .where("status", "==", "active")
            .get();

        const products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        products.sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        return res.status(200).json({
            success: true,
            count: products.length,
            data: products
        });

    } catch (error) {
        console.error("GET PRODUCTS ERROR:", error);
        next(error);
    }
};

// ==========================================
// GET PRODUCT BY ID
// ==========================================

const getProductById = async (req, res, next) => {
    try {
        const productDoc = await db
            .collection("products")
            .doc(req.params.id)
            .get();

        if (!productDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const product = {
            id: productDoc.id,
            ...productDoc.data()
        };

        return res.status(200).json({
            success: true,
            data: product
        });

    } catch (error) {
        console.error("GET PRODUCT ERROR:", error);
        next(error);
    }
};

// ==========================================
// ADMIN: CREATE PRODUCT
// ==========================================

const createProduct = async (req, res, next) => {
    try {
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const {
            id,
            name,
            category,
            country,
            currency,
            amount,
            minAmount,
            maxAmount,
            validity,
            status = "active"
        } = req.body;

        if (!id || !name || !category || !country || !currency) {
            return res.status(400).json({
                success: false,
                message:
                    "id, name, category, country and currency are required"
            });
        }

        const productRef = db
            .collection("products")
            .doc(id);

        const existingProduct =
            await productRef.get();

        if (existingProduct.exists) {
            return res.status(409).json({
                success: false,
                message: "Product already exists"
            });
        }

        const product = {
            name,
            category,
            country,
            currency,
            status,
            amount:
                amount !== undefined
                    ? Number(amount)
                    : null,
            minAmount:
                minAmount !== undefined
                    ? Number(minAmount)
                    : null,
            maxAmount:
                maxAmount !== undefined
                    ? Number(maxAmount)
                    : null,
            validity: validity || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await productRef.set(product);

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: {
                id,
                ...product
            }
        });

    } catch (error) {
        console.error("CREATE PRODUCT ERROR:", error);
        next(error);
    }
};

// ==========================================
// ADMIN: UPDATE PRODUCT
// ==========================================

const updateProduct = async (req, res, next) => {
    try {
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const productRef = db
            .collection("products")
            .doc(req.params.id);

        const productDoc =
            await productRef.get();

        if (!productDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const allowedFields = [
            "name",
            "category",
            "country",
            "currency",
            "amount",
            "minAmount",
            "maxAmount",
            "validity",
            "status"
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] =
                    ["amount", "minAmount", "maxAmount"].includes(field)
                        ? Number(req.body[field])
                        : req.body[field];
            }
        }

        updates.updatedAt =
            new Date().toISOString();

        await productRef.update(updates);

        const updatedDoc =
            await productRef.get();

        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: {
                id: updatedDoc.id,
                ...updatedDoc.data()
            }
        });

    } catch (error) {
        console.error("UPDATE PRODUCT ERROR:", error);
        next(error);
    }
};

// ==========================================
// ADMIN: DELETE PRODUCT
// ==========================================

const deleteProduct = async (req, res, next) => {
    try {
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const productRef = db
            .collection("products")
            .doc(req.params.id);

        const productDoc =
            await productRef.get();

        if (!productDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Soft delete instead of permanently deleting
        await productRef.update({
            status: "inactive",
            updatedAt: new Date().toISOString()
        });

        return res.status(200).json({
            success: true,
            message: "Product deactivated successfully"
        });

    } catch (error) {
        console.error("DELETE PRODUCT ERROR:", error);
        next(error);
    }
};

// ==========================================
// EXPORT
// ==========================================

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
};