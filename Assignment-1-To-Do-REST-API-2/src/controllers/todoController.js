// Controllers hold the logic for each API route.
const Todo = require('../models/Todo');
const asyncHandler = require('../middleware/asyncHandler');
const { ALLOWED_FIELDS } = require('../middleware/validateTodo');

// Keep only the fields we allow, so nobody can set other values.
const pickAllowedFields = (body) =>
  ALLOWED_FIELDS.reduce((result, field) => {
    if (body[field] !== undefined) result[field] = body[field];
    return result;
  }, {});

// POST /api/todos  -> create a task
const createTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.create(pickAllowedFields(req.body));
  res.status(201).json({
    success: true,
    message: 'Todo created successfully',
    data: todo,
  });
});

// GET /api/todos  -> get all tasks (newest first)
const getTodos = asyncHandler(async (req, res) => {
  const todos = await Todo.find().sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    count: todos.length,
    data: todos,
  });
});

// GET /api/todos/:id  -> get one task
const getTodoById = asyncHandler(async (req, res) => {
  const todo = await Todo.findById(req.params.id);
  if (!todo) {
    return res.status(404).json({ success: false, message: 'Todo not found' });
  }
  res.status(200).json({ success: true, data: todo });
});

// PUT /api/todos/:id  -> update a task
const updateTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findByIdAndUpdate(
    req.params.id,
    pickAllowedFields(req.body),
    { new: true, runValidators: true } // return the updated task and check the rules
  );
  if (!todo) {
    return res.status(404).json({ success: false, message: 'Todo not found' });
  }
  res.status(200).json({
    success: true,
    message: 'Todo updated successfully',
    data: todo,
  });
});

// DELETE /api/todos/:id  -> delete a task
const deleteTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findByIdAndDelete(req.params.id);
  if (!todo) {
    return res.status(404).json({ success: false, message: 'Todo not found' });
  }
  res.status(200).json({
    success: true,
    message: 'Todo deleted successfully',
    data: todo,
  });
});

module.exports = { createTodo, getTodos, getTodoById, updateTodo, deleteTodo };
