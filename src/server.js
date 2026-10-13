const os = require('os');
const path = require('path');
const express = require('express');
const { pool, waitForDatabase, migrate } = require('./db');
const { version, name } = require('../package.json');

const PORT = Number(process.env.PORT) || 3000;
const startedAt = new Date();

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Liveness: el proceso está vivo
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Readiness: el proceso puede atender (la base responde)
app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', database: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', database: 'down', error: err.message });
  }
});

app.get('/api/info', async (req, res) => {
  const info = {
    app: 'Sofre Digital Node Test',
    package: name,
    version,
    environment: process.env.APP_ENV || process.env.NODE_ENV || 'development',
    commit: process.env.GIT_COMMIT || null,
    deployedAt: process.env.DEPLOYED_AT || null,
    node: process.version,
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.arch()}`,
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    database: { status: 'down' },
  };

  try {
    const started = Date.now();
    const { rows } = await pool.query(
      'SELECT version() AS version, current_database() AS name, NOW() AS now'
    );
    info.database = {
      status: 'up',
      latencyMs: Date.now() - started,
      name: rows[0].name,
      version: rows[0].version.split(' on ')[0],
      serverTime: rows[0].now,
    };
  } catch (err) {
    info.database.error = err.message;
  }

  res.json(info);
});

app.post('/api/visits', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE visits SET total = total + 1 WHERE id = 1 RETURNING total'
    );
    res.json({ total: Number(rows[0].total) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/messages', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, author, content, created_at FROM messages ORDER BY created_at DESC LIMIT 50'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/messages', async (req, res, next) => {
  const author = String(req.body?.author ?? '').trim();
  const content = String(req.body?.content ?? '').trim();

  if (!author || !content) {
    return res.status(400).json({ error: 'author y content son obligatorios' });
  }
  if (author.length > 60 || content.length > 280) {
    return res.status(400).json({ error: 'author máx. 60 caracteres, content máx. 280' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO messages (author, content) VALUES ($1, $2) RETURNING id, author, content, created_at',
      [author, content]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error('[http]', err);
  res.status(500).json({ error: 'Error interno', detail: err.message });
});

async function start() {
  await waitForDatabase();
  await migrate();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Sofre Digital Node Test v${version} escuchando en http://0.0.0.0:${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`[app] ${signal} recibido, cerrando...`);
    server.close(async () => {
      await pool.end();
      console.log('[app] cerrado correctamente');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[app] no se pudo iniciar:', err.message);
  process.exit(1);
});
