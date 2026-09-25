// Accès localStorage tolérant aux erreurs (navigation privée, quota, JSON
// corrompu) : l'app doit toujours démarrer, quitte à repartir de zéro.
export const STORAGE_KEYS = {
	competition: 'unl:competition-cache:v1',
	favoriteTeam: 'unl:favorite-team',
	notificationLevel: 'unl:notification-level',
	activeTab: 'unl:active-tab',
	installDismissedAt: 'unl:install-dismissed-at',
} as const;

export function readJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return null;
		const parsed: unknown = JSON.parse(raw);
		return isValid(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function writeJson(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Quota dépassé ou stockage indisponible : le cache est facultatif.
	}
}

export function readString(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function writeString(key: string, value: string | null): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		// Stockage indisponible : la préférence ne survivra pas au rechargement.
	}
}
