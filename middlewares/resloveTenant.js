// middleware/resolveTenant.js

const resolveSubscription = require("../services/subscriptionResolver");

async function resolveTenant(req, res, next) {
  try {
    const user = req.user;

    if (!user) return next();

    req.businessId = user.personalBusinessId || null;

    req.subscription = await resolveSubscription(user);

    next();
  } catch (err) {
    console.error("resolveTenant error:", err);
    next();
  }
}

module.exports = resolveTenant;
