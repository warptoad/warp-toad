import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

/**
 * Rollup plugin: name class expressions that Rollup's scope hoisting stripped.
 *
 * Why: the Aztec SDK declares classes like
 *
 *     export class Fr extends BaseField {
 *         static ZERO = new Fr(0n);
 *         ...
 *     }
 *
 * Rollup's scope hoisting wraps each module's exports in an IIFE and
 * transforms top-level class declarations into anonymous class expressions
 * assigned to a hoisted variable:
 *
 *     Fr = class extends BaseField {       // ← anonymous, no inner binding
 *         static ZERO = new Fr(0n);         // ← references OUTER Fr (TDZ!)
 *         ...
 *     };
 *
 * The static initializer `new Fr(0n)` then references the OUTER `Fr` variable,
 * which hasn't been assigned yet (the assignment is the surrounding statement).
 * This throws `Fr is not a constructor` at module evaluation.
 *
 * The fix is to give the class expression an internal name so the static
 * initializer references the class's OWN binding, which is fully constructed
 * by the time field initializers run:
 *
 *     Fr = class Fr extends BaseField {    // ← named expression, internal binding
 *         static ZERO = new Fr(0n);         // ← references the inner Fr
 *     };
 *
 * Done in `renderChunk` (post-Rollup output) rather than `transform`
 * (pre-Rollup input) because the broken transformation is Rollup's own work.
 */
// nameAnonymousClassExpressions was a Rollup/Vite plugin attempt that didn't
// work because Vite's plugin pipeline doesn't expose `generateBundle` through
// user plugins for output bundles. The patch is now applied via a postbuild
// node script (`scripts/patch-dist.js`) wired through `pnpm build`.

// IMPORTANT: this app is intended to be served via `pnpm build && pnpm preview`,
// not `pnpm dev`. Reasons:
//
// - Two parallel package families (`@noir-lang/{acvm_js,noirc_abi}` and
//   `@aztec/noir-{acvm_js,noirc_abi}`) ship `.wasm` files with identical
//   basenames but different wasm-bindgen schemas. Vite's dev-mode optimizer
//   serves both at the same `/node_modules/.vite/deps/<basename>_bg.wasm` URL,
//   guaranteeing a wasm-bindgen LinkError no matter which middleware tricks
//   you try.
// - Rollup (used by `pnpm build`) hashes asset filenames per-source so the
//   two `_bg.wasm` files become `noirc_abi_wasm_bg-<hashA>.wasm` and
//   `noirc_abi_wasm_bg-<hashB>.wasm`. No collision, no special config needed.
// - The preview server serves `dist/assets/*.wasm` with `application/wasm`
//   MIME natively, no SPA-fallback intercept.
//
// If you ever need HMR-style iteration, do it for non-wasm-touching code paths
// only and accept that anything reaching @noir-lang/noir_js or @aztec/wallets
// will fail under `pnpm dev`.

export default defineConfig({
    plugins: [tailwindcss(), svelte(), wasm(), topLevelAwait()],
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
        // Node.js global to browser globalThis
        global: 'globalThis',
    },
    optimizeDeps: {
        esbuildOptions: {
            define: {
                global: 'globalThis',
            },
        },
    },
    server: {
        // Required for bb.js multithreaded WASM (SharedArrayBuffer needs cross-origin isolation).
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    preview: {
        // Same headers required for the preview server (where things actually work).
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    build: {
        target: 'esnext',
        // Don't inline assets - we need them as separate files so wasm-bindgen
        // can fetch them by URL.
        assetsInlineLimit: 0,
        // Source maps + readable names so runtime errors are debuggable.
        // Set to false / 'esbuild' once the app is stable.
        sourcemap: true,
        minify: false,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                polyfills: path.resolve(__dirname, 'src/polyfills.ts'),
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    return chunkInfo.name === 'polyfills' ? 'assets/polyfills-[hash].js' : 'assets/[name]-[hash].js';
                },
            },
        },
    },
});
