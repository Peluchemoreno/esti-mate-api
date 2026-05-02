// routes/admin.js
const router = require("express").Router();
const User = require("../models/user");
const Customer = require("../models/customer");
const Project = require("../models/project");
const Estimate = require("../models/estimate");

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function requireAdmin(req, res, next) {
  const adminCsv = process.env.ADMIN_EMAILS || "jmcdmoreno19@aol.com";
  const allowed = new Set(
    adminCsv
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  const callerEmail = String(req.user?.email || "").toLowerCase();
  if (!callerEmail) return res.status(401).json({ error: "Unauthorized" });
  if (!allowed.has(callerEmail))
    return res.status(403).json({ error: "Forbidden" });

  next();
}

// GET /api/admin/account-state?email=someone@example.com
// GET /api/admin/account-state?email=someone@example.com
router.get("/account-state", requireAdmin, async (req, res, next) => {
  try {
    const email = String(req.query.email || "")
      .trim()
      .toLowerCase();
    if (!email) return res.status(400).json({ error: "Missing email" });

    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // Counts you can safely support right now (based on uploaded models)
    const customerCount = await Customer.countDocuments({ userId: user._id });
    const projectCount = await Project.countDocuments({ userId: user._id });
    const estimateCount = await Estimate.countDocuments({ userId: user._id });

    // ---- Stripe live subscription details (no user.subscription subobject needed) ----
    let stripeSub = null;
    let cancelIntent = {
      willCancelAtPeriodEnd: false,
      cancelAt: null,
      currentPeriodEnd: null,
      status: null,
      priceId: null,
      productId: null,
    };

    if (user.stripeSubscriptionId) {
      try {
        stripeSub = await stripe.subscriptions.retrieve(
          user.stripeSubscriptionId,
          {
            expand: ["items.data.price"],
          },
        );

        const item = stripeSub.items?.data?.[0];
        const price = item?.price;

        cancelIntent = {
          willCancelAtPeriodEnd: !!stripeSub.cancel_at_period_end,
          cancelAt: stripeSub.cancel_at
            ? new Date(stripeSub.cancel_at * 1000)
            : null,
          currentPeriodEnd: stripeSub.current_period_end
            ? new Date(stripeSub.current_period_end * 1000)
            : null,
          status: stripeSub.status || null,
          priceId: price?.id || null,
          productId: price?.product || null,
        };
      } catch (e) {
        // Don't fail the endpoint if Stripe is temporarily down
        cancelIntent = {
          ...cancelIntent,
          status: "unknown",
        };
      }
    }

    return res.json({
      account: {
        id: String(user._id),
        email: user.email,
        fullName: user.fullName || null,

        subscriptionPlan: user.subscriptionPlan || null,
        subscriptionStatus: user.subscriptionStatus || null,

        stripeCustomerId: user.stripeCustomerId || null,
        stripeSubscriptionId: user.stripeSubscriptionId || null,

        createdAt: user.createdAt || null,
        updatedAt: user.updatedAt || null,
      },
      summary: {
        hasStripeCustomer: Boolean(user.stripeCustomerId),
        hasSubscription: Boolean(user.stripeSubscriptionId),
        subscriptionStatus: user.subscriptionPlan
          ? user.subscriptionStatus || "unknown"
          : "none",

        // NEW: cancellation intent + Stripe truth
        willCancelAtPeriodEnd: cancelIntent.willCancelAtPeriodEnd,
        cancelAt: cancelIntent.cancelAt,
        currentPeriodEnd: cancelIntent.currentPeriodEnd,
        stripeStatus: cancelIntent.status,
        stripePriceId: cancelIntent.priceId,
        stripeProductId: cancelIntent.productId,
      },
      counts: {
        customers: customerCount,
        projects: projectCount,
        estimates: estimateCount,
      },
      onboarding: {
        activeFlow: user.onboarding?.activeFlow || "gutter_first_estimate",
        completedStepIds: user.onboarding?.completedStepIds || [],
        completedEventNames: user.onboarding?.completedEventNames || [],
        skippedStepIds: user.onboarding?.skippedStepIds || [],
        dismissedFlowIds: user.onboarding?.dismissedFlowIds || [],
        firstWinCompletedAt: user.onboarding?.firstWinCompletedAt || null,
        lastEventName: user.onboarding?.lastEventName || null,
        lastEventAt: user.onboarding?.lastEventAt || null,
        updatedAt: user.onboarding?.updatedAt || null,
        totalSteps: 4,
        completedStepsCount: Array.isArray(user.onboarding?.completedStepIds)
          ? user.onboarding.completedStepIds.length
          : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/stripe-customers?limit=25&starting_after=cus_...
router.get("/stripe-customers", requireAdmin, async (req, res, next) => {
  try {
    const limitRaw = Number(req.query.limit || 25);
    const limit = Math.max(1, Math.min(limitRaw, 100)); // Stripe max is 100
    const starting_after = req.query.starting_after
      ? String(req.query.starting_after)
      : undefined;

    const list = await stripe.customers.list({
      limit,
      ...(starting_after ? { starting_after } : {}),
    });

    const customers = list.data || [];
    const last = customers[customers.length - 1];

    return res.json({
      customers: customers.map((c) => ({
        id: c.id,
        email: c.email || null,
        name: c.name || null,
        created: c.created ? new Date(c.created * 1000) : null,
        delinquent: !!c.delinquent,
        livemode: !!c.livemode,
      })),
      page: {
        has_more: !!list.has_more,
        next_starting_after: last?.id || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
