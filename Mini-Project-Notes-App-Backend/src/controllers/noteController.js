// Controllers hold the logic for each note route.
// Every function here runs AFTER the "protect" middleware, so req.user is the logged-in user.
// Every database query is filtered by that user, so people can only touch their own notes.
const Note = require('../models/Note');
const asyncHandler = require('../middleware/asyncHandler');
const { ALLOWED_FIELDS } = require('../middleware/validateNote');

// Keep only the fields we allow, so a client can never set "user" or anything else.
const pickAllowedFields = (body) =>
  ALLOWED_FIELDS.reduce((result, field) => {
    if (body[field] !== undefined) result[field] = body[field];
    return result;
  }, {});

// What the client receives for a note.
const formatNote = (note) => ({
  id: note._id,
  title: note.title,
  content: note.content,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
});

const notFoundResponse = (res) =>
  res.status(404).json({ success: false, message: 'Note not found' });

// POST /api/notes  -> create a note
const createNote = asyncHandler(async (req, res) => {
  const note = await Note.create({
    ...pickAllowedFields(req.body),
    user: req.user._id, // the owner always comes from the token, never from the request body
  });
  res.status(201).json({
    success: true,
    message: 'Note created successfully',
    data: formatNote(note),
  });
});

// GET /api/notes  -> get all of MY notes (newest first)
const getNotes = asyncHandler(async (req, res) => {
  const notes = await Note.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    count: notes.length,
    data: notes.map(formatNote),
  });
});

// GET /api/notes/:id  -> get one of MY notes
const getNoteById = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
  if (!note) return notFoundResponse(res);
  res.status(200).json({ success: true, data: formatNote(note) });
});

// PUT /api/notes/:id  -> update one of MY notes (send only the fields you want to change)
const updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    pickAllowedFields(req.body),
    { new: true, runValidators: true } // return the updated note and check the rules
  );
  if (!note) return notFoundResponse(res);
  res.status(200).json({
    success: true,
    message: 'Note updated successfully',
    data: formatNote(note),
  });
});

// DELETE /api/notes/:id  -> delete one of MY notes
const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!note) return notFoundResponse(res);
  res.status(200).json({
    success: true,
    message: 'Note deleted successfully',
    data: formatNote(note),
  });
});

module.exports = { createNote, getNotes, getNoteById, updateNote, deleteNote };
