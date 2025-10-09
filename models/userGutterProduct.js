// models/UserGutterProduct.js
const mongoose = require("mongoose");

const toNumber = (val) => {
  if (val == null) return val;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^\d.-]/g, "");
  if (cleaned === "" || isNaN(cleaned)) throw new Error("Invalid price");
  return parseFloat(cleaned);
};

const UserGutterProductSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GutterProductTemplate",
      index: true,
      default: null,
    },

    name: String,
    price: { type: Number, min: 0, set: toNumber, required: true },
    listed: Boolean,
    description: String,
    colorCode: String,
    color: { type: String, default: null }, // null means "inherit"
    removalPricePerFoot: Number,
    unit: String,

    gutterGuardOptions: [
      {
        name: String,
        price: Number,
        unit: String, // usually 'foot'
      },
    ],

    profile: String,
    type: String,
    size: String,
    isDownspout: Boolean,
    canWrapFascia: Boolean,
    canReplaceFascia: Boolean,
    canBeRemoved: Boolean,
    canBeRepaired: Boolean,
    supportsGutterGuard: Boolean,
    canReplace1x2: Boolean,

    hasElbows: Boolean,
  },
  { timestamps: true }
);

// ❌ REMOVE the plain unique index you had earlier
// UserGutterProductSchema.index({ userId: 1, templateId: 1 }, { unique: true });

// ✅ Strong uniqueness ONLY when templateId is a real ObjectId
UserGutterProductSchema.index(
  { userId: 1, templateId: 1 },
  {
    unique: true,
    partialFilterExpression: { templateId: { $type: "objectId" } },
  }
);

// ===== Canonicalization helpers =====
function _norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/×/g, "x")
    .replace(/[“”″]/g, '"')
    .trim();
}
function _Title(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function _parseMaterial(text) {
  const n = _norm(text);
  if (/\bgalvalume\b|\bgalv[-\s]?alum(?:inum)?\b|\bgalv(?:alum)?\b/.test(n))
    return "galvalume";
  if (/\bcopper\b|(?:^|\s)cu\b/.test(n)) return "copper";
  if (/\baluminum\b|\balum\b|\bal\b/.test(n)) return "aluminum";
  return "aluminum";
}
function _parseRectSize(text) {
  const n = _norm(text);
  const m = n.match(
    /(\d+)\s*(?:in\.?|inch(?:es)?)?\s*[x×]\s*(\d+)\s*(?:in\.?|inch(?:es)?)?/
  );
  return m ? `${m[1]}x${m[2]}` : null;
}
function _parseRoundDia(text) {
  const m = _norm(text).match(
    /(?:^|\b)(\d+(?:\.\d+)?)\s*(?:["]|in\.?|inch(?:es)?)\b/
  );
  return m ? m[1] : null;
}
function _parseOffsetInches(text) {
  const m = _norm(text).match(
    /(?:^|\b)(\d+(?:\.\d+)?)\s*(?:["]|in\.?|inch(?:es)?)\b/
  );
  return m ? m[1] : null;
}
function _parseElbowLetter(text) {
  const n = _norm(text);
  const m =
    n.match(/\b([abc])\b/) ||
    n.match(/elbow\s*([abc])\b/) ||
    n.match(/\b([abc])\s*elbow\b/);
  return m ? m[1].toUpperCase() : null;
}
function _canonicalName(kind, sizeLabel, detail, material) {
  const mat = _Title(material);
  if (kind === "elbow") return `${sizeLabel} ${mat} ${detail} Elbow`;
  return `${sizeLabel} ${mat} ${detail}" Offset`;
}
function _canonicalSlug(kind, sizeSlug, detail, material) {
  return `downspout|${kind}|${sizeSlug}|${String(
    detail
  ).toLowerCase()}|${material}`
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function normalizeDownspout(doc) {
  const base = `${doc.name || ""} ${doc.description || ""}`;
  const n = _norm(base);

  const isElbow = n.includes("elbow") || n.includes("elb");
  const isOffset = n.includes("offset");
  if (!isElbow && !isOffset) return;

  const kind = isOffset ? "offset" : "elbow";
  const material = doc.material || _parseMaterial(base);

  const isRound = n.includes("round");
  const isBox = n.includes("box");
  const isCustom = n.includes("custom");

  let sizeSlug, sizeLabel, detail;

  if (isRound) {
    const dia =
      _parseRoundDia(base) ||
      _parseRoundDia(doc.size || "") ||
      _parseRoundDia(doc.profile || "");
    if (!dia) return;
    sizeSlug = `${dia}in-round`;
    sizeLabel = `${dia}" Round`;
    detail = isOffset
      ? _parseOffsetInches(base)
      : _parseElbowLetter(base) || "A";
    if (isOffset && !detail) return;
  } else if (isBox) {
    sizeSlug = "box";
    sizeLabel = "Box";
    detail = isOffset
      ? _parseOffsetInches(base)
      : _parseElbowLetter(base) || "A";
    if (isOffset && !detail) return;
  } else if (isCustom) {
    const dia = _parseRoundDia(base);
    sizeSlug = dia ? `custom-${dia}in` : "custom";
    sizeLabel = dia ? `Custom ${dia}"` : "Custom";
    detail = isOffset
      ? _parseOffsetInches(base)
      : _parseElbowLetter(base) || "A";
    if (isOffset && !detail) return;
  } else {
    const rect =
      _parseRectSize(base) ||
      _parseRectSize(doc.size || "") ||
      _parseRectSize(doc.profile || "") ||
      (doc.size ? String(doc.size).replace(/\s+/g, "") : null);
    if (!rect) return;
    sizeSlug = rect;
    sizeLabel = rect;
    detail = isOffset
      ? _parseOffsetInches(base)
      : _parseElbowLetter(base) || "A";
    if (isOffset && !detail) return;
  }

  doc.slug = _canonicalSlug(kind, sizeSlug, detail, material);
  doc.name = _canonicalName(kind, sizeLabel, detail, material);
  doc.material = material;
}

UserGutterProductSchema.pre("save", function (next) {
  normalizeDownspout(this);
  next();
});
UserGutterProductSchema.pre("findOneAndUpdate", function (next) {
  const upd = this.getUpdate() || {};
  const scratch = { ...(upd.$set || {}), ...upd };
  normalizeDownspout(scratch);
  if (!upd.$set) upd.$set = {};
  if (scratch.slug) upd.$set.slug = scratch.slug;
  if (scratch.name) upd.$set.name = scratch.name;
  if (scratch.material) upd.$set.material = scratch.material;
  this.setUpdate(upd);
  next();
});
// Strong uniqueness: one canonical piece per user by canonical slug
UserGutterProductSchema.index(
  { userId: 1, slug: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model("UserGutterProduct", UserGutterProductSchema);
