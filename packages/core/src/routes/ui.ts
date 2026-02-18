import crypto from 'crypto';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { apiKeys, workspaces } from '../db/schema.js';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lock — API Keys</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .container { width: 100%; max-width: 480px; padding: 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: .25rem; }
  .sub { color: #888; font-size: .875rem; margin-bottom: 2rem; }
  label { display: block; font-size: .8rem; color: #aaa; margin-bottom: .35rem; font-weight: 500; }
  input, select { width: 100%; padding: .6rem .75rem; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #e5e5e5; font-size: .9rem; margin-bottom: 1rem; outline: none; }
  input:focus, select:focus { border-color: #555; }
  button { width: 100%; padding: .7rem; background: #fff; color: #000; border: none; border-radius: 6px; font-size: .9rem; font-weight: 600; cursor: pointer; }
  button:hover { background: #ddd; }
  .result { margin-top: 1.5rem; padding: 1rem; background: #111; border: 1px solid #2a2a2a; border-radius: 6px; display: none; }
  .result.show { display: block; }
  .key-display { font-family: monospace; font-size: .95rem; color: #fff; word-break: break-all; padding: .75rem; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; margin: .5rem 0; user-select: all; cursor: pointer; }
  .warn { font-size: .75rem; color: #f59e0b; margin-top: .5rem; }
  .keys-list { margin-top: 2rem; }
  .keys-list h2 { font-size: 1rem; margin-bottom: .75rem; color: #aaa; }
  .key-row { display: flex; justify-content: space-between; align-items: center; padding: .5rem .75rem; background: #1a1a1a; border-radius: 6px; margin-bottom: .4rem; font-size: .85rem; }
  .key-row .prefix { font-family: monospace; color: #888; }
  .key-row .name { color: #ccc; }
  .key-row .date { color: #666; font-size: .75rem; }
  .empty { color: #555; font-size: .85rem; font-style: italic; }
</style>
</head>
<body>
<div class="container">
  <h1>Lock</h1>
  <p class="sub">Create an API key</p>

  <form id="form">
    <label>Key name</label>
    <input type="text" id="name" placeholder="e.g. philippe's CLI" required>

    <label>Workspace</label>
    <select id="workspace"></select>

    <button type="submit">Generate key</button>
  </form>

  <p id="error" style="display:none; color:#ef4444; font-size:.85rem; margin-top:.75rem; padding:.5rem .75rem; background:#1c0a0a; border-radius:6px;"></p>

  <div class="result" id="result">
    <label>Your API key (save it now — you won't see it again)</label>
    <div class="key-display" id="keyValue"></div>
    <p class="warn">Store this somewhere safe. Only the hash is kept in the database.</p>
  </div>

  <div class="keys-list">
    <h2>Existing keys</h2>
    <div id="keysList"></div>
  </div>
</div>

<script>
async function load() {
  try {
    const ws = await fetch('/_ui/workspaces').then(r => r.json());
    const sel = document.getElementById('workspace');
    if (!ws || ws.length === 0) {
      sel.innerHTML = '<option value="">Auto-create new workspace</option>';
    } else {
      sel.innerHTML = ws.map(w => '<option value="'+w.id+'">'+w.name+'</option>').join('');
    }
  } catch (e) {
    document.getElementById('workspace').innerHTML = '<option value="">Auto-create new workspace</option>';
  }

  try {
    const keys = await fetch('/_ui/keys').then(r => r.json());
    const list = document.getElementById('keysList');
    if (!keys || keys.length === 0) {
      list.innerHTML = '<p class="empty">No API keys yet</p>';
    } else {
      list.innerHTML = keys.map(k =>
        '<div class="key-row"><span class="prefix">'+k.key_prefix+'...</span><span class="name">'+k.name+'</span><span class="date">'+new Date(k.created_at).toLocaleDateString()+'</span></div>'
      ).join('');
    }
  } catch (e) {
    document.getElementById('keysList').innerHTML = '<p class="empty">Could not load keys</p>';
  }
}

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value;
  const workspace = document.getElementById('workspace').value;
  const errEl = document.getElementById('error');
  errEl.style.display = 'none';

  try {
    const res = await fetch('/_ui/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, workspace_id: workspace || null }),
    });
    const data = await res.json();

    if (!res.ok || !data.api_key) {
      errEl.textContent = data.error?.message || data.message || 'Failed to create key';
      errEl.style.display = 'block';
      return;
    }

    document.getElementById('keyValue').textContent = data.api_key;
    document.getElementById('result').classList.add('show');
    document.getElementById('name').value = '';
    load();
  } catch (err) {
    errEl.textContent = 'Request failed: ' + err.message;
    errEl.style.display = 'block';
  }
});

load();
</script>
</body>
</html>`;

export async function uiRoutes(fastify: FastifyInstance) {
  // Serve the HTML page
  fastify.get('/', async (_request, reply) => {
    reply.type('text/html').send(HTML);
  });

  // List workspaces
  fastify.get('/_ui/workspaces', async () => {
    return await db.query.workspaces.findMany();
  });

  // List existing keys (prefix + name only, no secrets)
  fastify.get('/_ui/keys', async () => {
    const keys = await db.query.apiKeys.findMany();
    return keys.map((k) => ({
      key_prefix: k.keyPrefix,
      name: k.name,
      created_at: k.createdAt,
    }));
  });

  // Create a new API key
  fastify.post('/_ui/keys', async (request) => {
    const { name, workspace_id } = request.body as {
      name: string;
      workspace_id?: string | null;
    };

    // Resolve or create workspace
    let wsId = workspace_id;
    if (!wsId) {
      const [ws] = await db
        .insert(workspaces)
        .values({ name: 'Default Workspace' })
        .returning();
      wsId = ws.id;
    }

    // Generate the key
    const rawKey = 'lk_' + crypto.randomBytes(16).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 11);

    await db.insert(apiKeys).values({
      workspaceId: wsId,
      keyHash,
      keyPrefix,
      name: name || 'Unnamed key',
    });

    return { api_key: rawKey, key_prefix: keyPrefix };
  });
}
