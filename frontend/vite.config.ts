import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), tailwindcss(), nodePolyfills()],
})
