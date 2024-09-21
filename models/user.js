const mongoose = require('mongoose');
const validator = require('validator')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    validate: {
      validator(v){
        return validator.isEmail(v)
      },
      message: "You must enter a valid email address."
    },
    unique: true,
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  logo: {
    type: Buffer,
  },
  subscription: {
    type: String,
    required: true,
    enum: ['basic', 'intermediate', 'pro']
  }
})

const User = mongoose.model('user', userSchema)

module.exports = User;