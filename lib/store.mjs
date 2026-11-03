import { readFile, mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const initialState = () => ({ version: 1, accounts: [], sessions: [], friends: [], requests: [], results: [], messages: [] });
const validate = data => {
  if (data?.version !== 1 || !['accounts', 'sessions', 'friends', 'requests', 'results', 'messages'].every(key => Array.isArray(data[key]))) throw new Error('Format penyimpanan akun tidak dikenali. Data tidak diubah.');
  return data;
};

// One serialized transaction queue per local server; atomic replacement prevents partial saves.
export function createStore({ file = null, databaseUrl = null } = {}) {
  if (databaseUrl) return postgresStore(databaseUrl);
  let state = initialState();
  const ready = file ? readFile(file, 'utf8').then(text => { state = validate(JSON.parse(text)); }).catch(error => { if (error.code !== 'ENOENT') throw error; }) : Promise.resolve();
  let tail = ready;
  async function save(data) {
    if (!file) return;
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(data)); await handle.sync(); } finally { await handle.close(); }
      await rename(temporary, file);
    } finally { await rm(temporary, { force: true }); }
  }
  return {
    ready, kind: file ? 'file' : 'memory',
    async read(work) { await ready; await tail; return work(structuredClone(state)); },
    transaction(work) {
      const operation = tail.then(async () => {
        const candidate = structuredClone(state);
        const result = await work(candidate);
        await save(candidate);
        state = candidate;
        return structuredClone(result);
      });
      tail = operation.catch(() => {});
      return operation;
    },
    async close() { await tail; },
  };
}

function postgresStore(connectionString) {
  let pool;
  const ready = import('pg').then(async ({ Pool }) => {
    pool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 10000 });
    pool.on('error', () => console.error('Koneksi penyimpanan akun terputus.'));
    await pool.query('CREATE TABLE IF NOT EXISTS empire_state (id integer PRIMARY KEY CHECK (id = 1), data jsonb NOT NULL)');
    await pool.query('INSERT INTO empire_state (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [initialState()]);
  });
  return {
    ready, kind: 'postgres',
    async read(work) { await ready; const { rows } = await pool.query('SELECT data FROM empire_state WHERE id = 1'); return work(validate(rows[0].data)); },
    async transaction(work) {
      await ready;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT data FROM empire_state WHERE id = 1 FOR UPDATE');
        const data = validate(rows[0].data);
        const result = await work(data);
        await client.query('UPDATE empire_state SET data = $1 WHERE id = 1', [data]);
        await client.query('COMMIT');
        return structuredClone(result);
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async close() { await ready; await pool.end(); },
  };
}
