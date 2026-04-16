const { query } = require('../_lib/db');
const { requireAdmin, hashPassword, randomToken } = require('../_lib/auth');
const { readJson, json } = require('../_lib/body');

function friendlyTempPassword() {
  return randomToken(8).replace(/[-_]/g, '').slice(0, 10);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  const session = await requireAdmin(req, res);
  if (!session) return;
  try {
    const { user_id } = await readJson(req);
    if (!user_id) return json(res, 400, { error: 'user_id is required' });

    const r = await query('SELECT id, email, name FROM users WHERE id = $1', [user_id]);
    if (r.rowCount === 0) return json(res, 404, { error: 'user not found' });
    const user = r.rows[0];

    const tempPassword = friendlyTempPassword();
    const hash = await hashPassword(tempPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

    return json(res, 200, {
      user: { id: user.id, email: user.email, name: user.name },
      temp_password: tempPassword,
    });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
