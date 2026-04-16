const { clearSessionCookie } = require('./_lib/auth');
const { json } = require('./_lib/body');

module.exports = async (req, res) => {
  clearSessionCookie(res);
  return json(res, 200, { ok: true });
};
