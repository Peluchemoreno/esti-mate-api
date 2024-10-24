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

function deleteProject(req, res, next){
  const {projectId} = req.params
  const {_id} = req.user;

  // find project in db first to confirm whether user is owner of project
  Project.findById(projectId)
  .orFail()
  .then(project => {
    const ownerId = project?.createdBy.toString()

    if (!(_id === ownerId)){
      return next(new Error('You do not own this project'))
    }

    return Project.findByIdAndDelete(projectId)
    .then(project => {
      res.send({message: `deleted project with ID: ${project._id}`})
    })
  })
  .catch(err => {
    if (err.name === "CastError"){
      return next(new Error('invalid data entered'))
    }

    if (err.name === "DocumentNotFoundError"){
      return next(new Error('requested resource not found'))
    }
    return next(err)
  })
}


module.exports = {createProject, getAllProjects, deleteProject}