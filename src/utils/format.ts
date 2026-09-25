const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
});

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
	hour: '2-digit',
	minute: '2-digit',
});

// Clé de regroupement par jour, dans le fuseau local de l'utilisateur.
export function localDayKey(iso: string): string {
	const d = new Date(iso);
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${month}-${day}`;
}

export function formatDayLabel(iso: string): string {
	const label = dayFormatter.format(new Date(iso));
	return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatTime(iso: string): string {
	return timeFormatter.format(new Date(iso));
}

const tabWeekdayFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
const tabMonthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

// Onglet de jour compact : « jeu. » / « 24 » / « sept. ».
export function formatDayTab(iso: string): { weekday: string; day: string; month: string } {
	const d = new Date(iso);
	return {
		weekday: tabWeekdayFormatter.format(d),
		day: String(d.getDate()),
		month: tabMonthFormatter.format(d),
	};
}

export function todayKey(): string {
	return localDayKey(new Date().toISOString());
}
