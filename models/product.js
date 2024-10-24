const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 30,
    unique: true
  },
  visual: {
    type: String,
    required: true,
    unique: true,
  },
  quantity: {
    type: String,
    enum: ['length-feet', 'unit-per']
  },
  price: {
    type: String,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
})

const Product = mongoose.model('product', productSchema)

module.exports = Product