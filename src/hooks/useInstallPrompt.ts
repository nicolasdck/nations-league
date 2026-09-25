import { useCallback, useEffect, useState } from 'react';
import { readString, STORAGE_KEYS, writeString } from '../utils/storage';

// Événement non standard (Chromium) : absent de lib.dom.d.ts.
interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
	prompt(): Promise<void>;
}

declare global {
	interface WindowEventMap {
		beforeinstallprompt: BeforeInstallPromptEvent;
	}
	interface Navigator {
		// Safari iOS : vrai quand l'app est lancée depuis l'écran d'accueil.
		readonly standalone?: boolean;
	}
}

const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		navigator.standalone === true
	);
}

function isIosSafari(): boolean {
	const ua = navigator.userAgent;
	const isIos =
		/iPad|iPhone|iPod/.test(ua) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	return isIos && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function recentlyDismissed(): boolean {
	const raw = readString(STORAGE_KEYS.installDismissedAt);
	const at = raw ? Number(raw) : 0;
	return Number.isFinite(at) && Date.now() - at < DISMISS_DURATION_MS;
}

// Bannière d'installation : Chrome/Edge/Android exposent beforeinstallprompt ;
// iOS Safari n'a pas d'API, on y affiche la marche à suivre manuelle.
export function useInstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
	const [installed, setInstalled] = useState(isStandalone);
	const [dismissed, setDismissed] = useState(recentlyDismissed);
	const [iosHint] = useState(() => !isStandalone() && isIosSafari());

	useEffect(() => {
		const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
			// Empêche la mini-barre native : on affiche notre propre bannière.
			event.preventDefault();
			setDeferredPrompt(event);
		};
		const onInstalled = () => {
			setInstalled(true);
			setDeferredPrompt(null);
		};
		window.addEventListener('beforeinstallprompt', onBeforeInstall);
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			window.removeEventListener('beforeinstallprompt', onBeforeInstall);
			window.removeEventListener('appinstalled', onInstalled);
		};
	}, []);

	const install = useCallback(async () => {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		// Un événement beforeinstallprompt n'est utilisable qu'une fois.
		setDeferredPrompt(null);
		if (outcome === 'accepted') setInstalled(true);
	}, [deferredPrompt]);

	const dismiss = useCallback(() => {
		writeString(STORAGE_KEYS.installDismissedAt, String(Date.now()));
		setDismissed(true);
	}, []);

	const mode: 'prompt' | 'ios' | null =
		installed || dismissed ? null : deferredPrompt ? 'prompt' : iosHint ? 'ios' : null;

	return { mode, install, dismiss };
}
