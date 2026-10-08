// The User schema: people who can log in and own notes.
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot be longer than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // no two users can share an email
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    // Stores the bcrypt HASH, never the real password.
    // select: false means queries do not return it unless we ask for it.
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
