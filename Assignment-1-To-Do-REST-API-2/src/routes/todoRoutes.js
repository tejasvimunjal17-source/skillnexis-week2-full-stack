// Connects URLs + HTTP methods to controller functions.
const express = require('express');
const {
  createTodo,
  getTodos,
  getTodoById,
  updateTodo,
  deleteTodo,
} = require('../controllers/todoController');
const {
  validateCreateTodo,
  validateUpdateTodo,
  validateObjectId,
} = require('../middleware/validateTodo');

const router = express.Router();

router.route('/').get(getTodos).post(validateCreateTodo, createTodo);

router
  .route('/:id')
  .get(validateObjectId, getTodoById)
  .put(validateObjectId, validateUpdateTodo, updateTodo)
  .patch(validateObjectId, validateUpdateTodo, updateTodo)
  .delete(validateObjectId, deleteTodo);

module.exports = router;
