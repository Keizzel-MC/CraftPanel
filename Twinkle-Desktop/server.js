const express = require('express'), http = require('http'), { WebSocketServer } = require('ws');
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawn, exec } = require('child_process');
const modules = require('./twinkle-modules');

// ---- Configuración persistente ----
// Guardar siempre junto a server.js evita que npm start use otro config.json
// cuando el panel se inicia desde una carpeta de trabajo distinta.
const DATA_DIR = process.env.TWINKLE_DATA_DIR || __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });
modules.initModules(DATA_DIR);
const CF = path.join(DATA_DIR, 'config.json');
const legacyCF = path.resolve(process.cwd(), 'config.json');
if (!fs.existsSync(CF) && legacyCF !== CF && fs.existsSync(legacyCF)) {
  try { fs.copyFileSync(legacyCF, CF); } catch (e) {
    console.warn('[Panel] No se pudo migrar config.json desde la carpeta actual:', e.message);
  }
}
if (!fs.existsSync(CF)) fs.writeFileSync(CF, JSON.stringify({
  port: 3000,
  serverDir: 'C:/Users/TU_USUARIO/Desktop/vanillaserver',
  startCommand: 'run.bat nogui'
}, null, 2));
const CFG = JSON.parse(fs.readFileSync(CF, 'utf8'));
const saveCfg = () => fs.writeFileSync(CF, JSON.stringify(CFG, null, 2) + '\n');

// ---- Soporte para múltiples servidores ----
if (!Array.isArray(CFG.servers)) CFG.servers = [];
if (!CFG.servers.some(s => s.id === CFG.activeServerId)) CFG.activeServerId = CFG.servers[0]?.id || '';
const setServerRam = (server, ramGb) => {
  const ram = Number(ramGb);
  if (!Number.isInteger(ram) || ram < 1 || ram > 32) throw new Error('La RAM debe ser un número entero entre 1 y 32 GB.');
  const dir = server.dir;
  const jvmPath = path.join(dir, 'user_jvm_args.txt');
  const batPath = path.join(dir, 'run.bat');
  const shPath = path.join(dir, 'run.sh');
  if (fs.existsSync(jvmPath)) {
    let raw = fs.readFileSync(jvmPath, 'utf8');
    raw = /(^|\r?\n)\s*-Xmx\s*\S+/i.test(raw) ? raw.replace(/(^|\r?\n)\s*-Xmx\s*\S+/i, '$1-Xmx' + ram + 'G') : '-Xmx' + ram + 'G\n' + raw;
    raw = /(^|\r?\n)\s*-Xms\s*\S+/i.test(raw) ? raw.replace(/(^|\r?\n)\s*-Xms\s*\S+/i, '$1-Xms' + ram + 'G') : raw.replace(/\r?\n?$/, '\n') + '-Xms' + ram + 'G\n';
    fs.writeFileSync(jvmPath, raw);
  } else if (fs.existsSync(batPath)) {
    let raw = fs.readFileSync(batPath, 'utf8');
    if (/-Xmx\s*\d+\s*[gGmM]/i.test(raw)) raw = raw.replace(/-Xmx\s*\d+\s*[gGmM]/i, '-Xmx' + ram + 'G');
    if (/-Xms\s*\d+\s*[gGmM]/i.test(raw)) raw = raw.replace(/-Xms\s*\d+\s*[gGmM]/i, '-Xms' + ram + 'G');
    if (!/-Xmx\s*\d+\s*[gGmM]/i.test(raw)) {
      const lines = raw.split(/\r?\n/); const idx = lines.findIndex(line => /\bjava(?:\.exe)?\b/i.test(line) && !/^\s*(?:rem|::)/i.test(line));
      if (idx < 0) throw new Error('No encontré el comando de Java en run.bat para cambiar la RAM.');
      lines[idx] = lines[idx].replace(/\bjava(?:\.exe)?\b/i, match => match + ' -Xmx' + ram + 'G -Xms' + ram + 'G');
      raw = lines.join('\r\n');
    } else if (!/-Xms\s*\d+\s*[gGmM]/i.test(raw)) raw = raw.replace(/(-Xmx\s*\d+\s*[gGmM])/i, '$1 -Xms' + ram + 'G');
    fs.writeFileSync(batPath, raw);
  } else if (fs.existsSync(shPath)) {
    let raw = fs.readFileSync(shPath, 'utf8');
    if (/-Xmx\s*\d+\s*[gGmM]/i.test(raw)) raw = raw.replace(/-Xmx\s*\d+\s*[gGmM]/i, '-Xmx' + ram + 'G');
    else raw = raw.replace(/\bjava\b/i, 'java -Xmx' + ram + 'G -Xms' + ram + 'G');
    if (/-Xms\s*\d+\s*[gGmM]/i.test(raw)) raw = raw.replace(/-Xms\s*\d+\s*[gGmM]/i, '-Xms' + ram + 'G');
    fs.writeFileSync(shPath, raw);
  } else {
    throw new Error('No se encontró run.bat, run.sh ni user_jvm_args.txt en la carpeta del servidor.');
  }
  server.ramGb = ram;
};
const getActiveServer = () => CFG.servers.find(s => s.id === CFG.activeServerId) || CFG.servers[0];
const setActiveServer = (id) => {
  const s = CFG.servers.find(x => x.id === id);
  if (!s) throw new Error('Servidor no encontrado');
  CFG.activeServerId = s.id;
  CFG.serverDir = s.dir;
  CFG.startCommand = s.startCommand || 'run.bat nogui';
  saveCfg();
  return s;
};
const curActive = getActiveServer();
CFG.serverDir = curActive?.dir || '';
CFG.startCommand = curActive?.startCommand || 'run.bat nogui';

// ---- Usuarios y sesiones ----
const UF = path.join(DATA_DIR, 'users.json'), ROLES = { viewer: 0, mod: 1, admin: 2 };
// En cada instalación nueva se crea users.json vacío. Nunca importamos cuentas de otra instalación.
// Los usuarios existentes en DATA_DIR se conservan durante las actualizaciones.
if (!fs.existsSync(UF)) fs.writeFileSync(UF, '{}\n', { flag: 'wx' });
let users = JSON.parse(fs.readFileSync(UF, 'utf8'));
const saveUsers = () => fs.writeFileSync(UF, JSON.stringify(users, null, 1));
const hash = (p, s) => crypto.scryptSync(p, s, 32).toString('hex');
const addUser = (n, p, role) => { const s = crypto.randomBytes(16).toString('hex'); users[n] = { salt: s, hash: hash(p, s), role }; saveUsers(); };
const tokens = new Map(), fails = new Map();
const newSession = (name) => { const t = crypto.randomBytes(32).toString('hex'); tokens.set(t, { name, role: users[name].role, exp: Date.now() + 12 * 3600e3 }); return t; };
const session = (t) => { const s = tokens.get(t); return s && s.exp > Date.now() && users[s.name] ? s : null; };
const auth = (min) => (q, r, n) => {
  const s = session((q.headers.authorization || '').slice(7));
  if (!s) return r.status(401).json({ error: 'Sesión expirada' });
  if (ROLES[s.role] < ROLES[min]) return r.status(403).json({ error: 'No tienes permiso para esto' });
  q.user = s; n();
};

// ---- Proceso de Minecraft ----
let proc = null, status = 'offline', started = 0, wantRestart = false, log = [];
let installState = { installing: false, step: '', progress: 0, error: '' };
let serverMemMb = 0, serverMaxRamMb = 2048;
const players = new Set();
let cpu = 0, prevServerCpuSeconds = null, prevServerCpuAt = 0;
const sampleServerCpu = () => {
  if (!proc) { cpu = 0; prevServerCpuSeconds = null; prevServerCpuAt = 0; return; }
  // Suma el tiempo de CPU del proceso lanzador y sus procesos descendientes (incluido Java), no el del equipo entero.
  let command;
  if (process.platform === 'win32') {
    const pid = Number(proc.pid);
    command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=${pid}; $all=@(Get-CimInstance Win32_Process); $ids=@($root); do { $new=@($all | Where-Object { $ids -contains $_.ParentProcessId } | ForEach-Object { [int]$_.ProcessId }); $new=@($new | Where-Object { $ids -notcontains $_ }); $ids+= $new } while ($new.Count -gt 0); $sum=(Get-Process -Id $ids -ErrorAction SilentlyContinue | Measure-Object -Property CPU -Sum).Sum; if ($null -eq $sum) { '0' } else { [math]::Round($sum,3) }"`;
  } else {
    command = `ps -eo pid=,ppid=,cputimes=`;
  }
  exec(command, (err, stdout) => {
    if (err || !stdout) return;
    let seconds = 0;
    if (process.platform === 'win32') seconds = parseFloat(stdout.trim()) || 0;
    else {
      const rows = stdout.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/).map(Number)).filter(a => a.length >= 3 && a.every(Number.isFinite));
      const ids = new Set([Number(proc && proc.pid)]);
      let changed = true;
      while (changed) { changed = false; for (const [pid, ppid] of rows) if (ids.has(ppid) && !ids.has(pid)) { ids.add(pid); changed = true; } }
      seconds = rows.reduce((sum, row) => sum + (ids.has(row[0]) ? row[2] : 0), 0);
    }
    const now = Date.now();
    if (prevServerCpuSeconds !== null && prevServerCpuAt && now > prevServerCpuAt) {
      const elapsed = (now - prevServerCpuAt) / 1000;
      const delta = Math.max(0, seconds - prevServerCpuSeconds);
      cpu = Math.max(0, Math.min(100, Math.round(delta / (elapsed * Math.max(1, os.cpus().length)) * 100)));
    }
    prevServerCpuSeconds = seconds; prevServerCpuAt = now;
  });
};
const getServerMaxRam = (dir) => {
  try {
    const batPath = path.join(dir, 'run.bat');
    const jvmPath = path.join(dir, 'user_jvm_args.txt');
    const shPath = path.join(dir, 'run.sh');
    let raw = (CFG.startCommand || '') + '\n';
    if (fs.existsSync(batPath)) raw += fs.readFileSync(batPath, 'utf8') + '\n';
    if (fs.existsSync(jvmPath)) raw += fs.readFileSync(jvmPath, 'utf8') + '\n';
    if (fs.existsSync(shPath)) raw += fs.readFileSync(shPath, 'utf8') + '\n';

    // Ignore commented lines (#, rem, ::)
    const validLines = raw.split(/\r?\n/).filter(line => {
      const t = line.trim().toLowerCase();
      return !t.startsWith('#') && !t.startsWith('rem ') && !t.startsWith('::');
    }).join('\n');

    const matches = [...validLines.matchAll(/-Xmx\s*(\d+)\s*([gGmM])/gi)];
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      const val = parseInt(last[1], 10), unit = last[2].toUpperCase();
      return unit === 'G' ? val * 1024 : val;
    }
  } catch {}
  return 2048;
};
const sampleServerMem = () => {
  serverMaxRamMb = getServerMaxRam(CFG.serverDir);
  if (!proc) { serverMemMb = 0; return; }
  if (process.platform === 'win32') {
    exec('tasklist /FI "IMAGENAME eq java.exe" /FO CSV /NH', (err, stdout) => {
      if (err || !stdout || stdout.toLowerCase().includes('info') || stdout.toLowerCase().includes('informaci')) {
        serverMemMb = 0;
        return;
      }
      let totalKb = 0;
      stdout.split(/\r?\n/).forEach(line => {
        if (!line.trim() || !line.toLowerCase().includes('java.exe')) return;
        const parts = line.split('","');
        if (parts.length >= 5) {
          const kb = parseInt(parts[4].replace(/[^\d]/g, ''), 10);
          if (!isNaN(kb)) totalKb += kb;
        }
      });
      serverMemMb = Math.round(totalKb / 1024);
    });
  } else {
    exec(`ps -o rss= --ppid ${proc.pid} 2>/dev/null || ps -o rss= -p ${proc.pid}`, (err, stdout) => {
      if (err || !stdout) { serverMemMb = 0; return; }
      const totalKb = stdout.trim().split(/\s+/).reduce((acc, v) => acc + (parseInt(v, 10) || 0), 0);
      serverMemMb = Math.round(totalKb / 1024);
    });
  }
};
const wss = new WebSocketServer({ noServer: true });
const send = (o) => wss.clients.forEach((c) => c.readyState === 1 && c.send(JSON.stringify(o)));
const state = () => {
  const maxMb = getServerMaxRam(CFG.serverDir) || serverMaxRamMb || 2048;
  serverMaxRamMb = maxMb;
  const memPct = proc && maxMb ? Math.min(100, Math.round((serverMemMb / maxMb) * 100)) : 0;
  return {
    status,
    started,
    players: [...players],
    cpu,
    mem: memPct,
    serverMemMb: proc ? serverMemMb : 0,
    serverMaxRamMb: maxMb,
    activeServer: getActiveServer(),
    servers: CFG.servers.map(s => ({ id: s.id, name: s.name, dir: s.dir, active: s.id === CFG.activeServerId, exists: fs.existsSync(s.dir) }))
  };
};
const push = () => send({ type: 'status', ...state() });
const setStatus = (s) => { status = s; push(); };

const onLine = (l) => {
  modules.checkTpsFromLine(l);
  l = String(l).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  log.push(l); if (log.length > 500) log.shift(); send({ type: 'log', line: l });
  let m;
  if (/Done \(.*\)! For help/.test(l)) { started = Date.now(); setStatus('online'); }
  if ((m = l.match(/\]: (\w+) joined the game/))) { players.add(m[1]); push(); }
  if ((m = l.match(/\]: (\w+) left the game/))) { players.delete(m[1]); push(); }
};
const start = () => {
  if (proc) return;
  if (!fs.existsSync(CFG.serverDir)) { onLine('[Panel] No existe la carpeta del servidor: ' + CFG.serverDir + ' . Corrige "serverDir" en config.json y reinicia el panel.'); return; }
  setStatus('starting'); players.clear();
  const activeJava = getActiveServer()?.javaPath;
  const childEnv = { ...process.env };
  if (activeJava) {
    const javaExe = path.resolve(String(activeJava).trim());
    if (!fs.existsSync(javaExe) || !/java(?:w)?\.exe$/i.test(javaExe)) {
      onLine('[Panel] La ruta de Java configurada no es válida: ' + javaExe); setStatus('offline'); return;
    }
    childEnv.PATH = path.dirname(javaExe) + path.delimiter + (childEnv.PATH || '');
    childEnv.JAVA_HOME = path.dirname(path.dirname(javaExe));
  }
  // On Windows, run.bat may contain an absolute path to an older Java. PATH alone
  // cannot override that. Create a temporary launcher that explicitly substitutes
  // the Java executable chosen for this server while preserving the rest of the BAT.
  let launchCommand = CFG.startCommand;
  let temporaryBat = null;
  if (activeJava && process.platform === 'win32' && /\.bat(?:\s|$)/i.test(CFG.startCommand)) {
    try {
      const javaExe = path.resolve(String(activeJava).trim());
      const originalBat = path.join(CFG.serverDir, CFG.startCommand.trim().replace(/^\"|\"$/g, '').split(/\s+/)[0]);
      if (fs.existsSync(originalBat)) {
        let batText = fs.readFileSync(originalBat, 'utf8');
        const quotedJava = '\"' + javaExe.replace(/\\/g, '\\\\') + '\"';
        // Replace Java command tokens at the start of commands, including absolute paths.
        batText = batText.split(/\r?\n/).map(line => {
          if (/^\s*(?:@?echo|rem\b|::)/i.test(line)) return line;
          return line.replace(/(^|[&|]\s*)(?:\"[^\"]*\\javaw?\.exe\"|\"?[^\s&|]*\\javaw?\.exe\"?|javaw?\.exe|java)(?=\s|$)/i, (m, prefix) => prefix + quotedJava);
        }).join('\r\n');
        temporaryBat = path.join(CFG.serverDir, '.craftpanel-run-selected-java.bat');
        fs.writeFileSync(temporaryBat, batText, 'utf8');
        launchCommand = '\"' + temporaryBat + '\"' + CFG.startCommand.trim().slice(CFG.startCommand.trim().split(/\s+/)[0].length);
      }
    } catch (e) { onLine('[Panel] No se pudo preparar el lanzador con Java seleccionado: ' + e.message); }
  }
  proc = spawn(launchCommand, { cwd: CFG.serverDir, shell: true, env: childEnv });
  let buf = '';
  const feed = (d) => { buf += d; const p = buf.split(/\r?\n/); buf = p.pop(); p.forEach(onLine); };
  proc.stdout.on('data', feed); proc.stderr.on('data', feed);
  proc.on('error', (e) => { onLine('[Panel] No se pudo iniciar: ' + e.message + ' (revisa serverDir y startCommand en config.json)'); proc = null; serverMemMb = 0; setStatus('offline'); });
  proc.on('exit', (c) => {
    proc = null; serverMemMb = 0; players.clear();
    if (temporaryBat) { try { fs.unlinkSync(temporaryBat); } catch {} temporaryBat = null; }
    onLine(`[Panel] Servidor detenido (código ${c})`); setStatus('offline');
    if (wantRestart) { wantRestart = false; setTimeout(start, 1500); }
  });
};
const stop = () => {
  if (!proc) return;
  setStatus('stopping'); proc.stdin.write('stop\n');
  setTimeout(() => proc && proc.stdin.write('\n'), 15000); // libera el "pause" de run.bat
};
const kill = () => proc && (process.platform === 'win32' ? exec('taskkill /pid ' + proc.pid + ' /T /F') : proc.kill('SIGKILL'));

// ---- API ----
const app = express();
app.use(express.json({ limit: '2mb' }));
if (fs.existsSync(path.join(__dirname, 'public'))) {
  app.use(express.static(path.join(__dirname, 'public')));
}
// Servir exclusivamente la interfaz, nunca users.json ni config.json.
app.get('/twinkle-logo.png', (q, r) => {
  const asset = [path.join(__dirname, 'public', 'twinkle-logo.png'), path.join(__dirname, 'twinkle-logo.png')].find(fs.existsSync);
  if (!asset) return r.status(404).end();
  r.sendFile(asset);
});

app.get('/', (q, r) => {
  const pHtml = path.join(__dirname, 'public', 'index.html');
  const rHtml = path.join(__dirname, 'index.html');
  if (fs.existsSync(pHtml)) return r.sendFile(pHtml);
  if (fs.existsSync(rHtml)) return r.sendFile(rHtml);
  r.status(404).send('No se encontro index.html');
});

app.get('/api/setup', (q, r) => r.json({ needed: !Object.keys(users).length }));
app.post('/api/setup', (q, r) => {
  if (Object.keys(users).length) return r.status(403).json({ error: 'Ya existe un administrador' });
  const { name, pass } = q.body;
  if (!/^\w{3,20}$/.test(name || '') || (pass || '').length < 8) return r.status(400).json({ error: 'Usuario de 3 a 20 letras o números y contraseña de mínimo 8 caracteres' });
  addUser(name, pass, 'admin'); r.json({ token: newSession(name) });
});
// Registro público: las cuentas nuevas siempre tienen permisos de solo lectura.
const registrations = new Map();
app.post('/api/register', (q, r) => {
  const now = Date.now();
  const entry = registrations.get(q.ip) || { n: 0, t: now };
  if (now - entry.t > 60 * 60e3) { entry.n = 0; entry.t = now; }
  if (entry.n >= 5) return r.status(429).json({ error: 'Demasiados registros desde esta conexión. Inténtalo más tarde.' });
  const { name, pass } = q.body || {};
  if (!/^\w{3,20}$/.test(name || '') || (pass || '').length < 8)
    return r.status(400).json({ error: 'Usuario: 3–20 letras, números o _. Contraseña: mínimo 8 caracteres.' });
  if (Object.prototype.hasOwnProperty.call(users, name))
    return r.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
  addUser(name, pass, Object.keys(users).length === 0 ? 'admin' : 'viewer');
  entry.n++; registrations.set(q.ip, entry);
  r.status(201).json({ token: newSession(name) });
});
app.post('/api/login', (q, r) => {
  const f = fails.get(q.ip) || { n: 0, t: Date.now() };
  if (Date.now() - f.t > 60e3) { f.n = 0; f.t = Date.now(); }
  if (f.n >= 5) return r.status(429).json({ error: 'Demasiados intentos, espera un minuto' });
  const { name, pass } = q.body, u = users[name];
  if (!u || !crypto.timingSafeEqual(Buffer.from(hash(pass || '', u.salt)), Buffer.from(u.hash))) {
    f.n++; fails.set(q.ip, f); return r.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  r.json({ token: newSession(name) });
});
app.get('/api/me', auth('viewer'), (q, r) => r.json({ name: q.user.name, role: q.user.role, ip: CFG.publicIp || '' }));

app.post('/api/power', auth('mod'), (q, r) => {
  modules.logAudit(q.user?.name, 'power_' + q.body.action, { action: q.body.action });
  const a = q.body.action;
  if (a === 'start') start();
  else if (a === 'stop') stop();
  else if (a === 'restart') proc ? (wantRestart = true, stop()) : start();
  else if (a === 'kill') kill();
  r.json({ ok: true });
});
app.post('/api/cmd', auth('mod'), (q, r) => {
  if (!proc) return r.status(409).json({ error: 'El servidor está apagado' });
  const c = String(q.body.cmd || '').replace(/[\r\n]/g, '').slice(0, 300);
  onLine('> ' + c); proc.stdin.write(c + '\n'); modules.logAudit(q.user?.name, 'console_command', { command: c }); r.json({ ok: true });
});

const safe = (p) => {
  const root = path.resolve(CFG.serverDir), f = path.resolve(root, '.' + path.sep + (p || ''));
  if (f !== root && !f.startsWith(root + path.sep)) throw new Error('Ruta inválida');
  return f;
};
const wrap = (fn) => (q, r) => { try { fn(q, r); } catch (e) { r.status(400).json({ error: e.message }); } };
app.get('/api/files', auth('admin'), wrap((q, r) => r.json(fs.readdirSync(safe(q.query.path), { withFileTypes: true })
  .map((d) => ({ name: d.name, dir: d.isDirectory(), size: d.isDirectory() ? 0 : fs.statSync(path.join(safe(q.query.path), d.name)).size }))
  .sort((a, b) => b.dir - a.dir || a.name.localeCompare(b.name)))));
app.get('/api/file', auth('admin'), wrap((q, r) => {
  const f = safe(q.query.path);
  if (fs.statSync(f).size > 1e6) throw new Error('Archivo demasiado grande para editar (máx. 1 MB)');
  r.json({ text: fs.readFileSync(f, 'utf8') });
}));
app.put('/api/file', auth('admin'), wrap((q, r) => { fs.writeFileSync(safe(q.body.path), q.body.text); r.json({ ok: true }); }));
app.post('/api/file-op', auth('admin'), wrap((q, r) => {
  const action = String(q.body.action || '');
  const rel = String(q.body.path || '');
  const src = safe(rel);
  if (src === path.resolve(CFG.serverDir)) throw new Error('No se puede modificar la carpeta raíz del servidor');
  if (!fs.existsSync(src)) return r.status(404).json({ error: 'No se encontró el archivo o carpeta' });
  const st = fs.lstatSync(src);
  if (st.isSymbolicLink()) throw new Error('No se permiten operaciones sobre enlaces simbólicos');
  const parentRel = path.posix.dirname(rel.replace(/\\/g, '/'));
  const baseName = (name) => {
    const n = String(name || '').trim();
    if (!n || n === '.' || n === '..' || /[\\/\0]/.test(n) || /^[. ]+$/.test(n)) throw new Error('Nombre de archivo inválido');
    return n;
  };
  if (action === 'rename') {
    const name = baseName(q.body.name), dest = safe(path.posix.join(parentRel === '.' ? '' : parentRel, name));
    if (dest === src) return r.json({ ok: true });
    if (fs.existsSync(dest)) throw new Error('Ya existe un archivo o carpeta con ese nombre');
    fs.renameSync(src, dest); return r.json({ ok: true, name });
  }
  if (action === 'delete') {
    if (st.isDirectory()) fs.rmSync(src, { recursive: true, force: false }); else fs.unlinkSync(src);
    return r.json({ ok: true });
  }
  if (action === 'copy' || action === 'move') {
    const targetRel = String(q.body.targetDir || '');
    const targetDir = safe(targetRel);
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) throw new Error('La carpeta de destino no existe');
    const dest = safe(path.join(targetRel, path.basename(src)));
    if (dest === src) throw new Error('El destino no puede ser el mismo archivo');
    if (st.isDirectory() && (dest.startsWith(src + path.sep) || src.startsWith(dest + path.sep))) throw new Error('No se puede copiar o mover una carpeta dentro de sí misma');
    if (fs.existsSync(dest)) throw new Error('Ya existe un archivo o carpeta con ese nombre en el destino');
    if (action === 'copy') fs.cpSync(src, dest, { recursive: true, errorOnExist: true, force: false, dereference: false });
    else fs.renameSync(src, dest);
    return r.json({ ok: true, name: path.basename(dest) });
  }
  throw new Error('Operación de archivos no válida');
}));

app.post('/api/upload', auth('admin'), (q, r) => {
  let f, tmp, w;
  const fail = (code, msg) => { q.resume(); r.status(code).json({ error: msg }); };
  try {
    const name = path.basename(String(q.query.name || ''));
    if (!name || name === '.' || name === '..') return fail(400, 'Falta el nombre del archivo');
    f = safe(path.join(String(q.query.path || ''), name));
    if (fs.existsSync(f) && q.query.overwrite !== '1') return fail(409, 'Ya existe un archivo con ese nombre');
    tmp = f + '.part'; w = fs.createWriteStream(tmp);
  } catch (e) { return fail(400, e.message); }
  const clean = () => fs.unlink(tmp, () => {});
  w.on('error', (e) => { clean(); fail(400, e.message); });
  w.on('finish', () => fs.rename(tmp, f, (e) => e ? (clean(), r.status(400).json({ error: e.message })) : r.json({ ok: true })));
  q.on('aborted', () => { w.destroy(); clean(); });
  q.pipe(w);
});

const PF = () => safe('server.properties');
app.get('/api/props', auth('admin'), wrap((q, r) => {
  const o = {}; fs.readFileSync(PF(), 'utf8').split(/\r?\n/).forEach((l) => { const i = l.indexOf('='); if (l && l[0] !== '#' && i > 0) o[l.slice(0, i)] = l.slice(i + 1); });
  r.json(o);
}));
app.put('/api/props', auth('admin'), wrap((q, r) => {
  const o = q.body, seen = new Set();
  const out = fs.readFileSync(PF(), 'utf8').split(/\r?\n/).map((l) => {
    const i = l.indexOf('='), k = l.slice(0, i);
    if (l && l[0] !== '#' && i > 0 && k in o) { seen.add(k); return k + '=' + String(o[k]).replace(/[\r\n]/g, ''); } return l;
  });
  fs.writeFileSync(PF(), out.join('\n')); r.json({ ok: true });
}));

app.get('/api/users', auth('admin'), (q, r) => r.json(Object.entries(users).map(([name, u]) => ({ name, role: u.role }))));
app.post('/api/users', auth('admin'), (q, r) => {
  const { name, pass, role } = q.body;
  if (!/^\w{3,20}$/.test(name || '') || (pass || '').length < 8 || !(role in ROLES)) return r.status(400).json({ error: 'Datos inválidos (contraseña de mínimo 8 caracteres)' });
  addUser(name, pass, role); r.json({ ok: true });
});
app.delete('/api/users/:name', auth('admin'), (q, r) => {
  if (q.params.name === q.user.name) return r.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  delete users[q.params.name]; saveUsers(); r.json({ ok: true });
});

// ---- Gestor de mods (Modrinth oficial) ----
const https = require('https');
const modsDir = () => safe('mods');
const ensureModsDir = () => fs.mkdirSync(modsDir(), { recursive: true });
const modrinthJson = async (url) => {
  const u = new URL(url);
  if (u.hostname !== 'api.modrinth.com') throw new Error('Destino de API no permitido');
  const response = await fetch(u, { headers: { 'User-Agent': 'MinecraftPanel/1.1 (mod manager)', 'Accept': 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Modrinth respondió con HTTP ' + response.status);
  return response.json();
};
const validLoader = (v) => ['fabric', 'forge', 'neoforge', 'quilt'].includes(String(v || '').toLowerCase());
app.get('/api/mods/list', auth('admin'), wrap((q, r) => {
  ensureModsDir();
  const files = fs.readdirSync(modsDir(), { withFileTypes: true })
    .filter(d => d.isFile() && d.name.toLowerCase().endsWith('.jar'))
    .map(d => ({ name: d.name, size: fs.statSync(path.join(modsDir(), d.name)).size }))
    .sort((a, b) => a.name.localeCompare(b.name));
  r.json({ path: path.join(CFG.serverDir, 'mods'), files });
}));
app.get('/api/mods/search', auth('admin'), async (q, r) => {
  try {
    const query = String(q.query.q || '').trim().slice(0, 100);
    if (!query) return r.status(400).json({ error: 'Escribe el nombre de un mod para buscarlo.' });
    const facets = [['project_type:mod']];
    if (q.query.loader && validLoader(q.query.loader)) facets.push(['categories:' + String(q.query.loader).toLowerCase()]);
    if (q.query.gameVersion && /^\d{1,2}\.\d{1,2}(?:\.\d{1,2})?$/.test(q.query.gameVersion)) facets.push(['versions:' + q.query.gameVersion]);
    const url = 'https://api.modrinth.com/v2/search?query=' + encodeURIComponent(query) + '&limit=12&facets=' + encodeURIComponent(JSON.stringify(facets));
    const data = await modrinthJson(url);
    r.json({ hits: (data.hits || []).map(x => ({ id: x.project_id, slug: x.slug, title: x.title, description: x.description, icon: x.icon_url, downloads: x.downloads, categories: x.categories })) });
  } catch (e) { r.status(502).json({ error: 'No se pudo buscar en Modrinth: ' + e.message }); }
});
app.get('/api/mods/versions', auth('admin'), async (q, r) => {
  try {
    const id = String(q.query.project || '');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return r.status(400).json({ error: 'Proyecto inválido.' });
    const loader = String(q.query.loader || '').toLowerCase(), gameVersion = String(q.query.gameVersion || '').trim();
    if (!validLoader(loader)) return r.status(400).json({ error: 'Selecciona un cargador válido.' });
    if (gameVersion && !/^\d{1,2}\.\d{1,2}(?:\.\d{1,2})?$/.test(gameVersion)) return r.status(400).json({ error: 'Versión de Minecraft inválida.' });
    let url = 'https://api.modrinth.com/v2/project/' + encodeURIComponent(id) + '/version?loaders=' + encodeURIComponent(JSON.stringify([loader]));
    if (gameVersion) url += '&game_versions=' + encodeURIComponent(JSON.stringify([gameVersion]));
    const data = await modrinthJson(url);
    r.json({ versions: data.slice(0, 30).map(v => ({ id: v.id, name: v.name, version: v.version_number, date: v.date_published, gameVersions: v.game_versions, loaders: v.loaders, files: v.files.map(f => ({ filename: f.filename, primary: f.primary, size: f.size })) })) });
  } catch (e) { r.status(502).json({ error: 'No se pudieron cargar las versiones: ' + e.message }); }
});
app.post('/api/mods/install', auth('admin'), async (q, r) => {
  let tmp;
  try {
    const versionId = String((q.body || {}).versionId || '');
    const loader = String((q.body || {}).loader || '').toLowerCase();
    const gameVersion = String((q.body || {}).gameVersion || '').trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(versionId) || !validLoader(loader)) return r.status(400).json({ error: 'Versión o cargador inválido.' });
    setModpackProgress(3, 'Consultando la versión del modpack en Modrinth…');
    const version = await modrinthJson('https://api.modrinth.com/v2/version/' + encodeURIComponent(versionId));
    if (!Array.isArray(version.loaders) || !version.loaders.includes(loader)) return r.status(400).json({ error: 'Esta versión no es compatible con el cargador seleccionado.' });
    if (gameVersion && (!Array.isArray(version.game_versions) || !version.game_versions.includes(gameVersion))) return r.status(400).json({ error: 'Esta versión del mod no coincide con la versión de Minecraft seleccionada.' });
    const file = (version.files || []).find(f => f.primary && String(f.filename).toLowerCase().endsWith('.jar')) || (version.files || []).find(f => String(f.filename).toLowerCase().endsWith('.jar'));
    if (!file || !file.url || !/^https:\/\/cdn\.modrinth\.com\//i.test(file.url)) return r.status(400).json({ error: 'Modrinth no proporcionó un archivo JAR válido.' });
    if (Number(file.size || 0) > 100 * 1024 * 1024) return r.status(413).json({ error: 'El archivo supera el límite de 100 MB.' });
    const name = path.basename(file.filename);
    if (!name.toLowerCase().endsWith('.jar') || name === '.' || name === '..') return r.status(400).json({ error: 'Nombre de archivo inválido.' });
    ensureModsDir();
    const dest = path.join(modsDir(), name);
    if (fs.existsSync(dest)) return r.status(409).json({ error: 'Ya existe ' + name + ' en la carpeta mods. Elimínalo o haz una copia antes de reemplazarlo.' });
    setModpackProgress(5, 'Descargando archivo del modpack (.mrpack)…');
    const response = await fetch(file.url, { headers: { 'User-Agent': 'MinecraftPanel/1.1 (mod manager)' }, redirect: 'error', signal: AbortSignal.timeout(60000) });
    if (!response.ok || !response.body) throw new Error('No se pudo descargar el archivo (HTTP ' + response.status + ').');
    const declared = Number(response.headers.get('content-length') || file.size || 0);
    if (declared > 100 * 1024 * 1024) throw new Error('El archivo supera el límite de 100 MB.');
    tmp = dest + '.part';
    const chunks = []; let total = 0;
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > 100 * 1024 * 1024) throw new Error('El archivo supera el límite de 100 MB.');
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error('El archivo descargado no parece ser un JAR/ZIP válido.');
    fs.writeFileSync(tmp, buffer, { flag: 'wx' });
    fs.renameSync(tmp, dest); tmp = null;
    r.json({ ok: true, filename: name, size: buffer.length });
  } catch (e) {
    if (tmp) try { fs.unlinkSync(tmp); } catch {}
    r.status(502).json({ error: 'No se pudo instalar el mod: ' + e.message });
  }
});
// Estado de progreso del instalador de modpacks (consultado por el panel).
let modpackInstallState = { installing: false, progress: 0, step: 'Listo', error: '' };
const setModpackProgress = (progress, step) => { modpackInstallState = { ...modpackInstallState, installing: true, progress: Math.max(0, Math.min(100, Math.round(progress))), step, error: '' }; };
app.get('/api/modpacks/progress', auth('admin'), (q, r) => r.json(modpackInstallState));

// ---- Gestor de modpacks (Modrinth) ----
app.get('/api/modpacks/search', auth('admin'), async (q, r) => {
  try {
    const query = String(q.query.q || '').trim().slice(0, 100);
    if (!query) return r.status(400).json({ error: 'Escribe el nombre de un modpack.' });
    const facets = [['project_type:modpack']];
    if (q.query.gameVersion && /^\d{1,2}\.\d{1,2}(?:\.\d{1,2})?$/.test(q.query.gameVersion)) facets.push(['versions:' + q.query.gameVersion]);
    const url = 'https://api.modrinth.com/v2/search?query=' + encodeURIComponent(query) + '&limit=12&facets=' + encodeURIComponent(JSON.stringify(facets));
    const data = await modrinthJson(url);
    r.json({ hits: (data.hits || []).map(x => ({ id: x.project_id, slug: x.slug, title: x.title, description: x.description, icon: x.icon_url, downloads: x.downloads, categories: x.categories })) });
  } catch (e) { r.status(502).json({ error: 'No se pudieron buscar modpacks en Modrinth: ' + e.message }); }
});
app.get('/api/modpacks/versions', auth('admin'), async (q, r) => {
  try {
    const id = String(q.query.project || ''), gameVersion = String(q.query.gameVersion || '').trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return r.status(400).json({ error: 'Modpack inválido.' });
    if (gameVersion && !/^\d{1,2}\.\d{1,2}(?:\.\d{1,2})?$/.test(gameVersion)) return r.status(400).json({ error: 'Versión de Minecraft inválida.' });
    const data = await modrinthJson('https://api.modrinth.com/v2/project/' + encodeURIComponent(id) + '/version');
    const versions = data.filter(v => !gameVersion || (v.game_versions || []).includes(gameVersion)).slice(0, 30);
    r.json({ versions: versions.map(v => ({ id: v.id, name: v.name, version: v.version_number, date: v.date_published, gameVersions: v.game_versions, loaders: v.loaders, files: (v.files || []).map(f => ({ filename: f.filename, primary: f.primary, size: f.size })) })) });
  } catch (e) { r.status(502).json({ error: 'No se pudieron cargar las versiones del modpack: ' + e.message }); }
});
app.post('/api/modpacks/install', auth('admin'), async (q, r) => {
  if (modpackInstallState.installing || installState.installing) return r.status(409).json({ error: 'Ya hay una instalación en curso.' });
  modpackInstallState = { installing: true, progress: 1, step: 'Preparando instalación del modpack…', error: '' };
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpack-'));
  try {
    if (proc) { modpackInstallState = { installing: false, progress: 0, step: 'Instalación cancelada', error: 'Detén el servidor antes de instalar un modpack.' }; return r.status(409).json({ error: 'Detén el servidor antes de instalar un modpack.' }); }
    const versionId = String((q.body || {}).versionId || '');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(versionId)) return r.status(400).json({ error: 'Versión de modpack inválida.' });
    const version = await modrinthJson('https://api.modrinth.com/v2/version/' + encodeURIComponent(versionId));
    const file = (version.files || []).find(f => f.primary && String(f.filename).toLowerCase().endsWith('.mrpack')) || (version.files || []).find(f => String(f.filename).toLowerCase().endsWith('.mrpack'));
    if (!file || !file.url || !/^https:\/\/cdn\.modrinth\.com\//i.test(file.url)) return r.status(400).json({ error: 'Modrinth no proporcionó un archivo .mrpack válido desde su CDN.' });
    if (Number(file.size || 0) > 500 * 1024 * 1024) return r.status(413).json({ error: 'El modpack supera el límite de 500 MB.' });
    const response = await fetch(file.url, { headers: { 'User-Agent': 'MinecraftPanel/1.1 (modpack manager)' }, redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new Error('No se pudo descargar el modpack (HTTP ' + response.status + ').');
    const chunks = []; let total = 0;
    for await (const chunk of response.body) { total += chunk.length; if (total > 500 * 1024 * 1024) throw new Error('El modpack supera el límite de 500 MB.'); chunks.push(Buffer.from(chunk)); }
    const packPath = path.join(tempRoot, 'pack.zip'); fs.writeFileSync(packPath, Buffer.concat(chunks)); // Los .mrpack usan contenedor ZIP; PowerShell exige la extensión .zip para Expand-Archive.
    setModpackProgress(12, 'Descarga del modpack completada. Extrayendo manifiesto…');
    const extractDir = path.join(tempRoot, 'extract'); fs.mkdirSync(extractDir);
    const psquote = x => "'" + String(x).replace(/'/g, "''") + "'";
    await new Promise((resolve, reject) => exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath ${psquote(packPath)} -DestinationPath ${psquote(extractDir)} -Force"`, { timeout: 120000, windowsHide: true }, (err, stdout, stderr) => err ? reject(new Error('No se pudo abrir el archivo .mrpack como ZIP. ' + String(stderr || err.message).slice(0, 300))) : resolve()));
    const indexPath = path.join(extractDir, 'modrinth.index.json');
    if (!fs.existsSync(indexPath)) throw new Error('El archivo no contiene modrinth.index.json y no parece un modpack válido de Modrinth.');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    if (index.game !== 'minecraft' || !Array.isArray(index.files)) throw new Error('El manifiesto del modpack no es válido.');
    const root = path.resolve(CFG.serverDir); fs.mkdirSync(root, { recursive: true });
    const ramGb = Math.max(1, Math.min(32, parseInt((q.body || {}).ram, 10) || 4));
    let installed = 0, skipped = 0, external = 0;
    const downloadEntries = index.files.filter(entry => entry?.env?.server !== 'unsupported');
    const totalEntries = Math.max(1, downloadEntries.length); let completedEntries = 0;
    setModpackProgress(15, 'Preparando descarga de archivos del servidor…');
    const safeTarget = rel => {
      if (typeof rel !== 'string' || !rel || rel.includes('\\') || path.posix.isAbsolute(rel) || rel.split('/').some(x => x === '..' || x === '.')) throw new Error('El modpack contiene una ruta de archivo no permitida.');
      const dest = path.resolve(root, ...rel.split('/'));
      if (dest !== root && !dest.startsWith(root + path.sep)) throw new Error('Ruta del modpack fuera de la carpeta del servidor.');
      return dest;
    };
    const copyTree = (src, relBase) => {
      if (!fs.existsSync(src)) return;
      for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
        const rel = relBase ? relBase + '/' + ent.name : ent.name;
        const dest = safeTarget(rel), from = path.join(src, ent.name);
        if (ent.isDirectory()) { copyTree(from, rel); continue; }
        if (!ent.isFile()) continue;
        if (fs.existsSync(dest)) { skipped++; continue; }
        fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(from, dest); installed++;
      }
    };
    // Only files explicitly marked for the server (not client-only entries) are fetched.
    for (const entry of index.files) {
      if (entry?.env?.server === 'unsupported') { completedEntries++; continue; }
      setModpackProgress(15 + (completedEntries / totalEntries) * 78, 'Descargando archivos del modpack (' + (completedEntries + 1) + ' de ' + totalEntries + ')…');
      const dest = safeTarget(entry.path);
      if (fs.existsSync(dest)) { skipped++; completedEntries++; setModpackProgress(15 + (completedEntries / totalEntries) * 78, 'Procesando archivos del modpack (' + completedEntries + ' de ' + totalEntries + ')…'); continue; }
      const download = (entry.downloads || []).find(u => typeof u === 'string' && /^https:\/\/cdn\.modrinth\.com\//i.test(u));
      if (!download) { external++; completedEntries++; continue; }
      const expected = Number(entry.fileSize || 0);
      if (expected > 150 * 1024 * 1024) { external++; completedEntries++; continue; }
      const fr = await fetch(download, { headers: { 'User-Agent': 'MinecraftPanel/1.1 (modpack manager)' }, redirect: 'error', signal: AbortSignal.timeout(60000) });
      if (!fr.ok || !fr.body) { external++; completedEntries++; continue; }
      const parts = []; let bytes = 0;
      for await (const chunk of fr.body) { bytes += chunk.length; if (bytes > 150 * 1024 * 1024) throw new Error('Un archivo del modpack supera el límite de 150 MB.'); parts.push(Buffer.from(chunk)); }
      const buffer = Buffer.concat(parts);
      if (entry.fileSize && buffer.length !== Number(entry.fileSize)) throw new Error('La descarga de ' + path.basename(entry.path) + ' está incompleta.');
      fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, buffer, { flag: 'wx' }); installed++; completedEntries++;
      setModpackProgress(15 + (completedEntries / totalEntries) * 78, 'Descargando archivos del modpack (' + completedEntries + ' de ' + totalEntries + ')…');
    }
    setModpackProgress(93, 'Copiando archivos de configuración y overrides…');
    copyTree(path.join(extractDir, 'overrides'), '');
    copyTree(path.join(extractDir, 'server-overrides'), '');

    // Instala automáticamente el cargador y ajusta el arranque usando las dependencias exactas del .mrpack.
    const deps = index.dependencies || {};
    const mcVersion = String(deps.minecraft || '').trim();
    if (!/^\d{1,2}\.\d{1,2}(?:\.\d{1,2})?(?:[-+][A-Za-z0-9.-]+)?$/.test(mcVersion)) throw new Error('El manifiesto no contiene una versión de Minecraft válida; no se puede configurar el servidor automáticamente.');
    const loaderDeps = ['fabric-loader', 'forge', 'neoforge', 'quilt-loader'].filter(k => deps[k] != null && String(deps[k]).trim());
    if (loaderDeps.length !== 1) throw new Error(loaderDeps.length ? 'El modpack declara más de un cargador; no se puede elegir automáticamente con seguridad.' : 'El modpack no declara un cargador compatible.');
    const loaderKey = loaderDeps[0], loaderVersion = String(deps[loaderKey]).trim();
    if (!/^[0-9A-Za-z.+_-]{1,80}$/.test(loaderVersion)) throw new Error('La versión del cargador del modpack no es válida.');
    const downloadBytes = async (url, dest, label, limit = 300 * 1024 * 1024) => {
      const u = new URL(url);
      if (u.protocol !== 'https:' || !['meta.fabricmc.net','meta.quiltmc.org','maven.minecraftforge.net','maven.neoforged.net','launchermeta.mojang.com','launcher.mojang.com','piston-meta.mojang.com','piston-data.mojang.com'].includes(u.hostname)) throw new Error('El servidor de descargas del cargador no está permitido: ' + u.hostname);
      setModpackProgress(94, label);
      const dr = await fetch(u, { headers: { 'User-Agent': 'MinecraftPanel/1.1 (modpack installer)' }, redirect: 'follow', signal: AbortSignal.timeout(600000) });
      if (!dr.ok || !dr.body) throw new Error('Descarga fallida para el cargador (HTTP ' + dr.status + ').');
      const parts = []; let size = 0;
      for await (const ch of dr.body) { size += ch.length; if (size > limit) throw new Error('El archivo del cargador supera el límite permitido.'); parts.push(Buffer.from(ch)); }
      const buf = Buffer.concat(parts);
      if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error('La descarga del cargador no es un JAR/ZIP válido.');
      fs.writeFileSync(dest, buf); return buf.length;
    };
    const runModpackInstaller = (args, label) => new Promise((resolve, reject) => {
      setModpackProgress(96, label + ' (puede tardar varios minutos)…');
      const child = spawn('java', args, { cwd: root, shell: false, windowsHide: true });
      let output = '';
      child.stdout.on('data', d => { output = String(d).trim().slice(-180); if (output) setModpackProgress(97, label + ': ' + output); });
      child.stderr.on('data', d => { output = String(d).trim().slice(-180); if (output) setModpackProgress(97, label + ': ' + output); });
      child.on('error', e => reject(new Error('No se pudo ejecutar Java para instalar el cargador: ' + e.message)));
      child.on('close', code => code === 0 ? resolve() : reject(new Error(label + ' falló (código ' + code + '). ' + output)));
    });
    setModpackProgress(94, 'Instalando automáticamente ' + loaderKey + ' ' + loaderVersion + ' para Minecraft ' + mcVersion + '…');
    if (loaderKey === 'fabric-loader') {
      const loaderUrl = 'https://meta.fabricmc.net/v2/versions/installer';
      const ir = await fetch(loaderUrl, { headers: { 'User-Agent': 'MinecraftPanel/1.1' }, signal: AbortSignal.timeout(30000) });
      if (!ir.ok) throw new Error('No se pudo consultar el instalador de Fabric.');
      const installers = await ir.json(); if (!installers.length) throw new Error('No hay instalador de Fabric disponible.');
      const fabricJar = path.join(root, 'fabric-server-launch.jar');
      await downloadBytes('https://meta.fabricmc.net/v2/versions/loader/' + encodeURIComponent(mcVersion) + '/' + encodeURIComponent(loaderVersion) + '/' + encodeURIComponent(installers[0].version) + '/server/jar', fabricJar, 'Descargando Fabric ' + loaderVersion);
      try {
        const mm = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', { signal: AbortSignal.timeout(30000) });
        if (mm.ok) { const manifest = await mm.json(), mv = manifest.versions.find(v => v.id === mcVersion); if (mv) { const md = await fetch(mv.url, { signal: AbortSignal.timeout(30000) }); if (md.ok) { const details = await md.json(); if (details.downloads?.server?.url && !fs.existsSync(path.join(root, 'server.jar'))) await downloadBytes(details.downloads.server.url, path.join(root, 'server.jar'), 'Descargando servidor base de Minecraft'); } } }
      } catch (e) { if (!fs.existsSync(path.join(root, 'server.jar'))) throw new Error('Fabric se descargó, pero no se pudo obtener server.jar: ' + e.message); }
      writeEula(root); writeBat(root, 'fabric-server-launch.jar', ramGb, mcVersion);
    } else if (loaderKey === 'quilt-loader') {
      const quiltJar = path.join(root, 'quilt-server-launch.jar');
      await downloadBytes('https://meta.quiltmc.org/v3/versions/loader/' + encodeURIComponent(mcVersion) + '/' + encodeURIComponent(loaderVersion) + '/server/jar', quiltJar, 'Descargando Quilt ' + loaderVersion);
      writeEula(root); writeBat(root, 'quilt-server-launch.jar', ramGb, mcVersion);
    } else if (loaderKey === 'forge') {
      const forgeJar = path.join(root, 'forge-installer.jar');
      await downloadBytes('https://maven.minecraftforge.net/net/minecraftforge/forge/' + encodeURIComponent(mcVersion + '-' + loaderVersion) + '/forge-' + encodeURIComponent(mcVersion + '-' + loaderVersion) + '-installer.jar', forgeJar, 'Descargando Forge ' + loaderVersion);
      await runModpackInstaller(['-jar', 'forge-installer.jar', '--installServer'], 'Instalando Forge ' + loaderVersion);
      try { fs.unlinkSync(forgeJar); } catch {} try { fs.unlinkSync(path.join(root, 'forge-installer.jar.log')); } catch {}
      writeEula(root);
      if (fs.existsSync(path.join(root, 'run.bat'))) fs.writeFileSync(path.join(root, 'user_jvm_args.txt'), '-Xmx' + ramGb + 'G\n-Xms' + ramGb + 'G\n');
      else { const jar = fs.readdirSync(root).find(f => /^forge-.*\.jar$/i.test(f) && !/installer/i.test(f)); if (!jar) throw new Error('Forge terminó, pero no se encontró el JAR de arranque.'); writeBat(root, jar, ramGb, mcVersion); }
    } else if (loaderKey === 'neoforge') {
      const neoJar = path.join(root, 'neoforge-installer.jar');
      await downloadBytes('https://maven.neoforged.net/releases/net/neoforged/neoforge/' + encodeURIComponent(loaderVersion) + '/neoforge-' + encodeURIComponent(loaderVersion) + '-installer.jar', neoJar, 'Descargando NeoForge ' + loaderVersion);
      await runModpackInstaller(['-jar', 'neoforge-installer.jar', '--installServer'], 'Instalando NeoForge ' + loaderVersion);
      try { fs.unlinkSync(neoJar); } catch {}
      writeEula(root);
      if (fs.existsSync(path.join(root, 'run.bat'))) fs.writeFileSync(path.join(root, 'user_jvm_args.txt'), '-Xmx' + ramGb + 'G\n-Xms' + ramGb + 'G\n');
      else { const jar = fs.readdirSync(root).find(f => /^neoforge-.*\.jar$/i.test(f) && !/installer/i.test(f)); if (!jar) throw new Error('NeoForge terminó, pero no se encontró el JAR de arranque.'); writeBat(root, jar, ramGb, mcVersion); }
    }
    CFG.serverDir = root; CFG.startCommand = 'run.bat'; saveCfg();
    modpackInstallState = { installing: false, progress: 100, step: '¡Modpack y cargador instalados correctamente!', error: '' };
    r.json({ ok: true, name: index.name || file.filename, installed, skipped, external, minecraft: mcVersion, loader: loaderKey, loaderVersion, ram: ramGb });
  } catch (e) { modpackInstallState = { installing: false, progress: modpackInstallState.progress || 0, step: 'Error al instalar el modpack', error: e.message }; r.status(502).json({ error: 'No se pudo instalar el modpack: ' + e.message }); }
  finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
});

app.delete('/api/mods/:name', auth('admin'), wrap((q, r) => {
  const name = String(q.params.name || '');
  if (path.basename(name) !== name || !name.toLowerCase().endsWith('.jar')) throw new Error('Nombre de mod inválido');
  const file = path.join(modsDir(), name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return r.status(404).json({ error: 'No se encontró ese mod.' });
  fs.unlinkSync(file); r.json({ ok: true });
}));

// ---- Instalador de servidor (descarga e instala desde cero) ----
const sendInstall = () => send({ type: 'install', ...installState });
const setStep = (step, progress) => { installState.step = step; if (progress != null) installState.progress = progress; sendInstall(); };
const fetchJ = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': 'MinecraftPanel/2.0', Accept: 'application/json' }, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
const dlFile = async (u, dest, label) => {
  const r = await fetch(u, { headers: { 'User-Agent': 'MinecraftPanel/2.0' }, signal: AbortSignal.timeout(600000), redirect: 'follow' });
  if (!r.ok) throw new Error('Descarga fallida (HTTP ' + r.status + ')');
  const total = Number(r.headers.get('content-length') || 0), chunks = []; let got = 0;
  for await (const ch of r.body) { chunks.push(Buffer.from(ch)); got += ch.length; if (total && label) setStep(label + ' (' + (got / 1048576).toFixed(1) + '/' + (total / 1048576).toFixed(1) + ' MB)'); }
  fs.writeFileSync(dest, Buffer.concat(chunks)); return got;
};
const runJar = (args, cwd, label) => new Promise((res, rej) => {
  const p = spawn('java', args, { cwd, shell: true });
  p.stdout.on('data', d => setStep(label + ': ' + String(d).replace(/[\r\n]+/g, ' ').trim().slice(-100)));
  p.stderr.on('data', d => setStep(label + ': ' + String(d).replace(/[\r\n]+/g, ' ').trim().slice(-100)));
  p.on('error', e => rej(new Error('No se pudo ejecutar Java: ' + e.message)));
  p.on('exit', c => c === 0 ? res() : rej(new Error(label + ' falló (código ' + c + ')')));
});
const writeEula = d => fs.writeFileSync(path.join(d, 'eula.txt'), 'eula=true\n');
const findJavaForVersion = (mcVersion) => {
  const parts = String(mcVersion || '').split('.').map(Number);
  const minor = parts[1] || 0, patch = parts[2] || 0;
  let target = 21;
  if (minor < 17) target = 8;
  else if (minor === 17) target = 16;
  else if (minor <= 20 && (minor < 20 || patch <= 4)) target = 17;
  
  const dirs = ['C:\\Program Files\\Java', 'C:\\Program Files (x86)\\Java'];
  for (const base of dirs) {
    if (fs.existsSync(base)) {
      try {
        for (const entry of fs.readdirSync(base)) {
          const exe = path.join(base, entry, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
          if (fs.existsSync(exe)) {
            if (target === 8 && /1\.8|jre8|jdk8/i.test(entry)) return `"${exe}"`;
            if (target === 16 && /16/i.test(entry)) return `"${exe}"`;
            if (target === 17 && /17/i.test(entry)) return `"${exe}"`;
            if (target === 21 && /21/i.test(entry)) return `"${exe}"`;
          }
        }
      } catch {}
    }
  }
  return 'java';
};
const writeBat = (d, jar, ram, ver) => {
  const jCmd = findJavaForVersion(ver);
  fs.writeFileSync(path.join(d, 'run.bat'), '@echo off\n' + jCmd + ' -Xmx' + ram + 'G -Xms' + ram + 'G -jar ' + jar + ' nogui\npause\n');
};
const checkJava = () => new Promise(res => exec('java -version', e => res(!e)));
const serverInstalled = () => { try { return fs.existsSync(CFG.serverDir) && fs.readdirSync(CFG.serverDir).some(f => /\.jar$/i.test(f)); } catch { return false; } };
const nfToMc = v => { const p = v.split('.'); return p[1] === '0' ? '1.' + p[0] : '1.' + p[0] + '.' + p[1]; };
let versionsCache = {};
const cachedVer = async (k, fn) => { const c = versionsCache[k]; if (c && Date.now() - c.t < 300000) return c.v; const v = await fn(); versionsCache[k] = { v, t: Date.now() }; return v; };

const getVersions = {
  vanilla: () => cachedVer('vanilla', async () => (await fetchJ('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')).versions.filter(v => v.type === 'release').map(v => v.id)),
  purpur: () => cachedVer('purpur', async () => {
    const d = await fetchJ('https://api.purpurmc.org/v2/purpur');
    return (d.versions || []).reverse();
  }),
  paper: () => cachedVer('paper', async () => {
    const d = await fetchJ('https://fill.papermc.io/v3/projects/paper');
    return Object.values(d.versions || {}).flat().filter(v => !v.includes('rc') && !v.includes('pre'));
  }),
  fabric: () => cachedVer('fabric', async () => (await fetchJ('https://meta.fabricmc.net/v2/versions/game')).filter(v => v.stable).map(v => v.version)),
  forge: () => cachedVer('forge', async () => { const s = new Set(); Object.keys((await fetchJ('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')).promos || {}).forEach(k => { const m = k.match(/^([\d.]+)-/); if (m) s.add(m[1]); }); return [...s].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })); }),
  neoforge: () => cachedVer('neoforge', async () => { const s = new Set(); ((await fetchJ('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge')).versions || []).forEach(v => s.add(nfToMc(v))); return [...s].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })); }),
  spigot: () => cachedVer('spigot', async () => (await fetchJ('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')).versions.filter(v => v.type === 'release').map(v => v.id).slice(0, 30)),
  bukkit: () => cachedVer('bukkit', async () => (await fetchJ('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json')).versions.filter(v => v.type === 'release').map(v => v.id).slice(0, 30))
};

const doInstall = {
  vanilla: async (ver, ram, dir) => {
    setStep('Descargando manifiesto de versiones…', 10);
    const m = await fetchJ('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
    const v = m.versions.find(x => x.id === ver); if (!v) throw new Error('Versión no encontrada');
    const vd = await fetchJ(v.url); if (!vd.downloads?.server?.url) throw new Error('No hay servidor para ' + ver);
    setStep('Descargando server.jar…', 20); await dlFile(vd.downloads.server.url, path.join(dir, 'server.jar'), 'Descargando server.jar');
    writeEula(dir); writeBat(dir, 'server.jar', ram, ver); CFG.serverDir = dir; CFG.startCommand = 'run.bat'; saveCfg();
  },
  purpur: async (ver, ram, dir) => {
    setStep('Obteniendo último build de Purpur ' + ver + '…', 10);
    const d = await fetchJ('https://api.purpurmc.org/v2/purpur/' + ver);
    const build = d.builds?.latest || d.builds?.all?.slice(-1)[0];
    if (!build) throw new Error('No hay builds de Purpur para ' + ver);
    const dlUrl = 'https://api.purpurmc.org/v2/purpur/' + ver + '/' + build + '/download';
    setStep('Descargando Purpur…', 20); await dlFile(dlUrl, path.join(dir, 'server.jar'), 'Descargando Purpur');
    writeEula(dir);
    writeBat(dir, 'server.jar', ram, ver);
    CFG.serverDir = dir; CFG.startCommand = 'run.bat'; saveCfg();
  },
  paper: async (ver, ram, dir) => {
    setStep('Obteniendo último build de Paper…', 10);
    const b = await fetchJ('https://fill.papermc.io/v3/projects/paper/versions/' + ver);
    if (!b.builds?.length) throw new Error('No hay builds de Paper para ' + ver);
    const buildId = typeof b.builds[0] === 'object' ? b.builds[0].id : b.builds[0];
    const bData = await fetchJ('https://fill.papermc.io/v3/projects/paper/versions/' + ver + '/builds/' + buildId);
    const dlUrl = bData.downloads?.['server:default']?.url || Object.values(bData.downloads || {})[0]?.url;
    if (!dlUrl) throw new Error('No se encontró enlace de descarga para Paper ' + ver);
    setStep('Descargando Paper…', 20); await dlFile(dlUrl, path.join(dir, 'server.jar'), 'Descargando Paper');
    writeEula(dir); writeBat(dir, 'server.jar', ram, ver); CFG.serverDir = dir; CFG.startCommand = 'run.bat'; saveCfg();
  },
  fabric: async (ver, ram, dir) => {
    setStep('Obteniendo versiones de Fabric…', 10);
    const ld = await fetchJ('https://meta.fabricmc.net/v2/versions/loader/' + ver); if (!ld?.length) throw new Error('No hay Fabric para ' + ver);
    const ins = await fetchJ('https://meta.fabricmc.net/v2/versions/installer'); if (!ins?.length) throw new Error('Instalador de Fabric no encontrado');
    setStep('Descargando servidor Fabric…', 20); await dlFile('https://meta.fabricmc.net/v2/versions/loader/' + ver + '/' + ld[0].loader.version + '/' + ins[0].version + '/server/jar', path.join(dir, 'fabric-server-launch.jar'), 'Descargando Fabric');
    setStep('Descargando server.jar de Minecraft…', 50);
    try { const m = await fetchJ('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'); const v = m.versions.find(x => x.id === ver); if (v) { const vd = await fetchJ(v.url); if (vd.downloads?.server?.url) await dlFile(vd.downloads.server.url, path.join(dir, 'server.jar'), 'Descargando server.jar'); } } catch {}
    writeEula(dir); writeBat(dir, 'fabric-server-launch.jar', ram, ver); CFG.serverDir = dir; CFG.startCommand = 'run.bat'; saveCfg();
  },
  forge: async (ver, ram, dir) => {
    setStep('Obteniendo versión de Forge…', 10);
    const d = await fetchJ('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
    const fv = d.promos[ver + '-recommended'] || d.promos[ver + '-latest']; if (!fv) throw new Error('No hay Forge para ' + ver);
    setStep('Descargando instalador de Forge…', 20); await dlFile('https://maven.minecraftforge.net/net/minecraftforge/forge/' + ver + '-' + fv + '/forge-' + ver + '-' + fv + '-installer.jar', path.join(dir, 'forge-installer.jar'), 'Descargando Forge');
    setStep('Ejecutando instalador (puede tardar varios minutos)…', 40); await runJar(['-jar', 'forge-installer.jar', '--installServer'], dir, 'Instalando Forge');
    try { fs.unlinkSync(path.join(dir, 'forge-installer.jar')); } catch {} try { fs.unlinkSync(path.join(dir, 'forge-installer.jar.log')); } catch {}
    writeEula(dir);
    if (fs.existsSync(path.join(dir, 'run.bat'))) fs.writeFileSync(path.join(dir, 'user_jvm_args.txt'), '-Xmx' + ram + 'G\n-Xms' + ram + 'G\n');
    else { const j = fs.readdirSync(dir).find(f => /^forge-.*\.jar$/i.test(f) && !/installer/i.test(f)) || 'server.jar'; writeBat(dir, j, ram, ver); }
    CFG.serverDir = dir; CFG.startCommand = 'run.bat'; saveCfg();
  },
  neoforge: async (ver, ram, dir) => {
    setStep('Obteniendo versión de NeoForge…', 10);
    const d = await fetchJ('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
    const mcP = ver.replace(/^1\./, '').split('.'), pfx = mcP.length === 1 ? mcP[0] + '.0' : mcP.join('.');
    const match = (d.versions || []).filter(v => v.startsWith(pfx + '.')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    if (!match.length) throw new Error('No hay NeoForge para ' + ver);
    setStep('Descargando NeoForge ' + match[0] + '…', 20); await dlFile('https://maven.neoforged.net/releases/net/neoforged/neoforge/' + match[0] + '/neoforge-' + match[0] + '-installer.jar', path.join(dir, 'neoforge-installer.jar'), 'Descargando NeoForge');
    setStep('Ejecutando instalador (puede tardar varios minutos)…', 40); await runJar(['-jar', 'neoforge-installer.jar', '--installServer'], dir, 'Instalando NeoForge');
    try { fs.unlinkSync(path.join(dir, 'neoforge-installer.jar')); } catch {}
    writeEula(dir);
    if (fs.existsSync(path.join(dir, 'run.bat'))) fs.writeFileSync(path.join(dir, 'user_jvm_args.txt'), '-Xmx' + ram + 'G\n-Xms' + ram + 'G\n');
    else { const j = fs.readdirSync(dir).find(f => /^neoforge-.*\.jar$/i.test(f) && !/installer/i.test(f)) || 'server.jar'; writeBat(dir, j, ram, ver); }
    CFG.serverDir = dir; CFG.startCommand = 'run.bat'; saveCfg();
  },
  spigot: async (ver, ram, dir) => {
    setStep('Descargando BuildTools…', 10); await dlFile('https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar', path.join(dir, 'BuildTools.jar'), 'Descargando BuildTools');
    setStep('Compilando Spigot (10–20 min, requiere Git)…', 20); await runJar(['-jar', 'BuildTools.jar', '--rev', ver], dir, 'Compilando Spigot');
    const jar = fs.readdirSync(dir).find(f => /^spigot-.*\.jar$/i.test(f)); if (!jar) throw new Error('No se generó spigot.jar. ¿Git está instalado?');
    writeEula(dir); writeBat(dir, jar, ram, ver); try { fs.unlinkSync(path.join(dir, 'BuildTools.jar')); } catch {}
    CFG.serverDir = dir; CFG.startCommand = 'run.bat'; saveCfg();
  },
  bukkit: async (ver, ram, dir) => {
    setStep('Descargando BuildTools…', 10); await dlFile('https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar', path.join(dir, 'BuildTools.jar'), 'Descargando BuildTools');
    setStep('Compilando CraftBukkit (10–20 min, requiere Git)…', 20); await runJar(['-jar', 'BuildTools.jar', '--rev', ver, '--compile', 'craftbukkit'], dir, 'Compilando CraftBukkit');
    const jar = fs.readdirSync(dir).find(f => /^craftbukkit-.*\.jar$/i.test(f)); if (!jar) throw new Error('No se generó craftbukkit.jar. ¿Git está instalado?');
    writeEula(dir); writeBat(dir, jar, ram, ver); try { fs.unlinkSync(path.join(dir, 'BuildTools.jar')); } catch {}
    CFG.serverDir = dir; CFG.startCommand = 'run.bat'; saveCfg();
  }
};

app.get('/api/install/status', auth('admin'), async (q, r) => r.json({ installed: serverInstalled(), serverDir: CFG.serverDir, javaFound: await checkJava(), installing: installState.installing }));
app.get('/api/install/versions', auth('admin'), async (q, r) => {
  try { const t = String(q.query.type || '').toLowerCase(); if (!getVersions[t]) return r.status(400).json({ error: 'Tipo no soportado' }); r.json({ versions: await getVersions[t]() }); }
  catch (e) { r.status(502).json({ error: 'No se pudieron obtener las versiones: ' + e.message }); }
});
app.get('/api/install/progress', auth('admin'), (q, r) => r.json(installState));
app.post('/api/install/run', auth('admin'), (q, r) => {
  if (installState.installing) return r.status(409).json({ error: 'Ya hay una instalación en curso.' });
  if (proc) return r.status(409).json({ error: 'Detén el servidor antes de reinstalar.' });
  const { version, type, ram, serverDir } = q.body || {};
  if (!version || !type || !doInstall[type]) return r.status(400).json({ error: 'Faltan datos o tipo no soportado.' });
  const ramG = Math.max(1, Math.min(32, parseInt(ram) || 2)), dir = path.resolve(String(serverDir || CFG.serverDir));
  installState = { installing: true, step: 'Iniciando instalación…', progress: 0, error: '' }; sendInstall(); r.json({ ok: true });
  (async () => {
    try {
      setStep('Creando carpeta del servidor…', 5); fs.mkdirSync(dir, { recursive: true });
      await doInstall[type](version, ramG, dir);
      let target = CFG.servers.find(s => path.resolve(s.dir) === dir);
      if (!target) {
        target = { id: 'srv-' + Date.now().toString(36), name: type.toUpperCase() + ' ' + version, dir, startCommand: 'run.bat' };
        CFG.servers.push(target);
      } else {
        target.startCommand = 'run.bat';
      }
      CFG.activeServerId = target.id;
      CFG.serverDir = target.dir;
      CFG.startCommand = target.startCommand;
      saveCfg();
      setStep('¡Instalación completada! Ya puedes iniciar el servidor.', 100); installState.installing = false; sendInstall(); push();
    } catch (e) { installState.error = e.message || 'Error desconocido'; installState.installing = false; sendInstall(); }
  })();
});

// ---- Gestión de múltiples servidores ----
app.get('/api/java/installed', auth('viewer'), (q, r) => {
  const found = new Set();
  const bases = process.platform === 'win32' ? ['C:\\Program Files\\Eclipse Adoptium','C:\\Program Files\\Java','C:\\Program Files\\Microsoft\\jdk','C:\\Program Files (x86)\\Java'] : ['/usr/lib/jvm','/Library/Java/JavaVirtualMachines'];
  for (const root of bases) { try { for (const entry of fs.readdirSync(root, { withFileTypes:true })) { const candidates = [path.join(root,entry.name,'bin',process.platform==='win32'?'java.exe':'java'), path.join(root,entry.name,'Contents','Home','bin','java')]; for (const c of candidates) if (fs.existsSync(c)) found.add(c); } } catch {} }
  r.json({ java: [...found].map(p => ({ path:p, label:path.basename(path.dirname(path.dirname(p)))+' — '+p })) });
});

app.get('/api/servers', auth('viewer'), (q, r) => {
  r.json({
    activeId: CFG.activeServerId,
    servers: CFG.servers.map(s => ({
      id: s.id,
      name: s.name,
      dir: s.dir,
      startCommand: s.startCommand || 'run.bat nogui',
      javaPath: s.javaPath || '',
      ramGb: Number(s.ramGb) || getServerMaxRam(s.dir) / 1024 || 4,
      active: s.id === CFG.activeServerId,
      exists: fs.existsSync(s.dir)
    }))
  });
});

app.post('/api/servers/select', auth('mod'), (q, r) => {
  if (proc) return r.status(409).json({ error: 'Debes apagar el servidor actual antes de cambiar a otro.' });
  const { id } = q.body || {};
  try {
    const s = setActiveServer(id);
    log = [];
    push();
    r.json({ ok: true, active: s });
  } catch (e) {
    r.status(400).json({ error: e.message });
  }
});

app.post('/api/servers', auth('admin'), (q, r) => {
  const { name, dir, startCommand } = q.body || {};
  const sName = String(name || '').trim();
  const sDir = String(dir || '').trim();
  const sCmd = String(startCommand || 'run.bat nogui').trim();
  if (!sName) return r.status(400).json({ error: 'Ingresa un nombre para el servidor.' });
  if (!sDir) return r.status(400).json({ error: 'Ingresa la ruta de la carpeta del servidor.' });
  const resolvedDir = path.resolve(sDir);
  const id = 'srv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newServer = { id, name: sName, dir: resolvedDir, startCommand: sCmd };
  CFG.servers.push(newServer);
  saveCfg();
  push();
  r.status(201).json({ ok: true, server: newServer });
});

app.put('/api/servers/:id', auth('admin'), (q, r) => {
  const s = CFG.servers.find(x => x.id === q.params.id);
  if (!s) return r.status(404).json({ error: 'Servidor no encontrado' });
  const { name, dir, startCommand, ramGb, javaPath } = q.body || {};
  if (ramGb !== undefined) {
    const ram = Number(ramGb);
    if (!Number.isInteger(ram) || ram < 1 || ram > 32) return r.status(400).json({ error: 'La RAM debe ser un número entero entre 1 y 32 GB.' });
    if (proc && s.id === CFG.activeServerId) return r.status(409).json({ error: 'Apaga el servidor activo antes de cambiar su RAM.' });
    try { setServerRam(s, ram); } catch (e) { return r.status(400).json({ error: e.message }); }
  }
  if (name) s.name = String(name).trim();
  if (dir) s.dir = path.resolve(String(dir).trim());
  if (startCommand) s.startCommand = String(startCommand).trim();
  if (javaPath !== undefined) {
    const jp = String(javaPath || '').trim();
    if (jp && (!/java(?:w)?\.exe$/i.test(jp) || !fs.existsSync(path.resolve(jp)))) return r.status(400).json({ error: 'La ruta debe apuntar a un java.exe existente.' });
    if (proc && s.id === CFG.activeServerId) return r.status(409).json({ error: 'Apaga el servidor activo antes de cambiar Java.' });
    s.javaPath = jp;
  }
  if (s.id === CFG.activeServerId) {
    CFG.serverDir = s.dir;
    CFG.startCommand = s.startCommand;
  }
  saveCfg();
  push();
  r.json({ ok: true, server: s });
});

app.delete('/api/servers/:id', auth('admin'), (q, r) => {
  const idx = CFG.servers.findIndex(x => x.id === q.params.id);
  if (idx === -1) return r.status(404).json({ error: 'Servidor no encontrado' });
  const target = CFG.servers[idx];
  if (target.id === CFG.activeServerId && proc) return r.status(409).json({ error: 'Apaga el servidor antes de quitarlo.' });
  const deleteFiles = (q.body || {}).deleteFiles;
  if (deleteFiles !== true && deleteFiles !== false) return r.status(400).json({ error: 'Debes elegir si deseas conservar o borrar los archivos.' });
  if (deleteFiles) {
    const dir = path.resolve(String(target.dir || ''));
    const root = path.parse(dir).root;
    const panelDir = path.resolve(DATA_DIR);
    const home = path.resolve(os.homedir());
    if (!target.dir || dir === root || dir === home || dir === panelDir || panelDir.startsWith(dir + path.sep) || dir.startsWith(panelDir + path.sep)) {
      return r.status(400).json({ error: 'Por seguridad, esta ruta no se puede borrar desde Twinkle.' });
    }
    if (CFG.servers.some(s => s.id !== target.id && s.dir && (path.resolve(s.dir) === dir || path.resolve(s.dir).startsWith(dir + path.sep)))) {
      return r.status(409).json({ error: 'Otro servidor registrado usa esta carpeta o una subcarpeta. Quita este servidor del panel sin borrar los archivos.' });
    }
    try {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 2, retryDelay: 350 });
    } catch (e) {
      const blocked = ['EPERM', 'EACCES', 'EBUSY'].includes(e.code);
      const extra = blocked
        ? ' Windows tiene archivos bloqueados o permisos insuficientes. Detén Minecraft, cierra programas que usan esa carpeta y pausa OneDrive si está sincronizando; después vuelve a intentarlo. Algunos archivos podrían haberse borrado antes del error. También puedes usar «Quitar del panel» para conservar la carpeta.'
        : ' Comprueba el estado de los archivos. Algunos podrían haberse borrado antes del error.';
      return r.status(blocked ? 409 : 500).json({ error: `No se pudieron borrar los archivos (${e.code || 'error'}): ${e.message}.${extra}` });
    }
  }
  CFG.servers.splice(idx, 1);
  if (target.id === CFG.activeServerId) {
    const next = CFG.servers[0];
    CFG.activeServerId = next?.id || '';
    CFG.serverDir = next?.dir || '';
    CFG.startCommand = next?.startCommand || 'run.bat nogui';
  }
  saveCfg(); push();
  r.json({ ok: true, filesDeleted: deleteFiles, remaining: CFG.servers.length });
});

// ==========================================
// NUEVOS ENDPOINTS TWINKLE 2.0.2
// ==========================================

// --- Monitoreo y Métricas en tiempo real ---
app.get('/api/metrics', auth('viewer'), (q, r) => {
  r.json(modules.getMetricsHistory());
});

// --- Auditoría y Registros de Seguridad ---
app.get('/api/audit', auth('admin'), (q, r) => {
  r.json({ logs: modules.getAuditLogs(150) });
});

// --- Copias de Seguridad (Backups) ---
app.get('/api/backups', auth('admin'), (q, r) => {
  try {
    const list = modules.listBackups(CFG.serverDir);
    r.json({ backups: list });
  } catch (e) {
    r.status(500).json({ error: 'No se pudieron listar las copias de seguridad: ' + e.message });
  }
});

app.post('/api/backups', auth('admin'), async (q, r) => {
  try {
    const { scope, note } = q.body || {};
    modules.logAudit(q.user?.name, 'backup_create_start', { scope, note });
    const result = await modules.createBackup(CFG.serverDir, scope || 'all', note || '');
    modules.logAudit(q.user?.name, 'backup_create_success', result);
    r.json({ ok: true, backup: result });
  } catch (e) {
    modules.logAudit(q.user?.name, 'backup_create_failed', { error: e.message });
    r.status(500).json({ error: 'Fallo al crear la copia de seguridad: ' + e.message });
  }
});

app.post('/api/backups/restore', auth('admin'), async (q, r) => {
  if (proc) return r.status(409).json({ error: 'Debes apagar el servidor antes de restaurar una copia de seguridad.' });
  const { filename } = q.body || {};
  if (!filename) return r.status(400).json({ error: 'Indica el nombre de la copia a restaurar.' });
  try {
    modules.logAudit(q.user?.name, 'backup_restore_start', { filename });
    await modules.restoreBackup(CFG.serverDir, filename);
    modules.logAudit(q.user?.name, 'backup_restore_success', { filename });
    r.json({ ok: true, message: 'Copia de seguridad restaurada con éxito' });
  } catch (e) {
    modules.logAudit(q.user?.name, 'backup_restore_failed', { filename, error: e.message });
    r.status(500).json({ error: 'Error al restaurar: ' + e.message });
  }
});

// --- Gestión avanzada de Jugadores e Inventarios ---
app.get('/api/player/inventory', auth('mod'), (q, r) => {
  const player = String(q.query.player || '').trim();
  if (!player) return r.status(400).json({ error: 'Falta el nombre o UUID del jugador' });
  const inv = modules.getPlayerInventoryData(CFG.serverDir, player);
  r.json(inv);
});

// --- Gestor avanzado de plugins y mods (estado, duplicados, desactivar) ---
app.get('/api/addons/status', auth('admin'), (q, r) => {
  try {
    const status = modules.getPluginsAndModsStatus(CFG.serverDir);
    r.json(status);
  } catch (e) {
    r.status(500).json({ error: e.message });
  }
});

app.post('/api/addons/toggle', auth('admin'), (q, r) => {
  const { type, filename, enable } = q.body || {};
  if (!type || !filename) return r.status(400).json({ error: 'Faltan parámetros' });
  try {
    const res = modules.toggleAddonState(CFG.serverDir, type, filename, !!enable);
    modules.logAudit(q.user?.name, 'addon_toggle', res);
    r.json({ ok: true, ...res });
  } catch (e) {
    r.status(400).json({ error: e.message });
  }
});

// --- Explorador Nativo de Archivos / Carpetas del Sistema ---
app.post('/api/dialog/pick', auth('admin'), async (q, r) => {
  const type = String(q.body?.type || 'folder');
  try {
    const res = await modules.openNativeExplorer(type);
    r.json({ ok: true, path: res.path || '' });
  } catch (e) {
    r.status(500).json({ error: 'No se pudo abrir el explorador: ' + e.message });
  }
});

// ---- WebSocket (consola en vivo) ----
const server = http.createServer(app);
server.requestTimeout = 0; // permite subidas largas de archivos grandes
server.on('upgrade', (q, s, h) => {
  const t = new URL(q.url, 'http://x').searchParams.get('t');
  if (!session(t)) return s.destroy();
  wss.handleUpgrade(q, s, h, (ws) => ws.send(JSON.stringify({ type: 'init', log, ...state() })));
});
setInterval(() => { sampleServerCpu(); sampleServerMem(); modules.recordMetrics(cpu, proc ? serverMemMb : 0, serverMaxRamMb, players.size); push(); }, 2000);
if (!fs.existsSync(CFG.serverDir)) console.log('AVISO: la carpeta "' + CFG.serverDir + '" no existe. Edita serverDir en config.json y vuelve a iniciar el panel.');
server.listen(CFG.port, () => console.log(`Panel listo en http://localhost:${CFG.port}`));
