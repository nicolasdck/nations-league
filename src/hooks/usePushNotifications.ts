import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Json } from '../lib/database.types';

export type PushSupport = 'unsupported' | 'denied' | 'default' | 'granted';

function detectSupport(): PushSupport {
	if (
		typeof window === 'undefined' ||
		!('serviceWorker' in navigator) ||
		!('PushManager' in window) ||
		!('Notification' in window)
	) {
		return 'unsupported';
	}
	return Notification.permission;
}

// Clé VAPID publique (base64url) → Uint8Array attendu par PushManager.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = window.atob(base64);
	const output = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
	return output;
}

function vapidKey(): string {
	const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
	if (!key) throw new Error('VITE_VAPID_PUBLIC_KEY manquante');
	return key.trim().replace(/^["']|["']$/g, '');
}

async function newSubscription(registration: ServiceWorkerRegistration) {
	return registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(vapidKey()),
	});
}

async function saveSubscription(userId: string, subscription: PushSubscription) {
	return supabase.from('push_subscriptions').upsert(
		{
			user_id: userId,
			endpoint: subscription.endpoint,
			subscription: subscription.toJSON() as Json,
			user_agent: navigator.userAgent.slice(0, 255),
		},
		{ onConflict: 'endpoint' },
	);
}

// Abonnement Web Push de l'appareil. Le NIVEAU d'alerte (équipe préférée /
// toutes / aucune) est stocké dans user_preferences et appliqué côté serveur
// par la fonction SQL goal_alert_recipients ; ce hook ne gère que
// l'abonnement navigateur et sa ligne dans push_subscriptions.
export function usePushNotifications(userId: string | null) {
	const [support, setSupport] = useState<PushSupport>(detectSupport);
	const [isSubscribed, setIsSubscribed] = useState(false);
	const [isBusy, setIsBusy] = useState(false);

	useEffect(() => {
		if (support === 'unsupported') return;
		let cancelled = false;
		navigator.serviceWorker.ready
			.then((registration) => registration.pushManager.getSubscription())
			.then((subscription) => {
				if (!cancelled) setIsSubscribed(subscription !== null);
			})
			.catch(() => {
				if (!cancelled) setIsSubscribed(false);
			});
		return () => {
			cancelled = true;
		};
	}, [support]);

	// Renvoie true si l'appareil est abonné et enregistré en base.
	const subscribe = useCallback(async (): Promise<boolean> => {
		if (support === 'unsupported') return false;
		if (!userId) throw new Error('Session indisponible : impossible d’enregistrer les alertes.');

		setIsBusy(true);
		try {
			let permission = Notification.permission;
			if (permission === 'default') permission = await Notification.requestPermission();
			setSupport(permission);
			if (permission !== 'granted') return false;

			const registration = await navigator.serviceWorker.ready;
			let subscription =
				(await registration.pushManager.getSubscription()) ??
				(await newSubscription(registration));

			let { error } = await saveSubscription(userId, subscription);
			// L'endpoint appartient à une ancienne session anonyme (stockage vidé) :
			// la RLS refuse la mise à jour. On régénère un endpoint propre.
			if (error?.code === '42501') {
				await subscription.unsubscribe();
				subscription = await newSubscription(registration);
				({ error } = await saveSubscription(userId, subscription));
			}
			if (error) throw error;

			setIsSubscribed(true);
			return true;
		} finally {
			setIsBusy(false);
		}
	}, [support, userId]);

	const unsubscribe = useCallback(async (): Promise<void> => {
		if (support === 'unsupported') return;
		setIsBusy(true);
		try {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();
			if (subscription) {
				if (userId) {
					const { error } = await supabase
						.from('push_subscriptions')
						.delete()
						.eq('endpoint', subscription.endpoint);
					if (error) console.error('Suppression de l’abonnement en base impossible :', error.message);
				}
				await subscription.unsubscribe();
			}
			setIsSubscribed(false);
		} finally {
			setIsBusy(false);
		}
	}, [support, userId]);

	return { support, isSubscribed, isBusy, subscribe, unsubscribe };
}
