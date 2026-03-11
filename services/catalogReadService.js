const UserGutterProduct = require("../models/userGutterProduct");
const BusinessCatalogItem = require("../models/businessCatalogItem");

async function getLegacyProducts(filter) {
  return UserGutterProduct.find(filter).sort({ name: 1 }).lean();
}

/*
  Future ready — not used yet.

  Later this will merge:
  - legacy user products
  - new BusinessCatalogItem rows

  For now it simply returns legacy rows.
*/
async function getUnifiedCatalog(filter) {
  const legacy = await getLegacyProducts(filter);

  return legacy;
}

module.exports = {
  getUnifiedCatalog,
};
