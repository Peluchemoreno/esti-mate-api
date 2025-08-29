class IncorrectEmailOrPasswordError extends Error {
  constructor(message) {
    super(message);
    this.message = "Incorrect email or password :(";
    this.statusCode = 400;
  }
}

module.exports = IncorrectEmailOrPasswordError;
