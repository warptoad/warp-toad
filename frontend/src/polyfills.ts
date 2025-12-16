// Browser polyfills that need to be available globally before any modules load
import { Buffer } from 'buffer';

// Make Buffer available globally - must happen synchronously
(function() {
  if (typeof globalThis !== 'undefined') {
    // @ts-ignore
    globalThis.Buffer = Buffer;
    // @ts-ignore
    globalThis.global = globalThis;
    // @ts-ignore
    if (!globalThis.process) {
      // @ts-ignore
      globalThis.process = { env: {}, browser: true };
    }
  }
  
  // Also set on window for extra compatibility
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.Buffer = Buffer;
    // @ts-ignore
    window.global = window;
    // @ts-ignore
    if (!window.process) {
      // @ts-ignore
      window.process = { env: {}, browser: true };
    }
  }
})();

export { Buffer };
