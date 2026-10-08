// "protect" guards a route: it only lets the request through if it has a valid JWT.
// The client must send the header:  Authorization: Bearer <token>
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('./asyncHandler');

const unauthorized = (res, message) =>
  res.status(401).json({ success: false, message });

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized(res, 'Not authorized: token missing');
  }

  const token = header.split(' ')[1];
  if (!token) {
    return unauthorized(res, 'Not authorized: token missing');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError'
        ? 'Not authorized: token has expired, please log in again'
        : 'Not authorized: invalid token';
    return unauthorized(res, message);
  }

  // The password is not loaded here (select: false in the model).
  const user = await User.findById(decoded.id);
  if (!user) {
    return unauthorized(res, 'Not authorized: user no longer exists');
  }

  req.user = user;
  next();
});

module.exports = { protect };
