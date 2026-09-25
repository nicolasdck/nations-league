/// <reference lib="webworker" />
import type { PrecacheEntry } from 'workbox-precaching';

declare global {
	interface ServiceWorkerGlobalScope {
		// Liste de précache injectée par vite-plugin-pwa au build.
		__WB_MANIFEST: (string | PrecacheEntry)[];
	}
}
