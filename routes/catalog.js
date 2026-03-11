const router = require("express").Router();
const controller = require("../controllers/catalog");

router.get("/", controller.listCatalogItems);
router.post("/", controller.createCatalogItem);
router.patch("/:id", controller.updateCatalogItem);
router.delete("/:id", controller.deleteCatalogItem);

module.exports = router;
