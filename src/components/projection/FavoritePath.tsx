import type { Team } from '../../types/competition';
import type { PathStep } from '../../utils/projection';

type FavoritePathProps = {
	team: Team;
	steps: PathStep[];
};

const DOT_STYLES: Record<PathStep['result'], string> = {
	win: 'bg-emerald-500 border-emerald-300',
	loss: 'bg-rose-600 border-rose-400',
	neutral: 'bg-slate-600 border-slate-400',
};

export default function FavoritePath({ team, steps }: FavoritePathProps) {
	return (
		<section className="rounded-xl border border-emerald-500/50 bg-linear-to-br from-emerald-950/60 to-slate-900 p-4">
			<h3 className="flex items-center gap-2 text-sm font-black text-slate-100 mb-3">
				<span className="flags text-2xl leading-none">{team.flag}</span>
				Parcours projeté · {team.name}
			</h3>
			<ol className="relative border-l-2 border-slate-700 ml-2 flex flex-col gap-3">
				{steps.map((step, index) => (
					<li key={`${step.stage}-${index}`} className="pl-4 relative">
						<span
							className={`absolute -left-[0.44rem] top-1 w-3 h-3 rounded-full border-2 ${DOT_STYLES[step.result]}`}
						/>
						<p className="text-xs font-black text-emerald-300">{step.title}</p>
						<p className="text-xs text-slate-300 leading-snug">{step.detail}</p>
					</li>
				))}
			</ol>
		</section>
	);
}
