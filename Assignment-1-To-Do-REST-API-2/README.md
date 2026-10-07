# To-Do List REST API

Skill Nexis Full Stack Web Development (MERN) Internship — **Week 2, Assignment 1**

A backend REST API for a To-Do application. It lets you **create, read, update and delete** tasks and stores them in **MongoDB** using **Mongoose**.

---

## Table of Contents

1. [Technologies Used](#technologies-used)
2. [Project Structure](#project-structure)
3. [Requirements (Node.js and MongoDB)](#requirements-nodejs-and-mongodb)
4. [Local Installation](#local-installation)
5. [Environment Variables (.env setup)](#environment-variables-env-setup)
6. [Starting the Server](#starting-the-server)
7. [Todo Data Model](#todo-data-model)
8. [API Endpoints](#api-endpoints)
9. [Example Requests and Expected Responses](#example-requests-and-expected-responses)
10. [Testing with Postman](#testing-with-postman)
11. [Automated Checks (npm test and smoke-test)](#automated-checks-npm-test-and-smoke-test)
12. [Troubleshooting](#troubleshooting)

---

## Technologies Used

- **Node.js** – runs JavaScript on the server
- **Express.js** – web framework for routes and middleware
- **MongoDB** – database that stores the tasks
- **Mongoose** – connects Node.js to MongoDB and defines the Todo schema
- **dotenv** – loads settings from a `.env` file
- **nodemon** *(development only)* – restarts the server when you save a file
- **Postman** – used to test the API

## Project Structure

```
todo-list-api/
├── server.js                      # Starts the app: connects to MongoDB, then listens on a port
├── package.json                   # Project info, dependencies and npm scripts
├── .env.example                   # Template for your environment variables (no real secrets)
├── .gitignore                     # Keeps .env and node_modules out of Git
├── src/
│   ├── app.js                     # Express setup (JSON parsing, routes, error handlers)
│   ├── config/
│   │   └── db.js                  # MongoDB connection using Mongoose
│   ├── models/
│   │   └── Todo.js                # Todo schema (title, description, completed)
│   ├── controllers/
│   │   └── todoController.js      # Logic for create, read, update, delete
│   ├── routes/
│   │   └── todoRoutes.js          # Maps URLs + HTTP methods to controllers
│   └── middleware/
│       ├── asyncHandler.js        # Sends errors from async code to the error handler
│       ├── validateTodo.js        # Checks request data and ID format
│       └── errorHandler.js        # 404 handler and central error handler
├── tests/
│   ├── validation.test.js         # Offline tests: validation and error handling
│   └── controller.logic.test.js   # Offline tests: controller logic (uses an in-memory fake, not MongoDB)
└── scripts/
    └── smokeCheck.js              # End-to-end check to run against a real server + database
```

## Requirements (Node.js and MongoDB)

- **Node.js 18 or newer** – check with `node -v`. Download from https://nodejs.org
- **A running MongoDB database.** The API cannot start without one. Choose either option:
  - **Option A – Local MongoDB:** install MongoDB Community Edition, start it, and use
    `mongodb://127.0.0.1:27017/todo_db` as your connection string.
  - **Option B – MongoDB Atlas (free cloud database):** create a free cluster at https://www.mongodb.com/atlas,
    create a database user, allow your IP address under *Network Access*, then copy the connection string
    (it looks like `mongodb+srv://<username>:<password>@<cluster-url>/todo_db?...`).
- **Postman** (optional but recommended) – https://www.postman.com/downloads/

## Local Installation

```bash
# 1. Go into the project folder
cd todo-list-api

# 2. Install dependencies
npm install
```

## Environment Variables (.env setup)

1. Copy the example file to a new file named `.env`:
   - Mac/Linux: `cp .env.example .env`
   - Windows (Command Prompt): `copy .env.example .env`
2. Open `.env` and replace the placeholder values with your own:

| Variable      | Description                                                 | Example                             |
| ------------- | ----------------------------------------------------------- | ----------------------------------- |
| `PORT`        | Port the server runs on                                     | `5000`                              |
| `MONGODB_URI` | Your MongoDB connection string                              | `mongodb://127.0.0.1:27017/todo_db` |
| `NODE_ENV`    | `development` shows error details, `production` hides them  | `development`                       |

> **Security:** never commit your `.env` file or share your database password. `.env` is already listed in `.gitignore`.
> If `MONGODB_URI` is missing, the server stops and prints a message telling you to set it.

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
{ "success": true, "message": "To-Do List API is running" }
```

## Todo Data Model

| Field         | Type    | Rules                                |
| ------------- | ------- | ------------------------------------ |
| `title`       | String  | Required, max 100 characters         |
| `description` | String  | Optional, max 500 characters         |
| `completed`   | Boolean | Optional, defaults to `false`        |
| `createdAt`   | Date    | Added automatically                  |
| `updatedAt`   | Date    | Added automatically                  |

## API Endpoints

Base URL: `http://localhost:5000`

| Method | Endpoint         | Description                  | Success status |
| ------ | ---------------- | ---------------------------- | -------------- |
| GET    | `/`              | Check that the API is running | 200           |
| POST   | `/api/todos`     | Create a task                | 201            |
| GET    | `/api/todos`     | Get all tasks (newest first) | 200            |
| GET    | `/api/todos/:id` | Get one task                 | 200            |
| PUT    | `/api/todos/:id` | Update a task                | 200            |
| PATCH  | `/api/todos/:id` | Update a task (same as PUT)  | 200            |
| DELETE | `/api/todos/:id` | Delete a task                | 200            |

For updates, send **only the fields you want to change** (`title`, `description`, `completed`).

### Error status codes

| Status | When                                                        |
| ------ | ----------------------------------------------------------- |
| 400    | Invalid data, invalid JSON, empty update body, or malformed ID |
| 404    | Task not found, or the route does not exist                 |
| 500    | Unexpected server error                                     |

Every response is JSON. Success responses contain `"success": true`. Error responses contain `"success": false` and a `message`.

## Example Requests and Expected Responses

The `_id` and date values below are examples; yours will be different.

### 1. Create a task — `POST /api/todos`

Request body:
```json
{
  "title": "Learn Express.js",
  "description": "Finish the routing chapter"
}
```
Expected response — `201 Created`:
```json
{
  "success": true,
  "message": "Todo created successfully",
  "data": {
    "_id": "665f1c2e8a1b2c3d4e5f6a7b",
    "title": "Learn Express.js",
    "description": "Finish the routing chapter",
    "completed": false,
    "createdAt": "2026-10-02T10:00:00.000Z",
    "updatedAt": "2026-10-02T10:00:00.000Z",
    "__v": 0
  }
}
```

### 2. Get all tasks — `GET /api/todos`

No request body. Expected response — `200 OK`:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "665f1c2e8a1b2c3d4e5f6a7b",
      "title": "Learn Express.js",
      "description": "Finish the routing chapter",
      "completed": false,
      "createdAt": "2026-10-02T10:00:00.000Z",
      "updatedAt": "2026-10-02T10:00:00.000Z",
      "__v": 0
    }
  ]
}
```

### 3. Get one task — `GET /api/todos/665f1c2e8a1b2c3d4e5f6a7b`

No request body. Expected response — `200 OK`:
```json
{
  "success": true,
  "data": {
    "_id": "665f1c2e8a1b2c3d4e5f6a7b",
    "title": "Learn Express.js",
    "description": "Finish the routing chapter",
    "completed": false,
    "createdAt": "2026-10-02T10:00:00.000Z",
    "updatedAt": "2026-10-02T10:00:00.000Z",
    "__v": 0
  }
}
```

### 4. Update a task — `PUT /api/todos/665f1c2e8a1b2c3d4e5f6a7b`

Request body (send only what you want to change):
```json
{
  "completed": true
}
```
Expected response — `200 OK`:
```json
{
  "success": true,
  "message": "Todo updated successfully",
  "data": {
    "_id": "665f1c2e8a1b2c3d4e5f6a7b",
    "title": "Learn Express.js",
    "description": "Finish the routing chapter",
    "completed": true,
    "createdAt": "2026-10-02T10:00:00.000Z",
    "updatedAt": "2026-10-02T10:05:00.000Z",
    "__v": 0
  }
}
```

### 5. Delete a task — `DELETE /api/todos/665f1c2e8a1b2c3d4e5f6a7b`

No request body. Expected response — `200 OK`:
```json
{
  "success": true,
  "message": "Todo deleted successfully",
  "data": {
    "_id": "665f1c2e8a1b2c3d4e5f6a7b",
    "title": "Learn Express.js",
    "description": "Finish the routing chapter",
    "completed": true,
    "createdAt": "2026-10-02T10:00:00.000Z",
    "updatedAt": "2026-10-02T10:05:00.000Z",
    "__v": 0
  }
}
```

### Example error responses

`POST /api/todos` with body `{}` — `400 Bad Request`:
```json
{ "success": false, "message": "Validation failed", "errors": ["Title is required"] }
```

`GET /api/todos/123` — `400 Bad Request`:
```json
{ "success": false, "message": "Invalid todo ID format" }
```

`GET /api/todos/507f1f77bcf86cd799439011` (valid format, but no such task) — `404 Not Found`:
```json
{ "success": false, "message": "Todo not found" }
```

## Testing with Postman

**Before you start:** the server must be running (`npm run dev`) and the console must show `MongoDB connected`.

**How to send each request in Postman**

1. Click **New → HTTP Request**.
2. Choose the method (GET, POST, PUT, PATCH, DELETE) and type the URL.
3. For requests with a body: open the **Body** tab → select **raw** → choose **JSON** in the dropdown on the right → paste the JSON.
4. Click **Send** and check the **status code** (top right of the response) and the **response body**.

**Recommended order:** 1 → 2 → 3 → 4 → 5 → 7 → 8 → 6 (do the DELETE last, because steps 7 and 8 reuse the task's `_id`).
Replace `<id>` below with the `_id` you copy from step 1.

### Checklist

| ☐ | Step | Method + URL | JSON body | Expected status | What to verify in the response |
| - | ---- | ------------ | --------- | --------------- | ------------------------------ |
| ☐ | 0 | `GET http://localhost:5000/` | none | **200** | `message` is "To-Do List API is running" |
| ☐ | 1. Create | `POST http://localhost:5000/api/todos` | `{"title": "Learn Express.js", "description": "Finish the routing chapter"}` | **201** | `success` is `true`; message "Todo created successfully"; `data` has an `_id` (**copy it**), the same `title`/`description`, `completed` is `false`, and `createdAt`/`updatedAt` exist |
| ☐ | 2. Get all | `GET http://localhost:5000/api/todos` | none | **200** | `count` is 1 or more; `data` is a list that contains your task (newest first) |
| ☐ | 3. Get one | `GET http://localhost:5000/api/todos/<id>` | none | **200** | `data._id` matches the `_id` you copied |
| ☐ | 4. Update (PUT) | `PUT http://localhost:5000/api/todos/<id>` | `{"title": "Learn Express.js - routing done", "completed": true}` | **200** | message "Todo updated successfully"; `title` changed; `completed` is `true`; `description` is unchanged; `updatedAt` is newer |
| ☐ | 5. Partial update (PATCH) | `PATCH http://localhost:5000/api/todos/<id>` | `{"completed": false}` | **200** | `completed` is `false`; `title` and `description` are unchanged |
| ☐ | 7a. Validation: no title | `POST http://localhost:5000/api/todos` | `{}` | **400** | `success` is `false`; message "Validation failed"; `errors` contains "Title is required" |
| ☐ | 7b. Validation: blank title | `POST http://localhost:5000/api/todos` | `{"title": "   "}` | **400** | `errors` contains "Title must be a non-empty string" |
| ☐ | 7c. Validation: wrong type | `POST http://localhost:5000/api/todos` | `{"title": "Test", "completed": "yes"}` | **400** | `errors` contains "Completed must be true or false" |
| ☐ | 7d. Validation: empty update | `PUT http://localhost:5000/api/todos/<id>` | `{}` | **400** | `errors` contains "Provide at least one field to update: title, description or completed" |
| ☐ | 7e. Invalid JSON | `POST http://localhost:5000/api/todos` | type `{ bad json` | **400** | message "Invalid JSON in request body" |
| ☐ | 8a. Invalid ID | `GET http://localhost:5000/api/todos/123` | none | **400** | message "Invalid todo ID format" |
| ☐ | 8b. ID not found | `GET http://localhost:5000/api/todos/507f1f77bcf86cd799439011` | none | **404** | message "Todo not found" |
| ☐ | 8c. Unknown route | `GET http://localhost:5000/api/unknown` | none | **404** | message "Route not found: GET /api/unknown" |
| ☐ | 6. Delete | `DELETE http://localhost:5000/api/todos/<id>` | none | **200** | message "Todo deleted successfully"; `data` shows the deleted task |
| ☐ | 6b. Confirm deleted | `GET http://localhost:5000/api/todos/<id>` | none | **404** | message "Todo not found" |

Tip: take a screenshot of each response (status code and body visible) as evidence for your submission.

## Automated Checks (npm test and smoke-test)

### `npm test` — offline tests (no database needed)

```bash
npm test
```

Runs 25 tests covering request validation, ID checking, the error handler, and the controller logic.
The controller tests use a small in-memory fake in place of MongoDB, so they check the logic only —
they do **not** test the database connection.

### `npm run smoke-test` — end-to-end check (needs the server and MongoDB)

1. Start the server in one terminal: `npm start`
2. In a second terminal run:

```bash
npm run smoke-test
```

The script sends real requests to your running server, exercises every route and several error cases,
and deletes the task it created. Expected output when everything works (14 checks):

```
PASS  Health route returns 200
PASS  Create todo returns 201
PASS  Created todo has _id and completed=false
PASS  Get all returns 200 and includes new todo
PASS  Get by id returns 200
PASS  Update returns 200 with new values
PASS  Create without title returns 400
PASS  Invalid JSON returns 400
PASS  Update with empty body returns 400
PASS  Invalid id format returns 400
PASS  Valid but unknown id returns 404
PASS  Delete returns 200
PASS  Deleted todo now returns 404
PASS  Unknown route returns 404

Result: 14 passed, 0 failed
```

If your server uses a different port: `BASE_URL=http://localhost:3000 npm run smoke-test`
(on Windows Command Prompt: `set "BASE_URL=http://localhost:3000" && npm run smoke-test` — keep the quotes).
The smoke test does not cover `PATCH`; test that one in Postman (step 5 below).

## Troubleshooting

| Problem | What to check |
| ------- | ------------- |
| `MONGODB_URI is missing` | You have not created `.env`. Copy `.env.example` to `.env` and set `MONGODB_URI`. |
| `MongoDB connection failed ... ECONNREFUSED` | Local MongoDB is not running. Start it, or use an Atlas connection string. |
| Atlas: `Authentication failed` or timeout | Check the username/password, and add your IP address under *Network Access* in Atlas. If your password has special characters (such as `@`, `#`, `/`), replace them with their URL-encoded form (for example `@` becomes `%40`). |
| `EADDRINUSE` (port already in use) | Another program is using the port. Change `PORT` in `.env`, or stop the other program. |
| `Cannot find module ...` | Run `npm install` inside the `todo-list-api` folder. |

---

*Skill Nexis MERN Internship — Week 2, Assignment 1*
