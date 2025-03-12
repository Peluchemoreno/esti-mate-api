const router = require("express").Router();
const {
  createProject,
  getAllProjects,
  deleteProject,
  addDiagramToProject,
} = require("../controllers/projects");

router.post("/", createProject);
router.get("/", getAllProjects);
router.delete("/:projectId", deleteProject);
router.patch("/:projectId", addDiagramToProject);

module.exports = router;
