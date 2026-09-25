/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
	cleanupOutdatedCaches,
	createHandlerBoundToURL,
	precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

type GoalPushPayload = {
	title: string;
	body: string;
	tag?: string;
	url?: string;
};

function isGoalPushPayload(value: unknown): value is GoalPushPayload {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return typeof v.title === 'string' && typeof v.body === 'string';
}

// registerType: 'prompt' : le nouveau SW attend que l'utilisateur clique
// « Rafraîchir » dans l'UpdateBanner, qui envoie SKIP_WAITING.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
	const data: unknown = event.data;
	if (
		typeof data === 'object' &&
		data !== null &&
		(data as { type?: unknown }).type === 'SKIP_WAITING'
	) {
		void self.skipWaiting();
	}
});
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Police des drapeaux (jsDelivr, URL versionnée donc immuable) : disponible
// hors ligne après le premier chargement.
registerRoute(
	({ url }) => url.origin === 'https://cdn.jsdelivr.net' && url.pathname.endsWith('.woff2'),
	new CacheFirst({
		cacheName: 'flag-font',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 2, maxAgeSeconds: 365 * 24 * 60 * 60 }),
		],
	}),
);

self.addEventListener('push', (event: PushEvent) => {
	if (!event.data) return;

	let payload: unknown;
	try {
		payload = event.data.json();
	} catch {
		payload = { title: 'Ligue des Nations', body: event.data.text() };
	}
	if (!isGoalPushPayload(payload)) return;

	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			icon: '/pwa-192x192.png',
			badge: '/pwa-192x192.png',
			// Un même tag remplace la notification précédente du même match.
			tag: payload.tag,
			data: { url: payload.url ?? self.location.origin },
		}),
	);
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
	event.notification.close();
	const data: unknown = event.notification.data;
	const url =
		typeof data === 'object' && data !== null && typeof (data as { url?: unknown }).url === 'string'
			? (data as { url: string }).url
			: self.location.origin;

	event.waitUntil(
		(async () => {
			const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const existing = windows.find((client) => client.url.startsWith(self.location.origin));
			if (existing) {
				await existing.focus();
				return;
			}
			await self.clients.openWindow(url);
		})(),
	);
});
