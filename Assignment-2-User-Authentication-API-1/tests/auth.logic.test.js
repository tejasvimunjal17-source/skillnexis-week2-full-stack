// Tests the register / login / token-check LOGIC using small FAKES instead of
// MongoDB, bcrypt and jsonwebtoken (none of which are needed to run this file).
//
// IMPORTANT: this is NOT a database or real-encryption test. It proves our own
// code behaves correctly (status codes, messages, "password never sent back",
// "only the hash is stored"). It does NOT prove that the real bcrypt hashing,
// real JWT signing or real MongoDB work. Use "npm run smoke-test" against a
// running server and a real database for that.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

// ---------------- fakes ----------------
const bcryptCalls = { hash: [], compare: [] };
const fakeBcrypt = {
  hash: async (password, rounds) => {
    bcryptCalls.hash.push({ password, rounds });
    return `hashed(${rounds}):${password}`;
  },
  compare: async (password, hash) => {
    bcryptCalls.compare.push({ password, hash });
    return hash.startsWith('hashed(') && hash.endsWith(`):${password}`);
  },
};

const jwtError = (name, message) => {
  const error = new Error(message);
  error.name = name;
  return error;
};
const fakeJwt = {
  sign: (payload, secret, options) =>
    `fake.${Buffer.from(JSON.stringify({ payload, secret, options })).toString('base64url')}.sig`,
  verify: (token, secret) => {
    if (token === 'expired.token.here') throw jwtError('TokenExpiredError', 'jwt expired');
    if (!token.startsWith('fake.')) throw jwtError('JsonWebTokenError', 'jwt malformed');
    const data = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    if (data.secret !== secret) throw jwtError('JsonWebTokenError', 'invalid signature');
    return data.payload;
  },
};

let users = [];
let nextId = 1;
const newId = () => String(nextId++).padStart(24, '0');
const withoutPassword = ({ password, ...rest }) => rest; // like select: false

const FakeUser = {
  findOne: (query) => {
    const doc = users.find((u) => u.email === query.email) || null;
    const promise = Promise.resolve(doc ? withoutPassword(doc) : null);
    promise.select = () => Promise.resolve(doc); // .select('+password') includes the hash
    return promise;
  },
  findById: async (id) => {
    const doc = users.find((u) => u._id === id);
    return doc ? withoutPassword(doc) : null;
  },
  create: async (data) => {
    const doc = { _id: newId(), createdAt: new Date('2026-10-02T10:00:00Z'), ...data };
    users.push(doc);
    return { ...doc }; // a real created document still holds the password field
  },
};

// Swap the real modules for the fakes before our code loads them.
const originalLoad = Module._load;
Module._load = function (request) {
  if (request === 'bcrypt') return fakeBcrypt;
  if (request === 'jsonwebtoken') return fakeJwt;
  if (request.endsWith('models/User')) return FakeUser;
  return originalLoad.apply(this, arguments);
};

const { register, login, getProfile } = require('../src/controllers/authController');
const { protect } = require('../src/middleware/authMiddleware');
const generateToken = require('../src/utils/generateToken');

// ---------------- helpers ----------------
const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};

// Waits until the handler responds (res.json) or calls next().
const call = (handler, req) =>
  new Promise((resolve, reject) => {
    const res = makeRes();
    const originalJson = res.json;
    res.json = (data) => { originalJson(data); resolve({ res, nextCalled: false }); return res; };
    const next = (error) => (error ? reject(error) : resolve({ res, nextCalled: true }));
    handler(req, res, next);
  });

const alice = { name: '  Alice ', email: ' Alice@Example.COM ', password: 'secret123' };
const registerAlice = () => call(register, { body: alice });
const loginAs = (email, password) => call(login, { body: { email, password } });
const authReq = (token) => ({ headers: { authorization: token } });

test.beforeEach(() => {
  users = [];
  nextId = 1;
  bcryptCalls.hash = [];
  bcryptCalls.compare = [];
});

// ---------------- registration ----------------
test('register -> 201, user cleaned (trimmed name, lowercase email)', async () => {
  const { res } = await registerAlice();
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.message, 'User registered successfully');
  assert.strictEqual(res.body.data.user.name, 'Alice');
  assert.strictEqual(res.body.data.user.email, 'alice@example.com');
  assert.ok(res.body.data.user.id);
});

test('register -> only the bcrypt HASH is stored, never the plain password', async () => {
  await registerAlice();
  assert.strictEqual(users.length, 1);
  assert.notStrictEqual(users[0].password, 'secret123');
  assert.strictEqual(users[0].password, 'hashed(10):secret123');
  assert.deepStrictEqual(bcryptCalls.hash, [{ password: 'secret123', rounds: 10 }]);
});

test('register -> response never contains the password or the hash', async () => {
  const { res } = await registerAlice();
  const text = JSON.stringify(res.body);
  assert.ok(!text.includes('secret123'));
  assert.ok(!text.includes('hashed('));
  assert.ok(!('password' in res.body.data.user));
});

test('register -> duplicate email gives 409 and does not create a second user', async () => {
  await registerAlice();
  const { res } = await call(register, { body: { name: 'Other', email: 'ALICE@example.com', password: 'another1' } });
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.message, 'Email is already registered');
  assert.strictEqual(users.length, 1);
});

// ---------------- login ----------------
test('login -> 200 with a token that carries the user id', async () => {
  const { res: registered } = await registerAlice();
  const { res } = await loginAs('alice@example.com', 'secret123');
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.message, 'Login successful');
  assert.strictEqual(typeof res.body.token, 'string');
  const payload = fakeJwt.verify(res.body.token, 'test-secret');
  assert.strictEqual(payload.id, registered.body.data.user.id);
});

test('login -> token is signed with JWT_SECRET and JWT_EXPIRES_IN', async () => {
  await registerAlice();
  const { res } = await loginAs('alice@example.com', 'secret123');
  const decoded = JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64url').toString());
  assert.strictEqual(decoded.secret, 'test-secret');
  assert.strictEqual(decoded.options.expiresIn, '1h');
});

test('login -> email is not case-sensitive', async () => {
  await registerAlice();
  const { res } = await loginAs('  ALICE@EXAMPLE.COM ', 'secret123');
  assert.strictEqual(res.statusCode, 200);
});

test('login -> response never contains the password or the hash', async () => {
  await registerAlice();
  const { res } = await loginAs('alice@example.com', 'secret123');
  const text = JSON.stringify(res.body);
  assert.ok(!text.includes('secret123'));
  assert.ok(!text.includes('hashed('));
});

test('login -> wrong password gives 401 and no token', async () => {
  await registerAlice();
  const { res } = await loginAs('alice@example.com', 'wrong-password');
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.message, 'Invalid email or password');
  assert.strictEqual(res.body.token, undefined);
});

test('login -> unknown email gives the SAME 401 message as a wrong password', async () => {
  await registerAlice();
  const wrongPassword = await loginAs('alice@example.com', 'wrong-password');
  const unknownEmail = await loginAs('nobody@example.com', 'secret123');
  assert.strictEqual(unknownEmail.res.statusCode, 401);
  assert.deepStrictEqual(unknownEmail.res.body, wrongPassword.res.body);
});

// ---------------- protect middleware + profile ----------------
const loginToken = async () => {
  await registerAlice();
  const { res } = await loginAs('alice@example.com', 'secret123');
  return res.body.token;
};

test('protect -> no Authorization header gives 401', async () => {
  const { res, nextCalled } = await call(protect, { headers: {} });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.message, 'Not authorized: token missing');
  assert.strictEqual(nextCalled, false);
});

test('protect -> wrong scheme (not "Bearer") gives 401', async () => {
  const token = await loginToken();
  const { res, nextCalled } = await call(protect, authReq(`Token ${token}`));
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
});

test('protect -> "Bearer " with an empty token gives 401', async () => {
  const { res } = await call(protect, authReq('Bearer '));
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.message, 'Not authorized: token missing');
});

test('protect -> malformed token gives 401 invalid token', async () => {
  const { res } = await call(protect, authReq('Bearer abc.def.ghi'));
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.message, 'Not authorized: invalid token');
});

test('protect -> token signed with a different secret gives 401', async () => {
  const forged = fakeJwt.sign({ id: '1'.padStart(24, '0') }, 'some-other-secret', {});
  const { res } = await call(protect, authReq(`Bearer ${forged}`));
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.message, 'Not authorized: invalid token');
});

test('protect -> expired token gives 401 with an "expired" message', async () => {
  const { res } = await call(protect, authReq('Bearer expired.token.here'));
  assert.strictEqual(res.statusCode, 401);
  assert.match(res.body.message, /expired/);
});

test('protect -> valid token lets the request through and sets req.user', async () => {
  const token = await loginToken();
  const req = authReq(`Bearer ${token}`);
  const { nextCalled } = await call(protect, req);
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.user.email, 'alice@example.com');
  assert.strictEqual(req.user.password, undefined);
});

test('protect -> valid token but the user was deleted gives 401', async () => {
  const token = await loginToken();
  users = [];
  const { res, nextCalled } = await call(protect, authReq(`Bearer ${token}`));
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.message, 'Not authorized: user no longer exists');
  assert.strictEqual(nextCalled, false);
});

test('getProfile -> 200 with the user and no password', async () => {
  const token = await loginToken();
  const req = authReq(`Bearer ${token}`);
  await call(protect, req);
  const { res } = await call(getProfile, req);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.user.email, 'alice@example.com');
  assert.ok(!JSON.stringify(res.body).includes('hashed('));
});

// ---------------- generateToken ----------------
test('generateToken -> throws a clear error when JWT_SECRET is missing', () => {
  const saved = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  assert.throws(() => generateToken('abc'), /JWT_SECRET is not set/);
  process.env.JWT_SECRET = saved;
});

test('generateToken -> defaults to 1 day when JWT_EXPIRES_IN is not set', () => {
  const saved = process.env.JWT_EXPIRES_IN;
  delete process.env.JWT_EXPIRES_IN;
  const token = generateToken('abc');
  const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.strictEqual(decoded.options.expiresIn, '1d');
  process.env.JWT_EXPIRES_IN = saved;
});
