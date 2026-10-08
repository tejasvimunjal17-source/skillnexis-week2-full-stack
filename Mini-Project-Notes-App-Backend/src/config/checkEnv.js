// Checks that JWT_SECRET is safe to use before the server starts.
// A missing, example-placeholder or very short secret would make tokens easy to forge.
const PLACEHOLDER_SECRET = 'your_jwt_secret_here'; // the value written in .env.example
const MIN_SECRET_LENGTH = 16;

// Returns a message describing the problem, or null if the secret is fine.
const getJwtSecretProblem = (secret) => {
  if (!secret) {
    return 'JWT_SECRET is missing. Copy .env.example to .env and set it.';
  }
  if (secret === PLACEHOLDER_SECRET) {
    return 'JWT_SECRET is still the example placeholder. Generate your own secret (see the README).';
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    return `JWT_SECRET is too short. Use at least ${MIN_SECRET_LENGTH} characters (see the README).`;
  }
  return null;
};

module.exports = { getJwtSecretProblem, PLACEHOLDER_SECRET, MIN_SECRET_LENGTH };
