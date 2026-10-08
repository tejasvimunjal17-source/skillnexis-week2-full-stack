// Offline tests for validation + error handling.
// They need no database and no npm packages: run with "npm test".
const test = require('node:test');
const assert = require('node:assert');
const {
  getRegisterErrors,
  getLoginErrors,
  validateRegister,
  validateLogin,
} = require('../src/middleware/validateAuth');
const { notFound, errorHandler } = require('../src/middleware/errorHandler');

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

test('register: missing name fails', () => {
  assert.ok(getRegisterErrors({ ...validUser, name: undefined }).includes('Name is required'));
});

test('register: blank name fails', () => {
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

test('register: email with surrounding spaces is accepted (it is trimmed later)', () => {
  assert.deepStrictEqual(getRegisterErrors({ ...validUser, email: '  alice@example.com  ' }), []);
});

test('register: missing password fails', () => {
  assert.ok(getRegisterErrors({ ...validUser, password: undefined }).includes('Password is required'));
});

test('register: password shorter than 6 fails', () => {
  assert.ok(getRegisterErrors({ ...validUser, password: '12345' }).includes('Password must be at least 6 characters'));
});

test('register: password of exactly 6 characters passes', () => {
  assert.deepStrictEqual(getRegisterErrors({ ...validUser, password: '123456' }), []);
});

test('register: password longer than 72 fails', () => {
  assert.ok(getRegisterErrors({ ...validUser, password: 'a'.repeat(73) }).includes('Password cannot be longer than 72 characters'));
});

test('register: non-string values fail', () => {
  assert.ok(getRegisterErrors({ name: 123, email: 456, password: 789 }).length >= 3);
});

test('register: several problems are all reported together', () => {
  assert.strictEqual(getRegisterErrors({}).length, 3);
});

test('register: body that is not an object fails', () => {
  assert.deepStrictEqual(getRegisterErrors(undefined), ['Request body must be a JSON object']);
  assert.deepStrictEqual(getRegisterErrors([]), ['Request body must be a JSON object']);
});

// ---------- login validation ----------
test('login: valid body passes', () => {
  assert.deepStrictEqual(getLoginErrors({ email: 'a@b.co', password: 'x' }), []);
});

test('login: missing email and password fail', () => {
  assert.deepStrictEqual(getLoginErrors({}), ['Email is required', 'Password is required']);
});

test('login: non-string values fail', () => {
  assert.strictEqual(getLoginErrors({ email: 1, password: 2 }).length, 2);
});

test('login: body that is not an object fails', () => {
  assert.strictEqual(getLoginErrors(null).length, 1);
});

// ---------- middleware wrappers ----------
test('validateRegister middleware: 400 on bad body, next() on good body', () => {
  const badRes = makeRes();
  let called = false;
  validateRegister({ body: {} }, badRes, () => { called = true; });
  assert.strictEqual(badRes.statusCode, 400);
  assert.strictEqual(badRes.body.success, false);
  assert.strictEqual(badRes.body.message, 'Validation failed');
  assert.strictEqual(called, false);

  validateRegister({ body: validUser }, makeRes(), () => { called = true; });
  assert.strictEqual(called, true);
});

test('validateLogin middleware: 400 on bad body, next() on good body', () => {
  const badRes = makeRes();
  validateLogin({ body: {} }, badRes, () => assert.fail('next should not run'));
  assert.strictEqual(badRes.statusCode, 400);

  let called = false;
  validateLogin({ body: { email: 'a@b.co', password: 'x' } }, makeRes(), () => { called = true; });
  assert.strictEqual(called, true);
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
  const err = { name: 'ValidationError', errors: { name: { message: 'Name is required' } } };
  errorHandler(err, {}, res, () => {});
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.body.errors, ['Name is required']);
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

  const res = makeRes();
  validateRegister({ body: attack }, res, () => assert.fail('next should not run'));
  assert.strictEqual(res.statusCode, 400);
});

test('login/register: array values are rejected', () => {
  assert.strictEqual(getLoginErrors({ email: ['a@b.co'], password: ['x'] }).length, 2);
  assert.ok(getRegisterErrors({ ...validUser, email: ['alice@example.com'] }).length >= 1);
});

test('register: a very long name or password is rejected, not crashed on', () => {
  assert.ok(getRegisterErrors({ name: 'a'.repeat(100000), email: 'a@b.co', password: 'b'.repeat(100000) }).length >= 2);
});

// ---------- JWT secret check (runs at server start) ----------
const fs = require('node:fs');
const path = require('node:path');
const { getJwtSecretProblem, MIN_SECRET_LENGTH } = require('../src/config/checkEnv');

test('JWT secret: missing or empty is a problem', () => {
  assert.match(getJwtSecretProblem(undefined), /missing/);
  assert.match(getJwtSecretProblem(''), /missing/);
});

test('JWT secret: the placeholder from .env.example is rejected', () => {
  const example = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
  const placeholder = example.match(/^JWT_SECRET=(.*)$/m)[1].trim();
  assert.match(getJwtSecretProblem(placeholder), /placeholder/);
});

test('JWT secret: too short is rejected, minimum length is accepted', () => {
  assert.match(getJwtSecretProblem('a'.repeat(MIN_SECRET_LENGTH - 1)), /too short/);
  assert.strictEqual(getJwtSecretProblem('a'.repeat(MIN_SECRET_LENGTH)), null);
});

test('JWT secret: a generated 64-character hex secret is accepted', () => {
  const generated = require('node:crypto').randomBytes(32).toString('hex');
  assert.strictEqual(getJwtSecretProblem(generated), null);
});
