// Load environment variables first, before any other imports
require("dotenv").config();
const pino = require('pino-http')();
const express = require("express");
const cors = require("cors");
const os = require("os");
const userRoutes = require("./routes/userRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const classRoutes = require("./routes/classRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(pino);

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/users", userRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/classes", classRoutes);
app.use("/bookings", bookingRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/auth", authRoutes);

app.get("/whoami", (req, res) => {
  res.json({
    message: "Backend response",
    container: os.hostname(),
    timestamp: new Date(),
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  app.log.info({
    event: "server_start",
    port: PORT,
    node_env: process.env.NODE_ENV,
    instance: os.hostname() 
  }, "Backend server is up");
});