export type ActiveTab = 'matches' | 'standings' | 'projection' | 'settings';

export const TABS: { id: ActiveTab; icon: string; label: string }[] = [
	{ id: 'matches', icon: '📅', label: 'Matchs' },
	{ id: 'standings', icon: '📊', label: 'Classements' },
	{ id: 'projection', icon: '🔮', label: 'Projection' },
	{ id: 'settings', icon: '⚙️', label: 'Réglages' },
];
