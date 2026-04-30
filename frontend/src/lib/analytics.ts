// Loads the umami tracking script if both VITE_UMAMI_SCRIPT_URL and
// VITE_UMAMI_WEBSITE_ID are set at build time. Unset = no-op, so local builds
// don't spam 404s against a phantom analytics host.
const src = import.meta.env.VITE_UMAMI_SCRIPT_URL;
const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

if (src && websiteId) {
	const s = document.createElement('script');
	s.async = true;
	s.defer = true;
	s.src = src;
	s.dataset.websiteId = websiteId;
	document.head.appendChild(s);
}
