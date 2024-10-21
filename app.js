const express = require('express');

require('dotenv').config();

const {errors} = require('celebrate')

const cors = require('cors')

const mongoose = require('mongoose');

const dataBase = "mongodb://127.0.0.1:27017/esti-mate"
const mainRouter = require('./routes/index')


const app = express();
const {PORT = 4000} = process.env;
mongoose.connect(dataBase, ()=>{console.log('connected successfully to db')})

app.use(cors())
app.use(express.json())

app.use('/', mainRouter)
app.listen(PORT, ()=>{
  console.log(`esti-mate listening on port ${PORT}`)
})