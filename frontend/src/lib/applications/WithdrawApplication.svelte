<script lang="ts">
    import {
        mintOnL2,
        warptoadNoteStore,
        type WarptoadNote,
    } from "../../stores/depositStore";

    let currentStep = 1;
    let draggedOver = false;
    let fileName: string | null = null;

    let warptoadNoteData: WarptoadNote | undefined;
    $: $warptoadNoteStore, (warptoadNoteData = $warptoadNoteStore);

    function handleWithDrawClear() {
        currentStep = 0;
        warptoadNoteStore.set(undefined);
    }

    async function handleWithdrawL2() {
        currentStep++;
        await mintOnL2();
        currentStep++;
    }

    async function processFile(file: File) {
        try {
            const text = await file.text();
            const parsed: unknown = JSON.parse(text);

            // Check if it's a valid WarptoadNote
            if (
                typeof parsed === "object" &&
                parsed !== null &&
                "preCommitment" in parsed &&
                "preImg" in parsed &&
                typeof parsed.preCommitment === "string" &&
                typeof parsed.preImg === "object" &&
                parsed.preImg !== null &&
                "amount" in parsed.preImg &&
                "destination_chain_id" in parsed.preImg &&
                "secret" in parsed.preImg &&
                "nullifier_preimg" in parsed.preImg
            ) {
                // If it's valid, update the store
                warptoadNoteStore.set(parsed as WarptoadNote);
                console.log("Valid WarptoadNote:", parsed);
                currentStep = 1;
            } else {
                console.error("Invalid WarptoadNote format.");
            }
        } catch (error) {
            console.error("Failed to parse file:", error);
        }
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        draggedOver = false;

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (file.type === "text/plain" || file.name.endsWith(".txt")) {
            fileName = file.name;
            processFile(file);
        } else {
            alert("Only .txt files are accepted.");
        }
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        draggedOver = true;
    }

    function handleDragLeave() {
        draggedOver = false;
    }

    function handleFileInputChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (
            file &&
            (file.type === "text/plain" || file.name.endsWith(".txt"))
        ) {
            fileName = file.name;
            processFile(file);
        } else {
            alert("Only .txt files are accepted.");
        }
    }
</script>

{#if currentStep === 0}
    <div class="flex flex-col gap-4 justify-center items-center h-full">
        <div
            role="region"
            class={`border-2 border-dashed p-8 rounded-lg text-center transition-all duration-200 cursor-pointer w-full ${draggedOver ? "bg-base-300" : "bg-base-200"}`}
            on:drop={handleDrop}
            on:dragover={handleDragOver}
            on:dragleave={handleDragLeave}
        >
            <p class="mb-2 font-semibold">
                Drag and drop your warptoadnote.txt file here
            </p>
            <p class="text-sm opacity-70">or use the file picker below</p>
            <input
                type="file"
                accept=".txt"
                class="file-input file-input-bordered w-full max-w-xs mt-4"
                on:change={handleFileInputChange}
            />
            {#if fileName}
                <p class="mt-2 text-success font-mono">Selected: {fileName}</p>
            {/if}
        </div>
    </div>
{:else if currentStep < 3}
    <div class="flex flex-col gap-4 justify-center items-center h-full">
        <p class="mb-2 font-semibold">
            This seems to be a valid warptoadnote.txt file
        </p>
        <button on:click={handleWithdrawL2} class="btn btn-success w-full"
            >Continue Withdraw</button
        >
        <button on:click={handleWithDrawClear} class="btn btn-warning w-full"
            >Select a different Note</button
        >
    </div>
{:else}
    <div class="flex flex-col gap-4 justify-center items-center h-full">
        <p>FUNDS WITHDRAWN!</p>
    </div>
{/if}
