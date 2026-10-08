// The Todo "schema" describes what a task looks like in MongoDB.
const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot be longer than 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot be longer than 500 characters'],
      default: '',
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = mongoose.model('Todo', todoSchema);
