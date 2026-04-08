import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import fs from 'fs';
import path from 'path';

// Vite's dev server returns its SPA fallback (index.html, text/html) for any
// unknown URL, including `.wasm` files inside node_modules. wasm-bindgen modules
// like @noir-lang/acvm_js do `fetch(new URL('acvm_js_bg.wasm', import.meta.url))`
// at runtime; without this middleware that fetch lands on the HTML fallback and
// `WebAssembly.compile` throws "magic number" errors. We resolve any `*.wasm`
// (or gzipped `*.wasm.gz`) request against the project root and serve the bytes
// with the correct MIME type.
// pnpm hoists transitive deps to the workspace-root node_modules, so we try
// both the local frontend dir AND the workspace root when resolving wasm paths.
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

// Two parallel package families ship `*_bg.wasm` files with the same basenames
// but DIFFERENT wasm-bindgen schemas:
//   - @noir-lang/{acvm_js,noirc_abi} (used by @noir-lang/noir_js for the Withdraw proof flow)
//   - @aztec/noir-{acvm_js,noirc_abi} (used by @aztec/pxe and @aztec/wallets)
//
// We can't disambiguate via the Referer header because browsers default to the
// document URL (the HTML page), not the importing module's URL. Instead, we
// scan Vite's pre-bundled chunks in `.vite/deps/` for `<basename>_bg.wasm`
// references, extract each chunk's wasm-bindgen `__wbg_*` symbols, and match
// them against the wasms installed in node_modules. The first chunk that
// references a basename gets its symbols matched to a unique wasm; we cache
// the result for subsequent requests with the same basename.
const wasmByBasename = new Map<string, string>(); // basename -> abs wasm path
const symbolsByWasm = new Map<string, Set<string>>();
let wasmIndexBuilt = false;

const WBG_RE = /__wbg_[a-zA-Z0-9_]+/g;
const VITE_DEPS = path.join(__dirname, 'node_modules', '.vite', 'deps');

function buildWasmIndex() {
    if (wasmIndexBuilt) return;
    const roots = [
        path.join(__dirname, 'node_modules'),
        path.join(WORKSPACE_ROOT, 'node_modules'),
    ];
    const found: string[] = [];
    for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        walkCollectRe(root, /_bg\.wasm$/, 10, found);
    }
    for (const filePath of found) {
        // Only consider browser/web wasm-bindgen targets.
        if (!filePath.includes(`${path.sep}web${path.sep}`)) continue;
        const symbols = extractWbgSymbols(filePath);
        if (symbols.size > 0) symbolsByWasm.set(filePath, symbols);
    }
    wasmIndexBuilt = true;
}

function extractWbgSymbols(filePath: string): Set<string> {
    const result = new Set<string>();
    try {
        const buf = fs.readFileSync(filePath);
        const ascii = buf.toString('latin1');
        let m: RegExpExecArray | null;
        while ((m = WBG_RE.exec(ascii)) !== null) result.add(m[0]);
        WBG_RE.lastIndex = 0;
    } catch { /* ignore */ }
    return result;
}

/**
 * Match a wasm basename to a physical wasm path by scanning Vite's bundled
 * chunks. Find which chunk(s) import this basename, extract their wbg symbols,
 * and pick the wasm whose required imports are a subset of those symbols.
 */
function findWasmForBasename(basename: string): string | null {
    // Cache hit
    const cached = wasmByBasename.get(basename);
    if (cached && fs.existsSync(cached)) return cached;
    buildWasmIndex();

    // Find every Vite chunk that mentions this wasm basename. Vite-bundled
    // wasm-bindgen JS does `new URL('foo_bg.wasm', import.meta.url)` so the
    // string literal is in the chunk source.
    let chunks: string[] = [];
    try {
        chunks = fs.readdirSync(VITE_DEPS).filter(n => n.endsWith('.js')).map(n => path.join(VITE_DEPS, n));
    } catch { /* .vite/deps not built yet */ }

    let bestPath: string | null = null;
    let bestScore = -Infinity;
    for (const chunk of chunks) {
        let txt: string;
        try { txt = fs.readFileSync(chunk, 'utf8'); } catch { continue; }
        if (!txt.includes(basename)) continue;
        // Pull symbols from this chunk
        const provided = new Set<string>();
        let m: RegExpExecArray | null;
        while ((m = WBG_RE.exec(txt)) !== null) provided.add(m[0]);
        WBG_RE.lastIndex = 0;
        if (provided.size === 0) continue;

        // Find the wasm whose imports best match the chunk's provided symbols.
        for (const [wasmPath, required] of symbolsByWasm.entries()) {
            if (path.basename(wasmPath) !== basename) continue;
            let overlap = 0;
            let missing = 0;
            for (const s of required) {
                if (provided.has(s)) overlap++;
                else missing++;
            }
            const subset = missing === 0;
            const score = overlap - missing * 2 + (subset ? 10000 : 0);
            if (overlap > 0 && score > bestScore) {
                bestScore = score;
                bestPath = wasmPath;
            }
        }
    }
    if (bestPath) {
        wasmByBasename.set(basename, bestPath);
        return bestPath;
    }
    return null;
}

function walkCollectRe(dir: string, target: RegExp, depth: number, out: string[]): void {
    if (depth <= 0) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isFile() && target.test(e.name)) out.push(full);
        else if (e.isDirectory() && !e.name.startsWith('.git') && e.name !== 'src') {
            walkCollectRe(full, target, depth - 1, out);
        }
    }
}

const serveWasmFromNodeModules = (): Plugin => ({
    name: 'warptoad:serve-wasm-from-node-modules',
    configureServer(server) {
        // Vite's HTML fallback is registered LAST in the connect stack and
        // never calls next(), so any middleware added via the usual `use()`
        // gets pushed behind it and never fires for unknown URLs. We bypass
        // that by inserting directly at index 0 of the stack array.
        const handler = (req: any, res: any, next: any) => {
            const url = (req.url ?? '').split('?')[0];
            if (!url.endsWith('.wasm') && !url.endsWith('.wasm.gz')) return next();

            const rel = url.replace(/^\/+/, '');
            const basename = path.basename(rel);

            // Strategy 1: literal path resolution. Works when the JS lives next
            // to the wasm (raw module from node_modules, no Vite bundling).
            for (const base of [__dirname, WORKSPACE_ROOT]) {
                const filePath = path.resolve(base, rel);
                if (fs.existsSync(filePath)) {
                    return serveWasm(res, filePath, url);
                }
            }

            // Strategy 2: Vite-bundled chunks request /node_modules/.vite/deps/<basename>.wasm,
            // which doesn't exist on disk. Scan the bundled chunks in .vite/deps for
            // any chunk that imports this basename, extract its wbg symbols, and
            // match against installed wasms. Browsers don't tell us which chunk
            // initiated the fetch (the Referer header is the document URL), so we
            // discover the caller by searching the chunk source instead.
            const matched = findWasmForBasename(basename);
            if (matched) {
                return serveWasm(res, matched, url);
            }
            // First wasm request after a fresh `pnpm dev --force` may fall through
            // because Vite hasn't finished bundling the chunk yet. The next request
            // will succeed once .vite/deps is populated.
            console.warn(`[warptoad:wasm] no chunk found for ${url}, returning 404 (will retry on next request)`);
            return next();
        };
        // unshift so we run first
        (server.middlewares as any).stack.unshift({ route: '', handle: handler });
    },
});

function serveWasm(res: any, filePath: string, url: string) {
    res.setHeader('Content-Type', url.endsWith('.gz') ? 'application/gzip' : 'application/wasm');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(filePath).pipe(res);
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [tailwindcss(), svelte(), wasm(), topLevelAwait(), serveWasmFromNodeModules()],
    resolve: {
        alias: {
            $lib: path.resolve("./src/lib"),
            '@backend': path.resolve(__dirname, '../backend'),
            // Polyfills for Node.js modules in browser
            util: 'util',
            buffer: 'buffer',
            stream: 'stream-browserify',
            crypto: 'crypto-browserify',
            assert: 'assert',
            process: 'process/browser',
        },
        extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.svelte', '.svelte.ts', '.svelte.js'],
    },
    define: {
        // Define global for Node.js packages
        global: 'globalThis',
    },
    optimizeDeps: {
        // Only exclude the noir wasm-bindgen packages. Aztec packages MUST be
        // pre-bundled by Vite so its CJS/ESM interop layer fixes up imports
        // like `pino` (which @aztec/foundation/log imports `symbols` from).
        // When aztec packages get pre-bundled they may inline acvm_js etc, in
        // which case the wasm-bindgen `new URL('foo_bg.wasm', import.meta.url)`
        // resolves to `/node_modules/.vite/deps/<name>_bg.wasm` - the
        // serveWasmFromNodeModules middleware's strategy-2 fallback maps that
        // back to the real file in node_modules.
        exclude: [
            '@noir-lang/acvm_js',
            '@noir-lang/noirc_abi',
            '@noir-lang/noir_js',
            '@aztec/bb.js',
        ],
        esbuildOptions: {
            // Node.js global to browser globalThis
            define: {
                global: 'globalThis',
            },
        }
    },
    server: {
        // Required for bb.js multithreaded WASM (SharedArrayBuffer needs cross-origin isolation).
        // Mirrors the aztec-packages playground vite.config.
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                polyfills: path.resolve(__dirname, 'src/polyfills.ts'),
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    return chunkInfo.name === 'polyfills' ? 'assets/polyfills-[hash].js' : 'assets/[name]-[hash].js';
                }
            }
        }
    }
});
