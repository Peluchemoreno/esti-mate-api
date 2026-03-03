// app.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { errors } = require("celebrate");
const { randomUUID } = require("crypto");
const bodyParser = require("body-parser");
const Stripe = require("stripe");
const requireTier = require("./middlewares/requireTier");
const rateLimit = require("express-rate-limit");
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

const app = express();

// after you create `app`

// ---- Discord mirror for Sentry error notifications + rate limiting ----

// In-memory rate limiter: key -> lastSentEpochMs
const sentryDiscordRateLimit = new Map();

// Keep memory bounded: remove old entries periodically
setInterval(() => {
  const now = Date.now();
  const TTL_MS = 10 * 60 * 1000; // keep keys for ~10 minutes
  for (const [key, last] of sentryDiscordRateLimit.entries()) {
    if (now - last > TTL_MS) sentryDiscordRateLimit.delete(key);
  }
}, 60 * 1000).unref?.();

/**
 * Decide whether we should notify Discord for this Sentry event.
 * Returns true if allowed, false if rate-limited.
 */
function shouldNotifyDiscordForSentryEvent(event, cooldownMs = 60_000) {
  // Build a stable-ish fingerprint for "same error happening repeatedly"
  const ex = event?.exception?.values?.[0];
  const exType = ex?.type || "Error";
  const exValue = ex?.value || "(no message)";
  const transaction = event?.transaction || "";
  const reqUrl = event?.request?.url || "";

  // Prefer Sentry's own fingerprint if present
  const fp =
    Array.isArray(event?.fingerprint) && event.fingerprint.length
      ? event.fingerprint.join("|")
      : "";

  const key =
    fp || `${exType}|${exValue}|${transaction}|${reqUrl}`.slice(0, 400);

  const now = Date.now();
  const last = sentryDiscordRateLimit.get(key);

  if (last && now - last < cooldownMs) return false;

  sentryDiscordRateLimit.set(key, now);
  return true;
}

async function notifyDiscordSentry(event) {
  try {
    const url = process.env.DISCORD_WEBHOOK_URL_SENTRY;
    if (!url) return;

    // Try to extract useful info (avoid PII)
    const level = event.level || "error";
    const eventId = event.event_id || null;

    const ex = event.exception?.values?.[0];
    const exType = ex?.type || "Error";
    const exValue = ex?.value || "(no message)";

    const transaction = event.transaction || null;
    const environment = event.environment || process.env.NODE_ENV || null;

    // Tags you might set elsewhere
    const requestId = event.tags?.request_id || null;
    const stripeType = event.tags?.["stripe.event_type"] || null;
    const stripeEventId = event.tags?.["stripe.event_id"] || null;
    const stripeCustomer = event.tags?.["stripe.customer"] || null;
    const stripeSubscription = event.tags?.["stripe.subscription"] || null;

    // Request context (may be missing)
    const reqUrl = event.request?.url || null;
    const method = event.request?.method || null;

    const fields = [
      { name: "level", value: String(level), inline: true },
      { name: "env", value: String(environment || ""), inline: true },
      ...(eventId
        ? [{ name: "sentry_event_id", value: String(eventId), inline: false }]
        : []),
      ...(requestId
        ? [{ name: "request_id", value: String(requestId), inline: false }]
        : []),
      ...(method || reqUrl
        ? [
            {
              name: "request",
              value: `${method || ""} ${reqUrl || ""}`.trim(),
              inline: false,
            },
          ]
        : []),
      ...(transaction
        ? [{ name: "transaction", value: String(transaction), inline: false }]
        : []),
      ...(stripeType
        ? [
            {
              name: "stripe.event_type",
              value: String(stripeType),
              inline: true,
            },
          ]
        : []),
      ...(stripeEventId
        ? [
            {
              name: "stripe.event_id",
              value: String(stripeEventId),
              inline: true,
            },
          ]
        : []),
      ...(stripeCustomer
        ? [
            {
              name: "stripe.customer",
              value: String(stripeCustomer),
              inline: true,
            },
          ]
        : []),
      ...(stripeSubscription
        ? [
            {
              name: "stripe.subscription",
              value: String(stripeSubscription),
              inline: true,
            },
          ]
        : []),
    ].slice(0, 20);

    const payload = {
      username: "Sentry (Esti-Mate)",
      embeds: [
        {
          title: `🚨 ${exType}: ${String(exValue).slice(0, 180)}`,
          timestamp: new Date().toISOString(),
          fields,
        },
      ],
    };

    // fire-and-forget; don't block Sentry
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (err) {
    // never throw from here
    console.error("notifyDiscordSentry failed:", err?.message || err);
  }
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: false,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,

  // Mirror Sentry error events to Discord (rate-limited)
  beforeSend(event) {
    try {
      const level = event?.level || "error";

      // Only alert on error/fatal to avoid noise
      if (level === "error" || level === "fatal") {
        // 1 ping per fingerprint per 60 seconds
        if (shouldNotifyDiscordForSentryEvent(event, 60_000)) {
          notifyDiscordSentry(event);
        }
      }
    } catch (_) {}

    return event; // always let Sentry send the event
  },
});

app.set("trust proxy", 1); // if behind a proxy (e.g. Heroku, Vercel, Cloudflare)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
});

app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.requestId = String(requestId);
  res.setHeader("x-request-id", req.requestId);

  // Sentry scope per request
  try {
    const Sentry = require("@sentry/node");
    Sentry.configureScope((scope) => scope.setTag("request_id", req.requestId));
  } catch (_) {}

  next();
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
      req.body?.length,
    );

    // 1) Verify signature (and report verification failures too)
    try {
      event = stripe.webhooks.constructEvent(
        req.body, // RAW BUFFER
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      // Tag signature failures so you can filter them
      try {
        Sentry.withScope((scope) => {
          scope.setTag("stripe.webhook_stage", "signature_verification");
          scope.setTag("stripe.has_signature_header", String(!!sig));
          scope.captureException(err);
        });
      } catch (_) {}

      console.error("⚠️  Webhook signature verification failed:", err.message);
      return res.status(400).send("Bad signature");
    }

    console.log("[stripe] verified event:", event.type, event.id);

    // 2) Handle event with per-request Sentry scope (tags won't leak)
    return Sentry.withScope(async (scope) => {
      // Core Stripe tags
      scope.setTag("stripe.event_type", event.type);
      scope.setTag("stripe.event_id", event.id);
      scope.setTag("stripe.livemode", String(event.livemode));
      scope.setTag("stripe.webhook_stage", "handler");

      const obj = event.data?.object || {};
      const meta = obj.metadata || {};

      // Safe IDs only (no PII)
      const stripeIds = {
        object: obj.object || null,
        object_id: obj.id || null,
        customer: obj.customer || null,
        subscription: obj.subscription || null,
        invoice: obj.object === "invoice" ? obj.id : null,
        checkout_session: obj.object === "checkout.session" ? obj.id : null,
        payment_intent: obj.payment_intent || null,
      };

      // Add as tags for easy filtering + context for details
      if (stripeIds.customer)
        scope.setTag("stripe.customer", String(stripeIds.customer));
      if (stripeIds.subscription)
        scope.setTag("stripe.subscription", String(stripeIds.subscription));
      if (stripeIds.checkout_session)
        scope.setTag(
          "stripe.checkout_session",
          String(stripeIds.checkout_session),
        );
      if (stripeIds.invoice)
        scope.setTag("stripe.invoice", String(stripeIds.invoice));
      if (stripeIds.payment_intent)
        scope.setTag("stripe.payment_intent", String(stripeIds.payment_intent));

      scope.setContext("stripe_ids", stripeIds);

      // App-level linkage from metadata (you already set metadata.appUserId in checkout) :contentReference[oaicite:2]{index=2}
      if (meta.appUserId) scope.setTag("app.user_id", String(meta.appUserId));

      try {
        // TODO: optional de-dupe using event.id in a small collection

        switch (event.type) {
          case "checkout.session.completed":
            await require("./webhooks/stripeHandlers").onCheckoutCompleted(
              event,
            );
            break;

          case "customer.subscription.created":
          case "customer.subscription.updated":
          case "customer.subscription.deleted":
            await require("./webhooks/stripeHandlers").onSubscriptionChange(
              event,
            );
            break;

          case "invoice.paid":
            await require("./webhooks/stripeHandlers").onInvoicePaid(event);
            break;

          case "invoice.payment_failed":
            await require("./webhooks/stripeHandlers").onPaymentFailed(event);
            break;

          default:
            console.log("Unhandled event:", event.type);
            break;
        }

        return res.sendStatus(200);
      } catch (err) {
        // Capture WITH the tags/context above
        try {
          scope.setTag("stripe_webhook", "handler_error");
          scope.captureException(err);
        } catch (_) {}

        console.error("Webhook handler error:", err);
        return res.sendStatus(500);
      }
    });
  },
);

// ---- CORS (ONE place, no trailing slash) ----
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:9000",
  "https://tryestimate.io", // <- exact match, no slash
  "https://tryestimate.io/",
  "https://api.tryestimate.io",
  "https://app.tryestimate.io",
  "https://www.tryestimate.io",
  "http://192.168.1.191:9000", // local network testing
  "http://192.168.1.109:9000", // local network testing
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
mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGO_DB,
  })
  .then(() => console.log("✅ Mongo connected:", process.env.MONGO_DB))
  .catch((err) => console.error("❌ Mongo connect error:", err));
// ---- Routes ----
const mainRouter = require("./routes/index");
app.use("/", mainRouter);

app.use("/forgot-password", forgotPasswordLimiter);

// after routes, before your error middleware
Sentry.setupExpressErrorHandler(app);

// (optional) celebrate errors if you use celebrate
app.use(errors());

app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  // res.end(res.sentry + "\n");
});

/* class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL" } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
} */

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  // log full error server-side
  console.error(err);

  res.status(status).json({
    error: {
      message: status >= 500 ? "Server error" : err.message || "Request error",
      requestId: req.requestId || null,
    },
  });
});

// ---- Server ----
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
