// End-to-end check against a RUNNING server that is connected to a REAL MongoDB.
// 1) Start the server:  npm start
// 2) In a second terminal:  npm run smoke-test
// Optional: BASE_URL=http://localhost:5000 npm run smoke-test
// Each run registers TWO new test users (smoke.a.<time>@example.com and smoke.b.<time>@example.com)
// and creates a few notes. The test deletes the notes it creates, but this project has no
// "delete user" route, so the two test users stay in your database.
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
let passed = 0;
let failed = 0;

const request = async (method, url, { body, rawBody, token, authHeader } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  else if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
};

const check = (name, condition, detail = '') => {
  if (condition) { passed++; console.log(`PASS  ${name}`); }
  else { failed++; console.log(`FAIL  ${name} ${detail}`); }
};

// A JWT has 3 parts separated by dots; the middle part is readable JSON.
const decodeJwtPayload = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  } catch (error) {
    return null;
  }
};

(async () => {
  const stamp = Date.now();
  const password = 'smokePass123';
  const emailA = `smoke.a.${stamp}@example.com`;
  const emailB = `smoke.b.${stamp}@example.com`;
  const someId = '507f1f77bcf86cd799439011'; // a valid-looking id that does not exist

  try {
    let r = await request('GET', '/');
    check('Health route returns 200', r.status === 200);

    // ----- every note route is protected -----
    r = await request('GET', '/api/notes');
    check('GET /api/notes without a token returns 401', r.status === 401);
    r = await request('POST', '/api/notes', { body: { title: 'x' } });
    check('POST /api/notes without a token returns 401', r.status === 401);
    r = await request('GET', `/api/notes/${someId}`);
    check('GET /api/notes/:id without a token returns 401', r.status === 401);
    r = await request('PUT', `/api/notes/${someId}`, { body: { title: 'x' } });
    check('PUT /api/notes/:id without a token returns 401', r.status === 401);
    r = await request('DELETE', `/api/notes/${someId}`);
    check('DELETE /api/notes/:id without a token returns 401', r.status === 401);
    r = await request('GET', '/api/notes', { token: 'abc.def.ghi' });
    check('Notes with an invalid token returns 401', r.status === 401);

    // ----- registration and login (users A and B) -----
    r = await request('POST', '/api/auth/register', { body: { name: 'Smoke A', email: emailA.toUpperCase(), password } });
    check('Register user A returns 201', r.status === 201, JSON.stringify(r.data));
    const userA = r.data.data && r.data.data.user;
    check('Register stores the email in lowercase and never returns the password',
      !!userA && userA.email === emailA && !JSON.stringify(r.data).includes(password));

    r = await request('POST', '/api/auth/register', { body: { name: 'Smoke A', email: emailA, password } });
    check('Registering the same email again returns 409', r.status === 409);

    r = await request('POST', '/api/auth/register', { body: {} });
    check('Register with an empty body returns 400', r.status === 400);

    r = await request('POST', '/api/auth/register', { body: { name: 'Smoke B', email: emailB, password } });
    check('Register user B returns 201', r.status === 201);
    const userB = r.data.data && r.data.data.user;

    r = await request('POST', '/api/auth/login', { body: { email: emailA, password } });
    check('Login user A returns 200', r.status === 200, JSON.stringify(r.data));
    const tokenA = r.data.token;
    const payload = typeof tokenA === 'string' ? decodeJwtPayload(tokenA) : null;
    check('Login returns a JWT (3 parts) holding the user id and an expiry',
      typeof tokenA === 'string' && tokenA.split('.').length === 3 && !!payload && payload.id === (userA && userA.id) && typeof payload.exp === 'number');

    r = await request('POST', '/api/auth/login', { body: { email: emailA, password: 'wrong-password' } });
    check('Login with a wrong password returns 401', r.status === 401);
    const wrongPasswordMessage = r.data.message;

    r = await request('POST', '/api/auth/login', { body: { email: `nobody.${stamp}@example.com`, password } });
    check('Login with an unknown email returns 401 with the same message', r.status === 401 && r.data.message === wrongPasswordMessage);

    r = await request('POST', '/api/auth/login', { body: { email: emailB, password } });
    const tokenB = r.data.token;
    check('Login user B returns 200 and a token', r.status === 200 && typeof tokenB === 'string');

    // ----- create -----
    r = await request('POST', '/api/notes', { token: tokenA, body: { title: 'Shopping list', content: 'Milk, eggs' } });
    check('Create note returns 201', r.status === 201, JSON.stringify(r.data));
    const note = r.data.data;
    const noteId = note && note.id;
    check('Created note has id, title, content and timestamps, and does not expose the owner id',
      !!noteId && note.title === 'Shopping list' && note.content === 'Milk, eggs' && !!note.createdAt && !!note.updatedAt && !('user' in note));

    r = await request('POST', '/api/notes', { token: tokenA, body: { title: 'Only a title' } });
    check('Create note without content returns 201 with empty content', r.status === 201 && r.data.data.content === '');
    const titleOnlyId = r.data.data && r.data.data.id;

    r = await request('POST', '/api/notes', { token: tokenA, body: {} });
    check('Create note without a title returns 400', r.status === 400);

    r = await request('POST', '/api/notes', { token: tokenA, rawBody: '{ bad json' });
    check('Create note with invalid JSON returns 400', r.status === 400);

    r = await request('POST', '/api/notes', { token: tokenA, body: { title: 'Sneaky', user: userB && userB.id } });
    check('Create note with someone else\'s id in the body returns 201', r.status === 201);
    const sneakyId = r.data.data && r.data.data.id;

    // ----- read -----
    r = await request('GET', '/api/notes', { token: tokenA });
    check('List returns 200 with all 3 of user A\'s notes',
      r.status === 200 && r.data.count === 3 && [noteId, titleOnlyId, sneakyId].every((id) => r.data.data.some((n) => n.id === id)));

    r = await request('GET', `/api/notes/${noteId}`, { token: tokenA });
    check('Get one note returns 200', r.status === 200 && r.data.data.id === noteId);

    r = await request('GET', '/api/notes/123', { token: tokenA });
    check('Invalid note id format returns 400', r.status === 400);

    r = await request('GET', `/api/notes/${someId}`, { token: tokenA });
    check('Valid but unknown note id returns 404', r.status === 404);

    // ----- update -----
    r = await request('PUT', `/api/notes/${noteId}`, { token: tokenA, body: { title: 'Updated title' } });
    check('Update returns 200, changes the title and keeps the content',
      r.status === 200 && r.data.data.title === 'Updated title' && r.data.data.content === 'Milk, eggs');

    r = await request('PUT', `/api/notes/${noteId}`, { token: tokenA, body: {} });
    check('Update with an empty body returns 400', r.status === 400);

    r = await request('PUT', `/api/notes/${noteId}`, { token: tokenA, body: { title: '   ' } });
    check('Update with a blank title returns 400', r.status === 400);

    // ----- ownership: user B must not reach user A's notes -----
    r = await request('GET', '/api/notes', { token: tokenB });
    check('User B\'s list is empty (does not include any of A\'s notes, even the "Sneaky" one)', r.status === 200 && r.data.count === 0, JSON.stringify(r.data));

    r = await request('GET', `/api/notes/${noteId}`, { token: tokenB });
    check('User B reading A\'s note returns 404', r.status === 404);

    r = await request('PUT', `/api/notes/${noteId}`, { token: tokenB, body: { title: 'Hacked' } });
    check('User B updating A\'s note returns 404', r.status === 404);

    r = await request('DELETE', `/api/notes/${noteId}`, { token: tokenB });
    check('User B deleting A\'s note returns 404', r.status === 404);

    r = await request('GET', `/api/notes/${noteId}`, { token: tokenA });
    check('A\'s note is unchanged after B\'s attempts', r.status === 200 && r.data.data.title === 'Updated title');

    // ----- delete (also cleans up the notes this test created) -----
    r = await request('DELETE', `/api/notes/${noteId}`, { token: tokenA });
    check('Delete returns 200', r.status === 200);

    r = await request('GET', `/api/notes/${noteId}`, { token: tokenA });
    check('Deleted note now returns 404', r.status === 404);

    await request('DELETE', `/api/notes/${titleOnlyId}`, { token: tokenA });
    await request('DELETE', `/api/notes/${sneakyId}`, { token: tokenA });

    r = await request('GET', '/api/unknown');
    check('Unknown route returns 404', r.status === 404);
  } catch (error) {
    failed++;
    console.log(`FAIL  Could not reach the server at ${BASE_URL}: ${error.message}`);
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
