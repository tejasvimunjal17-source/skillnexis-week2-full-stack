// Basic request validation for notes.
// Mongoose also validates, but checking early gives clearer error messages.

const ALLOWED_FIELDS = ['title', 'content']; // the only fields a client may set

const isPlainObject = (body) =>
  body && typeof body === 'object' && !Array.isArray(body);

// Returns a list of error messages (empty list = valid).
// partial = true is used for updates, where every field is optional.
const getNoteErrors = (body, { partial = false } = {}) => {
  if (!isPlainObject(body)) return ['Request body must be a JSON object'];

  const errors = [];
  const { title, content } = body;

  if (title === undefined) {
    if (!partial) errors.push('Title is required');
  } else if (typeof title !== 'string' || title.trim() === '') {
    errors.push('Title must be a non-empty string');
  } else if (title.trim().length > 100) {
    errors.push('Title cannot be longer than 100 characters');
  }

  if (content !== undefined) {
    if (typeof content !== 'string') {
      errors.push('Content must be a string');
    } else if (content.trim().length > 5000) {
      errors.push('Content cannot be longer than 5000 characters');
    }
  }

  if (partial && !ALLOWED_FIELDS.some((field) => body[field] !== undefined)) {
    errors.push('Provide at least one field to update: title or content');
  }

  return errors;
};

const sendValidationError = (res, errors) =>
  res.status(400).json({ success: false, message: 'Validation failed', errors });

const validateCreateNote = (req, res, next) => {
  const errors = getNoteErrors(req.body);
  if (errors.length > 0) return sendValidationError(res, errors);
  next();
};

const validateUpdateNote = (req, res, next) => {
  const errors = getNoteErrors(req.body, { partial: true });
  if (errors.length > 0) return sendValidationError(res, errors);
  next();
};

// A MongoDB id is 24 hexadecimal characters.
const validateObjectId = (req, res, next) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid note ID format' });
  }
  next();
};

module.exports = {
  ALLOWED_FIELDS,
  getNoteErrors,
  validateCreateNote,
  validateUpdateNote,
  validateObjectId,
};
