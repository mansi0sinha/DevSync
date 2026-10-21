
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the DevSync API!",
    status: "running",
  });
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "DevSync server is healthy",
  });
});

// Connect to MongoDB, then start the server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`DevSync API running at http://localhost:${PORT}`);
  });
});
