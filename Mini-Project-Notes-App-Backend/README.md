# Notes App Backend

Skill Nexis Full Stack Web Development (MERN) Internship — **Week 2, Mini Project**

A backend REST API for a notes-taking app. Users can **create, read, update and delete** notes, which are stored in **MongoDB** with **Mongoose**. All note routes are **secured with JWT authentication**.

---

## Table of Contents

1. [Project Objective](#project-objective)
2. [Official Requirements vs Design Decisions](#official-requirements-vs-design-decisions)
3. [Features](#features)
4. [Technologies Used](#technologies-used)
5. [Project Structure](#project-structure)
6. [Requirements (Node.js and MongoDB)](#requirements-nodejs-and-mongodb)
7. [Setup and Installation](#setup-and-installation)
8. [Environment Variables (.env setup)](#environment-variables-env-setup)
9. [Starting the Server](#starting-the-server)
10. [Authentication Flow (in simple words)](#authentication-flow-in-simple-words)
11. [Data Models](#data-models)
12. [API Endpoints](#api-endpoints)
13. [Example Requests and Expected Responses](#example-requests-and-expected-responses)
14. [Testing with Postman](#testing-with-postman)
15. [Automated Tests (npm test and smoke-test)](#automated-tests-npm-test-and-smoke-test)
16. [Verification Status](#verification-status)
17. [Troubleshooting](#troubleshooting)

---

## Project Objective

The official Week 2 material describes this Mini Project as: *"Notes App Backend — develop a backend API for a notes-taking app with CRUD operations. Secure routes with JWT authentication."*
Its learning outcome is to practise backend logic, database integration and API creation for a real-world application.

## Official Requirements vs Design Decisions

The official PDF is short. To keep things honest, this table separates what the PDF asks for from choices I made where the PDF says nothing.

### Official requirements (from the Week 2 PDF and the project instructions)

| Requirement | Where it is done |
| ----------- | ---------------- |
| Backend API for a notes app | The whole project (Node.js + Express.js) |
| CRUD operations: create, read, update, delete notes | `src/controllers/noteController.js`, `src/routes/noteRoutes.js` |
| Secure routes with JWT authentication | `src/middleware/authMiddleware.js` (`protect`), applied to **all** note routes in `src/routes/noteRoutes.js` |
| MongoDB integration with Mongoose | `src/config/db.js`, `src/models/Note.js`, `src/models/User.js` |
| REST API structure | Resource-based URLs and HTTP methods: `/api/notes` with POST, GET, PUT, DELETE |
| bcrypt and JWT (Week 2 topics list) | `src/controllers/authController.js` (`bcrypt` package), `src/utils/generateToken.js` (`jsonwebtoken`) |
| Backend only, no frontend | Confirmed: there is no frontend in this project |

### Design decisions (NOT in the official PDF — chosen by me)

| Decision | Why |
| -------- | --- |
| Added `POST /api/auth/register` and `POST /api/auth/login` | The PDF says routes must be secured with JWT but does not say how a user gets a token. Without a way to register and log in, the protected routes could not be used or tested. |
| Each user can only see and change **their own** notes | The PDF does not say whose notes a user may access. Without this rule, any logged-in user could read or delete everyone's notes. |
| Another user's note answers **404 "Note not found"** (not 403) | It does not reveal whether that note exists. |
| A note has `title` (required, max 100 characters) and `content` (optional, max 5000 characters) | The PDF does not define the note fields. |
| Update uses `PUT` only, and you send just the fields you want to change | Keeps the API small. |
| No search, pagination, tags or sharing | Not asked for, so not added. |
| Postman checklist, offline tests and a smoke-test script | The PDF has no testing or submission format for the Mini Project; these are provided to make it easy to check and demonstrate. |

## Features

- Register and log in (passwords are hashed with bcrypt; login returns a JWT)
- Create, list, read, update and delete notes
- Every note route requires `Authorization: Bearer <token>`
- Notes are private to the user who created them
- Input validation with clear error messages
- Central error handling with sensible HTTP status codes (400, 401, 404, 409, 500)
- Secrets and configuration come from environment variables only

## Technologies Used

- **Node.js** – runs JavaScript on the server
- **Express.js** – web framework for routes and middleware
- **MongoDB** – database for users and notes
- **Mongoose** – connects Node.js to MongoDB and defines the schemas
- **bcrypt** – the `bcrypt` npm package; hashes passwords (a native module: `npm install` downloads a ready-made binary for your computer)
- **jsonwebtoken** – creates and verifies JWTs
- **dotenv** – loads settings from a `.env` file
- **nodemon** *(development only)* – restarts the server when you save a file
- **Postman** – used to test the API

## Project Structure

```
notes-app-backend/
├── server.js                      # Starts the app: checks JWT_SECRET, connects to MongoDB, listens on a port
├── package.json                   # Project info, dependencies and npm scripts
├── .env.example                   # Template for your environment variables (no real secrets)
├── .gitignore                     # Keeps .env and node_modules out of Git
├── src/
│   ├── app.js                     # Express setup: JSON parsing, routes, error handlers
│   ├── config/
│   │   ├── db.js                  # MongoDB connection using Mongoose
│   │   └── checkEnv.js            # Refuses to start with a missing, placeholder or too-short JWT_SECRET
│   ├── models/
│   │   ├── User.js                # User schema (name, unique email, hashed password)
│   │   └── Note.js                # Note schema (title, content, owner)
│   ├── controllers/
│   │   ├── authController.js      # Register and login logic
│   │   └── noteController.js      # Create, read, update, delete notes (own notes only)
│   ├── routes/
│   │   ├── authRoutes.js          # Public routes: register, login
│   │   └── noteRoutes.js          # Note routes, all behind the JWT check
│   ├── utils/
│   │   └── generateToken.js       # Creates the signed JWT
│   └── middleware/
│       ├── authMiddleware.js      # "protect": checks the JWT before a route runs
│       ├── validateAuth.js        # Checks name, email and password input
│       ├── validateNote.js        # Checks note input and the note ID format
│       ├── asyncHandler.js        # Sends errors from async code to the error handler
│       └── errorHandler.js        # 404 handler and central error handler
├── tests/
│   ├── validation.test.js         # Offline: validation, attacker-style input, JWT-secret check, error handler
│   ├── auth.logic.test.js         # Offline: register / login / token logic (fakes, not MongoDB)
│   ├── notes.logic.test.js        # Offline: note CRUD and "only my own notes" (fakes, not MongoDB)
│   └── routes.wiring.test.js      # Offline: every note route is behind the JWT check (fake Express)
└── scripts/
    └── smokeCheck.js              # End-to-end check to run against a real server + database
```

## Requirements (Node.js and MongoDB)

- **Node.js 18 or newer** – check with `node -v`. Download from https://nodejs.org
- **A running MongoDB database.** The API cannot start without one. Choose either option:
  - **Option A – Local MongoDB:** install MongoDB Community Edition, start it, and use
    `mongodb://127.0.0.1:27017/notes_db` as your connection string.
  - **Option B – MongoDB Atlas (free cloud database):** create a free cluster at https://www.mongodb.com/atlas,
    create a database user, allow your IP address under *Network Access*, then copy the connection string
    (it looks like `mongodb+srv://<username>:<password>@<cluster-url>/notes_db?...`).
- **Postman** (optional but recommended) – https://www.postman.com/downloads/

## Setup and Installation

```bash
# 1. Go into the project folder
cd notes-app-backend

# 2. Install dependencies
npm install
```

## Environment Variables (.env setup)

1. Copy the example file to a new file named `.env`:
   - Mac/Linux: `cp .env.example .env`
   - Windows (Command Prompt): `copy .env.example .env`
2. Open `.env` and replace the placeholder values with your own:

| Variable         | Description                                                | Example                             |
| ---------------- | ---------------------------------------------------------- | ----------------------------------- |
| `PORT`           | Port the server runs on                                    | `5000`                              |
| `MONGODB_URI`    | Your MongoDB connection string                             | `mongodb://127.0.0.1:27017/notes_db` |
| `JWT_SECRET`     | Secret key used to sign tokens. Long, random, private (at least 16 characters) | *(generate one, see below)* |
| `JWT_EXPIRES_IN` | How long a token stays valid                               | `1d`                                |
| `NODE_ENV`       | `development` shows error details, `production` hides them | `development`                       |

**Generate a strong `JWT_SECRET`** by running this command and pasting the result into `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Security:** never commit your `.env` file or share your `JWT_SECRET` or database password. `.env` is already listed in `.gitignore`.
> The server **refuses to start** (and prints why) if `MONGODB_URI` is missing, or if `JWT_SECRET` is missing, shorter than 16 characters, or still the example text `your_jwt_secret_here`.

## Starting the Server

```bash
npm run dev     # development mode (auto-restarts when you save a file)
npm start       # normal mode
```

Expected console output:

```
MongoDB connected: <your-database-host>
Server running on port 5000
```

Quick check: open `http://localhost:5000/` in a browser. You should see:

```json
{ "success": true, "message": "Notes App API is running" }
```

## Authentication Flow (in simple words)

1. **Register** – send a name, email and password to `POST /api/auth/register`. bcrypt turns the password into a hash and **only the hash is saved**. The password is never returned.
2. **Log in** – send the email and password to `POST /api/auth/login`. If they match, you receive a **JWT**: a signed token holding your user id and an expiry time. It is signed with `JWT_SECRET`, so nobody can fake or change it. A wrong email and a wrong password give the **same** error message, so nobody can find out which emails are registered.
3. **Use the notes** – send the token with every notes request in the header `Authorization: Bearer <token>`.
4. **The JWT check** – the `protect` middleware runs before every note route. It rejects a missing, malformed, tampered or expired token (and a token for a user that no longer exists) with `401`.
5. **Your notes only** – every note query is filtered by the logged-in user's id, taken from the token (never from the request body). You cannot read, change or delete somebody else's notes.

## Data Models

**User** (collection `users`)

| Field      | Type   | Rules |
| ---------- | ------ | ----- |
| `name`     | String | Required, max 50 characters |
| `email`    | String | Required, valid email, **unique**, saved in lowercase |
| `password` | String | Required on input (6–72 characters). **Saved as a bcrypt hash** and never returned |

**Note** (collection `notes`)

| Field       | Type     | Rules |
| ----------- | -------- | ----- |
| `title`     | String   | Required, max 100 characters |
| `content`   | String   | Optional, max 5000 characters, defaults to an empty string |
| `user`      | ObjectId | The owner. Set automatically from the token; clients cannot set it. Not shown in responses |
| `createdAt` / `updatedAt` | Date | Added automatically |

## API Endpoints

Base URL: `http://localhost:5000`

| Method | Endpoint             | Description                    | Token needed? | Success status | Source |
| ------ | -------------------- | ------------------------------ | ------------- | -------------- | ------ |
| GET    | `/`                  | Check that the API is running  | No            | 200            | — |
| POST   | `/api/auth/register` | Register a new user            | No            | 201            | Design decision |
| POST   | `/api/auth/login`    | Log in and receive a JWT       | No            | 200            | Design decision |
| POST   | `/api/notes`         | Create a note                  | **Yes**       | 201            | Official (CRUD) |
| GET    | `/api/notes`         | Get all **my** notes (newest first) | **Yes**  | 200            | Official (CRUD) |
| GET    | `/api/notes/:id`     | Get one of my notes            | **Yes**       | 200            | Official (CRUD) |
| PUT    | `/api/notes/:id`     | Update one of my notes (send only the fields to change) | **Yes** | 200 | Official (CRUD) |
| DELETE | `/api/notes/:id`     | Delete one of my notes         | **Yes**       | 200            | Official (CRUD) |

### Error status codes

| Status | When |
| ------ | ---- |
| 400    | Invalid data, invalid JSON, empty update body, or a malformed note ID |
| 401    | Wrong email or password, or a missing / invalid / expired token |
| 404    | The note does not exist **or belongs to someone else**, or the route does not exist |
| 409    | The email is already registered |
| 500    | Unexpected server error |

Every response is JSON. Success responses contain `"success": true`. Error responses contain `"success": false` and a `message`.

## Example Requests and Expected Responses

The `id`, date and token values below are examples; yours will be different.

### 1. Register — `POST /api/auth/register`

```json
{ "name": "Alice Johnson", "email": "alice@example.com", "password": "secret123" }
```
Expected — `201 Created`:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": { "user": { "id": "665f1c2e8a1b2c3d4e5f6a7b", "name": "Alice Johnson", "email": "alice@example.com", "createdAt": "2026-10-03T10:00:00.000Z" } }
}
```

### 2. Login — `POST /api/auth/login`

```json
{ "email": "alice@example.com", "password": "secret123" }
```
Expected — `200 OK`:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2NWYx...<long token>",
  "data": { "user": { "id": "665f1c2e8a1b2c3d4e5f6a7b", "name": "Alice Johnson", "email": "alice@example.com", "createdAt": "2026-10-03T10:00:00.000Z" } }
}
```
Copy the `token`. Every request below needs the header `Authorization: Bearer <token>`.

### 3. Create a note — `POST /api/notes`

```json
{ "title": "Shopping list", "content": "Milk, eggs, bread" }
```
Expected — `201 Created`:
```json
{
  "success": true,
  "message": "Note created successfully",
  "data": {
    "id": "665f2a1b8a1b2c3d4e5f6a80",
    "title": "Shopping list",
    "content": "Milk, eggs, bread",
    "createdAt": "2026-10-03T10:05:00.000Z",
    "updatedAt": "2026-10-03T10:05:00.000Z"
  }
}
```

### 4. Get all my notes — `GET /api/notes`

No body. Expected — `200 OK`:
```json
{
  "success": true,
  "count": 1,
  "data": [
    { "id": "665f2a1b8a1b2c3d4e5f6a80", "title": "Shopping list", "content": "Milk, eggs, bread", "createdAt": "2026-10-03T10:05:00.000Z", "updatedAt": "2026-10-03T10:05:00.000Z" }
  ]
}
```

### 5. Get one note — `GET /api/notes/665f2a1b8a1b2c3d4e5f6a80`

No body. Expected — `200 OK` with `{ "success": true, "data": { ...the note... } }`.

### 6. Update a note — `PUT /api/notes/665f2a1b8a1b2c3d4e5f6a80`

```json
{ "title": "Shopping list (updated)" }
```
Expected — `200 OK`, message `"Note updated successfully"`, the new `title`, and the `content` unchanged.

### 7. Delete a note — `DELETE /api/notes/665f2a1b8a1b2c3d4e5f6a80`

No body. Expected — `200 OK`, message `"Note deleted successfully"`, and `data` showing the deleted note.

### Example error responses

No token — `401 Unauthorized`:
```json
{ "success": false, "message": "Not authorized: token missing" }
```

Create a note with `{}` — `400 Bad Request`:
```json
{ "success": false, "message": "Validation failed", "errors": ["Title is required"] }
```

A note that does not exist, or belongs to another user — `404 Not Found`:
```json
{ "success": false, "message": "Note not found" }
```

## Testing with Postman

**Before you start:** the server must be running (`npm run dev`) and the console must show `MongoDB connected`.

**How to send each request in Postman**

1. Click **New → HTTP Request**.
2. Choose the method and type the URL.
3. For requests with a body: open the **Body** tab → select **raw** → choose **JSON** in the dropdown on the right → paste the JSON.
4. For notes requests: open the **Authorization** tab → set **Auth Type** to **Bearer Token** → paste the token into the **Token** box. *(Paste only the token, without the word "Bearer".)*
5. Click **Send** and check the **status code** and the **response body**.

Run the steps in the order shown. Write down: `TOKEN_A` (step 4), `NOTE_ID` (step 8) and `TOKEN_B` (step 24).

### Checklist

| ☐ | Step | Method + URL | Body / Auth | Expected status | What to verify in the response |
| - | ---- | ------------ | ----------- | --------------- | ------------------------------ |
| ☐ | 0 | `GET http://localhost:5000/` | none | **200** | message "Notes App API is running" |
| | **Register and log in** | | | | |
| ☐ | 1. Register | `POST http://localhost:5000/api/auth/register` | `{"name": "Alice Johnson", "email": "alice@example.com", "password": "secret123"}` | **201** | "User registered successfully"; **no password** in the response |
| ☐ | 2. Duplicate email | `POST http://localhost:5000/api/auth/register` | same body as step 1 | **409** | "Email is already registered" |
| ☐ | 3. Bad register data | `POST http://localhost:5000/api/auth/register` | `{}` | **400** | `errors` lists "Name is required", "Email is required", "Password is required" |
| ☐ | 4. Login | `POST http://localhost:5000/api/auth/login` | `{"email": "alice@example.com", "password": "secret123"}` | **200** | "Login successful"; a long `token` (**copy it as TOKEN_A**) |
| ☐ | 5. Wrong password | `POST http://localhost:5000/api/auth/login` | `{"email": "alice@example.com", "password": "wrong-password"}` | **401** | "Invalid email or password"; no token |
| | **The JWT check (all note routes are protected)** | | | | |
| ☐ | 6. No token | `GET http://localhost:5000/api/notes` | no Authorization | **401** | "Not authorized: token missing" |
| ☐ | 7. Invalid token | `GET http://localhost:5000/api/notes` | Bearer Token → `abc.def.ghi` | **401** | "Not authorized: invalid token" |
| | **Create, read and update (use TOKEN_A for every request in this block)** | | | | |
| ☐ | 8. Create | `POST http://localhost:5000/api/notes` | `{"title": "Shopping list", "content": "Milk, eggs, bread"}` | **201** | "Note created successfully"; `data.id` (**copy it as NOTE_ID**); no owner id shown |
| ☐ | 9. Create, title only | `POST http://localhost:5000/api/notes` | `{"title": "Only a title"}` | **201** | `content` is an empty string |
| ☐ | 10. List | `GET http://localhost:5000/api/notes` | none | **200** | `count` is 2; both notes are listed, newest first |
| ☐ | 11. Get one | `GET http://localhost:5000/api/notes/<NOTE_ID>` | none | **200** | `data.id` matches NOTE_ID |
| ☐ | 12. Update | `PUT http://localhost:5000/api/notes/<NOTE_ID>` | `{"title": "Shopping list (updated)"}` | **200** | "Note updated successfully"; new `title`; `content` unchanged |
| | **Validation and errors (still TOKEN_A)** | | | | |
| ☐ | 13. No title | `POST http://localhost:5000/api/notes` | `{}` | **400** | `errors` contains "Title is required" |
| ☐ | 14. Blank title | `POST http://localhost:5000/api/notes` | `{"title": "   "}` | **400** | "Title must be a non-empty string" |
| ☐ | 15. Wrong type | `POST http://localhost:5000/api/notes` | `{"title": "Test", "content": 123}` | **400** | "Content must be a string" |
| ☐ | 16. Empty update | `PUT http://localhost:5000/api/notes/<NOTE_ID>` | `{}` | **400** | "Provide at least one field to update: title or content" |
| ☐ | 17. Invalid JSON | `POST http://localhost:5000/api/notes` | type `{ bad json` | **400** | "Invalid JSON in request body" |
| ☐ | 18. Invalid ID | `GET http://localhost:5000/api/notes/123` | none | **400** | "Invalid note ID format" |
| ☐ | 19. Unknown ID | `GET http://localhost:5000/api/notes/507f1f77bcf86cd799439011` | none | **404** | "Note not found" |
| | **Notes are private (a second user)** | | | | |
| ☐ | 20. Register user B | `POST http://localhost:5000/api/auth/register` | `{"name": "Bob Smith", "email": "bob@example.com", "password": "secret456"}` | **201** | "User registered successfully" |
| ☐ | 21. Login user B | `POST http://localhost:5000/api/auth/login` | `{"email": "bob@example.com", "password": "secret456"}` | **200** | **copy the token as TOKEN_B** |
| ☐ | 22. B's list | `GET http://localhost:5000/api/notes` | Bearer Token → **TOKEN_B** | **200** | `count` is 0 — Alice's notes are not visible |
| ☐ | 23. B reads A's note | `GET http://localhost:5000/api/notes/<NOTE_ID>` | Bearer Token → **TOKEN_B** | **404** | "Note not found" |
| ☐ | 24. B updates A's note | `PUT http://localhost:5000/api/notes/<NOTE_ID>` | TOKEN_B, body `{"title": "Hacked"}` | **404** | "Note not found" |
| ☐ | 25. B deletes A's note | `DELETE http://localhost:5000/api/notes/<NOTE_ID>` | Bearer Token → **TOKEN_B** | **404** | "Note not found" |
| ☐ | 26. A's note unchanged | `GET http://localhost:5000/api/notes/<NOTE_ID>` | Bearer Token → **TOKEN_A** | **200** | the title is still "Shopping list (updated)" |
| | **Delete and clean up** | | | | |
| ☐ | 27. Delete | `DELETE http://localhost:5000/api/notes/<NOTE_ID>` | Bearer Token → TOKEN_A | **200** | "Note deleted successfully" |
| ☐ | 28. Confirm deleted | `GET http://localhost:5000/api/notes/<NOTE_ID>` | Bearer Token → TOKEN_A | **404** | "Note not found" |
| ☐ | 29. Unknown route | `GET http://localhost:5000/api/unknown` | none | **404** | "Route not found: GET /api/unknown" |

Tip: take a screenshot of each response (status code and body visible) as evidence for your submission.

## Automated Tests (npm test and smoke-test)

### `npm test` — offline tests (no database needed)

```bash
npm test
```

Runs 76 tests in four files:

| File | Tests | What it covers |
| ---- | ----- | -------------- |
| `validation.test.js` | 31 | Input rules for users and notes, attacker-style input such as `{"$gt": ""}` in place of text, the JWT-secret check, the error handler |
| `auth.logic.test.js` | 19 | Register, login and the JWT check: only the hash is stored, passwords are never returned, bad tokens get 401 |
| `notes.logic.test.js` | 17 | Create, read, update and delete notes; users cannot see, change or delete each other's notes; clients cannot set the owner; every database query is filtered by the logged-in user |
| `routes.wiring.test.js` | 9 | Using a fake Express: the JWT check is registered before every note route, the five CRUD routes are exactly the ones expected, register and login are the only public routes |

These tests use small in-memory fakes in place of MongoDB, bcrypt, jsonwebtoken and Express, so they check **our own logic and wiring only**. They do **not** prove that the real database, real bcrypt hashing, real JWT signing or a real running server work. Use the smoke test and Postman for that.

### `npm run smoke-test` — end-to-end check (needs the server and MongoDB)

1. Start the server in one terminal: `npm start`
2. In a second terminal run:

```bash
npm run smoke-test
```

The script sends real requests to your running server. It checks that every note route rejects a missing token, registers two users, runs create / read / update / delete, tests validation, and proves that the second user cannot read, change or delete the first user's notes.
Each run registers **two new test users** (`smoke.a.<time>@example.com`, `smoke.b.<time>@example.com`). The script deletes the notes it creates, but this project has no delete-user route, so those two users stay in your database; you can remove them in MongoDB Compass if you like.

Expected output when everything works (38 checks):

```
PASS  Health route returns 200
PASS  GET /api/notes without a token returns 401
PASS  POST /api/notes without a token returns 401
PASS  GET /api/notes/:id without a token returns 401
PASS  PUT /api/notes/:id without a token returns 401
PASS  DELETE /api/notes/:id without a token returns 401
PASS  Notes with an invalid token returns 401
PASS  Register user A returns 201
PASS  Register stores the email in lowercase and never returns the password
PASS  Registering the same email again returns 409
PASS  Register with an empty body returns 400
PASS  Register user B returns 201
PASS  Login user A returns 200
PASS  Login returns a JWT (3 parts) holding the user id and an expiry
PASS  Login with a wrong password returns 401
PASS  Login with an unknown email returns 401 with the same message
PASS  Login user B returns 200 and a token
PASS  Create note returns 201
PASS  Created note has id, title, content and timestamps, and does not expose the owner id
PASS  Create note without content returns 201 with empty content
PASS  Create note without a title returns 400
PASS  Create note with invalid JSON returns 400
PASS  Create note with someone else's id in the body returns 201
PASS  List returns 200 with all 3 of user A's notes
PASS  Get one note returns 200
PASS  Invalid note id format returns 400
PASS  Valid but unknown note id returns 404
PASS  Update returns 200, changes the title and keeps the content
PASS  Update with an empty body returns 400
PASS  Update with a blank title returns 400
PASS  User B's list is empty (does not include any of A's notes, even the "Sneaky" one)
PASS  User B reading A's note returns 404
PASS  User B updating A's note returns 404
PASS  User B deleting A's note returns 404
PASS  A's note is unchanged after B's attempts
PASS  Delete returns 200
PASS  Deleted note now returns 404
PASS  Unknown route returns 404

Result: 38 passed, 0 failed
```

If your server uses a different port: `BASE_URL=http://localhost:3000 npm run smoke-test`
(on Windows Command Prompt: `set "BASE_URL=http://localhost:3000" && npm run smoke-test` — keep the quotes).

## Verification Status

This section says honestly what was checked before this project was packaged, and what still has to be checked on a real computer.

**Verified offline (no internet, using Node.js's built-in test runner):**

- `npm test` -> **76 passed, 0 failed** (see the table above).
- **Deliberate-bug check:** 30 deliberate mistakes were put into copies of the code (for example: skipping the owner filter, removing the JWT check from the note routes, storing a plain password). The tests caught **30 of 30**.
- Every source file passes a syntax check, every `require` path and `package.json` script points to a real file, `.env` is ignored by git, and no secrets are written in the source.

**Not verified yet (needs your own computer with Node.js and MongoDB):**

- [ ] `npm install` (including the native `bcrypt` package)
- [ ] Starting the server and connecting to a real MongoDB
- [ ] Real Express request handling, real Mongoose queries and the real unique-email index
- [ ] Real bcrypt hashing and real JWT signing/verification (the offline tests use fakes for these)
- [ ] The Postman checklist above
- [ ] `npm run smoke-test` (38 checks)

So this project has **not** been fully runtime-tested yet. Once you have ticked the boxes above on your own computer, it has been.

## Troubleshooting

| Problem | What to check |
| ------- | ------------- |
| `MONGODB_URI is missing`, `JWT_SECRET is missing`, `JWT_SECRET is still the example placeholder` or `JWT_SECRET is too short` | You have not created `.env`, or a value is empty or still the example text. Copy `.env.example` to `.env`, set every value, and generate your own `JWT_SECRET` with the command above. |
| `MongoDB connection failed ... ECONNREFUSED` | Local MongoDB is not running. Start it, or use an Atlas connection string. |
| Atlas: `Authentication failed` or timeout | Check the username/password, and add your IP address under *Network Access* in Atlas. If your password has special characters (such as `@`, `#`, `/`), replace them with their URL-encoded form (for example `@` becomes `%40`). |
| `401 Not authorized: invalid token` in Postman | Paste only the token (no word "Bearer", no quotes) into the Bearer Token box, and make sure you copied the whole token. |
| `401 ... token has expired` | Log in again to get a new token. |
| Tokens stopped working after changing `JWT_SECRET` | Tokens are tied to the secret. Log in again after changing it. |
| `404 Note not found` for a note you know exists | Check you are using the token of the user who created it. Notes are private to their owner. |
| `EADDRINUSE` (port already in use) | Another program is using the port. Change `PORT` in `.env`, or stop the other program. |
| `Cannot find module ...` | Run `npm install` inside the `notes-app-backend` folder. |
| `npm install` fails on `bcrypt` | `bcrypt` is a native package. Use a current Node.js LTS version, make sure you are online, and try again. If it still fails, send me the full error text. |

---

*Skill Nexis MERN Internship — Week 2, Mini Project*
