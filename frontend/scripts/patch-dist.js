#!/usr/bin/env node
/**
 * Postbuild patches applied to dist/ after `vite build`:
 *
 *   1. Name the anonymous class expressions in dist/assets/*.js
 *      (Rollup scope-hoisting TDZ bug).
 *   2. Emit an unhashed dist/assets/sqlite3.wasm alias
 *      (Aztec sqlite3mc loader bug).
 *
 * ---------------------------------------------------------------------------
 * 1. Anonymous class expressions
 *
 * Why: Rollup's scope hoisting converts top-level class declarations into
 * anonymous class expressions assigned to a hoisted variable, regardless of
 * whether the original class extends anything:
 *
 *     // Original (clean ES2022):
 *     export class Point {
 *         static ZERO = new Point(Fr.ZERO, Fr.ZERO, false);
 *     }
 *     export class Fr extends BaseField {
 *         static ZERO = new Fr(0n);
 *     }
 *
 *     // After Rollup scope hoisting (broken):
 *     Point = class {                       // ← anonymous, no inner binding
 *         static ZERO = new Point(...);      // ← references OUTER Point (TDZ!)
 *     };
 *     Fr = class extends BaseField {        // ← anonymous, no inner binding
 *         static ZERO = new Fr(0n);         // ← references OUTER Fr (TDZ!)
 *     };
 *
 * The static initializer references the OUTER variable, which hasn't been
 * assigned yet when the initializer runs (the assignment IS the surrounding
 * statement). Throws `<ClassName> is not a constructor`.
 *
 * Fix: give each class expression its own internal name binding. The internal
 * name creates a class-scoped binding, fully constructed by the time field
 * and static initializers run:
 *
 *     Point = class Point { ... };
 *     Fr = class Fr extends BaseField { ... };
 *
 * Idempotent: does not re-process classes that already have an internal name.
 *
 * Why a postbuild script and not a Rollup/Vite plugin: tried `transform`,
 * `renderChunk`, `generateBundle`, both as Vite plugins and as Rollup plugins
 * via `build.rollupOptions.plugins`. None of them either run early enough to
 * see the broken pattern, or run late enough to be the final word - Vite's
 * plugin orchestration suppresses output hooks at the wrong moments. The
 * postbuild script runs strictly after `vite build` finishes writing the
 * dist/ tree, so we always see and patch the final output.
 *
 * Long-term proper fix: switch @aztec/foundation from the npm package to a
 * workspace link (`link:../aztec-packages/yarn-project/foundation`) like the
 * aztec-packages playground does. That bypasses the SWC-compiled npm output
 * and avoids the Rollup interaction entirely. Bigger structural change.
 *
 * See feedback_aztec_class_static_initializer.md in memory.
 *
 * ---------------------------------------------------------------------------
 * 2. Unhashed sqlite3.wasm alias
 *
 * The Aztec PXE's kv-store runs sqlite3mc in a dedicated worker chunk
 * (dist/assets/worker-*.js). `@aztec/sqlite3mc-wasm` knows the vendored
 * `sqlite3.wasm` is invisible to bundlers, so it wraps the loader and installs
 * a `emscriptenLocateFile` hook pointing at a statically analyzable
 * `new URL('../vendor/jswasm/sqlite3.wasm', import.meta.url)` that Vite emits
 * and rewrites to the hashed `/assets/sqlite3-<hash>.wasm`.
 *
 * That hook never survives. The vendored loader's entry point opens with
 *
 *     sIMS.emscriptenLocateFile = args[0]?.locateFile;
 *
 * (vendor/jswasm/sqlite3.mjs:14434), an unconditional assignment that runs as
 * the first statement of every init and overwrites the wrapper's hook with
 * `undefined`, because the wrapper passes its resolver on the shared state
 * object rather than through the module argument. `Module['locateFile']` then
 * falls back to
 *
 *     return new URL(path, import.meta.url).href;
 *
 * and Vite rewrites `import.meta.url` to `self.location.href` inside a worker
 * chunk, so the fallback resolves against the WORKER's own URL and requests
 * the unhashed `/assets/sqlite3.wasm`, which no build ever emits.
 *
 * Unbundled (node) usage is unaffected: there `import.meta.url` still points
 * at the real vendored file, which is why this only bites in the browser.
 *
 * Symptom, from inside the worker:
 *
 *     Uncaught (in promise) TypeError: Failed to execute 'compile' on
 *     'WebAssembly': HTTP status code is not ok
 *
 * and then nothing. The loader hands its fetch promise to Emscripten's
 * `instantiateWasm` hook, whose return value Emscripten ignores, so the
 * rejection is unhandled, `onSuccess` never fires, and the sqlite3 init
 * promise never settles. The PXE store hangs instead of failing, which takes
 * every Aztec-side bridge operation with it.
 *
 * Locally this is masked: `vite preview` SPA-falls-back to index.html, so the
 * request 200s (with the wrong MIME) instead of 404ing. The deployed nginx
 * matches `.wasm` in a regex location block with no try_files, so it returns a
 * real 404 and the failure surfaces.
 *
 * Fix: copy the hashed asset to the unhashed name the loader actually asks
 * for. Both live in dist/assets/ next to the worker chunk, so the fallback
 * URL resolves. Costs one duplicated ~1MB file and is version-agnostic, unlike
 * patching the loader.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS = path.resolve(__dirname, '../dist/assets');

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else if (entry.isFile() && entry.name.endsWith('.js')) yield full;
    }
}

if (!fs.existsSync(ASSETS)) {
    console.error(`[patch-dist] no dist/assets directory at ${ASSETS}`);
    process.exit(0);
}

// Pattern: identifier-only assignment to an anonymous class expression.
// Captures both forms:
//
//   Foo = class extends Bar {     // capture group 2 = " extends "
//   Foo = class {                 // capture group 2 = " {"
//
// Replace with:
//
//   Foo = class Foo extends Bar {
//   Foo = class Foo {
//
// Already-named expressions like `Foo = class Foo extends Bar {` are NOT
// matched because the regex requires `class` to be immediately followed by
// `\s+extends` or `\s*\{`, neither of which is true after `class Foo`.
//
// LHS must start with an uppercase letter (class naming convention) to avoid
// touching unrelated assignments like `obj = class { ... }` inside object
// literals (rare but theoretically possible).
const re = /(\b[A-Z][A-Za-z0-9_$]*)\s*=\s*class(\s+extends\s+|\s*\{)/g;

let filesPatched = 0;
let totalNamed = 0;
for (const file of walk(ASSETS)) {
    const original = fs.readFileSync(file, 'utf8');
    let count = 0;
    const out = original.replace(re, (_m, name, tail) => {
        count++;
        return `${name} = class ${name}${tail}`;
    });
    if (count > 0) {
        fs.writeFileSync(file, out);
        filesPatched++;
        totalNamed += count;
    }
}
console.log(`[patch-dist] named ${totalNamed} anonymous class expressions across ${filesPatched} files`);

// ---------------------------------------------------------------------------
// Step 2: unhashed sqlite3.wasm alias (see the header comment for the why).
//
// Matches the hashed asset Vite emits from
// @aztec/sqlite3mc-wasm/vendor/jswasm/sqlite3.wasm, e.g. sqlite3-CsziU1lZ.wasm.
// Deliberately anchored so it cannot pick up the alias we write ourselves.
const SQLITE_WASM_ALIAS = 'sqlite3.wasm';
const hashedSqliteWasm = fs
    .readdirSync(ASSETS)
    .filter((name) => /^sqlite3-[A-Za-z0-9_-]+\.wasm$/.test(name));

if (hashedSqliteWasm.length === 1) {
    const from = path.join(ASSETS, hashedSqliteWasm[0]);
    const to = path.join(ASSETS, SQLITE_WASM_ALIAS);
    fs.copyFileSync(from, to);
    console.log(`[patch-dist] aliased ${hashedSqliteWasm[0]} -> ${SQLITE_WASM_ALIAS}`);
} else if (hashedSqliteWasm.length === 0) {
    // Not fatal on its own: a build that never pulls in the Aztec kv-store
    // won't emit the asset. But if the PXE IS in the bundle this is the bug
    // above waiting to happen, so make it loud.
    console.warn(
        `[patch-dist] WARNING: no sqlite3-<hash>.wasm in ${ASSETS}. ` +
            `If this build includes the Aztec PXE, its sqlite3 worker will 404 on /assets/${SQLITE_WASM_ALIAS}.`,
    );
} else {
    console.error(
        `[patch-dist] ERROR: expected exactly one sqlite3-<hash>.wasm in ${ASSETS}, found ${hashedSqliteWasm.length}: ` +
            `${hashedSqliteWasm.join(', ')}. Cannot pick which one the worker wants.`,
    );
    process.exit(1);
}
