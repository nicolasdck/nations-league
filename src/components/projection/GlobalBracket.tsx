import { useState, type ReactNode } from 'react';
import type { TeamsById } from '../../types/competition';
import type { BracketModel, BracketSlot, BracketTie } from '../../utils/bracketModel';

type GlobalBracketProps = {
	model: BracketModel;
	teamsById: TeamsById;
	favoriteTeamId: string | null;
	// Détail affiché sous le cercle quand une confrontation est sélectionnée.
	renderDetail: (tie: BracketTie) => ReactNode;
	championCaption: (teamName: string) => string;
};

type Point = { x: number; y: number };
type Leaf = Point & { key: string; tie: BracketTie; slot: BracketSlot };
type Node = Point & { key: string; tie: BracketTie };
type Line = { key: string; x1: number; y1: number; x2: number; y2: number; official: boolean };

// Anneaux concentriques (rayon en % depuis le centre 50/50), de l'extérieur
// vers l'intérieur : les 8 quarts de finalistes, les vainqueurs des quarts,
// ceux des demi-finales, puis la finale au centre.
const RADIUS = { leaf: 42, afterQF: 29, afterSF: 16 };

function polar(angleDeg: number, radius: number): Point {
	const rad = (angleDeg * Math.PI) / 180;
	return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

// Une moitié du tableau (2 quarts → 1 demie) disposée sur un demi-cercle :
// 4 équipes régulièrement espacées, chaque vainqueur un anneau plus au centre,
// à mi-angle des deux confrontations qui l'alimentent.
function buildHalf(half: BracketModel['halves'][number], side: 'right' | 'left') {
	const start = side === 'right' ? -90 : 90;
	const leafAngle = (index: number) => start + 180 * ((index + 0.5) / 4);
	const leaves: Leaf[] = [];
	const nodes: Node[] = [];
	const lines: Line[] = [];
	const pushLine = (from: Point, to: Point, official: boolean) =>
		lines.push({ key: `${side}-${lines.length}`, x1: from.x, y1: from.y, x2: to.x, y2: to.y, official });

	const qfAngles = half.quarterFinals.map((qf, i) => {
		const aA = leafAngle(2 * i);
		const aB = leafAngle(2 * i + 1);
		const aMid = (aA + aB) / 2;
		const node = polar(aMid, RADIUS.afterQF);
		qf.slots.forEach((slot, s) => {
			const p = polar(s === 0 ? aA : aB, RADIUS.leaf);
			leaves.push({ key: `${qf.id}-${s}`, tie: qf, slot, ...p });
			pushLine(p, node, qf.official);
		});
		nodes.push({ key: `n-${qf.id}`, tie: qf, ...node });
		return aMid;
	});

	const aSf = (qfAngles[0] + qfAngles[1]) / 2;
	const sfNode = polar(aSf, RADIUS.afterSF);
	for (const a of qfAngles) pushLine(polar(a, RADIUS.afterQF), sfNode, half.semiFinal.official);
	pushLine(sfNode, { x: 50, y: 50 }, half.semiFinal.official);
	nodes.push({ key: `n-${half.semiFinal.id}`, tie: half.semiFinal, ...sfNode });

	return { leaves, nodes, lines };
}

export default function GlobalBracket({
	model,
	teamsById,
	favoriteTeamId,
	renderDetail,
	championCaption,
}: GlobalBracketProps) {
	const [selectedTieId, setSelectedTieId] = useState<string | null>(null);

	const right = buildHalf(model.halves[0], 'right');
	const left = buildHalf(model.halves[1], 'left');
	const leaves = [...right.leaves, ...left.leaves];
	const nodes = [...right.nodes, ...left.nodes];
	const lines = [...right.lines, ...left.lines];

	const allTies = [...model.halves.flatMap((h) => [...h.quarterFinals, h.semiFinal]), model.final];
	const selectedTie = allTies.find((t) => t.id === selectedTieId) ?? null;
	const champion = model.championId ? teamsById[model.championId] : undefined;
	const toggle = (tie: BracketTie) => setSelectedTieId((current) => (current === tie.id ? null : tie.id));
	const ring = (tie: BracketTie) => (selectedTieId === tie.id ? 'ring-2 ring-cyan-400/70' : '');

	return (
		<div className="flex flex-col">
			<div className="relative w-full max-w-md mx-auto aspect-square my-4 px-6">
				<svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" aria-hidden>
					{[RADIUS.leaf, RADIUS.afterQF, RADIUS.afterSF].map((r) => (
						<circle key={r} cx={50} cy={50} r={r} fill="none" stroke="currentColor" strokeWidth={0.15} className="text-slate-800/80" />
					))}
					{lines.map((l) => (
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

				{leaves.map((leaf) => {
					const team = leaf.slot.teamId ? teamsById[leaf.slot.teamId] : undefined;
					const decided = leaf.tie.winnerId !== null;
					const isWinner = decided && leaf.tie.winnerId === leaf.slot.teamId;
					const isFav = leaf.slot.teamId !== null && leaf.slot.teamId === favoriteTeamId;
					return (
						<button
							key={leaf.key}
							onClick={() => toggle(leaf.tie)}
							style={{ left: `${leaf.x}%`, top: `${leaf.y}%` }}
							title={team?.name ?? leaf.slot.label ?? undefined}
							className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-0.5 rounded-xl border px-2 py-1 leading-none whitespace-nowrap transition-colors ${
								isFav
									? 'border-amber-400 bg-amber-950/70 text-amber-200'
									: !team
										? 'border-dashed border-slate-700 bg-slate-950/80 text-slate-500'
										: isWinner
											? 'border-emerald-500 bg-emerald-950/70 text-emerald-200'
											: decided
												? 'border-slate-800 bg-slate-900/80 text-slate-600'
												: 'border-slate-700 bg-slate-900/90 text-slate-200'
							} ${ring(leaf.tie)}`}
						>
							{team ? (
								<>
									<span className="flex items-center gap-1 text-[11px] font-black">
										<span className="flags text-sm">{team.flag}</span>
										{team.id}
									</span>
									{leaf.slot.label && <span className="text-[8px] font-bold text-slate-500">{leaf.slot.label}</span>}
								</>
							) : (
								<span className="text-[9px] font-bold max-w-20 truncate">{leaf.slot.label ?? '?'}</span>
							)}
						</button>
					);
				})}

				{nodes.map((node) => {
					const team = node.tie.winnerId ? teamsById[node.tie.winnerId] : undefined;
					const isFav = node.tie.winnerId !== null && node.tie.winnerId === favoriteTeamId;
					return (
						<button
							key={node.key}
							onClick={() => toggle(node.tie)}
							style={{ left: `${node.x}%`, top: `${node.y}%` }}
							title={`${node.tie.title}${team ? ` : ${team.name}` : ''}`}
							className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
								node.tie.official ? 'border-solid' : 'border-dashed'
							} ${
								isFav
									? 'border-amber-400 bg-amber-950/80'
									: team
										? 'border-emerald-500/80 bg-slate-900'
										: 'border-slate-700 bg-slate-950/70'
							} ${ring(node.tie)}`}
						>
							<span className="flags text-lg leading-none">{team?.flag ?? ''}</span>
						</button>
					);
				})}

				<button
					onClick={() => toggle(model.final)}
					style={{ width: '17%', height: '17%' }}
					title={champion ? championCaption(champion.name) : 'Finale'}
					className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 rounded-full bg-linear-to-br from-amber-300 to-amber-600 border-2 border-amber-200 shadow-lg shadow-amber-500/40 flex items-center justify-center ${ring(model.final)}`}
				>
					<span className="flags text-3xl leading-none">{champion?.flag ?? '🏆'}</span>
				</button>
			</div>

			{champion && (
				<p className="text-center text-xs font-black text-amber-400 uppercase tracking-widest mb-3">
					🏆 {championCaption(champion.name)}
				</p>
			)}

			{selectedTie ? (
				<div className="max-w-sm w-full mx-auto flex flex-col gap-2 animate-fade-in">
					<p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">{selectedTie.title}</p>
					{renderDetail(selectedTie)}
				</div>
			) : (
				<p className="text-center text-[10px] text-slate-500">
					Touchez une équipe ou un nœud pour voir la confrontation
				</p>
			)}
		</div>
	);
}
