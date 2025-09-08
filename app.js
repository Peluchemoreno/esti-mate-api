// app.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");
const { errors } = require("celebrate");

const app = express();

// ---- CORS (ONE place, no trailing slash) ----
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:9000",
  "https://tryestimate.io", // <- exact match, no slash
]);

const corsOptions = {
  origin(origin, cb) {
    // allow server-to-server or same-origin requests without Origin header
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error("CORS: origin not allowed"));
  },
  credentials: true, // set to false if you don't use cookies/auth headers from browser
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use((req, res, next) => {
  // helpful for proxies/caches when Origin varies
  res.setHeader("Vary", "Origin");
  next();
});

app.use(cors(corsOptions));
// clean preflight handling (must be before routes)
app.options("*", cors(corsOptions));

// ---- Body parsing ----
app.use(express.json({ limit: "150mb" }));

// ---- DB ----
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/esti-mate",
  { dbName: process.env.MONGO_DB || "esti-mate" }
);

// ---- Routes ----
const mainRouter = require("./routes/index");
app.use("/", mainRouter);

// (optional) celebrate errors if you use celebrate
app.use(errors());

// ---- Server ----
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
