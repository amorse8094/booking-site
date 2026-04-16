const bcrypt = require('bcryptjs');
const { SignJWT, jwtVerify } = require('jose');
const crypto = require('crypto');

const SESSION_COOKIE = 'fbm_session';
const SESSION_DAYS = 30;

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET env var not set');
  return new TextEncoder().encode(s);
}

async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}
async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

async function createSessionToken(user) {
  return new SignJWT({ sub: String(user.id), email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

async function readSessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i < 0) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

async function getSessionFromReq(req) {
  const cookies = parseCookies(req);
  return readSessionToken(cookies[SESSION_COOKIE]);
}

async function requireAdmin(req, res) {
  const session = await getSessionFromReq(req);
  if (!session || session.role !== 'creator') {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'admin access required' }));
    return null;
  }
  return session;
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSessionToken,
  readSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromReq,
  requireAdmin,
  parseCookies,
  randomToken,
  sha256,
};
