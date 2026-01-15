require("dotenv").config();

const express = require("express");
const logger = require("pino")();
const pinoHttp = require("pino-http")({ logger });
const cors = require("cors");
const os = require("os");
const client = require("prom-client"); 

// Routes imports
const userRoutes = require("./routes/userRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const classRoutes = require("./routes/classRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Collecte des métriques par défaut du runtime (CPU, RAM, Event Loop)
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Création d'une métrique personnalisée pour les requêtes HTTP
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 10] 
});

// Enregistrement de la métrique
register.registerMetric(httpRequestDurationMicroseconds);

// Middleware pour mesurer chaque requête
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    if (req.route) { 
      end({ method: req.method, route: req.route.path, code: res.statusCode });
    }
  });
  next();
});


app.log = logger;
app.use(pinoHttp);

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint pour Prometheus (Scraping)
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

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

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

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

app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, "0.0.0.0", () => {
  logger.info(
    {
      event: "server_start",
      port: PORT,
      instance: os.hostname(),
    },
    "Backend server is up"
  );
});