const express = require("express");

require("dotenv").config();

const { errors } = require("celebrate");

const cors = require("cors");

const mongoose = require("mongoose");

// const dataBase = "mongodb://127.0.0.1:27017/esti-mate";
/* const dataBase =
  "mongodb+srv://jmcdmoreno19:tacobell22@testingcluster.rsp5krz.mongodb.net/?retryWrites=true&w=majority&appName=TestingCluster"; */
const mainRouter = require("./routes/index");

const app = express();
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

/* mongoose.connect(dataBase, () => {
  console.log("connected successfully to db");
});
 */
mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGO_DB || "app",
});
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
// app.use(cors());
app.use(express.json({ limit: "150mb" }));

app.use("/", mainRouter);

const PORT = process.env.PORT || 3000;
app.get("/health", (req, res) => res.status(200).send("ok"));
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
