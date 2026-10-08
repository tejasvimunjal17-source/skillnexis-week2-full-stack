// Builds the Express app (kept separate from server.js so it is easy to test).
const express = require('express');
const todoRoutes = require('./routes/todoRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json()); // lets the API read JSON request bodies

app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'To-Do List API is running' });
});

app.use('/api/todos', todoRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
