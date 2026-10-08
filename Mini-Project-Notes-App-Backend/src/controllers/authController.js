// Register and login: this is how a user gets the JWT needed for the note routes.
const bcrypt = require('bcrypt');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const generateToken = require('../utils/generateToken');

const SALT_ROUNDS = 10; // how much work bcrypt does; 10 is a common, safe default

// Only these fields are ever sent back to the client (never the password).
const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

// POST /api/auth/register  -> create a new user
const register = asyncHandler(async (req, res) => {
  const name = req.body.name.trim();
  const email = req.body.email.trim().toLowerCase();
  const { password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res
      .status(409)
      .json({ success: false, message: 'Email is already registered' });
  }

  // Turn the password into a bcrypt hash. Only the hash is saved.
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({ name, email, password: hashedPassword });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: { user: formatUser(user) },
  });
});

// POST /api/auth/login  -> check credentials and return a JWT
const login = asyncHandler(async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const { password } = req.body;

  // select('+password') asks MongoDB to include the hidden password hash
  const user = await User.findOne({ email }).select('+password');

  // Same message for "no such email" and "wrong password",
  // so attackers cannot find out which emails are registered.
  const passwordMatches = user
    ? await bcrypt.compare(password, user.password)
    : false;

  if (!passwordMatches) {
    return res
      .status(401)
      .json({ success: false, message: 'Invalid email or password' });
  }

  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    data: { user: formatUser(user) },
  });
});

module.exports = { register, login };
