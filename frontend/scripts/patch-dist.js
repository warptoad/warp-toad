#!/usr/bin/env node
/**
 * Postbuild patch: name the anonymous class expressions in dist/assets/*.js.
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
