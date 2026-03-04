const Business = require("../models/business");
const Membership = require("../models/membership");
/**
 * Stage 0: Create "personal business" for a user (idempotent).
 * Safe to call multiple times.
 */
async function ensurePersonalBusinessForUser(userDoc) {
  if (!userDoc || !userDoc._id)
    throw new Error("ensurePersonalBusinessForUser: missing user/_id");

  // If already set, ensure membership exists and return.
  if (userDoc.personalBusinessId) {
    await Membership.updateOne(
      { businessId: userDoc.personalBusinessId, userId: userDoc._id },
      { $setOnInsert: { role: "owner", status: "active" } },
      { upsert: true },
    );
    return userDoc.personalBusinessId;
  }

  // Create business
  const bizName = `${
    userDoc.companyName || userDoc.fullName || userDoc.email || "Personal"
  } (Personal)`;
  const biz = await Business.create({
    name: bizName,
    kind: "personal",
    createdByUserId: userDoc._id,
    settings: {},
  });

  // Create membership (unique index prevents duplicates)
  await Membership.updateOne(
    { businessId: biz._id, userId: userDoc._id },
    { $setOnInsert: { role: "owner", status: "active" } },
    { upsert: true },
  );

  // Save personalBusinessId only if still null (concurrent-safe-ish)
  await userDoc.constructor.updateOne(
    { _id: userDoc._id, personalBusinessId: null },
    { $set: { personalBusinessId: biz._id } },
  );

  return biz._id;
}

module.exports = { ensurePersonalBusinessForUser };
