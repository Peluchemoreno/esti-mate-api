const mongoose = require("mongoose");
const Project = require("../models/project");
const User = require("../models/user");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const projects = await Project.find({ businessId: { $exists: false } });

  for (const project of projects) {
    const user = await User.findById(project.userId);

    if (!user?.personalBusinessId) continue;

    project.businessId = user.personalBusinessId;

    await project.save();
  }

  console.log("Projects backfilled:", projects.length);

  process.exit();
}

run();
