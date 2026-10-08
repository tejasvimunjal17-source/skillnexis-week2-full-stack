// Tests the controller LOGIC (status codes + response shape) using a small
// in-memory FAKE model instead of MongoDB.
// IMPORTANT: this is NOT a database test. It does not prove MongoDB/Mongoose
// works. Use "npm run smoke-test" against a real database for that.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// ---- fake Todo model, injected in place of the real Mongoose model ----
let store = [];
let nextId = 1;
const newId = () => String(nextId++).padStart(24, '0');

const FakeTodo = {
  create: async (data) => {
    const doc = { _id: newId(), completed: false, description: '', ...data };
    store.push(doc);
    return doc;
  },
  find: () => ({ sort: async () => [...store].reverse() }),
  findById: async (id) => store.find((t) => t._id === id) || null,
  findByIdAndUpdate: async (id, updates) => {
    const doc = store.find((t) => t._id === id);
    if (!doc) return null;
    Object.assign(doc, updates);
    return doc;
  },
  findByIdAndDelete: async (id) => {
    const i = store.findIndex((t) => t._id === id);
    return i === -1 ? null : store.splice(i, 1)[0];
  },
};

const modelPath = require.resolve(path.join('..', 'src', 'models', 'Todo.js'));
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: FakeTodo };

const controller = require('../src/controllers/todoController');

const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};
// asyncHandler returns before the promise finishes, so wait for the response
const call = (handler, req) =>
  new Promise((resolve, reject) => {
    const res = makeRes();
    const originalJson = res.json;
    res.json = (data) => { originalJson(data); resolve(res); return res; };
    handler(req, res, reject);
  });

test.beforeEach(() => { store = []; nextId = 1; });

test('createTodo -> 201 and returns the todo', async () => {
  const res = await call(controller.createTodo, { body: { title: 'Learn Express', extra: 'ignored' } });
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.data.title, 'Learn Express');
  assert.strictEqual(res.body.data.extra, undefined); // unknown field stripped
});

test('getTodos -> 200 with count', async () => {
  await FakeTodo.create({ title: 'a' });
  await FakeTodo.create({ title: 'b' });
  const res = await call(controller.getTodos, {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.count, 2);
});

test('getTodoById -> 200 when found, 404 when missing', async () => {
  const todo = await FakeTodo.create({ title: 'a' });
  const ok = await call(controller.getTodoById, { params: { id: todo._id } });
  assert.strictEqual(ok.statusCode, 200);
  const missing = await call(controller.getTodoById, { params: { id: '9'.repeat(24) } });
  assert.strictEqual(missing.statusCode, 404);
});

test('updateTodo -> 200 with new values, 404 when missing', async () => {
  const todo = await FakeTodo.create({ title: 'a' });
  const ok = await call(controller.updateTodo, { params: { id: todo._id }, body: { completed: true } });
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(ok.body.data.completed, true);
  const missing = await call(controller.updateTodo, { params: { id: '9'.repeat(24) }, body: { completed: true } });
  assert.strictEqual(missing.statusCode, 404);
});

test('deleteTodo -> 200 then 404 on second delete', async () => {
  const todo = await FakeTodo.create({ title: 'a' });
  const ok = await call(controller.deleteTodo, { params: { id: todo._id } });
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(store.length, 0);
  const again = await call(controller.deleteTodo, { params: { id: todo._id } });
  assert.strictEqual(again.statusCode, 404);
});
