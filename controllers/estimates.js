// controllers/estimates.js

const Estimate = require("../models/estimate");
const Counter = require("../models/counter");

// Version B snapshots
const Project = require("../models/project");
let Customer;
try {
  Customer = require("../models/customer");
} catch (e) {
  // If the Customer model isn't added yet, we won't crash the server at require-time.
  // We'll just skip customerSnapshot until Customer exists.
  Customer = null;
}

function estimateOwnershipFilter(req) {
  const userId = req.user._id?.toString();
  const businessId = req.businessId || req.user?.personalBusinessId || null;

  if (businessId) {
    return {
      $or: [{ businessId }, { userId }],
    };
  }

  return { userId };
}

// GET /api/estimates/next  -> next estimate number for this user
exports.getNext = async (req, res, next) => {
  try {
    const userId = req.user._id?.toString();
    const _id = `user:${userId}:est`;

    // IMPORTANT: do NOT increment here — just "peek" the next number
    const doc = await Counter.findOne({ _id }).lean();
    const currentSeq = Number(doc?.seq || 0);

    res.json({ next: currentSeq + 1 });
  } catch (e) {
    next(e);
  }
};

async function nextEstNo(userId) {
  const _id = `user:${userId}:est`;
  const doc = await Counter.findOneAndUpdate(
    { _id },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  return doc.seq;
}

// GET /api/estimates?projectId=...
exports.list = async (req, res, next) => {
  try {
    const userId = req.user._id?.toString();
    const { projectId } = req.query;
    const raw = Number(req.query.limit);
    const limit = Number.isFinite(raw)
      ? Math.max(1, Math.min(100, Math.trunc(raw)))
      : undefined;
    const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

    const filter = estimateOwnershipFilter(req);

    if (projectId) filter.projectId = projectId;
    if (cursor && !isNaN(cursor.getTime())) {
      filter.createdAt = { $lt: cursor };
    }

    const q = Estimate.find(filter)
      .sort({ createdAt: -1 })
      .select(
        "_id estimateNumber estimateDate total projectSnapshot updatedAt createdAt",
      )
      .lean();

    if (limit) q.limit(limit);

    const estimates = await q.exec();

    const nextCursor =
      estimates.length && limit
        ? estimates[estimates.length - 1].createdAt
        : null;

    res.json({ estimates, nextCursor });
  } catch (e) {
    next(e);
  }
};

// GET /api/estimates/:id
exports.getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ownershipFilter = estimateOwnershipFilter(req);

    const est = await Estimate.findOne({
      _id: id,
      ...ownershipFilter,
    }).lean();

    if (!est) {
      return res.status(404).json({ error: "Estimate not found" });
    }

    if (est?.diagram && !Array.isArray(est.diagram.includedPhotoIds)) {
      est.diagram.includedPhotoIds = [];
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
    const businessId = req.businessId || req.user?.personalBusinessId || null;
    const { projectId, diagram, items, estimateDate, notes } = req.body;

    console.warn(
      "[create estimate] incoming includedPhotoIds count =",
      Array.isArray(diagram?.includedPhotoIds)
        ? diagram.includedPhotoIds.length
        : 0,
    );

    if (!projectId || !diagram) {
      return res.status(400).json({ error: "Missing projectId or diagram" });
    }

    const projectOwnershipFilter = businessId
      ? { $or: [{ businessId }, { userId }] }
      : { userId };

    const project = await Project.findOne({
      _id: projectId,
      ...projectOwnershipFilter,
    }).lean();

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const legacyProjectSnapshot = {
      name: project.projectName || "",
      address: project.siteAddress || "",
    };

    const siteSnapshot = {
      projectId: String(project._id),
      projectName: project.projectName || "",
      siteName: project.siteName ?? null,
      siteAddress: project.siteAddress || "",
      sitePrimaryPhone: project.sitePrimaryPhone ?? null,
      siteSecondaryPhone: project.siteSecondaryPhone ?? null,
      siteEmail: project.siteEmail ?? null,
    };

    let customerSnapshot = null;
    if (Customer && project.customerId) {
      const customerOwnershipFilter = businessId
        ? { $or: [{ businessId }, { userId }] }
        : { userId };

      const customer = await Customer.findOne({
        _id: project.customerId,
        ...customerOwnershipFilter,
      }).lean();

      if (customer) {
        customerSnapshot = {
          id: String(customer._id),
          type: customer.type,
          name: customer.name,
          companyName: customer.companyName ?? null,
          phone: customer.phone ?? null,
          email: customer.email ?? null,
          integration: customer.integration
            ? {
                provider: customer.integration.provider ?? null,
                externalId: customer.integration.externalId ?? null,
                syncedAt: customer.integration.syncedAt ?? null,
              }
            : null,
        };
      }
    }

    const nextNum = await nextEstNo(userId);

    const total = (Array.isArray(items) ? items : []).reduce(
      (sum, it) => sum + Number(it.quantity || 0) * Number(it.price || 0),
      0,
    );

    const doc = await Estimate.create({
      userId,
      businessId,
      projectId,

      projectSnapshot: legacyProjectSnapshot,
      customerSnapshot,
      siteSnapshot,

      diagram: {
        imageData: diagram?.imageData || null,
        lines: Array.isArray(diagram?.lines) ? diagram.lines : [],
        includedPhotoIds: Array.isArray(diagram?.includedPhotoIds)
          ? diagram.includedPhotoIds
          : [],
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
    const { id } = req.params;
    const ownershipFilter = estimateOwnershipFilter(req);

    const deleted = await Estimate.findOneAndDelete({
      _id: id,
      ...ownershipFilter,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Estimate not found" });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
