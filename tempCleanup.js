// scripts/cleanup-stray-products.js
const mongoose = require("mongoose");
const UserGutterProduct = require("./models/userGutterProduct");
const GutterProductTemplate = require("./models/gutterProductTemplate");

/* (async () => {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/",
    {
      dbName: process.env.MONGO_DB || "esti-mate",
    }
  );

  // 1) Remove any user products that have the bad name "5\" K-Style"
  const badName = /(^|\s)5"\s*K-Style\s*$/i;
  const delRes = await UserGutterProduct.deleteMany({ name: badName });
  console.log("Deleted stray '5\" K-Style' rows:", delRes.deletedCount);

  // 2) Optional: if any exact duplicates exist (same userId+templateId),
  // keep the newest by updatedAt and remove older ones.
  const dupPipeline = [
    {
      $group: {
        _id: { userId: "$userId", templateId: "$templateId" },
        ids: { $push: { _id: "$_id", updatedAt: "$updatedAt" } },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ];
  const dups = await UserGutterProduct.aggregate(dupPipeline);
  for (const g of dups) {
    const sorted = g.ids.sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    const keep = sorted[0]._id;
    const removeIds = sorted.slice(1).map((x) => x._id);
    if (removeIds.length) {
      await UserGutterProduct.deleteMany({ _id: { $in: removeIds } });
      console.log(
        `Deduped for user ${g._id.userId} tpl ${g._id.templateId}: removed ${removeIds.length}`
      );
    }
  }

  await mongoose.disconnect();
  console.log("Cleanup done.");
})() */ (async () => {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/",
    {
      dbName: process.env.MONGO_DB || "esti-mate",
    }
  );
  /* const dupNames = await GutterProductTemplate.aggregate([
    { $group: { _id: "$name", ids: { $push: "$_id" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  console.log("Duplicate template names:", dupNames); */

  // from a script or mongo shell using Mongoose connection
  // await require("./models/userGutterProduct").syncIndexes();

  // 1) Preview duplicates by slug
  db.gutterproducttemplates.aggregate([
    { $group: { _id: "$slug", ids: { $push: "$_id" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);

  // 2) Remove older duplicates, keep the newest (createdAt/updatedAt)
  const dups = await db.gutterproducttemplates
    .aggregate([
      { $sort: { slug: 1, updatedAt: -1, createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$slug",
          keep: { $first: "$_id" },
          extra: { $push: "$_id" },
        },
      },
      { $project: { extras: { $slice: ["$extra", 1, { $size: "$extra" }] } } },
    ])
    .toArray();

  const extraTemplateIds = dups.flatMap((d) => d.extras);
  if (extraTemplateIds.length) {
    db.gutterproducttemplates.deleteMany({ _id: { $in: extraTemplateIds } });
  }

  // 3) Create the unique index (if not already)
  db.gutterproducttemplates.createIndex(
    { slug: 1 },
    { unique: true, sparse: true }
  );

  await mongoose.disconnect();
})();
