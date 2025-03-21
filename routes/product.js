const router = require('express').Router();
const {createProduct, getAllProducts, deleteProduct, updateProduct} = require('../controllers/products')

router.post('/', createProduct)
router.get('/', getAllProducts)
router.delete('/', deleteProduct)
router.patch('/', updateProduct)

module.exports = router;