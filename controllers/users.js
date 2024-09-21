const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = require("../utils/config");

const User = require('../models/user')

function createUser(req, res, next){
  const {firstName, lastName, email, password, subscription} = req.body

  User.findOne({email})
  .then((user) => {
    if (user){
      throw new Error('Please use a different email')
    }
    return bcrypt.hash(password, 10)
  })
  .then((hash)=>{
    User.create({
      name: `${firstName} ${lastName}`,
      email: email,
      password: hash,
      subscription: subscription,
    })
    .then((user)=>{
      res.send({
        email: user.email,
        name: user.name,
      })
    })
  })

  .catch((err) => {
    if (err.name === "ValidationError") {
      return next(new Error('Invalid data sent'))
    }
    if (err.name === "InvalidEmailError"){
      return next(new Error('Please try a different email address.'))
    }
    return next(err)
  });
}

module.exports = {
  createUser
}