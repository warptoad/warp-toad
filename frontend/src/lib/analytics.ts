// Loads the umami tracking script if both VITE_UMAMI_SCRIPT_URL and
// VITE_UMAMI_WEBSITE_ID are set at build time. Unset = no-op, so local builds
// don't spam 404s against a phantom analytics host.
//
// crossOrigin = "anonymous" is load-bearing: the host reverse-proxy sets
// Cross-Origin-Embedder-Policy: require-corp (for bb.js wasm threads), which
// blocks any cross-origin subresource that isn't fetched via CORS or served
// with Cross-Origin-Resource-Policy. Umami's /script.js returns
// Access-Control-Allow-Origin: * so the CORS path works.
const src = import.meta.env.VITE_UMAMI_SCRIPT_URL;
const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

if (src && websiteId) {
	const s = document.createElement('script');
	s.async = true;
	s.defer = true;
	s.crossOrigin = 'anonymous';
	s.src = src;
	s.dataset.websiteId = websiteId;
	document.head.appendChild(s);
}
