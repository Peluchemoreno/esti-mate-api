// controllers/estimates.js
const Estimate = require("../models/estimate");
const Counter = require("../models/counter");

// GET /api/estimates/next  -> next estimate number for this user
exports.getNext = async (req, res, next) => {
  try {
    const userId = req.user._id?.toString();
    const count = await Estimate.countDocuments({ userId });
    // Next is count+1; you can later store a counter on user if you want gaps-proof
    res.json({ next: count + 1 });
  } catch (e) {
    next(e);
  }
};

async function nextEstNo(userId) {
  const _id = `user:${userId}:est`;
  const doc = await Counter.findOneAndUpdate(
    { _id },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();
  return doc.seq;
}

// GET /api/estimates?projectId=...
exports.list = async (req, res, next) => {
  try {
    const userId = req.user._id?.toString();
    const { projectId } = req.query;
    const filter = { userId };
    if (projectId) filter.projectId = projectId;

    const estimates = await Estimate.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ estimates });
  } catch (e) {
    next(e);
  }
};

// GET /api/estimates/:id
exports.getOne = async (req, res, next) => {
  try {
    const userId = req.user._id?.toString();
    const { id } = req.params;
    const est = await Estimate.findById(id).lean();
    if (!est || est.userId?.toString() !== userId) {
      return res.status(404).json({ error: "Estimate not found" });
    }
    res.json({ estimate: est });
  } catch (e) {
    next(e);
  }
};

// POST /api/estimates
exports.create = async (req, res, next) => {
  try {
    const userId = req.user._id?.toString();
    const { projectId, projectSnapshot, diagram, items, estimateDate, notes } =
      req.body;
    if (!projectId || !diagram) {
      return res.status(400).json({ error: "Missing projectId or diagram" });
    }

    // server is the source of truth
    const nextNum = await nextEstNo(userId);

    const total = (Array.isArray(items) ? items : []).reduce(
      (sum, it) => sum + Number(it.quantity || 0) * Number(it.price || 0),
      0
    );

    const doc = await Estimate.create({
      userId,
      projectId,
      projectSnapshot: {
        name: projectSnapshot?.name || "",
        address: projectSnapshot?.address || "",
      },
      diagram: {
        imageData: diagram?.imageData || null,
        lines: Array.isArray(diagram?.lines) ? diagram.lines : [],
      },
      items: (Array.isArray(items) ? items : []).map((it) => ({
        name: it.name,
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
      })),
      estimateDate: estimateDate || new Date().toISOString().slice(0, 10),
      estimateNumber: nextNum,
      notes: notes || "",
      total,
    });

    res.status(201).json({ estimate: doc });
  } catch (e) {
    next(e);
  }
};

// DELETE /api/estimates/:id
exports.remove = async (req, res, next) => {
  try {
    const userId = req.user._id?.toString();
    const { id } = req.params;

    const deleted = await Estimate.findOneAndDelete({
      _id: id,
      userId,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Estimate not found" });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
