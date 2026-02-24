require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { MongoClient } = require("mongodb");
const servoCommand = require("./servo");
const graphDev = require("./graphs");

const app = express();
const MONGO_PASSWORD = process.env.MONGO_PASSWORD;
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Serve model files
app.use("/model", express.static(path.join(__dirname, "model")));

// MongoDB URI
const uri =
  `mongodb+srv://zyv_db_user:${MONGO_PASSWORD}@classification.ad0cz7h.mongodb.net/?appName=classification`;

const client = new MongoClient(uri);

let collection;

async function connectDB() {
  await client.connect();
  const db = client.db("omnibin");
  collection = db.collection("classifications");
  console.log("Connected to MongoDB");
}

connectDB();

// POST classification
app.post("/classify", async (req, res) => {
  try {
    const { image, prediction, confirmed } = req.body;

    const doc = {
      prediction,
      confirmed,
      timestamp: new Date(),
      image
    };

    await collection.insertOne(doc);

    // Simulate servo command
    servoCommand(prediction);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save classification" });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));