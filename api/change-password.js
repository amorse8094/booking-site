const { query } = require('./_lib/db');
const { getSessionFromReq, verifyPassword, hashPassword } = require('./_lib/auth');
const { readJson, json } = require('./_lib/body');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  try {
    const session = await getSessionFromReq(req);
    if (!session) return json(res, 401, { error: 'sign in required' });

    const { current_password, new_password } = await readJson(req);
    if (!current_password || !new_password) return json(res, 400, { error: 'current and new passwords are required' });
    if (new_password.length < 6) return json(res, 400, { error: 'new password must be at least 6 characters' });

    const r = await query('SELECT password_hash FROM users WHERE id = $1', [session.sub]);
    if (r.rowCount === 0) return json(res, 401, { error: 'account not found' });
    const ok = await verifyPassword(current_password, r.rows[0].password_hash);
    if (!ok) return json(res, 401, { error: 'current password is incorrect' });

    const newHash = await hashPassword(new_password);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, session.sub]);
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
