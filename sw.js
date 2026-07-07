// Minimal service worker: caches the local app shell so the PWA installs and
// launches instantly. CDN assets (Bootstrap/JsBarcode/QRCode) are left to the
// network. Bump CACHE when local files change to invalidate old caches.
const CACHE = "d30-shell-v1";
const SHELL = [
	"./",
	"./index.html",
	"./index.css",
	"./index.js",
	"./src/printer.js",
	"./manifest.json",
	"./icons/icon-192.png",
	"./icons/icon-512.png",
	"./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
	e.waitUntil(
		caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (e) => {
	e.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (e) => {
	const { request } = e;
	if (request.method !== "GET") return;
	// Cache-first for same-origin shell; network otherwise.
	if (new URL(request.url).origin === self.location.origin) {
		e.respondWith(
			caches.match(request).then((hit) => hit || fetch(request)),
		);
	}
});
