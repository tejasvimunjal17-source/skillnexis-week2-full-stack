// Basic request validation for registration and login.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72; // bcrypt only uses the first 72 characters

const isPlainObject = (body) =>
  body && typeof body === 'object' && !Array.isArray(body);

// Each function returns a list of error messages (empty list = valid).
const getRegisterErrors = (body) => {
  if (!isPlainObject(body)) return ['Request body must be a JSON object'];

  const errors = [];
  const { name, email, password } = body;

  if (typeof name !== 'string' || name.trim() === '') {
    errors.push('Name is required');
  } else if (name.trim().length > 50) {
    errors.push('Name cannot be longer than 50 characters');
  }

  if (typeof email !== 'string' || email.trim() === '') {
    errors.push('Email is required');
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.push('Please provide a valid email address');
  }

  if (typeof password !== 'string' || password === '') {
    errors.push('Password is required');
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password cannot be longer than ${MAX_PASSWORD_LENGTH} characters`);
  }

  return errors;
};

const getLoginErrors = (body) => {
  if (!isPlainObject(body)) return ['Request body must be a JSON object'];

  const errors = [];
  const { email, password } = body;

  if (typeof email !== 'string' || email.trim() === '') {
    errors.push('Email is required');
  }
  if (typeof password !== 'string' || password === '') {
    errors.push('Password is required');
  }

  return errors;
};

const sendValidationError = (res, errors) =>
  res.status(400).json({ success: false, message: 'Validation failed', errors });

const validateRegister = (req, res, next) => {
  const errors = getRegisterErrors(req.body);
  if (errors.length > 0) return sendValidationError(res, errors);
  next();
};

const validateLogin = (req, res, next) => {
  const errors = getLoginErrors(req.body);
  if (errors.length > 0) return sendValidationError(res, errors);
  next();
};

module.exports = {
  getRegisterErrors,
  getLoginErrors,
  validateRegister,
  validateLogin,
};
