const router = require('express').Router();
const {createUser, login} = require('../controllers/users')
const authorize = require('../middlewares/auth')
const userRouter = require('./users')
const projectRouter = require('./projects')


router.use('/users', authorize, userRouter)
router.use('/dashboard/projects', authorize, projectRouter)
router.post('/signin', login)
router.post('/signup', createUser)

module.exports = router;