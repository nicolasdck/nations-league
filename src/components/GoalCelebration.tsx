import { useEffect, useRef, useState } from 'react';
import type { Match, TeamsById } from '../types/competition';

export type GoalEvent = {
	key: string;
	matchId: number;
	side: 'home' | 'away';
};

type GoalCelebrationProps = {
	goal: GoalEvent;
	match: Match | undefined;
	teamsById: TeamsById;
	onDone: () => void;
};

const BALL_SIZE = 76;
const BOUNCES = 6;
const FADE_MS = 700;
// Durée de secours si l'animation ne peut pas tourner (mouvement réduit).
const STATIC_DISPLAY_MS = 3200;

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Célébration plein écran : « GOAL! » géant aux couleurs de l'équipe qui
// marque, et un ballon qui rebondit 6 fois contre les bords de l'écran.
// Un toucher ferme tout de suite.
export default function GoalCelebration({ goal, match, teamsById, onDone }: GoalCelebrationProps) {
	const ballRef = useRef<HTMLSpanElement | null>(null);
	const [leaving, setLeaving] = useState(false);

	const scorerId = match ? (goal.side === 'home' ? match.homeTeamId : match.awayTeamId) : null;
	const team = scorerId ? teamsById[scorerId] : undefined;
	const home = match?.homeTeamId ? teamsById[match.homeTeamId] : undefined;
	const away = match?.awayTeamId ? teamsById[match.awayTeamId] : undefined;
	const scorers = match ? (goal.side === 'home' ? match.homeScorers : match.awayScorers) : [];
	const lastScorer = scorers[scorers.length - 1];

	useEffect(() => {
		if ('vibrate' in navigator) navigator.vibrate([120, 60, 120, 60, 300]);
	}, []);

	// Physique du ballon : trajectoire rectiligne, réflexion sur chaque bord,
	// rotation proportionnelle au déplacement.
	useEffect(() => {
		const ball = ballRef.current;
		let frame = 0;
		let timeout = 0;
		const finish = () => {
			setLeaving(true);
			timeout = window.setTimeout(onDone, FADE_MS);
		};

		if (!ball || prefersReducedMotion()) {
			timeout = window.setTimeout(finish, STATIC_DISPLAY_MS);
			return () => window.clearTimeout(timeout);
		}

		const width = window.innerWidth - BALL_SIZE;
		const height = window.innerHeight - BALL_SIZE;
		// ~6 rebonds en 3,5 s environ quelle que soit la taille d'écran.
		const speed = Math.max(width, height) / 520;
		const angle = (Math.PI / 180) * (25 + Math.random() * 40);
		let x = Math.random() * width * 0.3;
		let y = height * (0.15 + Math.random() * 0.3);
		let vx = speed * Math.cos(angle) * (Math.random() < 0.5 ? -1 : 1);
		let vy = speed * Math.sin(angle);
		let rotation = 0;
		let bounces = 0;
		let last = performance.now();

		const step = (now: number) => {
			const dt = Math.min(now - last, 32);
			last = now;
			x += vx * dt;
			y += vy * dt;
			rotation += (Math.abs(vx) + Math.abs(vy)) * dt * 0.9;

			if (x <= 0 || x >= width) {
				x = Math.min(Math.max(x, 0), width);
				vx = -vx;
				bounces++;
			}
			if (y <= 0 || y >= height) {
				y = Math.min(Math.max(y, 0), height);
				vy = -vy;
				bounces++;
			}
			// Écrasement bref du ballon au contact d'un bord.
			const nearEdge = x < 4 || x > width - 4 || y < 4 || y > height - 4;
			ball.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg) scale(${nearEdge ? 0.88 : 1})`;

			if (bounces >= BOUNCES) {
				finish();
				return;
			}
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);

		return () => {
			cancelAnimationFrame(frame);
			window.clearTimeout(timeout);
		};
	}, [onDone]);

	const primary = team?.primaryColor ?? 'var(--color-emerald-500)';
	const secondary = team?.secondaryColor ?? 'var(--color-cyan-500)';

	return (
		<div
			className={`fixed inset-0 z-100 overflow-hidden transition-opacity duration-700 ${leaving ? 'opacity-0' : 'opacity-100'}`}
			onClick={onDone}
			role="alert"
			aria-live="assertive"
			aria-label={`But ${team?.name ?? ''}`}
			style={{
				background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${primary} 45%, transparent), rgb(2 6 23 / 0.92) 70%)`,
			}}
		>
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 pointer-events-none select-none">
				<span className="flags text-6xl animate-goal-pop">{team?.flag ?? '⚽'}</span>
				<h2
					className="animate-goal-pop text-[clamp(4.5rem,24vw,11rem)] font-black italic leading-none tracking-tight text-transparent bg-clip-text drop-shadow-[0_6px_24px_rgba(0,0,0,0.6)]"
					style={{ backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${primary} 55%, ${secondary} 100%)` }}
				>
					GOAL!
				</h2>
				{match && (
					<div className="animate-goal-rise flex flex-col items-center gap-1 rounded-2xl border border-white/15 bg-slate-950/70 backdrop-blur px-5 py-3 text-center">
						<p className="flex items-center gap-2 text-xl font-black text-white tabular-nums">
							<span className="flags">{home?.flag}</span>
							{home?.id ?? match.placeholderHome} {match.homeScore ?? 0} - {match.awayScore ?? 0}{' '}
							{away?.id ?? match.placeholderAway}
							<span className="flags">{away?.flag}</span>
						</p>
						{lastScorer && <p className="text-sm font-bold text-slate-200">⚽ {lastScorer}</p>}
						{team && <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{team.name}</p>}
					</div>
				)}
			</div>

			<span
				ref={ballRef}
				className="absolute left-0 top-0 flex items-center justify-center text-[64px] leading-none drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)] will-change-transform pointer-events-none"
				style={{ width: BALL_SIZE, height: BALL_SIZE }}
				aria-hidden
			>
				⚽
			</span>
		</div>
	);
}
