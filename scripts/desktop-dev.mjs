import { spawn } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';

const isWin = process.platform === 'win32';
const cmdExe = isWin ? (process.env.ComSpec || 'cmd.exe') : null;

function spawnDev(command, opts) {
  if (isWin) {
    // En Windows no se puede spawnear *.cmd con shell:false (da EINVAL).
    // Para evitar shell:true (warning DEP0190), ejecutamos explícitamente cmd.exe.
    return spawn(cmdExe, ['/d', '/s', '/c', command], { ...opts, shell: false });
  }
  const [bin, ...args] = command.split(' ');
  return spawn(bin, args, { ...opts, shell: false });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    // 0.0.0.0 cubre todas las interfaces; si alguien escucha en ese puerto,
    // el bind debe fallar.
    server.listen({ port, host: '0.0.0.0' }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickPort(preferredPort, maxTries = 50) {
  for (let i = 0; i < maxTries; i++) {
    const port = preferredPort + i;
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortFree(port);
    if (free) return port;
  }
  throw new Error(`No se encontró un puerto libre desde ${preferredPort} (intenté ${maxTries} puertos).`);
}

async function waitForHttpOk(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(3_000, () => {
        req.destroy();
        resolve(false);
      });
    });

    if (ok) return;
    // eslint-disable-next-line no-await-in-loop
    await sleep(500);
  }
  throw new Error(`Timeout esperando a que responda ${url}`);
}

function prefixPipe(child, label) {
  const write = (chunk) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      process.stdout.write(`[${label}] ${line}\n`);
    }
  };
  child.stdout?.on('data', write);
  child.stderr?.on('data', write);
}

let viteProc;
let electronProc;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  try { electronProc?.kill('SIGTERM'); } catch {}
  try { viteProc?.kill('SIGTERM'); } catch {}

  // Si algo queda colgado en Windows, forzar cierre.
  setTimeout(() => {
    try { electronProc?.kill('SIGKILL'); } catch {}
    try { viteProc?.kill('SIGKILL'); } catch {}
    process.exit(code);
  }, 3_000).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  const preferredPort = Number.parseInt(process.env.DESKTOP_DEV_PORT || '5173', 10);
  const port = Number.isFinite(preferredPort) ? await pickPort(preferredPort) : await pickPort(5173);

  const devUrl = `http://localhost:${port}`;
  console.log(`Usando Vite en ${devUrl}`);

  viteProc = spawnDev(
    `npm run dev -- --port ${String(port)} --strictPort`,
    {
      cwd: 'LInguistika-Studio',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    }
  );
  prefixPipe(viteProc, 'VITE');

  viteProc.on('exit', (code) => {
    if (!shuttingDown) {
      const normalized = (typeof code === 'number') ? code : 1;
      const log = normalized === 0 ? console.log : console.error;
      log(`[VITE] salió con código ${normalized}`);
      shutdown(normalized);
    }
  });

  await waitForHttpOk(devUrl);

  electronProc = spawnDev(
    'npx electron .',
    {
      cwd: '.',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ELECTRON_START_URL: devUrl,
      },
    }
  );
  prefixPipe(electronProc, 'ELECTRON');

  electronProc.on('exit', (code) => {
    if (!shuttingDown) {
      const normalized = (typeof code === 'number') ? code : 1;
      const log = normalized === 0 ? console.log : console.error;
      log(`[ELECTRON] salió con código ${normalized}`);
      shutdown(normalized);
    }
  });
}

main().catch((err) => {
  console.error('desktop:dev falló:', err);
  shutdown(1);
});
