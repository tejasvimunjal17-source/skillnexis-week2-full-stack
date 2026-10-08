// Basic request validation for todo data.
// Mongoose also validates, but checking early gives clearer error messages.

const ALLOWED_FIELDS = ['title', 'description', 'completed'];

// Returns a list of error messages (empty list = valid).
// partial = true is used for updates, where every field is optional.
const getTodoErrors = (body, { partial = false } = {}) => {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['Request body must be a JSON object'];
  }

  const { title, description, completed } = body;

  if (title === undefined) {
    if (!partial) errors.push('Title is required');
  } else if (typeof title !== 'string' || title.trim() === '') {
    errors.push('Title must be a non-empty string');
  } else if (title.trim().length > 100) {
    errors.push('Title cannot be longer than 100 characters');
  }

  if (description !== undefined) {
    if (typeof description !== 'string') {
      errors.push('Description must be a string');
    } else if (description.trim().length > 500) {
      errors.push('Description cannot be longer than 500 characters');
    }
  }

  if (completed !== undefined && typeof completed !== 'boolean') {
    errors.push('Completed must be true or false');
  }

  if (partial && !ALLOWED_FIELDS.some((field) => body[field] !== undefined)) {
    errors.push('Provide at least one field to update: title, description or completed');
  }

  return errors;
};

const sendValidationError = (res, errors) =>
  res.status(400).json({ success: false, message: 'Validation failed', errors });

const validateCreateTodo = (req, res, next) => {
  const errors = getTodoErrors(req.body);
  if (errors.length > 0) return sendValidationError(res, errors);
  next();
};

const validateUpdateTodo = (req, res, next) => {
  const errors = getTodoErrors(req.body, { partial: true });
  if (errors.length > 0) return sendValidationError(res, errors);
  next();
};

// A MongoDB id is 24 hexadecimal characters.
const validateObjectId = (req, res, next) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid todo ID format' });
  }
  next();
};

module.exports = {
  ALLOWED_FIELDS,
  getTodoErrors,
  validateCreateTodo,
  validateUpdateTodo,
  validateObjectId,
};
