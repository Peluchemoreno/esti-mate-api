// routes/estimates.js
const router = require("express").Router();
const authorize = require("../middlewares/auth");
const ctrl = require("../controllers/estimates");

router.get("/next", authorize, ctrl.getNext);
router.get("/", authorize, ctrl.list);
router.get("/:id", authorize, ctrl.getOne);
router.post("/", authorize, ctrl.create);
router.delete("/:id", authorize, ctrl.remove);

module.exports = router;
