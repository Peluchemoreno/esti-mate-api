// routes/billing.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const mongoose = require("mongoose");
const User = require("../models/user");
const { randomUUID } = require("crypto");

const Idem = mongoose.model(
  "IdemRequests",
  new mongoose.Schema(
    {
      _id: String, // request id
      result: Object,
      createdAt: { type: Date, default: Date.now, expires: 3600 }, // 1h TTL
    },
    { versionKey: false }
  )
);

// simple idempotency middleware
async function idempotent(req, res, next) {
  const key = req.header("X-Idempotency-Key");
  if (!key) return next();
  const hit = await Idem.findById(key).lean();
  if (hit) return res.json(hit.result);
  res.locals._idemKey = key;
  const oldJson = res.json.bind(res);
  res.json = async (payload) => {
    if (res.locals._idemKey) {
      await Idem.create({ _id: res.locals._idemKey, result: payload });
    }
    return oldJson(payload);
  };
  next();
}

// POST /api/billing/checkout  { priceId }
router.post("/checkout", idempotent, async (req, res) => {
  const userId = req.user?._id;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { priceId } = req.body;
  if (!priceId) return res.status(400).json({ error: "Missing priceId" });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  // ensure customer
  if (!user.stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { appUserId: String(user._id) },
    });
    user.stripeCustomerId = customer.id;
    await user.save();
  }

  const day = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const idemKey = `checkout:${user._id}:${priceId}:${day}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: user.stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${process.env.FRONTEND_BASE_URL.replace(
        /\/$/,
        ""
      )}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_BASE_URL.replace(
        /\/$/,
        ""
      )}/billing/cancelled`,
      client_reference_id: String(user._id),
      metadata: { appUserId: String(user._id) },
    },
    { idempotencyKey: idemKey }
  );

  return res.json({ url: session.url });
});

// POST /api/billing/portal
router.post("/portal", async (req, res) => {
  const userId = req.user?._id;
  const user = await User.findById(userId);
  if (!user?.stripeCustomerId)
    return res.status(400).json({ error: "No Stripe customer" });

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.FRONTEND_BASE_URL.replace(
      /\/$/,
      ""
    )}/dashboard/products`,
  });
  res.json({ url: session.url });
});

module.exports = router;
