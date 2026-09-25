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

type GoalSide = 'home' | 'away';

type GoalPushPayload = {
	title: string;
	body: string;
	tag?: string;
	url?: string;
	// But : match et équipe qui a marqué, pour lancer la célébration au clic.
	matchId?: number;
	side?: GoalSide;
};

type NotificationData = { url: string; matchId: number | null; side: GoalSide | null };

function isNotificationData(value: unknown): value is NotificationData {
	return typeof value === 'object' && value !== null && typeof (value as { url?: unknown }).url === 'string';
}

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

// Un clic sur une alerte de but ouvre l'app sur la célébration
// (?goal=<id>&side=<home|away>, lu par useGoalCelebrations).
function notificationData(payload: GoalPushPayload): NotificationData {
	const matchId = Number.isSafeInteger(payload.matchId) ? (payload.matchId as number) : null;
	const side = payload.side === 'home' || payload.side === 'away' ? payload.side : null;
	const url =
		matchId !== null && side !== null
			? `${self.location.origin}/?goal=${matchId}&side=${side}`
			: (payload.url ?? self.location.origin);
	return { url, matchId, side };
}

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
			data: notificationData(payload),
		}),
	);
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
	event.notification.close();
	const raw: unknown = event.notification.data;
	const data: NotificationData = isNotificationData(raw)
		? raw
		: { url: self.location.origin, matchId: null, side: null };

	event.waitUntil(
		(async () => {
			const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const existing = windows.find((client) => client.url.startsWith(self.location.origin));
			if (existing) {
				// App déjà ouverte (en arrière-plan) : on la ramène au premier plan
				// et on lui demande de jouer la célébration.
				await existing.focus();
				if (data.matchId !== null && data.side !== null) {
					existing.postMessage({ type: 'GOAL_NOTIFICATION_CLICK', matchId: data.matchId, side: data.side });
				}
				return;
			}
			await self.clients.openWindow(data.url);
		})(),
	);
});
