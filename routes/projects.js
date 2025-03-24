const router = require("express").Router();
const {
  createProject,
  getAllProjects,
  deleteProject,
  addDiagramToProject,
  getProjectDiagrams,
  deleteDiagram,
} = require("../controllers/projects");

router.post("/", createProject);
router.get("/", getAllProjects);
router.delete("/:projectId", deleteProject);
router.patch("/:projectId", addDiagramToProject);
router.get("/:projectId", getProjectDiagrams);
router.patch("/:projectId/:diagramId", deleteDiagram);

module.exports = router;
