const { Pool } = require('pg');

const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;

// Si no hay DATABASE_URL, pg toma PGHOST, PGUSER, PGPASSWORD, PGDATABASE y PGPORT del entorno.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  ssl,
  max: 10,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] error inesperado en cliente inactivo:', err.message);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDatabase({ retries = 15, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log('[db] conexión establecida');
      return;
    } catch (err) {
      console.warn(`[db] intento ${attempt}/${retries} falló: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      author     VARCHAR(60)  NOT NULL,
      content    VARCHAR(280) NOT NULL,
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS visits (
      id         SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      total      BIGINT NOT NULL DEFAULT 0
    );

    INSERT INTO visits (id, total) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
  `);
  console.log('[db] migraciones aplicadas');
}

module.exports = { pool, waitForDatabase, migrate };
