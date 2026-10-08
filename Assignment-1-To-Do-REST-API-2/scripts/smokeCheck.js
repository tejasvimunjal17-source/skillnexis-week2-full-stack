// End-to-end check against a RUNNING server that is connected to a REAL MongoDB.
// 1) Start the server:  npm start
// 2) In a second terminal:  npm run smoke-test
// Optional: BASE_URL=http://localhost:5000 npm run smoke-test
// It creates one todo, exercises every route, then deletes it (no leftovers).
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
let passed = 0;
let failed = 0;

const request = async (method, url, body, rawBody) => {
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: rawBody !== undefined ? rawBody : body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
};

const check = (name, condition, detail = '') => {
  if (condition) { passed++; console.log(`PASS  ${name}`); }
  else { failed++; console.log(`FAIL  ${name} ${detail}`); }
};

(async () => {
  try {
    let r = await request('GET', '/');
    check('Health route returns 200', r.status === 200);

    r = await request('POST', '/api/todos', { title: 'Smoke test task', description: 'temp' });
    check('Create todo returns 201', r.status === 201, JSON.stringify(r.data));
    const id = r.data.data && r.data.data._id;
    check('Created todo has _id and completed=false', !!id && r.data.data.completed === false);

    r = await request('GET', '/api/todos');
    check('Get all returns 200 and includes new todo',
      r.status === 200 && r.data.data.some((t) => t._id === id));

    r = await request('GET', `/api/todos/${id}`);
    check('Get by id returns 200', r.status === 200 && r.data.data._id === id);

    r = await request('PUT', `/api/todos/${id}`, { completed: true, title: 'Updated title' });
    check('Update returns 200 with new values',
      r.status === 200 && r.data.data.completed === true && r.data.data.title === 'Updated title');

    r = await request('POST', '/api/todos', {});
    check('Create without title returns 400', r.status === 400);

    r = await request('POST', '/api/todos', undefined, '{ bad json');
    check('Invalid JSON returns 400', r.status === 400);

    r = await request('PUT', `/api/todos/${id}`, {});
    check('Update with empty body returns 400', r.status === 400);

    r = await request('GET', '/api/todos/not-an-id');
    check('Invalid id format returns 400', r.status === 400);

    r = await request('GET', '/api/todos/507f1f77bcf86cd799439011');
    check('Valid but unknown id returns 404', r.status === 404);

    r = await request('DELETE', `/api/todos/${id}`);
    check('Delete returns 200', r.status === 200);

    r = await request('GET', `/api/todos/${id}`);
    check('Deleted todo now returns 404', r.status === 404);

    r = await request('GET', '/api/unknown');
    check('Unknown route returns 404', r.status === 404);
  } catch (error) {
    failed++;
    console.log(`FAIL  Could not reach the server at ${BASE_URL}: ${error.message}`);
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
