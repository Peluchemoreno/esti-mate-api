const Project = require("../models/project");

function createProject(req, res, next) {
  const {
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
  } = req.body;
  Project.create({
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
    createdBy: req.user,
  })
    .then((data) => {
      res.send({ data });
    })
    .catch((err) => {
      if (err.name === "CastError") {
        return next(new Error("Invalid data sent"));
      }
      if (err.name === "InvalidEmailError") {
        return next(new Error("Please try a different email address."));
      }
      return next(err);
    });
}

function addDiagramToProject(req, res, next) {
  const { projectId } = req.params;
  const { lines, imageData, totalFootage, price, accessoryData, product } =
    req.body;
  Project.findByIdAndUpdate(
    projectId,
    {
      $push: {
        diagrams: {
          lines,
          imageData,
          totalFootage,
          price,
          createdAt: new Date().toLocaleString(),
          accessoryData,
          product,
        },
      },
    },
    { new: true },
    (err, updatedProject) => {
      if (err) {
        return res
          .status(500)
          .json({ error: "Failed to add diagram to project." });
      }
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found." });
      }
      return res.status(200).json(updatedProject);
    }
  );
}

async function updateDiagram(req, res, next) {
  const { projectId, diagramId } = req.params;
  const { lines, imageData, totalFootage, price, accessoryData, product } =
    req.body;
  try {
    const updatedProject = await Project.findOneAndUpdate(
      { _id: projectId, "diagrams._id": diagramId },
      {
        $set: {
          "diagrams.$.lines": lines,
          "diagrams.$.imageData": imageData,
          "diagrams.$.createdAt": new Date().toLocaleString(),
          "diagrams.$.totalFootage": totalFootage,
          "diagrams.$.price": price,
          "diagrams.$.accessoryData": accessoryData,
          "diagrams.$.product": product,
        },
      },
      { new: true }
    );

    if (!updatedProject) {
      throw new Error("No project or diagram found");
    }

    return res.status(200).json(updatedProject);
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function getProjectDiagrams(req, res, next) {
  const { projectId } = req.params;
  Project.findById(projectId)
    .orFail()
    .then((project) => {
      if (project.diagrams) {
        res.send(project.diagrams);
        return project.diagrams;
      } else {
        return "No such project";
      }
    })
    .catch((err) => {
      console.error(err);
    });
}

function deleteDiagram(req, res, next) {
  const { projectId } = req.params;
  const { diagramId } = req.params;
  Project.findByIdAndUpdate(
    projectId,
    { $pull: { diagrams: { _id: diagramId } } }, // Remove by ID
    { new: true } // Return the updated document
  )
    .orFail()
    .then((updatedProject) => {
      res.send(updatedProject.diagrams);
    });
}

function getAllProjects(req, res, next) {
  const { _id } = req.user;
  Project.find({ createdBy: _id })
    .orFail()
    .then((projects) => {
      res.send({ projects });
    })
    .catch((err) => {
      if (err.name === "DocumentNotFoundError") {
        // const error = new Error('there are no projects')
        // error.statusCode = 404;
        // error.message = 'There are no projects'
        res.send([]);
      }
      return next(err);
    });
}

function deleteProject(req, res, next) {
  const { projectId } = req.params;
  const { _id } = req.user;

  // find project in db first to confirm whether user is owner of project
  Project.findById(projectId)
    .orFail()
    .then((project) => {
      const ownerId = project?.createdBy.toString();

      if (!(_id === ownerId)) {
        return next(new Error("You do not own this project"));
      }

      return Project.findByIdAndDelete(projectId).then((project) => {
        res.send({ message: `deleted project with ID: ${project._id}` });
      });
    })
    .catch((err) => {
      if (err.name === "CastError") {
        return next(new Error("invalid data entered"));
      }

      if (err.name === "DocumentNotFoundError") {
        return next(new Error("requested resource not found"));
      }
      return next(err);
    });
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
