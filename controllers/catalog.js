const { createUserProductCatalog } = require("../services/productCopyService");

async function syncUserCatalog(req, res, next) {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ message: "Authorization required" });

    const result = await createUserProductCatalog(userId);
    if (!result) {
      // if the copier caught & swallowed an error, surface that fact
      return res
        .status(500)
        .json({ ok: false, message: "Catalog copy failed (null result)" });
    }
    return res.json({ ok: true, result });
  } catch (err) {
    console.error("syncUserCatalog error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { syncUserCatalog };
