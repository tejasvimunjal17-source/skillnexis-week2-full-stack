// Offline tests for validation, the JWT-secret check and error handling.
// They need no database and no npm packages: run with "npm test".
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  getRegisterErrors,
  getLoginErrors,
  validateRegister,
  validateLogin,
} = require('../src/middleware/validateAuth');
const {
  getNoteErrors,
  validateCreateNote,
  validateUpdateNote,
  validateObjectId,
} = require('../src/middleware/validateNote');
const { notFound, errorHandler } = require('../src/middleware/errorHandler');
const { getJwtSecretProblem, MIN_SECRET_LENGTH } = require('../src/config/checkEnv');

// Tiny fake "res" that records the status and JSON body
const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};

const validUser = { name: 'Alice', email: 'alice@example.com', password: 'secret123' };

// ---------- registration validation ----------
test('register: valid body passes', () => {
  assert.deepStrictEqual(getRegisterErrors(validUser), []);
});

test('register: missing/blank name fails', () => {
  assert.ok(getRegisterErrors({ ...validUser, name: undefined }).includes('Name is required'));
  assert.ok(getRegisterErrors({ ...validUser, name: '   ' }).includes('Name is required'));
});

test('register: name over 50 characters fails', () => {
  assert.strictEqual(getRegisterErrors({ ...validUser, name: 'a'.repeat(51) }).length, 1);
});

test('register: missing email fails', () => {
  assert.ok(getRegisterErrors({ ...validUser, email: undefined }).includes('Email is required'));
});

test('register: invalid email formats fail', () => {
  for (const email of ['plainaddress', 'a@b', '@example.com', 'a b@example.com', 'a@@example.com']) {
    assert.ok(
      getRegisterErrors({ ...validUser, email }).includes('Please provide a valid email address'),
      `should reject ${email}`
    );
  }
});

test('register: password rules (required, min 6, max 72)', () => {
  assert.ok(getRegisterErrors({ ...validUser, password: undefined }).includes('Password is required'));
  assert.ok(getRegisterErrors({ ...validUser, password: '12345' }).includes('Password must be at least 6 characters'));
  assert.deepStrictEqual(getRegisterErrors({ ...validUser, password: '123456' }), []);
  assert.ok(getRegisterErrors({ ...validUser, password: 'a'.repeat(73) }).includes('Password cannot be longer than 72 characters'));
});

test('register: several problems are all reported together', () => {
  assert.strictEqual(getRegisterErrors({}).length, 3);
});

test('register/login: body that is not an object fails', () => {
  assert.deepStrictEqual(getRegisterErrors(undefined), ['Request body must be a JSON object']);
  assert.deepStrictEqual(getRegisterErrors([]), ['Request body must be a JSON object']);
  assert.strictEqual(getLoginErrors(null).length, 1);
});

// ---------- login validation ----------
test('login: valid body passes; missing fields fail', () => {
  assert.deepStrictEqual(getLoginErrors({ email: 'a@b.co', password: 'x' }), []);
  assert.deepStrictEqual(getLoginErrors({}), ['Email is required', 'Password is required']);
});

test('validateRegister / validateLogin middleware: 400 on bad body, next() on good body', () => {
  const badRes = makeRes();
  validateRegister({ body: {} }, badRes, () => assert.fail('next should not run'));
  assert.strictEqual(badRes.statusCode, 400);
  assert.strictEqual(badRes.body.message, 'Validation failed');

  const badLogin = makeRes();
  validateLogin({ body: {} }, badLogin, () => assert.fail('next should not run'));
  assert.strictEqual(badLogin.statusCode, 400);

  let calls = 0;
  validateRegister({ body: validUser }, makeRes(), () => { calls++; });
  validateLogin({ body: { email: 'a@b.co', password: 'x' } }, makeRes(), () => { calls++; });
  assert.strictEqual(calls, 2);
});

// ---------- note validation ----------
test('note create: valid bodies pass (content is optional)', () => {
  assert.deepStrictEqual(getNoteErrors({ title: 'Shopping list' }), []);
  assert.deepStrictEqual(getNoteErrors({ title: 'Shopping list', content: 'Milk, eggs' }), []);
  assert.deepStrictEqual(getNoteErrors({ title: 'Empty note', content: '' }), []);
});

test('note create: missing, blank or non-string title fails', () => {
  assert.ok(getNoteErrors({}).includes('Title is required'));
  assert.deepStrictEqual(getNoteErrors({ title: '   ' }), ['Title must be a non-empty string']);
  assert.deepStrictEqual(getNoteErrors({ title: 123 }), ['Title must be a non-empty string']);
});

test('note create: title over 100 / content over 5000 characters fails; limits themselves pass', () => {
  assert.strictEqual(getNoteErrors({ title: 'a'.repeat(101) }).length, 1);
  assert.deepStrictEqual(getNoteErrors({ title: 'a'.repeat(100) }), []);
  assert.strictEqual(getNoteErrors({ title: 'ok', content: 'a'.repeat(5001) }).length, 1);
  assert.deepStrictEqual(getNoteErrors({ title: 'ok', content: 'a'.repeat(5000) }), []);
});

test('note create: non-string content fails', () => {
  assert.deepStrictEqual(getNoteErrors({ title: 'ok', content: 42 }), ['Content must be a string']);
});

test('note update: a single field is enough; empty or unknown-only body fails', () => {
  assert.deepStrictEqual(getNoteErrors({ content: 'new text' }, { partial: true }), []);
  assert.deepStrictEqual(getNoteErrors({ title: 'new title' }, { partial: true }), []);
  assert.deepStrictEqual(getNoteErrors({}, { partial: true }), ['Provide at least one field to update: title or content']);
  assert.strictEqual(getNoteErrors({ user: 'abc' }, { partial: true }).length, 1);
});

test('note update: blank title fails', () => {
  assert.strictEqual(getNoteErrors({ title: '' }, { partial: true }).length, 1);
});

test('note: body that is not an object fails', () => {
  assert.deepStrictEqual(getNoteErrors(undefined), ['Request body must be a JSON object']);
  assert.deepStrictEqual(getNoteErrors([]), ['Request body must be a JSON object']);
});

test('note middleware: validateCreateNote / validateUpdateNote', () => {
  const res = makeRes();
  validateCreateNote({ body: {} }, res, () => assert.fail('next should not run'));
  assert.strictEqual(res.statusCode, 400);

  const res2 = makeRes();
  validateUpdateNote({ body: {} }, res2, () => assert.fail('next should not run'));
  assert.strictEqual(res2.statusCode, 400);

  let calls = 0;
  validateCreateNote({ body: { title: 'x' } }, makeRes(), () => { calls++; });
  validateUpdateNote({ body: { content: 'y' } }, makeRes(), () => { calls++; });
  assert.strictEqual(calls, 2);
});

test('validateObjectId: rejects bad ids, accepts a real-looking id', () => {
  for (const id of ['123', 'not-an-id', '507f1f77bcf86cd79943901', '507f1f77bcf86cd7994390111', '507f1f77bcf86cd79943901g', '{"$gt":""}']) {
    const res = makeRes();
    validateObjectId({ params: { id } }, res, () => assert.fail(`next should not run for ${id}`));
    assert.strictEqual(res.statusCode, 400, `should reject ${id}`);
    assert.strictEqual(res.body.message, 'Invalid note ID format');
  }
  let called = false;
  validateObjectId({ params: { id: '507f1f77bcf86cd799439011' } }, makeRes(), () => { called = true; });
  assert.strictEqual(called, true);
});

// ---------- malformed / attacker-style input ----------
test('login: operator objects instead of strings (NoSQL injection attempt) are rejected', () => {
  const attack = { email: { $gt: '' }, password: { $gt: '' } };
  assert.deepStrictEqual(getLoginErrors(attack), ['Email is required', 'Password is required']);
  const res = makeRes();
  validateLogin({ body: attack }, res, () => assert.fail('next should not run'));
  assert.strictEqual(res.statusCode, 400);
});

test('register: operator objects instead of strings are rejected', () => {
  const attack = { name: { $ne: null }, email: { $gt: '' }, password: { $gt: '' } };
  assert.strictEqual(getRegisterErrors(attack).length, 3);
});

test('note: operator objects, arrays and numbers as title/content are rejected', () => {
  assert.ok(getNoteErrors({ title: { $ne: null } }).length >= 1);
  assert.ok(getNoteErrors({ title: ['a'] }).length >= 1);
  assert.ok(getNoteErrors({ title: 'ok', content: { $gt: '' } }).length >= 1);
  assert.ok(getNoteErrors({ title: 'ok', content: ['x'] }).length >= 1);
});

test('very long values are rejected, not crashed on', () => {
  assert.ok(getRegisterErrors({ name: 'a'.repeat(100000), email: 'a@b.co', password: 'b'.repeat(100000) }).length >= 2);
  assert.ok(getNoteErrors({ title: 'a'.repeat(100000), content: 'b'.repeat(100000) }).length >= 2);
});

// ---------- JWT secret check (runs at server start) ----------
test('JWT secret: missing or empty is a problem', () => {
  assert.match(getJwtSecretProblem(undefined), /missing/);
  assert.match(getJwtSecretProblem(''), /missing/);
});

test('JWT secret: the placeholder from .env.example is rejected', () => {
  const example = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
  const placeholder = example.match(/^JWT_SECRET=(.*)$/m)[1].trim();
  assert.match(getJwtSecretProblem(placeholder), /placeholder/);
});

test('JWT secret: too short is rejected; minimum length and generated secrets are accepted', () => {
  assert.match(getJwtSecretProblem('a'.repeat(MIN_SECRET_LENGTH - 1)), /too short/);
  assert.strictEqual(getJwtSecretProblem('a'.repeat(MIN_SECRET_LENGTH)), null);
  assert.strictEqual(getJwtSecretProblem(require('node:crypto').randomBytes(32).toString('hex')), null);
});

// ---------- not found + error handler ----------
test('notFound: returns 404 JSON', () => {
  const res = makeRes();
  notFound({ method: 'GET', originalUrl: '/nope' }, res);
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.message, 'Route not found: GET /nope');
});

test('errorHandler: invalid JSON -> 400', () => {
  const res = makeRes();
  errorHandler({ type: 'entity.parse.failed' }, {}, res, () => {});
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.message, 'Invalid JSON in request body');
});

test('errorHandler: mongoose ValidationError -> 400 with messages', () => {
  const res = makeRes();
  const err = { name: 'ValidationError', errors: { title: { message: 'Title is required' } } };
  errorHandler(err, {}, res, () => {});
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.body.errors, ['Title is required']);
});

test('errorHandler: duplicate key (code 11000) -> 409', () => {
  const res = makeRes();
  errorHandler({ code: 11000 }, {}, res, () => {});
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.message, 'Email is already registered');
});

test('errorHandler: unknown error -> 500; hides details in production', () => {
  const originalLog = console.error;
  console.error = () => {};
  const original = process.env.NODE_ENV;

  process.env.NODE_ENV = 'production';
  const prodRes = makeRes();
  errorHandler(new Error('secret detail'), {}, prodRes, () => {});
  assert.strictEqual(prodRes.statusCode, 500);
  assert.strictEqual(prodRes.body.error, undefined);

  process.env.NODE_ENV = 'development';
  const devRes = makeRes();
  errorHandler(new Error('secret detail'), {}, devRes, () => {});
  assert.strictEqual(devRes.body.error, 'secret detail');

  process.env.NODE_ENV = original;
  console.error = originalLog;
});
