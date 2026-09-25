import { useMemo, useState } from 'react';
import type { TeamsById } from '../../types/competition';
import type { ProjectedTie } from '../../utils/projection';
import type { StandingRow } from '../../utils/standings';
import TieCard from './TieCard';

type GlobalBracketProps = {
	quarterFinals: ProjectedTie[];
	semiFinals: ProjectedTie[];
	final: ProjectedTie | null;
	standingsByGroup: Record<string, StandingRow[]>;
	teamsById: TeamsById;
	favoriteTeamId: string | null;
};

type Side = 'right' | 'left';
type Point = { x: number; y: number };

type Leaf = Point & {
	key: string;
	tie: ProjectedTie;
	teamId: string;
	seed: string | null;
	isWinner: boolean;
};

type Node = Point & {
	key: string;
	tie: ProjectedTie;
	winnerId: string;
	official: boolean;
};

type Line = { key: string; x1: number; y1: number; x2: number; y2: number; official: boolean };

// Anneaux concentriques (rayon en % depuis le centre 50/50), de l'extérieur
// vers l'intérieur : les 8 quarts de finalistes, les vainqueurs des quarts,
// ceux des demi-finales, puis la finale au centre.
const RADIUS = { leaf: 42, afterQF: 29, afterSF: 16 };

function polar(angleDeg: number, radius: number): Point {
	const rad = (angleDeg * Math.PI) / 180;
	return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

const isOfficial = (tie: ProjectedTie) => tie.legs.length > 0 && tie.legs.every((l) => l.isReal);

// Les deux quarts qui alimentent une demi-finale, dans l'ordre (équipe A puis B).
function feedersOf(semi: ProjectedTie, quarterFinals: ProjectedTie[]): ProjectedTie[] {
	return [semi.teamAId, semi.teamBId]
		.map((teamId) => quarterFinals.find((qf) => qf.winnerId === teamId))
		.filter((qf): qf is ProjectedTie => Boolean(qf));
}

// Une moitié du tableau (2 quarts → 1 demie) disposée sur un demi-cercle :
// 4 équipes régulièrement espacées, chaque vainqueur un anneau plus au centre,
// à mi-angle des deux matchs qui l'alimentent.
function buildHalf(
	semi: ProjectedTie,
	quarterFinals: ProjectedTie[],
	side: Side,
	seedOf: (teamId: string) => string | null,
) {
	const start = side === 'right' ? -90 : 90;
	const leafAngle = (index: number) => start + 180 * ((index + 0.5) / 4);
	const leaves: Leaf[] = [];
	const nodes: Node[] = [];
	const lines: Line[] = [];

	const pushLine = (from: Point, to: Point, official: boolean) =>
		lines.push({ key: `${side}-${lines.length}`, x1: from.x, y1: from.y, x2: to.x, y2: to.y, official });

	const qfAngles: number[] = [];
	feedersOf(semi, quarterFinals).forEach((qf, i) => {
		const aA = leafAngle(2 * i);
		const aB = leafAngle(2 * i + 1);
		const aMid = (aA + aB) / 2;
		qfAngles.push(aMid);
		const official = isOfficial(qf);
		const node = polar(aMid, RADIUS.afterQF);

		for (const [teamId, angle] of [
			[qf.teamAId, aA],
			[qf.teamBId, aB],
		] as const) {
			const p = polar(angle, RADIUS.leaf);
			leaves.push({ key: `${qf.id}-${teamId}`, tie: qf, teamId, seed: seedOf(teamId), isWinner: qf.winnerId === teamId, ...p });
			pushLine(p, node, official);
		}
		nodes.push({ key: `n-${qf.id}`, tie: qf, winnerId: qf.winnerId, official, ...node });
	});

	if (qfAngles.length === 2) {
		const aMid = (qfAngles[0] + qfAngles[1]) / 2;
		const official = isOfficial(semi);
		const node = polar(aMid, RADIUS.afterSF);
		for (const a of qfAngles) pushLine(polar(a, RADIUS.afterQF), node, official);
		pushLine(node, { x: 50, y: 50 }, official);
		nodes.push({ key: `n-${semi.id}`, tie: semi, winnerId: semi.winnerId, official, ...node });
	}

	return { leaves, nodes, lines };
}

export default function GlobalBracket({
	quarterFinals,
	semiFinals,
	final,
	standingsByGroup,
	teamsById,
	favoriteTeamId,
}: GlobalBracketProps) {
	const [selectedTieId, setSelectedTieId] = useState<string | null>(null);

	// « 1A1 » = 1er du groupe A1, « 2A3 » = 2e du groupe A3.
	const seedOf = useMemo(() => {
		const seeds = new Map<string, string>();
		for (const [groupId, rows] of Object.entries(standingsByGroup)) {
			if (!groupId.startsWith('A')) continue;
			for (const row of rows) if (row.position <= 2) seeds.set(row.teamId, `${row.position}${groupId}`);
		}
		return (teamId: string) => seeds.get(teamId) ?? null;
	}, [standingsByGroup]);

	const layout = useMemo(() => {
		if (semiFinals.length !== 2) return null;
		const right = buildHalf(semiFinals[0], quarterFinals, 'right', seedOf);
		const left = buildHalf(semiFinals[1], quarterFinals, 'left', seedOf);
		return {
			leaves: [...right.leaves, ...left.leaves],
			nodes: [...right.nodes, ...left.nodes],
			lines: [...right.lines, ...left.lines],
		};
	}, [semiFinals, quarterFinals, seedOf]);

	if (!layout) return null;

	const allTies = [...quarterFinals, ...semiFinals, ...(final ? [final] : [])];
	const selectedTie = allTies.find((t) => t.id === selectedTieId) ?? null;
	const champion = final ? teamsById[final.winnerId] : undefined;
	const tieLabel = (tie: ProjectedTie) =>
		tie.stage === 'F' ? 'Finale' : tie.stage === 'SF' ? `Demi-finale ${tie.id.replace('SF', '')}` : `Quart ${tie.id.replace('QF', '')}`;
	const toggle = (tie: ProjectedTie) => setSelectedTieId((current) => (current === tie.id ? null : tie.id));

	return (
		<div className="flex flex-col">
			<div className="relative w-full max-w-md mx-auto aspect-square my-4 px-6">
				<svg
					viewBox="0 0 100 100"
					className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
					aria-hidden
				>
					{[RADIUS.leaf, RADIUS.afterQF, RADIUS.afterSF].map((r) => (
						<circle key={r} cx={50} cy={50} r={r} fill="none" stroke="currentColor" strokeWidth={0.15} className="text-slate-800/80" />
					))}
					{layout.lines.map((l) => (
						<line
							key={l.key}
							x1={l.x1}
							y1={l.y1}
							x2={l.x2}
							y2={l.y2}
							stroke="currentColor"
							strokeWidth={0.35}
							strokeDasharray={l.official ? undefined : '1 0.8'}
							className={l.official ? 'text-emerald-600' : 'text-slate-600'}
						/>
					))}
				</svg>

				{layout.leaves.map((leaf) => {
					const team = teamsById[leaf.teamId];
					const isFav = leaf.teamId === favoriteTeamId;
					return (
						<button
							key={leaf.key}
							onClick={() => toggle(leaf.tie)}
							style={{ left: `${leaf.x}%`, top: `${leaf.y}%` }}
							title={team?.name}
							className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-0.5 rounded-xl border px-2 py-1 leading-none whitespace-nowrap transition-colors ${
								isFav
									? 'border-amber-400 bg-amber-950/70 text-amber-200'
									: leaf.isWinner
										? 'border-emerald-500 bg-emerald-950/70 text-emerald-200'
										: 'border-slate-800 bg-slate-900/80 text-slate-500'
							} ${selectedTieId === leaf.tie.id ? 'ring-2 ring-cyan-400/70' : ''}`}
						>
							<span className="flex items-center gap-1 text-[11px] font-black">
								<span className="flags text-sm">{team?.flag ?? '🏳️'}</span>
								{team?.id ?? leaf.teamId}
							</span>
							{leaf.seed && <span className="text-[8px] font-bold text-slate-500">{leaf.seed}</span>}
						</button>
					);
				})}

				{layout.nodes.map((node) => {
					const team = teamsById[node.winnerId];
					const isFav = node.winnerId === favoriteTeamId;
					return (
						<button
							key={node.key}
							onClick={() => toggle(node.tie)}
							style={{ left: `${node.x}%`, top: `${node.y}%` }}
							title={`${tieLabel(node.tie)} : ${team?.name ?? node.winnerId}`}
							className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
								node.official ? 'border-solid' : 'border-dashed'
							} ${isFav ? 'border-amber-400 bg-amber-950/80' : 'border-emerald-500/80 bg-slate-900'} ${
								selectedTieId === node.tie.id ? 'ring-2 ring-cyan-400/70' : ''
							}`}
						>
							<span className="flags text-lg leading-none">{team?.flag ?? '?'}</span>
						</button>
					);
				})}

				<button
					onClick={() => final && toggle(final)}
					style={{ width: '17%', height: '17%' }}
					title={champion ? `Vainqueur projeté : ${champion.name}` : 'Finale'}
					className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 rounded-full bg-linear-to-br from-amber-300 to-amber-600 border-2 border-amber-200 shadow-lg shadow-amber-500/40 flex items-center justify-center ${
						selectedTieId === 'F' ? 'ring-2 ring-cyan-400/70' : ''
					}`}
				>
					<span className="flags text-3xl leading-none">{champion?.flag ?? '🏆'}</span>
				</button>
			</div>

			{champion && (
				<p className="text-center text-xs font-black text-amber-400 uppercase tracking-widest mb-3">
					🏆 {champion.name} — vainqueur {final && isOfficial(final) ? '' : 'projeté'}
				</p>
			)}

			{selectedTie ? (
				<div className="max-w-xs w-full mx-auto animate-fade-in">
					<TieCard tie={selectedTie} label={tieLabel(selectedTie)} teamsById={teamsById} favoriteTeamId={favoriteTeamId} />
				</div>
			) : (
				<p className="text-center text-[10px] text-slate-500">
					Touchez une équipe ou un nœud pour voir la confrontation · traits pointillés = projection
				</p>
			)}
		</div>
	);
}
