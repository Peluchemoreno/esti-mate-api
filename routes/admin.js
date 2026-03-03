// routes/admin.js
const router = require("express").Router();
const User = require("../models/user");
const Customer = require("../models/customer");

function requireAdmin(req, res, next) {
  const adminCsv = process.env.ADMIN_EMAILS || "";
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

    // You can add these later once you confirm model names:
    // const projectCount = await Project.countDocuments({ userId: user._id });
    // const estimateCount = await Estimate.countDocuments({ userId: user._id });

    return res.json({
      account: {
        id: String(user._id),
        email: user.email,
        fullName: user.fullName || null,

        subscriptionPlan: user.subscriptionPlan || null,
        subscriptionStatus: user.subscriptionStatus || null,

        stripeCustomerId: user.stripeCustomerId || null,
        stripeSubscriptionId: user.stripeSubscriptionId || null,

        // nested subscription (if present)
        subscription: user.subscription || null,

        createdAt: user.createdAt || null,
        updatedAt: user.updatedAt || null,
      },
      counts: {
        customers: customerCount,
        projects: projectCount,
        estimates: estimateCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
