import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
// https://vite.dev/config/
export default defineConfig({
    plugins: [tailwindcss(), svelte()],
    resolve: {
        alias: {
            $lib: path.resolve("./src/lib"),
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
        esbuildOptions: {
            // Node.js global to browser globalThis
            define: {
                global: 'globalThis',
            },
        }
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
