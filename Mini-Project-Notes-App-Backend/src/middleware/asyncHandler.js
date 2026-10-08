// Express 4 does not catch errors from async functions by itself.
// This small wrapper sends any error to our error handler.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
