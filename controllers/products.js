const Product = require('../models/product')

function createProduct(req, res, next){
  const {name, visual, quantity, price} = req.body
  Product.create({
    name,
    visual,
    quantity,
    price,
    createdBy: req.user,
  }).then(data => {
    res.send({data})
  })
  .catch((err) => {
    if (err.name === "CastError") {
      return next(new Error('Invalid data sent'))
    }
    return next(err)
  });
}

function deleteProduct(req, res, next){
  const {productId} = req.body
  Product.findByIdAndDelete(productId)
    .then(product => {
      res.send({message: `deleted product with ID: ${product._id}`})
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

function getAllProducts(req, res, next){
  const {_id} = req.user
  Product.find({createdBy: _id})
  .orFail()
  .then(products => {
    res.send({products})
  }).catch(err => {
    if (err.name === "DocumentNotFoundError"){
      // const error = new Error('there are no products')
      // error.statusCode = 404;
      // error.message = 'There are no products'
      res.send([])
    }
    return next(err)
  })
}

function updateProduct(req, res, next){
  const {productId, name, visual, price, quantity} = req.body
  Product.findByIdAndUpdate(
    productId,
    {$set: {name, price, quantity, visual}},
    {runValidators: true, new: true}
  ).orFail()
  .then(product => {
    res.send(product)
  }).catch(err => {
    if (err.name === 'CastError'){
      return next(new Error('invalid data entered'))
    }
    if (err.name === 'DocumentNotFoundError'){
      return next(new Error('requested resource not found'))
    }
    if (err.name === 'ValidationError'){
      return next(new Error('invalid data entered'))
    }
    return next(err)
  })
}


module.exports = {
  createProduct,
  deleteProduct,
  getAllProducts,
  updateProduct
}