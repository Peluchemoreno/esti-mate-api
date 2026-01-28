const router = require("express").Router();
const { login } = require("../controllers/users");
const authorize = require("../middlewares/auth");
const userRouter = require("./users");
const projectRouter = require("./projects");
const productRouter = require("./product");
const stripeRouter = require("./stripe");
// NEW: mount estimates router
const estimatesRouter = require("./estimates");
const billingRouter = require("./billing");
const requireTier = require("../middlewares/requireTier");

router.use("/api/estimates", estimatesRouter);
router.use("/api/stripe", stripeRouter);
router.use("/api/billing", authorize, billingRouter);

router.get("/health", (req, res) => res.status(200).send("ok"));
router.use("/users", userRouter);
router.use(
  "/dashboard/projects",
  authorize,
  requireTier(["basic"]),
  projectRouter
);
router.use(
  "/dashboard/products",
  authorize,
  requireTier(["basic"]),
  productRouter
);
router.post("/signin", login);

module.exports = router;
