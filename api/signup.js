const { query } = require('./_lib/db');
const { hashPassword, createSessionToken, setSessionCookie } = require('./_lib/auth');
const { readJson, json } = require('./_lib/body');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  try {
    const { email, password, name, phone, creator_code } = await readJson(req);
    if (!email || !password || !name) return json(res, 400, { error: 'email, password, and name are required' });
    if (password.length < 6) return json(res, 400, { error: 'password must be at least 6 characters' });

    const emailLower = String(email).trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE email = $1', [emailLower]);
    if (existing.rowCount > 0) return json(res, 409, { error: 'an account with this email already exists' });

    let role = 'member';
    if (creator_code) {
      if (!process.env.CREATOR_CODE) return json(res, 400, { error: 'creator code disabled' });
      if (creator_code !== process.env.CREATOR_CODE) return json(res, 400, { error: 'invalid creator code' });
      role = 'admin';
    }

    const password_hash = await hashPassword(password);
    const ins = await query(
      `INSERT INTO users (email, password_hash, name, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role`,
      [emailLower, password_hash, name.trim(), phone?.trim() || null, role]
    );
    const user = ins.rows[0];
    const token = await createSessionToken(user);
    setSessionCookie(res, token);
    return json(res, 200, { user });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
