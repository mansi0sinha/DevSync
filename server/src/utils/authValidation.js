const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_BYTES = 72;

function isObjectBody(body) {
  return body !== null && typeof body === "object" && !Array.isArray(body);
}

function validateEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function validatePassword(value) {
  return typeof value === "string" && value.length >= 8 && Buffer.byteLength(value, "utf8") <= MAX_PASSWORD_BYTES;
}

function validateRegistrationBody(body) {
  if (!isObjectBody(body)) return { error: "A valid request body is required." };
  if (Object.keys(body).some((key) => !["name", "email", "password"].includes(key))) return { error: "Request body contains unsupported fields." };
  if (typeof body.name !== "string") return { error: "Name must be a string." };
  const name = body.name.trim();
  if (!name || name.length > 80) return { error: "Name must be between 1 and 80 characters." };
  const email = validateEmail(body.email);
  if (!email) return { error: "Enter a valid email address of at most 254 characters." };
  if (!validatePassword(body.password)) return { error: "Password must be 8 to 72 UTF-8 bytes." };
  return { value: { name, email, password: body.password } };
}

function validateLoginBody(body) {
  if (!isObjectBody(body)) return { error: "A valid request body is required." };
  if (Object.keys(body).some((key) => !["email", "password"].includes(key))) return { error: "Request body contains unsupported fields." };
  const email = validateEmail(body.email);
  if (!email) return { error: "Enter a valid email address of at most 254 characters." };
  if (!validatePassword(body.password)) return { error: "Email or password is invalid." };
  return { value: { email, password: body.password } };
}

module.exports = { validateLoginBody, validateRegistrationBody };
