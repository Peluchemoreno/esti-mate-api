// services/productCopyService.js
const GutterProductTemplate = require("../models/gutterProductTemplate.js");
const UserGutterProduct = require("../models/userGutterProduct.js");

async function createUserProductCatalog(userId) {
  const templates = await GutterProductTemplate.find();

  const userProducts = templates.map((template) => ({
    userId,
    templateId: template._id,
    name: template.name,
    type: template.type,
    profile: template.profile,
    size: template.size,
    description: template.description,
    colorCode: template.defaultColor,
    unit: template.defaultUnit,
    price: 0, // Or custom pricing logic
    listed: template.type === "gutter",
    canWrapFascia: template.canWrapFascia,
    canReplaceFascia: template.canReplaceFascia,
    canBeRepaired: template.canBeRepaired,
    canReplace1x2: template.canReplace1x2,
    canBeRemoved: template.canBeRemoved,
    removalPricePerFoot: template.canBeRemoved ? 2.0 : 0,
    supportsGutterGuard: template.supportsGutterGuard,
    isDownspout: template.isDownspout,
    hasElbows: template.hasElbows,
    gutterGuardOptions: template.supportsGutterGuard
      ? [{ name: "Roll Lock", price: 6.5, unit: "foot" }]
      : [],
  }));

  console.log(userProducts);
  return await UserGutterProduct.insertMany(userProducts);
}

module.exports = { createUserProductCatalog };
