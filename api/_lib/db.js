const { Pool } = require('pg');

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL;

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
      max: 3,
    });
  }
  return pool;
}

async function query(text, params) {
  const res = await getPool().query(text, params);
  return res;
}

module.exports = { query, getPool };
