/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { Buffer as BufferType } from 'buffer';

declare global {
  interface Window {
    Buffer: typeof BufferType;
    global: typeof globalThis;
    process: NodeJS.Process;
  }
  
  var Buffer: typeof BufferType;
  var global: typeof globalThis;
  var process: NodeJS.Process;
}

export {};
