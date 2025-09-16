const router = require("express").Router();
const {
  createProduct,
  getAllProducts,
  deleteProduct,
  updateProduct,
} = require("../controllers/products");
const { syncUserCatalog } = require("../controllers/catalog");

router.post("/", createProduct);
router.post("/sync", syncUserCatalog);
router.get("/", getAllProducts);
router.delete("/", deleteProduct);
router.patch("/:productId", updateProduct);

module.exports = router;
