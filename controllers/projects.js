const Project = require('../models/project')

function createProject(req, res, next){
  const {projectName, clientName, address, primaryPhoneNumber, secondaryPhoneNumber, email} = req.body
  Project.create({
    projectName, clientName, address, primaryPhoneNumber, secondaryPhoneNumber, email, createdBy: req.user,
  }).then(data => {
    res.send({data})
  })
  .catch((err) => {
    if (err.name === "CastError") {
      return next(new Error('Invalid data sent'))
    }
    if (err.name === "InvalidEmailError"){
      return next(new Error('Please try a different email address.'))
    }
    return next(err)
  });
}

function getAllProjects(req, res, next){
  const {_id} = req.user;
  Project.find({createdBy: _id})
  .orFail()
  .then(projects => {
    res.send({projects})
  }).catch(err => {
    if (err.name === "DocumentNotFoundError"){
      // const error = new Error('there are no projects')
      // error.statusCode = 404;
      // error.message = 'There are no projects'
      res.send([])
    }
    return next(err)
  })
}

module.exports = {createProject, getAllProjects}