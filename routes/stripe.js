// routes/stripe.js

const express = require("express");
const router = express.Router();

const Stripe = require("stripe");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const authorize = require("../middlewares/auth"); // your Bearer auth middleware
const User = require("../models/user");

// IMPORTANT: load env ONCE in your entry file (app.js). Not here.
// require("dotenv").config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // sk_*** from env
const FRONTEND_BASE = (
  process.env.FRONTEND_BASE_URL || "http://localhost:9000"
).replace(/\/$/, "");
const JWT_SECRET = require("../utils/config"); // if this exports the secret string directly
// If ../utils/config exports { JWT_SECRET: '...' }, then:
// const { JWT_SECRET } = require("../utils/config");

function signJwt(userId) {
  return jwt.sign({ _id: userId }, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * POST /api/stripe/embedded-session
 * Body: { priceId: 'price_...', quantity?: number }
 * Requires: Authorization: Bearer <jwt>
 */
router.post("/embedded-session", authorize, async (req, res) => {
  console.log("running endpoint /api/stripe/embedded-session");
  try {
    const userId = req.user?._id;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { priceId, quantity = 1 } = req.body;
    if (!priceId) return res.status(400).json({ error: "Missing priceId" });

    // Ensure user exists
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // Validate price is recurring
    const price = await stripe.prices.retrieve(priceId);
    if (!price?.recurring) {
      return res
        .status(400)
        .json({ error: "Price must be recurring for subscription mode" });
    }

    // Create embedded Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      line_items: [{ price: price.id, quantity }],
      // Let Stripe email auto-create or attach a customer for you
      customer_email: user.email,
      allow_promotion_codes: true,
      // Used by your return page to fetch/verify:
      return_url: `${FRONTEND_BASE}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      // Help link back to your user later:
      metadata: { appUserId: String(user._id) },
    });

    return res.json({
      client_secret: session.client_secret, // for EmbeddedCheckoutProvider
      session_id: session.id,
    });
  } catch (err) {
    console.error("Create embedded session failed:", err?.message || err);
    res.status(400).json({ error: err?.message || "Stripe error" });
  }
});

/**
 * GET /api/stripe/session/:id
 * Public endpoint called by your CheckoutReturn page.
 * Returns: { jwt, user, subscription }
 */
router.get("/session/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ["subscription", "customer"],
    });

    if (session.mode !== "subscription") {
      return res.status(400).json({ error: "Not a subscription session" });
    }
    if (session.status !== "complete" && session.payment_status !== "paid") {
      return res.status(400).json({ error: "Checkout not completed" });
    }

    // Find app user
    let user = null;
    const metaUserId = session.metadata?.appUserId;
    if (metaUserId && mongoose.isValidObjectId(metaUserId)) {
      user = await User.findById(metaUserId);
    }
    if (!user && session.customer_details?.email) {
      user = await User.findOne({ email: session.customer_details.email });
    }
    if (!user)
      return res.status(404).json({ error: "App user not found for session" });

    // Persist Stripe linkage on user
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;

    user.stripeCustomerId = customerId || user.stripeCustomerId;
    user.stripeSubscriptionId = subscriptionId || user.stripeSubscriptionId;
    user.subscriptionStatus = "active"; // optional; or use session.subscription.status if expanded
    await user.save();

    // Return a fresh JWT (optional but convenient for stateless redirects)
    const token = signJwt(user._id);

    return res.json({
      jwt: token,
      user: {
        _id: user._id,
        email: user.email,
        subscriptionStatus: user.subscriptionStatus,
      },
      subscription: subscriptionId,
    });
  } catch (e) {
    console.error("Verify session failed:", e.message);
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
