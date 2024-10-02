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
    enum: ['unsubscribed', 'basic', 'intermediate', 'pro']
  }
})

userSchema.statics.findUserByCredentials = function findUserByCredentials(email, password){
  return this.findOne({email}).select(('+password'))
  .then(user => {
    if (!user){
      return Promise.reject(new Error('Incorrect email or password'))
    }
    return bcrypt.compare(password, user.password)
    .then((matched) => {
      if (!matched){
        return Promise.reject(new Error("Incorrect email or password"))
      }
      return user
    })
  })
}


const User = mongoose.model('user', userSchema)

module.exports = User;