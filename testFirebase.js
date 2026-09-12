require("dotenv").config();

const { db } = require("./src/config/firebase");

async function testFirebase() {
    try {
        const testRef = db.collection("system").doc("connection_test");

        await testRef.set({
            application: "Ellites Digital Services",
            status: "connected",
            timestamp: new Date().toISOString()
        });

        const snapshot = await testRef.get();

        console.log("==========================================");
        console.log("FIREBASE CONNECTION SUCCESSFUL");
        console.log("==========================================");
        console.log(snapshot.data());
        console.log("==========================================");

    } catch (error) {
        console.error("==========================================");
        console.error("FIREBASE CONNECTION FAILED");
        console.error("==========================================");
        console.error(error.message);
        console.error("==========================================");
    }
}

testFirebase();
