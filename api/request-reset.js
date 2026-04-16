const { query } = require('./_lib/db');
const { randomToken, sha256 } = require('./_lib/auth');
const { sendPasswordReset } = require('./_lib/email');
const { readJson, json } = require('./_lib/body');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  try {
    const { email } = await readJson(req);
    if (!email) return json(res, 400, { error: 'email is required' });
    const emailLower = String(email).trim().toLowerCase();

    if (!process.env.RESEND_API_KEY) {
      return json(res, 200, {
        ok: true,
        email_disabled: true,
        contact_email: process.env.OWNER_EMAIL || 'hello@floralbotanicalmedicine.com',
      });
    }

    const r = await query('SELECT id, email, name FROM users WHERE email = $1', [emailLower]);

    if (r.rowCount > 0) {
      const user = r.rows[0];
      const token = randomToken(32);
      const tokenHash = sha256(token);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

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
    }

    // Always respond the same way — don't leak whether the email is registered.
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
