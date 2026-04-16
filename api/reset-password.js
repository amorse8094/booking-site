const { query } = require('./_lib/db');
const { sha256, hashPassword, createSessionToken, setSessionCookie } = require('./_lib/auth');
const { readJson, json } = require('./_lib/body');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  try {
    const { token, password } = await readJson(req);
    if (!token || !password) return json(res, 400, { error: 'token and password are required' });
    if (password.length < 6) return json(res, 400, { error: 'password must be at least 6 characters' });

    const tokenHash = sha256(token);
    const r = await query(
      `SELECT t.id, t.user_id, t.expires_at, t.used_at, u.email, u.name, u.role
       FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1`,
      [tokenHash]
    );
    if (r.rowCount === 0) return json(res, 400, { error: 'invalid or expired reset link' });
    const row = r.rows[0];
    if (row.used_at) return json(res, 400, { error: 'this reset link has already been used' });
    if (new Date(row.expires_at) < new Date()) return json(res, 400, { error: 'this reset link has expired' });

    const newHash = await hashPassword(password);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, row.user_id]);
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL', [row.user_id]);

    const user = { id: row.user_id, email: row.email, name: row.name, role: row.role };
    const sessionToken = await createSessionToken(user);
    setSessionCookie(res, sessionToken);
    return json(res, 200, { user });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
