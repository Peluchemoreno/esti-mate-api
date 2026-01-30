const router = require("express").Router();
const {
  createProject,
  getAllProjects,
  deleteProject,
  addDiagramToProject,
  getProjectDiagrams,
  deleteDiagram,
  updateDiagram,
} = require("../controllers/projects");
const projectPhotosRouter = require("./projectPhotos");

router.post("/", createProject);
router.get("/", getAllProjects);
router.delete("/:projectId", deleteProject);
router.patch("/:projectId", addDiagramToProject);
router.get("/:projectId", getProjectDiagrams);
router.patch("/:projectId/:diagramId/delete", deleteDiagram);
router.patch("/:projectId/:diagramId", updateDiagram);

router.use("/:projectId/photos", projectPhotosRouter);
module.exports = router;
