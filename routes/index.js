const router = require("express").Router();
const { login } = require("../controllers/users");
const authorize = require("../middlewares/auth");
const userRouter = require("./users");
const projectRouter = require("./projects");
const productRouter = require("./product");
const stripeRouter = require("./stripe");
// NEW: mount estimates router
const estimatesRouter = require("./estimates");

router.use("/api/estimates", estimatesRouter);
router.use("/api/stripe", stripeRouter);

router.get("/health", (req, res) => res.status(200).send("ok"));
router.use("/users", userRouter);
router.use("/dashboard/projects", authorize, projectRouter);
router.use("/dashboard/products", authorize, productRouter);
router.post("/signin", login);
router.post("/signup", userRouter);

module.exports = router;
