<script lang="ts">
import { onMount, tick } from 'svelte';
import Draggable from './Draggable.svelte';
// Accept any Svelte component for maximum compatibility with app config
export let appWindows: Array<{
  id: string;
  title: string;
  icon: string; // icon class or src
  component: any; // Relaxed type to avoid Svelte type incompatibility
  defaultX: number;
  defaultY: number;
  width: number;
  height: number;
}> = [];

let openWindows: Record<string, boolean> = {};
let nonces: Record<string, number> = {};

// Open a window by id, force remount if already open
async function openWindow(id: string) {
  if (openWindows[id]) {
    openWindows = { ...openWindows, [id]: false };
    await tick();
  }
  openWindows = { ...openWindows, [id]: true };
  nonces = { ...nonces, [id]: (nonces[id] || 0) + 1 };
  console.log(`[WindowManager] Opened window: ${id} (nonce: ${nonces[id]})`);
}
// Close a window by id
function closeWindow(id: string) {
  openWindows = { ...openWindows, [id]: false };
  console.log(`[WindowManager] Closed window: ${id}`);
}

onMount(() => {
  // Initialize all windows as closed and nonce 0
  appWindows.forEach(app => {
    openWindows[app.id] = false;
    nonces[app.id] = 0;
  });
});
</script>

<!-- Sidebar App Launcher (now a normal flex column, not fixed) -->
<div class="h-full flex flex-col items-center py-8 gap-6 bg-base-200 shadow-lg min-w-[90px]">
  {#each appWindows as app}
    <button
      class="flex flex-col items-center justify-center group focus:outline-none"
      aria-label={app.title}
      on:click={() => openWindow(app.id)}
    >
      <span class="app-icon group-hover:scale-110 group-active:scale-95 transition-transform mb-1">
        <span class={app.icon + ' text-4xl'}></span>
      </span>
      <span class="text-xs font-sheila font-bold text-base-content group-hover:text-primary mt-1">
        {app.title}
      </span>
    </button>
  {/each}
</div>

<!-- Render open windows dynamically -->
{#each appWindows as app (app.id)}
  {#if openWindows[app.id]}
    {#key nonces[app.id]}
      <Draggable
        title={app.title}
        x={app.defaultX}
        y={app.defaultY}
        width={app.width}
        height={app.height}
        on:close={() => closeWindow(app.id)}
      >
        <svelte:component this={app.component} />
      </Draggable>
    {/key}
  {/if}
{/each}

<style>
.app-icon {
  background: var(--fallback-b1, #26203a);
  border-radius: 50%;
  box-shadow: 0 2px 8px 0 rgba(0,0,0,0.12);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow 0.15s, background 0.15s;
}
.app-icon:hover, .app-icon:focus {
  background: var(--fallback-p, #e7e0b2);
  box-shadow: 0 4px 16px 0 rgba(0,0,0,0.18);
}
</style>
<!-- Sidebar is now visually an app dock, not fixed, and fits within the main layout. --> 