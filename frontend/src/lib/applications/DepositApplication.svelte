<script lang="ts">
    // Define the number of times the paragraph should be repeated
    let repeatCount = 69;
</script>

<div class="h-full w-full flex flex-col justify-center items-center">
    {#each Array(repeatCount) as _}
        <p>This is the Deposit app</p>
    {/each}
</div>
