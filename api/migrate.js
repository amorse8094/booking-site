const { query } = require('./_lib/db');
const { json } = require('./_lib/body');

module.exports = async (req, res) => {
  const secret = req.query?.secret || new URL(req.url, 'http://x').searchParams.get('secret');
  if (!process.env.SESSION_SECRET || secret !== process.env.SESSION_SECRET) {
    return json(res, 401, { error: 'unauthorized' });
  }
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_tokens(token_hash);`);
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
