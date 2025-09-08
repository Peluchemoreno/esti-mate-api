// projects.js
const mongoose = require("mongoose");
const Project = require("../models/project");

function createProject(req, res, next) {
  const userId = req.user?._id;
  if (!userId)
    return res.status(401).json({ message: "Authorization required" });

  const fields = (({
    projectName,
    billingName,
    billingAddress,
    billingPrimaryPhone,
    billingSecondaryPhone,
    billingEmail,
    siteName,
    siteAddress,
    sitePrimaryPhone,
    siteSecondaryPhone,
    siteEmail,
  }) => ({
    projectName,
    billingName,
    billingAddress,
    billingPrimaryPhone,
    billingSecondaryPhone,
    billingEmail,
    siteName,
    siteAddress,
    sitePrimaryPhone,
    siteSecondaryPhone,
    siteEmail,
  }))(req.body);

  Project.create({ ...fields, createdBy: userId })
    .then((data) => res.json({ data }))
    .catch(next);
}

function getAllProjects(req, res, next) {
  const userId = req.user?._id;
  if (!userId)
    return res.status(401).json({ message: "Authorization required" });

  Project.find({ createdBy: userId })
    .lean()
    .then((projects) => res.json({ projects })) // [] ok
    .catch(next);
}

function deleteProject(req, res, next) {
  const userId = req.user?._id;
  const { projectId } = req.params;
  if (!userId)
    return res.status(401).json({ message: "Authorization required" });
  if (!mongoose.isValidObjectId(projectId))
    return res.status(400).json({ message: "Invalid id" });

  Project.findOneAndDelete({ _id: projectId, createdBy: userId })
    .then((doc) => {
      if (!doc) return res.status(404).json({ message: "Not found" });
      return res.json({ message: `deleted project with ID: ${doc._id}` });
    })
    .catch(next);
}

function addDiagramToProject(req, res, next) {
  const userId = req.user?._id;
  const { projectId } = req.params;
  if (!userId)
    return res.status(401).json({ message: "Authorization required" });
  if (!mongoose.isValidObjectId(projectId))
    return res.status(400).json({ message: "Invalid id" });

  const { lines, imageData, totalFootage, price, accessoryData, product } =
    req.body;
  Project.findOneAndUpdate(
    { _id: projectId, createdBy: userId },
    {
      $push: {
        diagrams: {
          lines,
          imageData,
          totalFootage,
          price,
          createdAt: new Date(),
          accessoryData,
          product,
        },
      },
    },
    { new: true }
  )
    .then((updated) => {
      if (!updated) return res.status(404).json({ error: "Project not found" });
      return res.json(updated);
    })
    .catch(next);
}

async function updateDiagram(req, res, next) {
  try {
    const userId = req.user?._id;
    const { projectId, diagramId } = req.params;
    if (!userId)
      return res.status(401).json({ message: "Authorization required" });
    if (
      !mongoose.isValidObjectId(projectId) ||
      !mongoose.isValidObjectId(diagramId)
    )
      return res.status(400).json({ message: "Invalid id" });

    const updated = await Project.findOneAndUpdate(
      { _id: projectId, createdBy: userId, "diagrams._id": diagramId },
      {
        $set: {
          "diagrams.$.lines": req.body.lines,
          "diagrams.$.imageData": req.body.imageData,
          "diagrams.$.createdAt": new Date(),
          "diagrams.$.totalFootage": req.body.totalFootage,
          "diagrams.$.price": req.body.price,
          "diagrams.$.accessoryData": req.body.accessoryData,
          "diagrams.$.product": req.body.product,
        },
      },
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ error: "No project/diagram found" });
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
}

function getProjectDiagrams(req, res, next) {
  const userId = req.user?._id;
  const { projectId } = req.params;
  if (!userId)
    return res.status(401).json({ message: "Authorization required" });
  if (!mongoose.isValidObjectId(projectId))
    return res.status(400).json({ message: "Invalid id" });

  Project.findOne({ _id: projectId, createdBy: userId })
    .lean()
    .then((project) => {
      if (!project) return res.status(404).json({ error: "Project not found" });
      return res.json(project.diagrams || []);
    })
    .catch(next);
}

function deleteDiagram(req, res, next) {
  const userId = req.user?._id;
  const { projectId, diagramId } = req.params;
  if (!userId)
    return res.status(401).json({ message: "Authorization required" });
  if (
    !mongoose.isValidObjectId(projectId) ||
    !mongoose.isValidObjectId(diagramId)
  )
    return res.status(400).json({ message: "Invalid id" });

  Project.findOneAndUpdate(
    { _id: projectId, createdBy: userId },
    { $pull: { diagrams: { _id: diagramId } } },
    { new: true }
  )
    .then((updated) => {
      if (!updated) return res.status(404).json({ error: "Project not found" });
      return res.json(updated.diagrams || []);
    })
    .catch(next);
}

module.exports = {
  createProject,
  getAllProjects,
  deleteProject,
  addDiagramToProject,
  getProjectDiagrams,
  deleteDiagram,
  updateDiagram,
};
