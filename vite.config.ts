import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const FLAG_FILE = 'flag.env';
const VIRTUAL_ID = 'virtual:feature-flags';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

function parseFlagEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    // Strip an inline comment and surrounding quotes; flags are simple scalars.
    const value = line
      .slice(eq + 1)
      .replace(/\s+#.*$/, '')
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) out[key] = value;
  }
  return out;
}

/**
 * Exposes flag.env to the app as `virtual:feature-flags`.
 *
 * A plain .env would work, but Vite bakes those in at server start; reading the
 * file here lets the dev server watch it and push a reload when a flag flips,
 * which is the point of having a flag file at all.
 */
function featureFlags(root: string): Plugin {
  const file = resolve(root, FLAG_FILE);
  const read = () => (existsSync(file) ? parseFlagEnv(readFileSync(file, 'utf8')) : {});

  return {
    name: 'feature-flags',
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : null),
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify(read())};`;
    },
    configureServer(server) {
      server.watcher.add(file);
      const onChange = (changed: string) => {
        if (resolve(changed) !== file) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
        server.config.logger.info(`  flags reloaded from ${FLAG_FILE}`, { timestamp: true });
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

export default defineConfig(({ root }) => ({
  plugins: [react(), featureFlags(root ?? process.cwd())],
  server: {
    port: 5173,
  },
}));
