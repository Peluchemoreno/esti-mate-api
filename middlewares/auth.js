const jwt = require('jsonwebtoken')

const JWT_SECRET = require('../utils/config');
// const UnauthorizedError = require('../errors/unauthorizedError');

function authorize(req, res, next){
  const {authorization} = req.headers;

  if (!authorization || !authorization.startsWith("Bearer ")){
    return next(new Error('Authorization required'))
  }

  const token = authorization.replace("Bearer ", '');
  let payload;

  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch (err) {
    return next(new Error('Authorization required'))
  }

  req.user = payload;
  return next();
}

module.exports = authorize;