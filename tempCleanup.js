// scripts/cleanup-stray-products.js
const mongoose = require("mongoose");
const UserGutterProduct = require("./models/userGutterProduct");
const GutterProductTemplate = require("./models/gutterProductTemplate");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGO_DB,
  });
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
