// Entry point: loads settings, checks required secrets, connects to MongoDB, starts the server.
require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const { getJwtSecretProblem } = require('./src/config/checkEnv');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const secretProblem = getJwtSecretProblem(process.env.JWT_SECRET);
  if (secretProblem) {
    console.error(secretProblem);
    process.exit(1);
  }

  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
