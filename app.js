const express = require("express");

require("dotenv").config();

const { errors } = require("celebrate");

const cors = require("cors");

const mongoose = require("mongoose");
// app.js (near top)

const allowed = new Set([
  "http://localhost:3000", // dev
  "https://tryestimate.io", // your frontend
  "https://tryestimate.io/",
]);
const app = express();
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
    credentials: true,
  })
);

// const dataBase = "mongodb://127.0.0.1:27017/esti-mate";
/* const dataBase =
  "mongodb+srv://jmcdmoreno19:tacobell22@testingcluster.rsp5krz.mongodb.net/?retryWrites=true&w=majority&appName=TestingCluster"; */
const mainRouter = require("./routes/index");

/* mongoose.connect(dataBase, () => {
  console.log("connected successfully to db");
});
 */
mongoose.connect(
  process.env.MONGODB_URI ||
    `mongodb+srv://jmcdmoreno19:tacobell22@testingcluster.rsp5krz.mongodb.net/?retryWrites=true&w=majority&appName=TestingCluster`,
  {
    dbName: process.env.MONGO_DB || "app",
  }
);
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
// app.use(cors());
app.use(express.json({ limit: "150mb" }));

app.use("/", mainRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
