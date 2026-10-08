// The Note schema: what a note looks like in MongoDB.
const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot be longer than 100 characters'],
    },
    content: {
      type: String,
      trim: true,
      maxlength: [5000, 'Content cannot be longer than 5000 characters'],
      default: '',
    },
    // The owner of the note. Every note belongs to exactly one user.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = mongoose.model('Note', noteSchema);
