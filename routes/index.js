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
const customersRouter = require("./customers");
const adminRouter = require("./admin");

router.use("/admin", adminRouter);
router.use("/api/estimates", estimatesRouter);
router.use("/api/stripe", stripeRouter);
router.use("/api/billing", authorize, billingRouter);

router.get("/health", (req, res) => res.status(200).send("ok"));
router.use("/users", userRouter);
router.use(
  "/dashboard/projects",
  authorize,
  requireTier(["basic"]),
  projectRouter,
);
// Version B: Customers (protected)
router.use(
  "/dashboard/customers",
  authorize,
  requireTier(["basic"]),
  customersRouter,
);

// Optional alias to match requested paths (also protected)
router.use("/customers", authorize, requireTier(["basic"]), customersRouter);
router.use(
  "/dashboard/products",
  authorize,
  requireTier(["basic"]),
  productRouter,
);
router.post("/signin", login);

module.exports = router;
