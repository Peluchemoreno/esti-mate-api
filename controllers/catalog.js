const writeService = require("../services/businessCatalogWriteService");

function getBusinessId(req) {
  return req.businessId || req.user?.personalBusinessId || null;
}

async function createCatalogItem(req, res, next) {
  try {
    const businessId = getBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ error: "Business context required" });
    }

    const doc = await writeService.createCatalogItem({
      businessId,
      payload: req.body,
    });

    return res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function updateCatalogItem(req, res, next) {
  try {
    const businessId = getBusinessId(req);
    const id = req.params.id;

    const doc = await writeService.updateCatalogItem({
      businessId,
      id,
      payload: req.body,
    });

    if (!doc) {
      return res.status(404).json({ error: "Catalog item not found" });
    }

    return res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function deleteCatalogItem(req, res, next) {
  try {
    const businessId = getBusinessId(req);
    const id = req.params.id;

    const doc = await writeService.deleteCatalogItem({
      businessId,
      id,
    });

    if (!doc) {
      return res.status(404).json({ error: "Catalog item not found" });
    }

    return res.json({ message: "deleted", id: doc._id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
};
