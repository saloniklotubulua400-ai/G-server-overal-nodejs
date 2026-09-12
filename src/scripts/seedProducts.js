// ==========================================
// ELLITES DIGITAL SERVICES
// FIRESTORE PRODUCT SEEDER
// ==========================================

const { db } = require("../config/firebase");

// ==========================================
// PRODUCTS
// ==========================================

const products = [
    {
        id: "AIR-001",
        name: "Kenya Airtime",
        category: "airtime",
        country: "KE",
        currency: "KES",
        minAmount: 10,
        maxAmount: 10000,
        status: "active"
    },

    {
        id: "DATA-001",
        name: "Daily Data Bundle",
        category: "data",
        country: "KE",
        currency: "KES",
        amount: 20,
        validity: "24 hours",
        status: "active"
    },

    {
        id: "DATA-002",
        name: "Weekly Data Bundle",
        category: "data",
        country: "KE",
        currency: "KES",
        amount: 100,
        validity: "7 days",
        status: "active"
    },

    {
        id: "ESIM-001",
        name: "Kenya eSIM",
        category: "esim",
        country: "KE",
        currency: "KES",
        amount: 500,
        validity: "30 days",
        status: "active"
    },

    {
        id: "GIFT-001",
        name: "Digital Gift Card",
        category: "giftcards",
        country: "GLOBAL",
        currency: "USD",
        amount: 10,
        status: "active"
    },

    {
        id: "UTIL-001",
        name: "Electricity Token",
        category: "utilities",
        country: "KE",
        currency: "KES",
        status: "active"
    }
];

// ==========================================
// SEED PRODUCTS
// ==========================================

const seedProducts = async () => {

    try {

        console.log("");
        console.log("==========================================");
        console.log("ELLITES DIGITAL SERVICES");
        console.log("FIRESTORE PRODUCT SEED");
        console.log("==========================================");
        console.log("");

        const batch = db.batch();

        for (const product of products) {

            const productRef = db
                .collection("products")
                .doc(product.id);

            batch.set(
                productRef,
                {
                    ...product,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    merge: true
                }
            );

            console.log(`Preparing: ${product.id} - ${product.name}`);
        }

        await batch.commit();

        console.log("");
        console.log("Products seeded successfully.");
        console.log(`Total products: ${products.length}`);
        console.log("");

        process.exit(0);

    } catch (error) {

        console.error("");
        console.error("PRODUCT SEED ERROR:");
        console.error(error);
        console.error("");

        process.exit(1);
    }
};

seedProducts();