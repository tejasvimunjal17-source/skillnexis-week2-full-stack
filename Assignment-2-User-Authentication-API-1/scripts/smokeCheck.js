// End-to-end check against a RUNNING server that is connected to a REAL MongoDB.
// 1) Start the server:  npm start
// 2) In a second terminal:  npm run smoke-test
// Optional: BASE_URL=http://localhost:5000 npm run smoke-test
// Each run registers ONE new test user with a unique email (smoke.<time>@example.com).
// There is no delete route in this assignment, so that user stays in your database.
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
  const email = `smoke.${Date.now()}@example.com`;
  const password = 'smokePass123';

  try {
    let r = await request('GET', '/');
    check('Health route returns 200', r.status === 200);

    // ----- registration -----
    r = await request('POST', '/api/auth/register', { body: { name: 'Smoke Tester', email: email.toUpperCase(), password } });
    check('Register returns 201', r.status === 201, JSON.stringify(r.data));
    const user = r.data.data && r.data.data.user;
    check('Registered email is stored in lowercase', !!user && user.email === email);
    check('Register response does not contain the password', !JSON.stringify(r.data).includes(password) && !(user && 'password' in user));

    r = await request('POST', '/api/auth/register', { body: { name: 'Smoke Tester', email, password } });
    check('Registering the same email again returns 409', r.status === 409);

    r = await request('POST', '/api/auth/register', { body: {} });
    check('Register with empty body returns 400', r.status === 400);

    r = await request('POST', '/api/auth/register', { body: { name: 'X', email: 'not-an-email', password } });
    check('Register with invalid email returns 400', r.status === 400);

    r = await request('POST', '/api/auth/register', { body: { name: 'X', email: `short.${Date.now()}@example.com`, password: '123' } });
    check('Register with too-short password returns 400', r.status === 400);

    r = await request('POST', '/api/auth/register', { rawBody: '{ bad json' });
    check('Register with invalid JSON returns 400', r.status === 400);

    // ----- login -----
    r = await request('POST', '/api/auth/login', { body: { email, password } });
    check('Login returns 200', r.status === 200, JSON.stringify(r.data));
    const token = r.data.token;
    const payload = typeof token === 'string' ? decodeJwtPayload(token) : null;
    check('Login returns a JWT (3 parts) holding the user id and an expiry',
      typeof token === 'string' && token.split('.').length === 3 && !!payload && payload.id === (user && user.id) && typeof payload.exp === 'number');
    check('Login response does not contain the password', !JSON.stringify(r.data).includes(password));

    r = await request('POST', '/api/auth/login', { body: { email, password: 'wrong-password' } });
    check('Login with wrong password returns 401', r.status === 401);
    const wrongPasswordMessage = r.data.message;

    r = await request('POST', '/api/auth/login', { body: { email: `nobody.${Date.now()}@example.com`, password } });
    check('Login with unknown email returns 401 with the same message', r.status === 401 && r.data.message === wrongPasswordMessage);

    r = await request('POST', '/api/auth/login', { body: {} });
    check('Login with empty body returns 400', r.status === 400);

    // ----- protected route -----
    r = await request('GET', '/api/auth/profile', { token });
    check('Profile with a valid token returns 200 and the right user',
      r.status === 200 && r.data.data.user.email === email && !JSON.stringify(r.data).includes(password));

    r = await request('GET', '/api/auth/profile');
    check('Profile without a token returns 401', r.status === 401);

    r = await request('GET', '/api/auth/profile', { token: 'abc.def.ghi' });
    check('Profile with an invalid token returns 401', r.status === 401);

    r = await request('GET', '/api/auth/profile', { authHeader: `Token ${token}` });
    check('Profile with the wrong header scheme returns 401', r.status === 401);

    const tampered = typeof token === 'string' ? `${token.slice(0, -2)}${token.endsWith('AA') ? 'BB' : 'AA'}` : 'x';
    r = await request('GET', '/api/auth/profile', { token: tampered });
    check('Profile with a tampered token returns 401', r.status === 401);

    r = await request('GET', '/api/unknown');
    check('Unknown route returns 404', r.status === 404);
  } catch (error) {
    failed++;
    console.log(`FAIL  Could not reach the server at ${BASE_URL}: ${error.message}`);
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
