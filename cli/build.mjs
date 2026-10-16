// esbuild bundle for the CLI.
//
// Two fixes live here rather than in the app, so the React app stays untouched:
//
//   1. `?url` imports — pdfCompare.ts line 6 does
//      `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`.
//      That suffix is a Vite build-time transform; Node cannot resolve it. The plugin
//      below turns it into a module that resolves the file NEXT TO THE BUNDLE at
//      runtime. It used to bake in an absolute path, which works in a checkout and
//      breaks the moment the package is installed anywhere else — so the worker is
//      copied into the output directory and found through `import.meta.url`.
//
//   2. pdfjs-dist build selection — the default browser build assumes DOM at import time.
//      Alias it to the legacy build, which runs under Node.

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const nodeModules = path.join(repoRoot, 'node_modules');

const pdfjsLegacy = path.join(nodeModules, 'pdfjs-dist/legacy/build/pdf.mjs');
const pdfjsLegacyWorker = path.join(nodeModules, 'pdfjs-dist/legacy/build/pdf.worker.mjs');

for (const [label, p] of [
  ['pdfjs legacy build', pdfjsLegacy],
  ['pdfjs legacy worker', pdfjsLegacyWorker],
]) {
  if (!fs.existsSync(p)) throw new Error(`Missing ${label}: ${p}`);
}

/** Resolve `…?url` imports to a module exporting the absolute file path. */
const urlSuffixPlugin = {
  name: 'url-suffix',
  setup(build) {
    build.onResolve({ filter: /\?url$/ }, (args) => ({
      path: args.path.slice(0, -'?url'.length),
      namespace: 'url-suffix',
      pluginData: { resolveDir: args.resolveDir },
    }));

    build.onLoad({ filter: /.*/, namespace: 'url-suffix' }, (args) => {
      // The app asks for the minified browser worker; under Node we hand back the
      // legacy worker instead, copied next to the bundle. pdf.js import()s this
      // value, and Node's ESM loader rejects bare Windows paths ("protocol 'c:'"),
      // so it has to be a URL — built at runtime, not at build time.
      if (args.path.includes('pdf.worker')) {
        return {
          contents:
            "export default new URL('./" +
            WORKER_BASENAME +
            "', import.meta.url).href;\n",
          loader: 'js',
        };
      }
      const href = pathToFileURL(path.resolve(nodeModules, args.path)).href;
      return { contents: `export default ${JSON.stringify(href)};`, loader: 'js' };
    });
  },
};

/** Point bare `pdfjs-dist` imports at the Node-safe legacy build. */
const pdfjsLegacyPlugin = {
  name: 'pdfjs-legacy',
  setup(build) {
    build.onResolve({ filter: /^pdfjs-dist$/ }, () => ({ path: pdfjsLegacy }));
  },
};

/** The worker's name beside the bundle. Referenced by the plugin above. */
const WORKER_BASENAME = 'pdf.worker.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const entry = flag('entry', 'src/index.ts');
const outfile = flag('out', 'dist/index.js');

await esbuild.build({
  entryPoints: [path.join(here, entry)],
  outfile: path.join(here, outfile),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  // Native module — must stay external, cannot be bundled.
  external: ['@napi-rs/canvas', 'express'],
  plugins: [urlSuffixPlugin, pdfjsLegacyPlugin],
  banner: {
    // esbuild's ESM output loses require(); some deps still reach for it.
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'info',
});

// The worker has to sit beside whatever was just built — dist/ for the published
// bundle, .work/ for a verify script — because that is where the generated module
// above looks for it.
const outDir = path.dirname(path.join(here, outfile));
fs.copyFileSync(pdfjsLegacyWorker, path.join(outDir, WORKER_BASENAME));
console.log(`  copied ${WORKER_BASENAME} → ${path.relative(here, outDir)}/`);
