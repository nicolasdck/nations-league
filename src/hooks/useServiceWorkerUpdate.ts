import { useRegisterSW } from 'virtual:pwa-register/react';

const ONE_HOUR = 60 * 60 * 1000;

// Enregistre le service worker (registerType: 'prompt') et expose
// `needRefresh` quand une nouvelle version est installée et en attente.
// Les navigateurs ne revérifient pas toujours sw.js quand une PWA est rouverte
// depuis l'écran d'accueil : on force donc une vérification au retour au
// premier plan et toutes les heures.
export function useServiceWorkerUpdate() {
	const {
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		immediate: true,
		onRegisteredSW(swUrl, registration) {
			if (!registration) return;

			const checkForUpdate = async () => {
				if (registration.installing || !navigator.onLine) return;
				try {
					const resp = await fetch(swUrl, { cache: 'no-store' });
					if (resp.status === 200) await registration.update();
				} catch {
					// Réseau indisponible : la prochaine vérification réessaiera.
				}
			};

			setInterval(checkForUpdate, ONE_HOUR);
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') void checkForUpdate();
			});
		},
		onRegisterError(error: unknown) {
			console.error('Enregistrement du service worker impossible :', error);
		},
	});

	return {
		needRefresh,
		// Envoie SKIP_WAITING au SW en attente puis recharge la page.
		applyUpdate: () => updateServiceWorker(true),
		dismiss: () => setNeedRefresh(false),
	};
}
