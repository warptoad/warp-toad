// Import polyfills FIRST before anything else
import './polyfills';

import { mount } from 'svelte'
import './app.css'
// Initialize theme as early as possible to avoid a flash of wrong scheme.
import './lib/stores/theme.svelte.js'
import './lib/analytics'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
