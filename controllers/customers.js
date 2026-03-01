const mongoose = require("mongoose");
const Customer = require("../models/customer");

function createCustomer(req, res, next) {
  const userId = req.user?._id;
  if (!userId)
    return res.status(401).json({ message: "Authorization required" });

  const { type, name, companyName, phone, email } = req.body || {};
  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ message: "name is required" });
  }

  Customer.create({
    userId,
    type: type || undefined,
    name: String(name).trim(),
    companyName: companyName ?? undefined,
    phone: phone ?? undefined,
    email: email ?? undefined,
    integration: {
      provider: req.body?.integration?.provider ?? undefined,
      externalId: req.body?.integration?.externalId ?? undefined,
      syncedAt: req.body?.integration?.syncedAt ?? undefined,
    },
  })
    .then((customer) => res.status(201).json({ customer }))
    .catch(next);
}

function listCustomers(req, res, next) {
  const userId = req.user?._id;
  if (!userId)
    return res.status(401).json({ message: "Authorization required" });

  const q = String(req.query?.query || "").trim();
  const filter = { userId };

  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    filter.$or = [
      { name: rx },
      { companyName: rx },
      { phone: rx },
      { email: rx },
    ];
  }

  Customer.find(filter)
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(25)
    .lean()
    .then((customers) => res.json({ customers }))
    .catch(next);
}

function getCustomerById(req, res, next) {
  const userId = req.user?._id;
  const { id } = req.params;

  if (!userId)
    return res.status(401).json({ message: "Authorization required" });
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ message: "Invalid id" });

  Customer.findOne({ _id: id, userId })
    .lean()
    .then((customer) => {
      if (!customer) return res.status(404).json({ message: "Not found" });
      return res.json({ customer });
    })
    .catch(next);
}

function updateCustomer(req, res, next) {
  const userId = req.user?._id;
  const { id } = req.params;

  if (!userId)
    return res.status(401).json({ message: "Authorization required" });
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ message: "Invalid id" });

  const { type, name, companyName, phone, email } = req.body || {};
  if (name !== undefined && String(name).trim().length === 0) {
    return res.status(400).json({ message: "name cannot be empty" });
  }

  const set = {};
  if (type !== undefined) set.type = type;
  if (name !== undefined) set.name = String(name).trim();
  if (companyName !== undefined) set.companyName = companyName;
  if (phone !== undefined) set.phone = phone;
  if (email !== undefined) set.email = email;

  // allow updating integration fields later without breaking now
  if (req.body?.integration) {
    set["integration.provider"] = req.body.integration.provider ?? null;
    set["integration.externalId"] = req.body.integration.externalId ?? null;
    set["integration.syncedAt"] = req.body.integration.syncedAt ?? null;
  }

  Customer.findOneAndUpdate({ _id: id, userId }, { $set: set }, { new: true })
    .lean()
    .then((customer) => {
      if (!customer) return res.status(404).json({ message: "Not found" });
      return res.json({ customer });
    })
    .catch(next);
}

module.exports = {
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
};
