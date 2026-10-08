// Handles routes that do not exist (404) and any error thrown in the app.

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Request body was not valid JSON
  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid JSON in request body' });
  }

  // Mongoose validation failed
  if (err.name === 'ValidationError' && err.errors) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  // MongoDB unique index violated (two people registering the same email at once)
  if (err.code === 11000) {
    return res
      .status(409)
      .json({ success: false, message: 'Email is already registered' });
  }

  console.error(err);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    // Error details are shown only while developing
    ...(process.env.NODE_ENV !== 'production' && { error: err.message }),
  });
};

module.exports = { notFound, errorHandler };
