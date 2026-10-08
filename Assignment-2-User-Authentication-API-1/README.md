# User Authentication API

Skill Nexis Full Stack Web Development (MERN) Internship — **Week 2, Assignment 2**

A backend REST API for **user registration and login**. Passwords are protected with **bcrypt**, logins return a **JWT** (JSON Web Token), and users are stored in **MongoDB** using **Mongoose**.

---

## Table of Contents

1. [What this project does](#what-this-project-does)
2. [Technologies Used](#technologies-used)
3. [Project Structure](#project-structure)
4. [Requirements (Node.js and MongoDB)](#requirements-nodejs-and-mongodb)
5. [Local Installation](#local-installation)
6. [Environment Variables (.env setup)](#environment-variables-env-setup)
7. [Starting the Server](#starting-the-server)
8. [How It Works (in simple words)](#how-it-works-in-simple-words)
9. [User Data Model](#user-data-model)
10. [API Endpoints](#api-endpoints)
11. [Example Requests and Expected Responses](#example-requests-and-expected-responses)
12. [Testing with Postman](#testing-with-postman)
13. [Checking That Passwords Are Hashed in MongoDB](#checking-that-passwords-are-hashed-in-mongodb)
14. [Automated Checks (npm test and smoke-test)](#automated-checks-npm-test-and-smoke-test)
15. [Verification Status](#verification-status)
16. [Troubleshooting](#troubleshooting)

---

## What this project does

| Feature | How it is done |
| ------- | -------------- |
| User registration | `POST /api/auth/register` saves a new user in MongoDB |
| User login | `POST /api/auth/login` checks the email and password and returns a JWT |
| Password security | Passwords are hashed with **bcrypt** before saving. The real password is never stored |
| JWT authentication | Login returns a JWT. The token is checked by a protected route, `GET /api/auth/profile` *(see the note below: this route is my addition)* |
| Database | Users are stored in MongoDB through a Mongoose `User` model |

> **Encryption vs hashing:** the assignment says "password encryption". bcrypt does not encrypt; it *hashes*, which is a one-way scramble that cannot be reversed. This is the correct, standard way to protect passwords, because even the database owner cannot read them.
>
> **Implementation addition (not an official PDF requirement):** the official Week 2 material asks for registration, login, password encryption and JWT-based authentication. It does not list a protected route.
> `GET /api/auth/profile` is a small extra route I added only so the JWT can actually be *demonstrated* (a token that nothing checks proves nothing). It is not a separate feature.

## Technologies Used

- **Node.js** – runs JavaScript on the server
- **Express.js** – web framework for routes and middleware
- **MongoDB** – database that stores the users
- **Mongoose** – connects Node.js to MongoDB and defines the User schema
- **bcrypt** – the `bcrypt` npm package; hashes passwords with the bcrypt algorithm. It is a native module, so `npm install` downloads a ready-made binary for your computer
- **jsonwebtoken** – creates and verifies JWTs
- **dotenv** – loads settings from a `.env` file
- **nodemon** *(development only)* – restarts the server when you save a file
- **Postman** – used to test the API

## Project Structure

```
user-auth-api/
├── server.js                      # Starts the app: checks JWT_SECRET, connects to MongoDB, listens on a port
├── package.json                   # Project info, dependencies and npm scripts
├── .env.example                   # Template for your environment variables (no real secrets)
├── .gitignore                     # Keeps .env and node_modules out of Git
├── src/
│   ├── app.js                     # Express setup (JSON parsing, routes, error handlers)
│   ├── config/
│   │   ├── db.js                  # MongoDB connection using Mongoose
│   │   └── checkEnv.js            # Refuses to start with a missing, placeholder or too-short JWT_SECRET
│   ├── models/
│   │   └── User.js                # User schema (name, unique email, hashed password)
│   ├── controllers/
│   │   └── authController.js      # Logic for register, login and profile
│   ├── routes/
│   │   └── authRoutes.js          # Maps URLs + HTTP methods to controllers
│   ├── utils/
│   │   └── generateToken.js       # Creates the signed JWT
│   └── middleware/
│       ├── authMiddleware.js      # "protect": checks the JWT before a route runs
│       ├── validateAuth.js        # Checks name, email and password input
│       ├── asyncHandler.js        # Sends errors from async code to the error handler
│       └── errorHandler.js        # 404 handler and central error handler
├── tests/
│   ├── validation.test.js         # Offline tests: validation, attacker-style input, error handler, JWT-secret check
│   └── auth.logic.test.js         # Offline tests: register/login/token logic (uses fakes, not MongoDB)
└── scripts/
    └── smokeCheck.js              # End-to-end check to run against a real server + database
```

## Requirements (Node.js and MongoDB)

- **Node.js 18 or newer** – check with `node -v`. Download from https://nodejs.org
- **A running MongoDB database.** The API cannot start without one. Choose either option:
  - **Option A – Local MongoDB:** install MongoDB Community Edition, start it, and use
    `mongodb://127.0.0.1:27017/auth_db` as your connection string.
  - **Option B – MongoDB Atlas (free cloud database):** create a free cluster at https://www.mongodb.com/atlas,
    create a database user, allow your IP address under *Network Access*, then copy the connection string
    (it looks like `mongodb+srv://<username>:<password>@<cluster-url>/auth_db?...`).
- **Postman** (optional but recommended) – https://www.postman.com/downloads/

## Local Installation

```bash
# 1. Go into the project folder
cd user-auth-api

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
| `MONGODB_URI`    | Your MongoDB connection string                             | `mongodb://127.0.0.1:27017/auth_db` |
| `JWT_SECRET`     | Secret key used to sign tokens. Long, random, private (at least 16 characters) | *(generate one, see below)* |
| `JWT_EXPIRES_IN` | How long a token stays valid                               | `1d`                                |
| `NODE_ENV`       | `development` shows error details, `production` hides them | `development`                       |

**Generate a strong `JWT_SECRET`** by running this command and pasting the result into `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Security:** never commit your `.env` file or share your `JWT_SECRET` or database password. `.env` is already listed in `.gitignore`.
> The server **refuses to start** (and prints why) if `MONGODB_URI` is missing, or if `JWT_SECRET` is missing, shorter than 16 characters, or still the example text `your_jwt_secret_here`. This stops you running with a secret that anyone could guess.

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
{ "success": true, "message": "User Authentication API is running" }
```

## How It Works (in simple words)

**Registering**
1. The user sends a name, email and password.
2. The API checks the data, and checks the email is not already used.
3. bcrypt turns the password into a hash (it looks like `$2b$10$N9qo8uLOickgx2ZMRZoMy...`). **Only the hash is saved.**
4. The new user is returned **without** the password.

**Logging in**
1. The user sends their email and password.
2. The API finds the user and asks bcrypt whether the password matches the saved hash.
3. If it matches, the API creates a **JWT**: a signed token that contains the user's id and an expiry time. It is signed with `JWT_SECRET`, so nobody can fake or change it.
4. If the email is unknown *or* the password is wrong, the API gives the same message (`Invalid email or password`), so attackers cannot find out which emails are registered.

**Using the protected route**
1. The user sends the token in a header: `Authorization: Bearer <token>`.
2. The `protect` middleware checks the signature and expiry, and loads the user.
3. If anything is missing, wrong or expired, the API answers `401 Unauthorized`.

## User Data Model

| Field       | Type   | Rules                                                              |
| ----------- | ------ | ------------------------------------------------------------------ |
| `name`      | String | Required, max 50 characters                                        |
| `email`     | String | Required, must be a valid email, **unique**, saved in lowercase    |
| `password`  | String | Required on input (6–72 characters). **Saved as a bcrypt hash** and never returned by the API |
| `createdAt` | Date   | Added automatically                                                |
| `updatedAt` | Date   | Added automatically                                                |

MongoDB stores these in a collection called `users`.

## API Endpoints

Base URL: `http://localhost:5000`

| Method | Endpoint             | Description                          | Auth needed? | Success status |
| ------ | -------------------- | ------------------------------------ | ------------ | -------------- |
| GET    | `/`                  | Check that the API is running        | No           | 200            |
| POST   | `/api/auth/register` | Register a new user                  | No           | 201            |
| POST   | `/api/auth/login`    | Log in and receive a JWT             | No           | 200            |
| GET    | `/api/auth/profile`  | Get the logged-in user (protected). **Added by me to demonstrate JWT; not in the official PDF** | **Yes** (Bearer token) | 200 |

### Error status codes

| Status | When                                                                                   |
| ------ | -------------------------------------------------------------------------------------- |
| 400    | Invalid data (missing fields, bad email, short password) or invalid JSON               |
| 401    | Wrong email or password, or a missing / invalid / expired token                        |
| 404    | The route does not exist                                                               |
| 409    | The email is already registered                                                        |
| 500    | Unexpected server error                                                                |

Every response is JSON. Success responses contain `"success": true`. Error responses contain `"success": false` and a `message`.

## Example Requests and Expected Responses

The `id`, date and token values below are examples; yours will be different.

### 1. Register — `POST /api/auth/register`

Request body:
```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "password": "secret123"
}
```
Expected response — `201 Created`:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "665f1c2e8a1b2c3d4e5f6a7b",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "createdAt": "2026-10-02T10:00:00.000Z"
    }
  }
}
```
The response never contains the password or the hash.

### 2. Login — `POST /api/auth/login`

Request body:
```json
{
  "email": "alice@example.com",
  "password": "secret123"
}
```
Expected response — `200 OK`:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2NWYx...<long token>",
  "data": {
    "user": {
      "id": "665f1c2e8a1b2c3d4e5f6a7b",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "createdAt": "2026-10-02T10:00:00.000Z"
    }
  }
}
```
Copy the `token` value. You need it for the next request.

### 3. Profile (protected) — `GET /api/auth/profile`

No request body. Header required:
```
Authorization: Bearer <paste the token here>
```
Expected response — `200 OK`:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "665f1c2e8a1b2c3d4e5f6a7b",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "createdAt": "2026-10-02T10:00:00.000Z"
    }
  }
}
```

### Example error responses

Register with `{}` — `400 Bad Request`:
```json
{ "success": false, "message": "Validation failed", "errors": ["Name is required", "Email is required", "Password is required"] }
```

Register an email that already exists — `409 Conflict`:
```json
{ "success": false, "message": "Email is already registered" }
```

Login with a wrong password or unknown email — `401 Unauthorized`:
```json
{ "success": false, "message": "Invalid email or password" }
```

Profile without a token — `401 Unauthorized`:
```json
{ "success": false, "message": "Not authorized: token missing" }
```

## Testing with Postman

**Before you start:** the server must be running (`npm run dev`) and the console must show `MongoDB connected`.

**How to send each request in Postman**

1. Click **New → HTTP Request**.
2. Choose the method (GET or POST) and type the URL.
3. For requests with a body: open the **Body** tab → select **raw** → choose **JSON** in the dropdown on the right → paste the JSON.
4. For the protected route: open the **Authorization** tab → set **Auth Type** to **Bearer Token** → paste the token into the **Token** box. *(Paste only the token, without the word "Bearer".)*
5. Click **Send** and check the **status code** (top right of the response) and the **response body**.

Run the steps in order. Step 4 gives you the token used in steps 8–10.

### Checklist

| ☐ | Step | Method + URL | Body / Auth | Expected status | What to verify in the response |
| - | ---- | ------------ | ----------- | --------------- | ------------------------------ |
| ☐ | 0 | `GET http://localhost:5000/` | none | **200** | message "User Authentication API is running" |
| ☐ | 1. Register | `POST http://localhost:5000/api/auth/register` | `{"name": "Alice Johnson", "email": "alice@example.com", "password": "secret123"}` | **201** | "User registered successfully"; user has `id`, `name`, `email`, `createdAt`; **no password** in the response |
| ☐ | 2. Duplicate email | `POST http://localhost:5000/api/auth/register` | same body as step 1 | **409** | "Email is already registered" |
| ☐ | 3a. Empty body | `POST http://localhost:5000/api/auth/register` | `{}` | **400** | `errors` lists "Name is required", "Email is required", "Password is required" |
| ☐ | 3b. Bad email | `POST http://localhost:5000/api/auth/register` | `{"name": "Bob", "email": "not-an-email", "password": "secret123"}` | **400** | "Please provide a valid email address" |
| ☐ | 3c. Short password | `POST http://localhost:5000/api/auth/register` | `{"name": "Bob", "email": "bob@example.com", "password": "123"}` | **400** | "Password must be at least 6 characters" |
| ☐ | 4. Login | `POST http://localhost:5000/api/auth/login` | `{"email": "alice@example.com", "password": "secret123"}` | **200** | "Login successful"; a long `token` is returned (**copy it**); no password in the response |
| ☐ | 5. Wrong password | `POST http://localhost:5000/api/auth/login` | `{"email": "alice@example.com", "password": "wrong-password"}` | **401** | "Invalid email or password"; no token |
| ☐ | 6. Unknown email | `POST http://localhost:5000/api/auth/login` | `{"email": "nobody@example.com", "password": "secret123"}` | **401** | the same message as step 5 |
| ☐ | 7. Login empty body | `POST http://localhost:5000/api/auth/login` | `{}` | **400** | `errors` lists "Email is required", "Password is required" |
| ☐ | 8. Profile with token | `GET http://localhost:5000/api/auth/profile` | Authorization → Bearer Token → your token | **200** | the user is `alice@example.com`; no password |
| ☐ | 9. Profile, no token | `GET http://localhost:5000/api/auth/profile` | no Authorization | **401** | "Not authorized: token missing" |
| ☐ | 10. Profile, bad token | `GET http://localhost:5000/api/auth/profile` | Authorization → Bearer Token → `abc.def.ghi` | **401** | "Not authorized: invalid token" |
| ☐ | 11. Unknown route | `GET http://localhost:5000/api/unknown` | none | **404** | "Route not found: GET /api/unknown" |

Tip: take a screenshot of each response (status code and body visible) as evidence for your submission.

## Checking That Passwords Are Hashed in MongoDB

After registering a user, look at what MongoDB really stored:

- **MongoDB Compass:** open the `auth_db` database → `users` collection.
- **Or in the terminal (mongosh):** `mongosh auth_db --eval "db.users.find().pretty()"`

The `password` field should look like a long scrambled text starting with `$2` (for example `$2b$10$...`), **not** `secret123`. That shows the password is stored as a bcrypt hash.

## Automated Checks (npm test and smoke-test)

### `npm test` — offline tests (no database needed)

```bash
npm test
```

Runs 54 tests covering input validation (including attacker-style input such as `{"$gt": ""}` in place of an email), the error handler, the JWT-secret check, registration, login, the JWT check and the protected route.
The register/login/token tests use small in-memory fakes in place of MongoDB, bcrypt and jsonwebtoken, so they check **our own logic only**
(for example "only the hash is stored", "the password is never returned", "401 for a bad token").
They do **not** prove that the real database, real bcrypt hashing or real JWT signing work. Use the smoke test and Postman for that.

### `npm run smoke-test` — end-to-end check (needs the server and MongoDB)

1. Start the server in one terminal: `npm start`
2. In a second terminal run:

```bash
npm run smoke-test
```

The script sends real requests to your running server and exercises registration, login, the protected route and several error cases.
It also reads the token to confirm it holds the user id and an expiry time.
Each run registers **one new test user** (`smoke.<time>@example.com`). This assignment has no delete route, so that user stays in your database; you can remove it in MongoDB Compass if you like.

Expected output when everything works (21 checks):

```
PASS  Health route returns 200
PASS  Register returns 201
PASS  Registered email is stored in lowercase
PASS  Register response does not contain the password
PASS  Registering the same email again returns 409
PASS  Register with empty body returns 400
PASS  Register with invalid email returns 400
PASS  Register with too-short password returns 400
PASS  Register with invalid JSON returns 400
PASS  Login returns 200
PASS  Login returns a JWT (3 parts) holding the user id and an expiry
PASS  Login response does not contain the password
PASS  Login with wrong password returns 401
PASS  Login with unknown email returns 401 with the same message
PASS  Login with empty body returns 400
PASS  Profile with a valid token returns 200 and the right user
PASS  Profile without a token returns 401
PASS  Profile with an invalid token returns 401
PASS  Profile with the wrong header scheme returns 401
PASS  Profile with a tampered token returns 401
PASS  Unknown route returns 404

Result: 21 passed, 0 failed
```

If your server uses a different port: `BASE_URL=http://localhost:3000 npm run smoke-test`
(on Windows Command Prompt: `set "BASE_URL=http://localhost:3000" && npm run smoke-test` — keep the quotes).

## Verification Status

This section says honestly what was checked before this project was packaged, and what still has to be checked on a real computer.

**Verified automatically (no internet, using Node.js's built-in test runner):**

- `npm test` -> **54 passed, 0 failed**. This covers input validation, attacker-style input, the error handler, the JWT-secret check, and the register / login / token / protected-route logic. The tests were also checked against deliberately broken copies of the code, and every broken copy made them fail.
- Every source file passes a syntax check, every `require` path and `package.json` script points to a real file, `.env` is ignored by git, and no secrets are written in the source.

**Not verified yet (needs your own computer with Node.js and MongoDB):**

- [ ] `npm install` (including the native `bcrypt` package)
- [ ] Starting the server and connecting to a real MongoDB
- [ ] Users really being saved in MongoDB, and the database itself rejecting a duplicate email
- [ ] Real bcrypt hashing and real JWT signing/verification (the offline tests use fakes for these)
- [ ] The Postman checklist above
- [ ] `npm run smoke-test` (21 checks)

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
| `EADDRINUSE` (port already in use) | Another program is using the port. Change `PORT` in `.env`, or stop the other program. |
| `Cannot find module ...` | Run `npm install` inside the `user-auth-api` folder. |
| `npm install` fails on `bcrypt` | `bcrypt` is a native package. Use a current Node.js LTS version, make sure you are online, and try again. If it still fails, send me the full error text. |

---

*Skill Nexis MERN Internship — Week 2, Assignment 2*
