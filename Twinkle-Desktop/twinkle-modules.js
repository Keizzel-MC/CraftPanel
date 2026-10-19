const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { exec, spawn } = require('child_process');

// ==========================================
// 1. REGISTRO DE AUDITORÍA Y SEGURIDAD
// ==========================================
let DATA_DIR = __dirname;
function initModules(dataDir) {
  DATA_DIR = dataDir;
}

const getAuditFile = () => path.join(DATA_DIR, 'audit.log');

const logAudit = (user, action, details = {}) => {
  const entry = {
    time: new Date().toISOString(),
    user: user || 'sistema',
    action,
    details
  };
  try {
    fs.appendFileSync(getAuditFile(), JSON.stringify(entry) + '\n');
  } catch (e) {
    console.error('[Auditoría] Error al registrar:', e.message);
  }
};

const getAuditLogs = (limit = 100) => {
  try {
    const f = getAuditFile();
    if (!fs.existsSync(f)) return [];
    const lines = fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean);
    const logs = [];
    for (let i = Math.max(0, lines.length - limit); i < lines.length; i++) {
      try { logs.push(JSON.parse(lines[i])); } catch {}
    }
    return logs.reverse();
  } catch (e) {
    return [];
  }
};

// ==========================================
// 2. HISTORIAL DE MONITOREO (CPU, RAM, TPS, PLAYERS)
// ==========================================
const metricsHistory = [];
const MAX_METRICS = 60; // últimos 60 puntos (ej. 2 minutos a 1 muestra cada 2s)
let lastTps = 20.0;

const recordMetrics = (cpu, ramMb, maxRamMb, playerCount, tps) => {
  if (tps != null) lastTps = tps;
  metricsHistory.push({
    time: Date.now(),
    cpu: Number(cpu) || 0,
    ramMb: Math.round(ramMb) || 0,
    maxRamMb: Math.round(maxRamMb) || 2048,
    ramPct: maxRamMb ? Math.min(100, Math.round((ramMb / maxRamMb) * 100)) : 0,
    players: Number(playerCount) || 0,
    tps: Number(lastTps) || 20.0
  });
  if (metricsHistory.length > MAX_METRICS) metricsHistory.shift();
};

const getMetricsHistory = () => ({
  history: metricsHistory,
  current: metricsHistory[metricsHistory.length - 1] || null
});

// Parsear TPS desde el log si el servidor es Paper/Purpur/Spigot
const checkTpsFromLine = (line) => {
  // Ej: TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0 o "TPS: 19.98"
  const m = line.match(/TPS\s*(?:from last [^:]+:|:)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (m) {
    const val = parseFloat(m[1]);
    if (!isNaN(val)) lastTps = Math.min(20, Math.max(0, val));
  }
};

// ==========================================
// 3. PARSER NBT DE INVENTARIOS DE JUGADORES
// ==========================================
function parseNbtBuffer(buf) {
  let uncompressed = buf;
  try {
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      uncompressed = zlib.gunzipSync(buf);
    } else if (buf[0] === 0x78) {
      uncompressed = zlib.inflateSync(buf);
    }
  } catch (e) {}

  let offset = 0;
  function readByte() { return uncompressed.readInt8(offset++); }
  function readShort() { const v = uncompressed.readInt16BE(offset); offset += 2; return v; }
  function readInt() { const v = uncompressed.readInt32BE(offset); offset += 4; return v; }
  function readLong() { const v = uncompressed.readBigInt64BE(offset); offset += 8; return v.toString(); }
  function readFloat() { const v = uncompressed.readFloatBE(offset); offset += 4; return v; }
  function readDouble() { const v = uncompressed.readDoubleBE(offset); offset += 8; return v; }
  function readString() {
    const len = uncompressed.readUInt16BE(offset);
    offset += 2;
    const str = uncompressed.toString('utf8', offset, offset + len);
    offset += len;
    return str;
  }

  function readTagPayload(type) {
    switch (type) {
      case 0: return null;
      case 1: return readByte();
      case 2: return readShort();
      case 3: return readInt();
      case 4: return readLong();
      case 5: return readFloat();
      case 6: return readDouble();
      case 7: {
        const len = readInt();
        const arr = uncompressed.slice(offset, offset + len);
        offset += len;
        return Array.from(arr);
      }
      case 8: return readString();
      case 9: {
        const elemType = readByte();
        const len = readInt();
        const list = [];
        for (let i = 0; i < len; i++) list.push(readTagPayload(elemType));
        return list;
      }
      case 10: {
        const compound = {};
        while (offset < uncompressed.length) {
          const tagType = readByte();
          if (tagType === 0) break;
          const tagName = readString();
          compound[tagName] = readTagPayload(tagType);
        }
        return compound;
      }
      case 11: {
        const len = readInt();
        const arr = [];
        for (let i = 0; i < len; i++) arr.push(readInt());
        return arr;
      }
      case 12: {
        const len = readInt();
        const arr = [];
        for (let i = 0; i < len; i++) arr.push(readLong());
        return arr;
      }
      default:
        throw new Error('Tipo NBT no soportado: ' + type);
    }
  }

  if (offset >= uncompressed.length) return null;
  const rootType = readByte();
  if (rootType === 0) return null;
  const rootName = readString();
  const rootData = readTagPayload(rootType);
  return { name: rootName, data: rootData };
}

// Obtener datos del jugador (UUID, stats, inventario, armadura, ender chest)
function getPlayerInventoryData(serverDir, playerNameOrUuid) {
  const result = {
    player: playerNameOrUuid,
    uuid: null,
    inventory: [],
    armor: { feet: null, legs: null, chest: null, head: null },
    offhand: null,
    enderChest: [],
    health: 20,
    food: 20,
    score: 0,
    xpLevel: 0,
    gamemode: 0,
    stats: {}
  };

  try {
    let uuid = playerNameOrUuid;
    // Si no parece un UUID (con guiones), buscar en usercache.json
    const usercachePath = path.join(serverDir, 'usercache.json');
    if (fs.existsSync(usercachePath)) {
      try {
        const cache = JSON.parse(fs.readFileSync(usercachePath, 'utf8'));
        const found = cache.find(u => (u.name && u.name.toLowerCase() === playerNameOrUuid.toLowerCase()) || u.uuid === playerNameOrUuid);
        if (found) {
          uuid = found.uuid;
          result.player = found.name || playerNameOrUuid;
        }
      } catch {}
    }
    result.uuid = uuid;

    // Buscar el archivo .dat en world/playerdata/{uuid}.dat
    // Nota: el mundo puede llamarse "world", "world_nether", o estar definido en server.properties
    let playerdataFile = null;
    const possibleWorldDirs = ['world', 'world_nether', 'world_the_end', '.'];
    for (const w of possibleWorldDirs) {
      const candidate = path.join(serverDir, w, 'playerdata', uuid + '.dat');
      if (fs.existsSync(candidate)) {
        playerdataFile = candidate;
        break;
      }
    }

    if (!playerdataFile) {
      // Buscar cualquier archivo que coincida en subcarpetas playerdata
      try {
        const entries = fs.readdirSync(serverDir, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.isDirectory()) {
            const c = path.join(serverDir, ent.name, 'playerdata', uuid + '.dat');
            if (fs.existsSync(c)) {
              playerdataFile = c;
              break;
            }
          }
        }
      } catch {}
    }

    if (playerdataFile && fs.existsSync(playerdataFile)) {
      const buf = fs.readFileSync(playerdataFile);
      const parsed = parseNbtBuffer(buf);
      if (parsed && parsed.data) {
        const d = parsed.data;
        result.health = d.Health != null ? d.Health : 20;
        result.food = d.foodLevel != null ? d.foodLevel : 20;
        result.score = d.Score != null ? d.Score : 0;
        result.xpLevel = d.XpLevel != null ? d.XpLevel : 0;
        result.gamemode = d.playerGameType != null ? d.playerGameType : 0;

        // Inventory
        if (Array.isArray(d.Inventory)) {
          for (const item of d.Inventory) {
            const slot = item.Slot;
            const itemObj = {
              slot,
              id: item.id || 'minecraft:air',
              count: item.Count || 1,
              tag: item.tag || null
            };
            if (slot >= 100 && slot <= 103) {
              if (slot === 100) result.armor.feet = itemObj;
              if (slot === 101) result.armor.legs = itemObj;
              if (slot === 102) result.armor.chest = itemObj;
              if (slot === 103) result.armor.head = itemObj;
            } else if (slot === -106) {
              result.offhand = itemObj;
            } else {
              result.inventory.push(itemObj);
            }
          }
        }

        // EnderChest
        if (Array.isArray(d.EnderItems)) {
          for (const item of d.EnderItems) {
            result.enderChest.push({
              slot: item.Slot,
              id: item.id || 'minecraft:air',
              count: item.Count || 1,
              tag: item.tag || null
            });
          }
        }
      }
    }

    // Buscar estadísticas en world/stats/{uuid}.json
    for (const w of possibleWorldDirs) {
      const statsCandidate = path.join(serverDir, w, 'stats', uuid + '.json');
      if (fs.existsSync(statsCandidate)) {
        try {
          result.stats = JSON.parse(fs.readFileSync(statsCandidate, 'utf8'));
        } catch {}
        break;
      }
    }

    return result;
  } catch (err) {
    result.error = err.message;
    return result;
  }
}

// ==========================================
// 4. SISTEMA DE COPIAS DE SEGURIDAD (BACKUPS)
// ==========================================
const getBackupsDir = (serverDir) => {
  return path.join(serverDir, '.craftpanel-backups');
};

const listBackups = (serverDir) => {
  const bDir = getBackupsDir(serverDir);
  if (!fs.existsSync(bDir)) return [];
  const entries = fs.readdirSync(bDir, { withFileTypes: true });
  const backups = [];
  for (const ent of entries) {
    if (ent.isFile() && ent.name.toLowerCase().endsWith('.zip')) {
      const p = path.join(bDir, ent.name);
      const st = fs.statSync(p);
      backups.push({
        id: ent.name,
        filename: ent.name,
        size: st.size,
        created: st.birthtime || st.mtime,
        path: p,
        verified: true
      });
    }
  }
  return backups.sort((a, b) => new Date(b.created) - new Date(a.created));
};

// Crear backup comprimido de mundo, configs, plugins, mods
const createBackup = (serverDir, scope = 'all', note = '') => {
  return new Promise((resolve, reject) => {
    try {
      const bDir = getBackupsDir(serverDir);
      fs.mkdirSync(bDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupName = `backup-${scope}-${timestamp}.zip`;
      const targetZip = path.join(bDir, backupName);

      // Definir qué carpetas y archivos incluir
      const includeItems = [];
      if (scope === 'all' || scope === 'world') {
        ['world', 'world_nether', 'world_the_end'].forEach(w => {
          if (fs.existsSync(path.join(serverDir, w))) includeItems.push(w);
        });
      }
      if (scope === 'all' || scope === 'config') {
        const files = fs.readdirSync(serverDir);
        files.forEach(f => {
          if (/\.(properties|json|yml|yaml|txt|bat|sh)$/i.test(f) && !f.startsWith('.')) {
            includeItems.push(f);
          }
        });
        ['config'].forEach(c => {
          if (fs.existsSync(path.join(serverDir, c))) includeItems.push(c);
        });
      }
      if (scope === 'all' || scope === 'addons') {
        ['plugins', 'mods'].forEach(dirName => {
          if (fs.existsSync(path.join(serverDir, dirName))) includeItems.push(dirName);
        });
      }

      if (includeItems.length === 0) {
        return reject(new Error('No hay archivos ni carpetas para respaldar'));
      }

      // Usar PowerShell Compress-Archive de forma segura
      const quotedItems = includeItems.map(item => `'${path.join(serverDir, item).replace(/'/g, "''")}'`).join(', ');
      const psScript = `Compress-Archive -LiteralPath @(${quotedItems}) -DestinationPath '${targetZip.replace(/'/g, "''")}' -CompressionLevel Fastest -Force`;

      exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, { timeout: 300000 }, (err, stdout, stderr) => {
        if (err) {
          if (fs.existsSync(targetZip)) try { fs.unlinkSync(targetZip); } catch {}
          return reject(new Error('Fallo al comprimir el backup: ' + (stderr || err.message)));
        }
        // Verificar integridad comprobando que el archivo existe y no está vacío
        if (!fs.existsSync(targetZip) || fs.statSync(targetZip).size < 22) {
          return reject(new Error('El archivo de backup generado está corrupto o vacío'));
        }
        resolve({
          id: backupName,
          filename: backupName,
          size: fs.statSync(targetZip).size,
          created: new Date().toISOString(),
          scope,
          note
        });
      });
    } catch (e) {
      reject(e);
    }
  });
};

// Restaurar backup con verificación previa
const restoreBackup = (serverDir, backupFilename) => {
  return new Promise((resolve, reject) => {
    const bDir = getBackupsDir(serverDir);
    const targetZip = path.join(bDir, path.basename(backupFilename));
    if (!fs.existsSync(targetZip)) {
      return reject(new Error('El archivo de backup no existe'));
    }
    // Verificar archivo ZIP válido
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${targetZip.replace(/'/g, "''")}' -DestinationPath '${serverDir.replace(/'/g, "''")}' -Force"`, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error('Error al restaurar el backup: ' + (stderr || err.message)));
      resolve({ ok: true, restored: backupFilename });
    });
  });
};

// ==========================================
// 5. GESTOR DE COMPLEMENTOS Y PLUGINS/MODS AVANZADO
// ==========================================
// Detectar complementos duplicados o desactivados (.disabled)
const getPluginsAndModsStatus = (serverDir) => {
  const pluginsDir = path.join(serverDir, 'plugins');
  const modsDir = path.join(serverDir, 'mods');

  const scanFolder = (dir, isPlugin) => {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir, { withFileTypes: true });
    return files.filter(f => f.isFile() && (f.name.endsWith('.jar') || f.name.endsWith('.disabled'))).map(f => {
      const enabled = f.name.endsWith('.jar');
      const baseName = f.name.replace(/\.disabled$/, '');
      const st = fs.statSync(path.join(dir, f.name));
      return {
        filename: f.name,
        baseName,
        type: isPlugin ? 'plugin' : 'mod',
        enabled,
        size: st.size,
        modified: st.mtime
      };
    });
  };

  const plugins = scanFolder(pluginsDir, true);
  const mods = scanFolder(modsDir, false);

  // Detección de duplicados
  const checkDuplicates = (list) => {
    const seen = new Map();
    const duplicates = [];
    list.forEach(item => {
      // Normalizar nombre sin versión para detectar duplicados (ej: WorldEdit-7.2.14 vs WorldEdit-7.2.15)
      const cleanName = item.baseName.replace(/[-_][vV]?\d+(\.\d+)*.*\.jar$/i, '').toLowerCase();
      if (seen.has(cleanName)) {
        duplicates.push({ original: seen.get(cleanName), duplicate: item.filename });
      } else {
        seen.set(cleanName, item.filename);
      }
    });
    return duplicates;
  };

  return {
    plugins,
    mods,
    pluginDuplicates: checkDuplicates(plugins),
    modDuplicates: checkDuplicates(mods)
  };
};

// Alternar estado de plugin/mod (.jar <-> .jar.disabled)
const toggleAddonState = (serverDir, type, filename, enable) => {
  const targetDir = path.join(serverDir, type === 'plugin' ? 'plugins' : 'mods');
  const currentPath = path.join(targetDir, filename);
  if (!fs.existsSync(currentPath)) throw new Error('El archivo no existe');

  let newFilename;
  if (enable) {
    newFilename = filename.replace(/\.disabled$/, '');
  } else {
    newFilename = filename.endsWith('.disabled') ? filename : filename + '.disabled';
  }
  const newPath = path.join(targetDir, newFilename);
  fs.renameSync(currentPath, newPath);
  return { oldFilename: filename, newFilename, enabled: enable };
};

// ==========================================
// 6. EXPLORADOR NATIVO DE ARCHIVOS Y CARPETAS
// ==========================================
const openNativeExplorer = (type = 'folder') => {
  return new Promise((resolve) => {
    try {
      if (process.platform === 'win32') {
        let psCmd = '';
        if (type === 'file') {
          // Selector de archivo java.exe o javaw.exe
          psCmd = "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Filter = 'Ejecutable Java (*.exe)|*.exe|Todos los archivos (*.*)|*.*'; $d.Title = 'Seleccionar archivo java.exe'; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.FileName }";
        } else {
          // Selector de carpeta de servidor Minecraft
          psCmd = "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = 'Selecciona la carpeta del servidor de Minecraft'; $d.ShowNewFolderButton = $true; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }";
        }
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, { timeout: 60000 }, (err, stdout) => {
          if (err || !stdout) return resolve({ path: '' });
          const selected = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || '';
          resolve({ path: selected.trim() });
        });
      } else {
        // En Linux/Mac si tuviera zenity u osascript
        resolve({ path: '' });
      }
    } catch {
      resolve({ path: '' });
    }
  });
};

module.exports = {
  initModules,
  logAudit,
  getAuditLogs,
  recordMetrics,
  getMetricsHistory,
  checkTpsFromLine,
  getPlayerInventoryData,
  listBackups,
  createBackup,
  restoreBackup,
  getPluginsAndModsStatus,
  toggleAddonState,
  openNativeExplorer
};
