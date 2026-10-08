// Offline tests for the validation + error-handling code.
// These need no database and no npm packages: run with "npm test".
const test = require('node:test');
const assert = require('node:assert');
const {
  getTodoErrors,
  validateCreateTodo,
  validateUpdateTodo,
  validateObjectId,
} = require('../src/middleware/validateTodo');
const { notFound, errorHandler } = require('../src/middleware/errorHandler');

// Tiny fake "res" that records the status and JSON body
const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};

test('create: valid body passes', () => {
  assert.deepStrictEqual(getTodoErrors({ title: 'Buy milk' }), []);
});

test('create: missing title fails', () => {
  assert.ok(getTodoErrors({}).includes('Title is required'));
});

test('create: empty/blank title fails', () => {
  assert.strictEqual(getTodoErrors({ title: '   ' }).length, 1);
});

test('create: non-string title fails', () => {
  assert.strictEqual(getTodoErrors({ title: 123 }).length, 1);
});

test('create: title over 100 chars fails', () => {
  assert.strictEqual(getTodoErrors({ title: 'a'.repeat(101) }).length, 1);
});

test('create: description over 500 chars fails', () => {
  assert.strictEqual(getTodoErrors({ title: 'ok', description: 'a'.repeat(501) }).length, 1);
});

test('create: completed must be boolean', () => {
  assert.strictEqual(getTodoErrors({ title: 'ok', completed: 'yes' }).length, 1);
});

test('create: body that is not an object fails', () => {
  assert.strictEqual(getTodoErrors(undefined).length, 1);
  assert.strictEqual(getTodoErrors([]).length, 1);
});

test('update: only completed is allowed', () => {
  assert.deepStrictEqual(getTodoErrors({ completed: true }, { partial: true }), []);
});

test('update: empty body fails', () => {
  assert.strictEqual(getTodoErrors({}, { partial: true }).length, 1);
});

test('update: unknown fields only fails', () => {
  assert.strictEqual(getTodoErrors({ foo: 'bar' }, { partial: true }).length, 1);
});

test('update: blank title fails', () => {
  assert.strictEqual(getTodoErrors({ title: '' }, { partial: true }).length, 1);
});

test('validateCreateTodo middleware: 400 on bad body, next() on good body', () => {
  const badRes = makeRes();
  let called = false;
  validateCreateTodo({ body: {} }, badRes, () => { called = true; });
  assert.strictEqual(badRes.statusCode, 400);
  assert.strictEqual(badRes.body.success, false);
  assert.strictEqual(called, false);

  validateCreateTodo({ body: { title: 'x' } }, makeRes(), () => { called = true; });
  assert.strictEqual(called, true);
});

test('validateUpdateTodo middleware: 400 on empty body', () => {
  const res = makeRes();
  validateUpdateTodo({ body: {} }, res, () => assert.fail('next should not run'));
  assert.strictEqual(res.statusCode, 400);
});

test('validateObjectId: rejects bad id, accepts good id', () => {
  const res = makeRes();
  validateObjectId({ params: { id: '123' } }, res, () => assert.fail('next should not run'));
  assert.strictEqual(res.statusCode, 400);

  let called = false;
  validateObjectId({ params: { id: '507f1f77bcf86cd799439011' } }, makeRes(), () => { called = true; });
  assert.strictEqual(called, true);
});

test('notFound: returns 404 JSON', () => {
  const res = makeRes();
  notFound({ method: 'GET', originalUrl: '/nope' }, res);
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.success, false);
});

test('errorHandler: invalid JSON -> 400', () => {
  const res = makeRes();
  errorHandler({ type: 'entity.parse.failed' }, {}, res, () => {});
  assert.strictEqual(res.statusCode, 400);
});

test('errorHandler: mongoose ValidationError -> 400 with messages', () => {
  const res = makeRes();
  const err = { name: 'ValidationError', errors: { title: { message: 'Title is required' } } };
  errorHandler(err, {}, res, () => {});
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.body.errors, ['Title is required']);
});

test('errorHandler: CastError -> 400', () => {
  const res = makeRes();
  errorHandler({ name: 'CastError', path: '_id', value: 'abc' }, {}, res, () => {});
  assert.strictEqual(res.statusCode, 400);
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
