// Tests the NOTE logic (create / read / update / delete) and, most importantly,
// that every user can only reach their OWN notes. A small in-memory FAKE note
// store is used instead of MongoDB (and fakes for bcrypt / jsonwebtoken).
//
// IMPORTANT: this is NOT a database test. It does not prove that real MongoDB or
// Mongoose behave this way. It proves our code asks the database the right
// questions (always filtered by the logged-in user) and answers correctly.
// Use "npm run smoke-test" against a real database for the real thing.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

process.env.JWT_SECRET = 'test-secret';

// ---------------- fakes ----------------
const fakeJwt = {
  sign: (payload, secret) => `fake.${Buffer.from(JSON.stringify({ payload, secret })).toString('base64url')}.sig`,
  verify: (token, secret) => {
    const data = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    if (data.secret !== secret) throw Object.assign(new Error('invalid signature'), { name: 'JsonWebTokenError' });
    return data.payload;
  },
};

const USER_A = { _id: 'a'.repeat(24), name: 'Alice', email: 'alice@example.com' };
const USER_B = { _id: 'b'.repeat(24), name: 'Bob', email: 'bob@example.com' };
const FakeUser = {
  findById: async (id) => [USER_A, USER_B].find((u) => u._id === id) || null,
};

let notes = [];
let queries = []; // every query the controllers send to the "database"
let nextId = 1;
const newId = () => String(nextId++).padStart(24, '0');
const matches = (note, query) => Object.entries(query).every(([key, value]) => String(note[key]) === String(value));
const stamp = () => new Date('2026-10-02T10:00:00Z');

const FakeNote = {
  create: async (data) => {
    queries.push({ method: 'create', query: data });
    const doc = { _id: newId(), content: '', createdAt: stamp(), updatedAt: stamp(), ...data };
    notes.push(doc);
    return { ...doc };
  },
  find: (query) => {
    queries.push({ method: 'find', query });
    return { sort: async () => notes.filter((n) => matches(n, query)).reverse().map((n) => ({ ...n })) };
  },
  findOne: async (query) => {
    queries.push({ method: 'findOne', query });
    const note = notes.find((n) => matches(n, query));
    return note ? { ...note } : null;
  },
  findOneAndUpdate: async (query, updates) => {
    queries.push({ method: 'findOneAndUpdate', query });
    const note = notes.find((n) => matches(n, query));
    if (!note) return null;
    Object.assign(note, updates, { updatedAt: new Date('2026-10-02T11:00:00Z') });
    return { ...note };
  },
  findOneAndDelete: async (query) => {
    queries.push({ method: 'findOneAndDelete', query });
    const index = notes.findIndex((n) => matches(n, query));
    return index === -1 ? null : notes.splice(index, 1)[0];
  },
};

const originalLoad = Module._load;
Module._load = function (request) {
  if (request === 'jsonwebtoken') return fakeJwt;
  if (request === 'bcrypt') return {};
  if (request.endsWith('models/User')) return FakeUser;
  if (request.endsWith('models/Note')) return FakeNote;
  return originalLoad.apply(this, arguments);
};

const { protect } = require('../src/middleware/authMiddleware');
const { createNote, getNotes, getNoteById, updateNote, deleteNote } = require('../src/controllers/noteController');

// ---------------- helpers ----------------
const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};
const call = (handler, req) =>
  new Promise((resolve, reject) => {
    const res = makeRes();
    const originalJson = res.json;
    res.json = (data) => { originalJson(data); resolve({ res, nextCalled: false }); return res; };
    handler(req, res, (error) => (error ? reject(error) : resolve({ res, nextCalled: true })));
  });

// Sends a request exactly like the real route does: protect first, then the handler.
const asUser = async (user, handler, { params = {}, body = {} } = {}) => {
  const req = { headers: { authorization: `Bearer ${fakeJwt.sign({ id: user._id }, 'test-secret')}` }, params, body };
  const auth = await call(protect, req);
  if (!auth.nextCalled) return auth.res;
  return (await call(handler, req)).res;
};
const createAs = (user, body) => asUser(user, createNote, { body });
const idOf = (res) => res.body.data.id;

test.beforeEach(() => {
  notes = [];
  queries = [];
  nextId = 1;
});

// ---------------- create ----------------
test('create -> 201 with id, title, content and timestamps', async () => {
  const res = await createAs(USER_A, { title: 'Shopping list', content: 'Milk, eggs' });
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.message, 'Note created successfully');
  assert.strictEqual(res.body.data.title, 'Shopping list');
  assert.strictEqual(res.body.data.content, 'Milk, eggs');
  assert.ok(res.body.data.id && res.body.data.createdAt && res.body.data.updatedAt);
});

test('create -> content is optional and defaults to an empty string', async () => {
  const res = await createAs(USER_A, { title: 'Just a title' });
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.data.content, '');
});

test('create -> the owner is taken from the token and the owner id is not sent back', async () => {
  const res = await createAs(USER_A, { title: 'Mine' });
  assert.strictEqual(notes[0].user, USER_A._id);
  assert.ok(!('user' in res.body.data));
});

test('create -> a client cannot choose the owner or other fields (mass-assignment attempt)', async () => {
  const res = await createAs(USER_A, { title: 'Sneaky', user: USER_B._id, _id: 'f'.repeat(24), createdAt: '2000-01-01' });
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(notes[0].user, USER_A._id, 'owner must still be the logged-in user');
  assert.notStrictEqual(notes[0]._id, 'f'.repeat(24));
  assert.notStrictEqual(String(notes[0].createdAt), '2000-01-01');
});

// ---------------- read ----------------
test('list -> returns only MY notes, newest first, with a count', async () => {
  await createAs(USER_A, { title: 'A first' });
  await createAs(USER_B, { title: 'B note' });
  await createAs(USER_A, { title: 'A second' });
  const res = await asUser(USER_A, getNotes);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.count, 2);
  assert.deepStrictEqual(res.body.data.map((n) => n.title), ['A second', 'A first']);
});

test('list -> a user with no notes gets an empty list, not other people\'s notes', async () => {
  await createAs(USER_A, { title: 'A note' });
  const res = await asUser(USER_B, getNotes);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.count, 0);
  assert.deepStrictEqual(res.body.data, []);
});

test('get one -> 200 for my note', async () => {
  const id = idOf(await createAs(USER_A, { title: 'Mine' }));
  const res = await asUser(USER_A, getNoteById, { params: { id } });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.id, id);
});

test('get one -> another user\'s note gives 404, identical to a note that does not exist', async () => {
  const id = idOf(await createAs(USER_A, { title: 'Private' }));
  const others = await asUser(USER_B, getNoteById, { params: { id } });
  const missing = await asUser(USER_B, getNoteById, { params: { id: 'c'.repeat(24) } });
  assert.strictEqual(others.statusCode, 404);
  assert.strictEqual(others.body.message, 'Note not found');
  assert.deepStrictEqual(others.body, missing.body);
});

// ---------------- update ----------------
test('update -> 200, changes only the fields sent', async () => {
  const id = idOf(await createAs(USER_A, { title: 'Old title', content: 'Keep me' }));
  const res = await asUser(USER_A, updateNote, { params: { id }, body: { title: 'New title' } });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.message, 'Note updated successfully');
  assert.strictEqual(res.body.data.title, 'New title');
  assert.strictEqual(res.body.data.content, 'Keep me');
});

test('update -> another user\'s note gives 404 and the note is NOT changed', async () => {
  const id = idOf(await createAs(USER_A, { title: 'Original' }));
  const res = await asUser(USER_B, updateNote, { params: { id }, body: { title: 'Hacked' } });
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(notes[0].title, 'Original');
});

test('update -> a client cannot hand the note to another user (mass-assignment attempt)', async () => {
  const id = idOf(await createAs(USER_A, { title: 'Mine' }));
  await asUser(USER_A, updateNote, { params: { id }, body: { title: 'Still mine', user: USER_B._id } });
  assert.strictEqual(notes[0].user, USER_A._id);
  assert.strictEqual(notes[0].title, 'Still mine');
});

test('update -> a note that does not exist gives 404', async () => {
  const res = await asUser(USER_A, updateNote, { params: { id: 'c'.repeat(24) }, body: { title: 'x' } });
  assert.strictEqual(res.statusCode, 404);
});

// ---------------- delete ----------------
test('delete -> 200, the note is gone, and a second delete gives 404', async () => {
  const id = idOf(await createAs(USER_A, { title: 'Temporary' }));
  const first = await asUser(USER_A, deleteNote, { params: { id } });
  assert.strictEqual(first.statusCode, 200);
  assert.strictEqual(first.body.message, 'Note deleted successfully');
  assert.strictEqual(notes.length, 0);
  const second = await asUser(USER_A, deleteNote, { params: { id } });
  assert.strictEqual(second.statusCode, 404);
});

test('delete -> another user\'s note gives 404 and the note is NOT deleted', async () => {
  const id = idOf(await createAs(USER_A, { title: 'Keep' }));
  const res = await asUser(USER_B, deleteNote, { params: { id } });
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(notes.length, 1);
});

// ---------------- protection + query filtering ----------------
test('protect in front of a handler: no token means the handler never runs and nothing is saved', async () => {
  const req = { headers: {}, params: {}, body: { title: 'Sneaky' } };
  const auth = await call(protect, req);
  assert.strictEqual(auth.res.statusCode, 401);
  assert.strictEqual(auth.nextCalled, false);
  assert.strictEqual(notes.length, 0);
});

test('a token for a user that no longer exists cannot read notes', async () => {
  await createAs(USER_A, { title: 'A note' });
  const ghostToken = fakeJwt.sign({ id: 'd'.repeat(24) }, 'test-secret');
  const req = { headers: { authorization: `Bearer ${ghostToken}` }, params: {}, body: {} };
  const auth = await call(protect, req);
  assert.strictEqual(auth.res.statusCode, 401);
});

test('EVERY database query made by the note controllers is filtered by the logged-in user', async () => {
  const id = idOf(await createAs(USER_A, { title: 'Q' }));
  await asUser(USER_A, getNotes);
  await asUser(USER_A, getNoteById, { params: { id } });
  await asUser(USER_A, updateNote, { params: { id }, body: { title: 'Q2' } });
  await asUser(USER_A, deleteNote, { params: { id } });
  assert.deepStrictEqual(queries.map((q) => q.method), ['create', 'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete']);
  for (const { method, query } of queries) {
    assert.strictEqual(String(query.user), USER_A._id, `${method} must filter/set user = logged-in user`);
  }
});
