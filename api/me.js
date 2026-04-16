const { query } = require('./_lib/db');
const { getSessionFromReq } = require('./_lib/auth');
const { json } = require('./_lib/body');

module.exports = async (req, res) => {
  try {
    const session = await getSessionFromReq(req);
    if (!session) return json(res, 200, { user: null });
    const r = await query(
      'SELECT id, email, name, role, phone FROM users WHERE id = $1',
      [session.sub]
    );
    if (r.rowCount === 0) return json(res, 200, { user: null });
    return json(res, 200, { user: r.rows[0] });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
