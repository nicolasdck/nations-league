import { useEffect } from 'react';
import type { Team } from '../types/competition';
import { applyTeamTheme } from '../utils/teamTheme';

// Reteinte l'app aux couleurs de l'équipe préférée ; revient au thème par
// défaut quand aucune équipe n'est choisie.
export function useTeamTheme(team: Team | null): void {
	const primary = team?.primaryColor ?? null;
	const secondary = team?.secondaryColor ?? null;
	const dark = team?.darkColor ?? null;

	useEffect(() => {
		applyTeamTheme(
			primary && secondary && dark
				? { primaryColor: primary, secondaryColor: secondary, darkColor: dark }
				: null,
		);
	}, [primary, secondary, dark]);
}
