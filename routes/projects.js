const router = require('express').Router()
const {createProject, getAllProjects, deleteProject} = require('../controllers/projects')

router.post('/', createProject)
router.get('/', getAllProjects)
router.delete('/:projectId', deleteProject)

module.exports = router;