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

function login(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password){
    return next(new Error('Invalid data entered'))
  }

  return User.findUserByCredentials(email, password)
    .then((user) => {
      const token = jwt.sign({ _id: user._id }, JWT_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    })
    .catch((err) => {
      if (err.message === "Incorrect email or password"){
      return next(new Error('Incorrect email or password'))
      }
      return next(err)
    });
};

function getCurrentUser(req, res, next){
  const {_id} = req.user;

  User.findById(_id)
    .orFail()
    .then((user) => {
      res.send(user);
    })
    .catch((err) => {
      if (err.name === "DocumentNotFoundError"){
        return next(new NotFoundError('Requested resource not found.'))
      }
      return next(err)
    });
}

module.exports = {
  createUser,
  login,
  getCurrentUser,
}