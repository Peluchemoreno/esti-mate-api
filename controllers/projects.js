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

  Project.create({ ...fields, userId: userId })
    .then((data) => res.json({ data }))
    .catch(next);
}

function getAllProjects(req, res, next) {
  const userId = req.user?._id;
  if (!userId)
    return res.status(401).json({ message: "Authorization required" });

  Project.find({ userId: userId })
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

  Project.findOneAndDelete({ _id: projectId, userId: userId })
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

  const {
    lines,
    imageData,
    totalFootage,
    price,
    accessoryData,
    product,
    elbowsBySize,
    elbowLineItems,
    endCapsByProduct,
    mitersByProduct,
    mixedMiters,
    accessories,
  } = req.body;
  Project.findOneAndUpdate(
    { _id: projectId, userId: userId },
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
          elbowsBySize,
          elbowLineItems,
          endCapsByProduct,
          mitersByProduct,
          mixedMiters,
          accessories,
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
      { _id: projectId, userId: userId, "diagrams._id": diagramId },
      {
        $set: {
          "diagrams.$.lines": req.body.lines,
          "diagrams.$.imageData": req.body.imageData,
          "diagrams.$.createdAt": new Date(),
          "diagrams.$.totalFootage": req.body.totalFootage,
          "diagrams.$.price": req.body.price,
          "diagrams.$.accessoryData": req.body.accessoryData,
          "diagrams.$.product": req.body.product,
          "diagrams.$.elbowsBySize": req.body.elbowsBySize,
          "diagrams.$.elbowLineItems": req.body.elbowLineItems,
          "diagrams.$.endCapsByProduct": req.body.endCapsByProduct,
          "diagrams.$.mitersByProduct": req.body.mitersByProduct,
          "diagrams.$.mixedMiters": req.body.mixedMiters,
          "diagrams.$.accessories": req.body.accessories,
        },
      },
      { new: true }
    );
    // console.log(updated.diagrams[1].accessories);
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

  Project.findOne({ _id: projectId, userId: userId })
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
    { _id: projectId, userId: userId },
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
