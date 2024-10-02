const router = require('express').Router()
const {createProject, getAllProjects} = require('../controllers/projects')

router.post('/', createProject)
router.get('/', getAllProjects)

module.exports = router;