const { query } = require('../_lib/db');
const { requireAdmin } = require('../_lib/auth');
const { json } = require('../_lib/body');

module.exports = async (req, res) => {
  const session = await requireAdmin(req, res);
  if (!session) return;
  try {
    const r = await query(
      `SELECT id, email, name, phone, role, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    return json(res, 200, { users: r.rows });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
