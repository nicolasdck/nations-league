import type { Team } from '../types/competition';

// Tailwind v4 expose chaque couleur de palette en variable CSS
// (--color-emerald-400, etc.) et chaque utilitaire la lit
// (.text-emerald-400 { color: var(--color-emerald-400) }). Surcharger ces
// variables sur <html> reteinte d'un coup tous les usages emerald (accent
// primaire) et cyan (accent secondaire) de l'app, sans toucher aux composants.
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
type Shade = (typeof SHADES)[number];
type RampName = 'emerald' | 'cyan';

export const DEFAULT_THEME_COLOR = '#020617';

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
	const value = hex.replace('#', '');
	return [
		parseInt(value.slice(0, 2), 16),
		parseInt(value.slice(2, 4), 16),
		parseInt(value.slice(4, 6), 16),
	];
}

function rgbToHex([r, g, b]: Rgb): string {
	return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function mixRgb(base: Rgb, target: Rgb, ratio: number): Rgb {
	return [0, 1, 2].map((i) => Math.round(base[i] + (target[i] - base[i]) * ratio)) as Rgb;
}

function mix(baseHex: string, targetHex: string, ratio: number): string {
	const [r, g, b] = mixRgb(hexToRgb(baseHex), hexToRgb(targetHex), ratio);
	return `rgb(${r} ${g} ${b})`;
}

// Luminance relative WCAG.
function luminance([r, g, b]: Rgb): number {
	const channel = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// L'interface est sombre (slate-950) : une couleur d'équipe trop foncée
// (bleu marine, bordeaux…) serait illisible en texte. On l'éclaircit vers le
// blanc jusqu'à un contraste suffisant sur fond sombre.
const MIN_ACCENT_LUMINANCE = 0.16;

export function readableAccent(hex: string): string {
	const base = hexToRgb(hex);
	for (let ratio = 0; ratio <= 0.9; ratio += 0.05) {
		const candidate = mixRgb(base, [255, 255, 255], ratio);
		if (luminance(candidate) >= MIN_ACCENT_LUMINANCE) return rgbToHex(candidate);
	}
	return '#ffffff';
}

// Texte lisible posé SUR la couleur (boutons pleins).
export function contrastText(hex: string): '#020617' | '#ffffff' {
	return luminance(hexToRgb(hex)) > 0.4 ? '#020617' : '#ffffff';
}

// Approxime la progression 50 (clair) → 950 (foncé) de Tailwind : mélange
// vers le blanc pour les nuances claires, vers une ancre sombre pour les
// nuances foncées, la base elle-même restant en 400.
function buildRamp(base: string, darkAnchor: string): Record<Shade, string> {
	return {
		50: mix(base, '#ffffff', 0.92),
		100: mix(base, '#ffffff', 0.82),
		200: mix(base, '#ffffff', 0.62),
		300: mix(base, '#ffffff', 0.4),
		400: base,
		500: mix(base, darkAnchor, 0.18),
		600: mix(base, darkAnchor, 0.38),
		700: mix(base, darkAnchor, 0.55),
		800: mix(base, darkAnchor, 0.7),
		900: mix(base, darkAnchor, 0.82),
		950: mix(base, darkAnchor, 0.92),
	};
}

function setRamp(root: CSSStyleDeclaration, name: RampName, ramp: Record<Shade, string>) {
	SHADES.forEach((shade) => root.setProperty(`--color-${name}-${shade}`, ramp[shade]));
}

function clearRamp(root: CSSStyleDeclaration, name: RampName) {
	SHADES.forEach((shade) => root.removeProperty(`--color-${name}-${shade}`));
}

export type ThemeColors = Pick<Team, 'primaryColor' | 'secondaryColor' | 'darkColor'>;

function setMetaThemeColor(color: string) {
	let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	if (!meta) {
		meta = document.createElement('meta');
		meta.name = 'theme-color';
		document.head.appendChild(meta);
	}
	meta.content = color;
}

// Applique (ou retire si `colors` est null) la charte de l'équipe au DOM.
export function applyTeamTheme(colors: ThemeColors | null): void {
	const root = document.documentElement.style;

	if (!colors) {
		clearRamp(root, 'emerald');
		clearRamp(root, 'cyan');
		root.removeProperty('--team-primary');
		root.removeProperty('--team-secondary');
		root.removeProperty('--team-on-primary');
		document.documentElement.removeAttribute('data-team-theme');
		setMetaThemeColor(DEFAULT_THEME_COLOR);
		return;
	}

	const primary = readableAccent(colors.primaryColor);
	const secondary = readableAccent(colors.secondaryColor);
	setRamp(root, 'emerald', buildRamp(primary, colors.darkColor));
	setRamp(root, 'cyan', buildRamp(secondary, colors.darkColor));
	root.setProperty('--team-primary', primary);
	root.setProperty('--team-secondary', secondary);
	root.setProperty('--team-on-primary', contrastText(primary));
	document.documentElement.setAttribute('data-team-theme', 'on');
	setMetaThemeColor(mix(colors.primaryColor, colors.darkColor, 0.7));
}
