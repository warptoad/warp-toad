<script lang="ts">
    // Define the number of times the paragraph should be repeated
    let repeatCount = 69;

    //from
    //switch
    //to
    //calc/info
    //go/continue
</script>

<div class="h-full w-full flex flex-col justify-center items-center">
    <div class="w-4/6 flex flex-col gap-2">
        <div class="flex flex-col justify-around items-center gap-2">
            <div class="bg-base-300 p-2 rounded-md w-full">from</div>
            <label class="swap swap-flip absolute">
                <input type="checkbox" />
                <div class="swap-on bg-base-300 rounded-md p-2 outline-6 outline-base-200">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="h-10 w-10 fill-current lucide lucide-arrow-up-down-icon lucide-arrow-up-down"
                        ><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path
                            d="m3 8 4-4 4 4"
                        /><path d="M7 4v16" /></svg
                    >
                </div>
                <div class="swap-off bg-base-300 rounded-md p-2 outline-6 outline-base-200">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="swap-off h-10 w-10 fill-current lucide lucide-arrow-down-up-icon lucide-arrow-down-up"
                        ><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path
                            d="m21 8-4-4-4 4"
                        /><path d="M17 4v16" /></svg
                    >
                </div>
            </label>
            <div class="bg-base-300 p-2 rounded-md w-full">to</div>
        </div>
        <div class="bg-base-300 p-2 rounded-md w-full">estimation</div>
        <button class="btn btn-accent w-full">continue</button>
    </div>
</div>
