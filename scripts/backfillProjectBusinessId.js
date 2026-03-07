// FILE: scripts/backfillProjectBusinessId.js

require("dotenv").config();
const mongoose = require("mongoose");
const Project = require("../models/project");
const User = require("../models/user");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGO_DB || "esti-mate",
  });

  console.log("Connected:", {
    host: mongoose.connection.host,
    dbName: mongoose.connection.name,
    projectCollection: Project.collection.name,
    userCollection: User.collection.name,
  });

  const needsBackfillQuery = {
    $or: [{ businessId: { $exists: false } }, { businessId: null }],
  };

  const totalProjects = await Project.countDocuments({});
  const missingCount = await Project.countDocuments({
    businessId: { $exists: false },
  });
  const nullCount = await Project.countDocuments({ businessId: null });
  const needsBackfillCount = await Project.countDocuments(needsBackfillQuery);

  console.log("Project counts:", {
    totalProjects,
    missingCount,
    nullCount,
    needsBackfillCount,
  });

  const projects = await Project.find(needsBackfillQuery);

  let updated = 0;
  let skippedNoUser = 0;
  let skippedNoBusiness = 0;

  for (const project of projects) {
    const user = await User.findById(project.userId);

    if (!user) {
      skippedNoUser += 1;
      continue;
    }

    if (!user.personalBusinessId) {
      skippedNoBusiness += 1;
      continue;
    }

    project.businessId = user.personalBusinessId;
    await project.save();
    updated += 1;
  }

  console.log("Done:", {
    found: projects.length,
    updated,
    skippedNoUser,
    skippedNoBusiness,
  });

  process.exit(0);
}

run().catch((err) => {
  console.error("backfillProjectBusinessId failed:", err);
  process.exit(1);
});
