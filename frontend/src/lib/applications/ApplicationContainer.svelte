<script lang="ts">
    export let depositOpen = false;
    export let withdrawOpen = false;
    export let faqOpen = false;

    const iconSize = 125;
</script>

<div class="flex gap-8 justify-between items-end">
    <div class="text-center grid gap-2">
        <button
            class="h-full flex flex-col gap-2 btn btn-ghost text-warning p-4 aspect-square"
            aria-label="Deposit Button"
            on:click={() => {
                depositOpen = !depositOpen;
            }}
        >
            <svg
                width={iconSize}
                viewBox="0 0 32 32"
                version="1.1"
                id="svg1"
                xml:space="preserve"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs id="defs1" />
                <g id="layer1">
                    <path
                        id="path1"
                        style="stroke-width:0.195428"
                        fill="currentColor"
                        d="M 28.615066,30.319791 H 3.3849221 L 2.7971326,30.268379 2.2272055,30.115669 1.692453,29.866311 1.2091257,29.527881 0.79190944,29.110668 0.45347963,28.627337 0.20412154,28.09258 0.05141555,27.522651 0,26.934863 0.05141555,26.347077 0.20412154,25.777146 0.45347963,25.242396 13.068546,3.3924507 13.40698,2.9091233 l 0.417214,-0.4172162 0.483327,-0.3384299 0.534753,-0.2493581 0.569928,-0.1527059 0.587791,-0.051413 0.587786,0.051411 0.569929,0.1527059 0.534752,0.2493581 0.483326,0.3384298 0.417217,0.4172163 0.338432,0.4833273 12.615073,21.8499474 0.249364,0.53475 0.152704,0.569931 0.05142,0.587786 -0.05142,0.587788 -0.152704,0.569929 -0.249364,0.534757 -0.338428,0.483331 -0.417222,0.417213 -0.483322,0.33843 -0.534757,0.249358 -0.569926,0.15271 z"
                    />
                </g>
                <g
                    id="layer2"
                    fill="none"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    transform="translate(4.25,6)"
                    stroke="var(--color-base-100)"
                >
                    <path d="m16 12-4-4-4 4" />
                    <path d="M12 16V8" />
                </g>
            </svg>
            <p>Deposit</p>
        </button>
    </div>
    <div class="text-center grid gap-2">
        <button
            class="h-full flex flex-col gap-2 btn btn-ghost text-secondary p-4 aspect-square justify-end"
            aria-label="Withdraw Button"
            on:click={() => {
                withdrawOpen = !withdrawOpen;
            }}
        >
            <svg
                width={iconSize}
                viewBox="0 0 32 32"
                version="1.1"
                id="svg1"
                xml:space="preserve"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs id="defs1" />
                <g id="layer1">
                    <path
                        fill="currentColor"
                        id="rect1"
                        width="32"
                        height="32"
                        x="-0.039113946"
                        y="0"
                        d="M 4.7608861,0 H 27.160886 a 4.8,4.8 45 0 1 4.8,4.8 v 22.4 a 4.8,4.8 135 0 1 -4.8,4.8 H 4.7608861 A 4.8,4.8 45 0 1 -0.03911395,27.2 V 4.8 A 4.8,4.8 135 0 1 4.7608861,0 Z"
                    />
                </g>
                <g
                    id="layer2"
                    fill="none"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    transform="translate(4,4)"
                    stroke="var(--color-base-100)"
                >
                    <path d="M12 8v8" />
                    <path d="m8 12 4 4 4-4" />
                </g>
            </svg>
            <p>Withdraw</p>
        </button>
    </div>
    <div class="text-center grid gap-2">
        <button
            class="h-full flex flex-col gap-2 btn btn-ghost text-accent p-4 aspect-square"
            aria-label="FAQ Button"
            on:click={() => {
                faqOpen = !faqOpen;
            }}
        >
            <svg
                width={iconSize}
                viewBox="0 0 32 32"
                version="1.1"
                id="svg1"
                xml:space="preserve"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs id="defs1" />
                <g id="layer1">
                    <circle
                        fill="currentColor"
                        id="path2"
                        cx="16"
                        cy="16"
                        r="16"
                    />
                </g>
                <g
                    id="layer2"
                    fill="none"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    transform="translate(4,4)"
                    stroke="var(--color-base-100)"
                >
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                </g>
            </svg>
            <p>FAQ</p>
        </button>
    </div>
</div>

<style>
</style>
