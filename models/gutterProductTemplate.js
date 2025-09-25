const mongoose = require("mongoose");

const GutterProductTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["gutter", "downspout", "accessory", "guard"],
      required: true,
    },
    profile: { type: String }, // e.g., 'k-style', 'box', 'round'
    size: { type: String }, // e.g., '5"', '6"'
    description: { type: String },
    defaultColor: { type: String, default: "#000000" },
    defaultUnit: { type: String, enum: ["foot", "unit"], default: "foot" },

    // Feature toggles
    canWrapFascia: { type: Boolean, default: false },
    canReplaceFascia: { type: Boolean, default: false },
    canReplace1x2: { type: Boolean, default: false },
    canBeRemoved: { type: Boolean, default: false },
    canBeRepaired: { type: Boolean, default: false },

    // Gutter Guard capability (not guard options themselves)
    supportsGutterGuard: { type: Boolean, default: false },

    // Downspout-specific metadata
    isDownspout: { type: Boolean, default: false },
    hasElbows: { type: Boolean, default: false },
    // add into schema
    slug: { type: String, index: true },
  },
  { timestamps: true }
);

// === Canonicalization helpers (keep near bottom) ===
// === Canonicalization helpers ===
function _norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/×/g, "x")
    .replace(/[“”″]/g, '"') // normalize curly/prime quotes to straight "
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

// robust rectangular size: "2x3", "2 x 3", '2 in x 3 in', etc.
function _parseRectSize(text) {
  const n = _norm(text);
  const m = n.match(
    /(\d+)\s*(?:in\.?|inch(?:es)?)?\s*[x×]\s*(\d+)\s*(?:in\.?|inch(?:es)?)?/
  );
  return m ? `${m[1]}x${m[2]}` : null;
}

// round dia: 3", 4 in, 3-inch, 3″
function _parseRoundDia(text) {
  const m = _norm(text).match(
    /(?:^|\b)(\d+(?:\.\d+)?)\s*(?:["]|in\.?|inch(?:es)?)\b/
  );
  return m ? m[1] : null;
}

// offset inches: accept 2/4/6/etc with " or in/inch/es
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
    if (isOffset && !detail) return; // ← do NOT default; skip if inches unknown
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

// Hook into saves/updates
GutterProductTemplateSchema.pre("save", function (next) {
  normalizeDownspout(this);
  next();
});
GutterProductTemplateSchema.pre("findOneAndUpdate", function (next) {
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

// Keep existing schema as-is...
// Add this index to guarantee uniqueness of each canonical template
GutterProductTemplateSchema.index(
  { slug: 1 },
  { unique: true, sparse: true, background: true }
);

module.exports = mongoose.model(
  "GutterProductTemplate",
  GutterProductTemplateSchema
);
