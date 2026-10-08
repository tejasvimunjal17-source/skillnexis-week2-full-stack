// Note routes. "router.use(protect)" runs the JWT check before EVERY route below it,
// so no note route can be reached without a valid token.
const express = require('express');
const {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
} = require('../controllers/noteController');
const {
  validateCreateNote,
  validateUpdateNote,
  validateObjectId,
} = require('../middleware/validateNote');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/').get(getNotes).post(validateCreateNote, createNote);

router
  .route('/:id')
  .get(validateObjectId, getNoteById)
  .put(validateObjectId, validateUpdateNote, updateNote)
  .delete(validateObjectId, deleteNote);

module.exports = router;
