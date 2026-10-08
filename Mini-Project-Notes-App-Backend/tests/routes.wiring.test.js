// Checks how the routes are WIRED together, using a tiny fake Express that records
// what the route files and app.js register. This proves that:
//   - every note route has the JWT check ("protect") in front of it,
//   - the note routes are exactly the five CRUD routes, with the right validators,
//   - only register and login are public,
//   - app.js mounts everything in a safe order.
// It does NOT start a real Express server. Use "npm run smoke-test" for that.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

process.env.JWT_SECRET = 'test-secret';

// ---------------- fake Express ----------------
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const makeRouter = () => {
  const router = { log: [] }; // log keeps the ORDER in which things were registered
  router.use = (...fns) => { router.log.push({ type: 'use', fns }); return router; };
  router.route = (path) => {
    const chain = {};
    for (const m of METHODS) {
      chain[m] = (...handlers) => { router.log.push({ type: 'route', method: m.toUpperCase(), path, handlers }); return chain; };
    }
    return chain;
  };
  for (const m of METHODS) {
    router[m] = (path, ...handlers) => { router.log.push({ type: 'route', method: m.toUpperCase(), path, handlers }); return router; };
  }
  return router;
};

const jsonMiddleware = function jsonMiddleware() {};
const fakeExpress = () => {
  const app = { log: [] };
  app.use = (...args) => { app.log.push({ type: 'use', args }); return app; };
  app.get = (path, handler) => { app.log.push({ type: 'get', path, handler }); return app; };
  return app;
};
fakeExpress.Router = makeRouter;
fakeExpress.json = () => jsonMiddleware;

const originalLoad = Module._load;
Module._load = function (request) {
  if (request === 'express') return fakeExpress;
  if (request === 'jsonwebtoken') return {};
  if (request === 'bcrypt') return {};
  if (request === 'mongoose') return {};
  if (request.endsWith('models/User') || request.endsWith('models/Note')) return {};
  return originalLoad.apply(this, arguments);
};

const noteRouter = require('../src/routes/noteRoutes');
const authRouter = require('../src/routes/authRoutes');
const app = require('../src/app');
const { protect } = require('../src/middleware/authMiddleware');
const noteController = require('../src/controllers/noteController');
const authController = require('../src/controllers/authController');
const { validateCreateNote, validateUpdateNote, validateObjectId } = require('../src/middleware/validateNote');
const { validateRegister, validateLogin } = require('../src/middleware/validateAuth');
const { notFound, errorHandler } = require('../src/middleware/errorHandler');

const routesOf = (router) => router.log.filter((e) => e.type === 'route');
const find = (router, method, path) => routesOf(router).find((r) => r.method === method && r.path === path);

// ---------------- note routes ----------------
test('note router: "protect" is registered FIRST, before any route', () => {
  assert.strictEqual(noteRouter.log[0].type, 'use');
  assert.deepStrictEqual(noteRouter.log[0].fns, [protect]);
});

test('note router: no route is registered before protect (so none can bypass it)', () => {
  const protectIndex = noteRouter.log.findIndex((e) => e.type === 'use' && e.fns.includes(protect));
  const firstRouteIndex = noteRouter.log.findIndex((e) => e.type === 'route');
  assert.strictEqual(protectIndex, 0);
  assert.ok(protectIndex < firstRouteIndex);
});

test('note router: exactly the five CRUD routes exist, nothing else', () => {
  const table = routesOf(noteRouter).map((r) => `${r.method} ${r.path}`).sort();
  assert.deepStrictEqual(table, ['DELETE /:id', 'GET /', 'GET /:id', 'POST /', 'PUT /:id']);
});

test('note router: each route runs its validators, then the right controller', () => {
  assert.deepStrictEqual(find(noteRouter, 'GET', '/').handlers, [noteController.getNotes]);
  assert.deepStrictEqual(find(noteRouter, 'POST', '/').handlers, [validateCreateNote, noteController.createNote]);
  assert.deepStrictEqual(find(noteRouter, 'GET', '/:id').handlers, [validateObjectId, noteController.getNoteById]);
  assert.deepStrictEqual(find(noteRouter, 'PUT', '/:id').handlers, [validateObjectId, validateUpdateNote, noteController.updateNote]);
  assert.deepStrictEqual(find(noteRouter, 'DELETE', '/:id').handlers, [validateObjectId, noteController.deleteNote]);
});

// ---------------- auth routes ----------------
test('auth router: only POST /register and POST /login exist', () => {
  const table = routesOf(authRouter).map((r) => `${r.method} ${r.path}`).sort();
  assert.deepStrictEqual(table, ['POST /login', 'POST /register']);
});

test('auth router: register and login run validation, then the controller', () => {
  assert.deepStrictEqual(find(authRouter, 'POST', '/register').handlers, [validateRegister, authController.register]);
  assert.deepStrictEqual(find(authRouter, 'POST', '/login').handlers, [validateLogin, authController.login]);
});

test('auth router: register and login are public (no protect)', () => {
  assert.ok(authRouter.log.every((e) => e.type !== 'use'));
  for (const r of routesOf(authRouter)) assert.ok(!r.handlers.includes(protect));
});

// ---------------- app.js ----------------
test('app: JSON parsing first, then health route, then /api/auth, /api/notes, then 404 and error handler last', () => {
  const [json, health, auth, notes, notFoundEntry, errorEntry, ...rest] = app.log;
  assert.deepStrictEqual(json, { type: 'use', args: [jsonMiddleware] });
  assert.strictEqual(health.type, 'get');
  assert.strictEqual(health.path, '/');
  assert.deepStrictEqual(auth.args, ['/api/auth', authRouter]);
  assert.deepStrictEqual(notes.args, ['/api/notes', noteRouter]);
  assert.deepStrictEqual(notFoundEntry.args, [notFound]);
  assert.deepStrictEqual(errorEntry.args, [errorHandler]);
  assert.deepStrictEqual(rest, []);
});

test('app: notes are mounted only under /api/notes, through the protected router', () => {
  const mounts = app.log.filter((e) => e.type === 'use' && typeof e.args[0] === 'string');
  assert.deepStrictEqual(mounts.map((m) => m.args[0]), ['/api/auth', '/api/notes']);
  assert.strictEqual(mounts.find((m) => m.args[0] === '/api/notes').args[1].log[0].fns[0], protect);
});
