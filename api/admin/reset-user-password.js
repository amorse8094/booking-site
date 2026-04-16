const { query } = require('../_lib/db');
const { requireAdmin, randomToken, sha256 } = require('../_lib/auth');
const { sendPasswordReset } = require('../_lib/email');
const { readJson, json } = require('../_lib/body');

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

    if (!process.env.RESEND_API_KEY) {
      return json(res, 503, {
        error: 'Email is not enabled. Set RESEND_API_KEY in Vercel to send reset links.',
      });
    }

    const token = randomToken(32);
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    const origin = process.env.APP_URL
      || (req.headers['x-forwarded-proto'] && req.headers.host
          ? `${req.headers['x-forwarded-proto']}://${req.headers.host}`
          : `https://${req.headers.host}`);
    const resetUrl = `${origin}/reset.html?token=${encodeURIComponent(token)}`;

    try {
      await sendPasswordReset({ to: user.email, name: user.name, resetUrl });
    } catch (e) {
      return json(res, 500, { error: 'Could not send email: ' + e.message });
    }

    return json(res, 200, {
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
