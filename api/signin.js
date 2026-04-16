const { query } = require('./_lib/db');
const { verifyPassword, createSessionToken, setSessionCookie } = require('./_lib/auth');
const { readJson, json } = require('./_lib/body');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  try {
    const { email, password } = await readJson(req);
    if (!email || !password) return json(res, 400, { error: 'email and password are required' });
    const emailLower = String(email).trim().toLowerCase();
    const r = await query(
      'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
      [emailLower]
    );
    if (r.rowCount === 0) return json(res, 401, { error: 'incorrect email or password' });
    const user = r.rows[0];
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return json(res, 401, { error: 'incorrect email or password' });
    const token = await createSessionToken(user);
    setSessionCookie(res, token);
    return json(res, 200, { user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
