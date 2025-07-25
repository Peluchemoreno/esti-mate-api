const Product = require("../models/product");
const UserGutterProduct = require("../models/userGutterProduct");

function createProduct(req, res, next) {
  console.log(req.body);
  const { name, visual, quantity, price, listed, description } = req.body;
  Product.create({
    name,
    visual,
    quantity,
    price,
    listed,
    description,
    createdBy: req.user,
  })
    .then((data) => {
      res.send({ data });
    })
    .catch((err) => {
      if (err.name === "CastError") {
        return next(new Error("Invalid data sent"));
      }
      return next(err);
    });
}

function deleteProduct(req, res, next) {
  const { productId } = req.body;
  Product.findByIdAndDelete(productId)
    .then((product) => {
      res.send({ message: `deleted product with ID: ${product._id}` });
    })
    .catch((err) => {
      if (err.name === "CastError") {
        return next(new Error("invalid data entered"));
      }

      if (err.name === "DocumentNotFoundError") {
        return next(new Error("requested resource not found"));
      }
      return next(err);
    });
}

function getAllProducts(req, res, next) {
  const { _id } = req.user;
  UserGutterProduct.find({ createdBy: _id })
    .orFail()
    .then((products) => {
      res.send({ products });
    })
    .catch((err) => {
      if (err.name === "DocumentNotFoundError") {
        // const error = new Error('there are no products')
        // error.statusCode = 404;
        // error.message = 'There are no products'
        res.send([]);
      }
      return next(err);
    });
}

function updateProduct(req, res, next) {
  const { productId } = req.params;
  const {
    name,
    colorCode,
    price,
    unit,
    description,
    category,
    listed,
    removalPricePerFoot,
    repairPricePerFoot,
    screenOptions,
  } = req.body;
  console.log(req.body);
  UserGutterProduct.findOneAndUpdate(
    { _id: productId },
    {
      name,
      price,
      unit,
      colorCode,
      description,
      category,
      listed,
      removalPricePerFoot,
      repairPricePerFoot,
    },
    { runValidators: true, new: true }
  )
    .orFail()
    .then((product) => {
      res.send(product);
    })
    .catch((err) => {
      if (err.name === "CastError") {
        return next(
          new Error(
            `The data entered was invalid :( here's some details: ${err})`
          )
        );
      }
      if (err.name === "DocumentNotFoundError") {
        return next(new Error("requested resource not found"));
      }
      if (err.name === "ValidationError") {
        return next(new Error("invalid data entered"));
      }
      return next(err);
    });
}

module.exports = {
  createProduct,
  deleteProduct,
  getAllProducts,
  updateProduct,
};
