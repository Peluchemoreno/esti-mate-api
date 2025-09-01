const router = require("express").Router();
const { login } = require("../controllers/users");
const authorize = require("../middlewares/auth");
const userRouter = require("./users");
const projectRouter = require("./projects");
const productRouter = require("./product");

router.get("/health", (req, res) => res.status(200).send("ok"));
router.use("/users", userRouter);
router.use("/dashboard/projects", authorize, projectRouter);
router.use("/dashboard/products", authorize, productRouter);
router.post("/signin", login);
router.post("/signup", userRouter);

module.exports = router;
