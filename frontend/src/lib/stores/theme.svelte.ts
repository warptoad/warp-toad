/**
 * Theme store. Three states:
 *   - "system": follow OS prefers-color-scheme (default on first visit)
 *   - "light":  force light
 *   - "dark":   force dark
 *
 * Applies the resolved scheme as a `light` or `dark` class on <html>, so
 * Tailwind's `dark:` variant + the CSS variables in app.css both work.
 */

type ThemePref = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "warptoad-theme";

function readPref(): ThemePref {
	if (typeof localStorage === "undefined") return "system";
	const v = localStorage.getItem(STORAGE_KEY);
	if (v === "light" || v === "dark" || v === "system") return v;
	return "system";
}

function systemTheme(): ResolvedTheme {
	if (typeof window === "undefined" || !window.matchMedia) return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.classList.remove("light", "dark");
	root.classList.add(resolved);
	root.style.colorScheme = resolved;
}

function createThemeStore() {
	let pref = $state<ThemePref>(readPref());
	let resolved = $state<ResolvedTheme>(pref === "system" ? systemTheme() : pref);

	// Apply on init.
	if (typeof window !== "undefined") {
		applyTheme(resolved);

		// React to system preference changes when in "system" mode.
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => {
			if (pref === "system") {
				resolved = mq.matches ? "dark" : "light";
				applyTheme(resolved);
			}
		};
		mq.addEventListener?.("change", onChange);
	}

	function setPreference(next: ThemePref) {
		pref = next;
		if (typeof localStorage !== "undefined") {
			if (next === "system") localStorage.removeItem(STORAGE_KEY);
			else localStorage.setItem(STORAGE_KEY, next);
		}
		resolved = next === "system" ? systemTheme() : next;
		applyTheme(resolved);
	}

	function toggle() {
		// Cycle: system -> light -> dark -> system
		const next: ThemePref = pref === "system" ? "light" : pref === "light" ? "dark" : "system";
		setPreference(next);
	}

	return {
		get preference() { return pref; },
		get resolved() { return resolved; },
		setPreference,
		toggle,
	};
}

export const themeStore = createThemeStore();
