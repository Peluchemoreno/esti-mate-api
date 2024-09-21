const router = require('express').Router();
const {createUser} = require('../controllers/users')
const userRouter = require('./users')


router.use('/users', userRouter)
router.post('/signin')
router.post('/signup', createUser)

module.exports = router;