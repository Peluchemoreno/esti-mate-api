const router = require("express").Router();
const {
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
} = require("../controllers/customers");

router.post("/", createCustomer);
router.get("/", listCustomers);
router.get("/:id", getCustomerById);
router.put("/:id", updateCustomer);

module.exports = router;
