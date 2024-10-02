const mongoose = require('mongoose')
const validator = require('validator')

const diagramArrayBuffer = new mongoose.Schema({

})

const projectSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 60,
  },
  clientName: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 60,
  },
  address: {
    type: String,
    required: true,
  },
  primaryPhoneNumber: {
    type: String,
    required: true,
  },
  secondaryPhoneNumber: {
    type: String
  },
  email: {
    type: String,
    validate: {
      validator(v){
        return validator.isEmail(v)
      },
      message: "You must enter a valid email address."
    },
    unique: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now()
  },
  diagram: [{
    type: Array
  }],
  // images: []
})

const Project = mongoose.model('project', projectSchema)

module.exports = Project