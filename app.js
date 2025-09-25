// app.js
require("dotenv").config();
console.log(process.env.STRIPE_SECRET_KEY);
console.log(
  "Stripe mode:",
  process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "LIVE" : "TEST",
  "whsec prefix:",
  process.env.STRIPE_WEBHOOK_SECRET?.slice(0, 6)
);

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { errors } = require("celebrate");
const { randomUUID } = require("crypto");
const bodyParser = require("body-parser");
const Stripe = require("stripe");
const requireTier = require("./middlewares/requireTier");

const app = express();
app.set("trust proxy", 1); // if behind a proxy (e.g. Heroku, Vercel, Cloudflare)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

app.post(
  "/webhooks/stripe",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("running endpoint /webhooks/stripe");
    const sig = req.headers["stripe-signature"];
    let event;
    console.log(
      "[stripe] incoming webhook",
      "sig=",
      !!req.headers["stripe-signature"],
      "len=",
      req.body?.length
    );

    try {
      event = stripe.webhooks.constructEvent(
        req.body, // <--- RAW BUFFER
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("⚠️  Webhook signature verification failed:", err.message);
      return res.status(400).send("Bad signature");
    }

    console.log("[stripe] verified event:", event.type, event.id);

    try {
      // TODO: optional de-dupe using event.id in a small collection

      switch (event.type) {
        case "checkout.session.completed":
          // require and call your handler here to link customer to user
          await require("./webhooks/stripeHandlers").onCheckoutCompleted(event);
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await require("./webhooks/stripeHandlers").onSubscriptionChange(
            event
          );
          break;

        case "invoice.paid":
          await require("./webhooks/stripeHandlers").onInvoicePaid(event);
          break;

        case "invoice.payment_failed":
          await require("./webhooks/stripeHandlers").onPaymentFailed(event);
          break;

        default:
          // log and ignore for now
          console.log("Unhandled event:", event.type);
          break;
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("Webhook handler error:", err);
      return res.sendStatus(500);
    }
  }
);

// ---- CORS (ONE place, no trailing slash) ----
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:9000",
  "https://tryestimate.io", // <- exact match, no slash
  "https://api.tryestimate.io",
  "https://app.tryestimate.io",
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

// ---- Logging ----
app.use((req, res, next) => {
  req.reqId = randomUUID();
  // /* console.log(`[req ${req.reqId}] ${req.method} ${req.originalUrl}`); */
  res.on("finish", () => {
    // console.log(`[req ${req.reqId}] -> ${res.statusCode}`);
  });
  next();
});

// ---- DB ----
mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGO_DB,
});

// ---- Routes ----
const mainRouter = require("./routes/index");
app.use("/", mainRouter);

// (optional) celebrate errors if you use celebrate
app.use(errors());

// ---- Server ----
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
