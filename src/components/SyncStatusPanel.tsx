import { SYNC_ALERT_THRESHOLD, useSyncStatus } from '../hooks/useSyncStatus';

const relativeFormatter = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });

// « il y a 3 minutes », « il y a 2 heures », « hier »…
function relative(iso: string | null): string {
	if (!iso) return 'jamais';
	const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
	const abs = Math.abs(diffSec);
	if (abs < 60) return relativeFormatter.format(diffSec, 'second');
	if (abs < 3600) return relativeFormatter.format(Math.round(diffSec / 60), 'minute');
	if (abs < 86400) return relativeFormatter.format(Math.round(diffSec / 3600), 'hour');
	return relativeFormatter.format(Math.round(diffSec / 86400), 'day');
}

export default function SyncStatusPanel() {
	const status = useSyncStatus();

	if (!status) return <p className="text-xs text-slate-500">Chargement…</p>;

	const failing = status.consecutive_failures >= SYNC_ALERT_THRESHOLD;
	const degraded = status.consecutive_failures > 0 && !failing;

	return (
		<div
			className={`rounded-lg border px-3 py-3 text-xs flex flex-col gap-1 ${
				failing
					? 'border-rose-500/60 bg-rose-950/40 text-rose-200'
					: degraded
						? 'border-amber-500/50 bg-amber-950/30 text-amber-200'
						: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
			}`}
			role="status"
		>
			<p className="font-black text-sm">
				{failing
					? '⚠️ Synchronisation en échec'
					: degraded
						? '⏳ Synchronisation perturbée'
						: status.last_success_at
							? '✅ Synchronisation opérationnelle'
							: '⏳ En attente de la première synchronisation'}
			</p>
			<p className="text-slate-300">Dernière réussite : {relative(status.last_success_at)}</p>
			{status.consecutive_failures > 0 && (
				<>
					<p className="text-slate-300">
						{status.consecutive_failures} échec{status.consecutive_failures > 1 ? 's' : ''} consécutif
						{status.consecutive_failures > 1 ? 's' : ''} · dernière tentative {relative(status.last_attempt_at)}
					</p>
					{status.last_error && <p className="text-[11px] text-slate-400 break-words">{status.last_error}</p>}
				</>
			)}
			{failing && <p className="text-[11px] text-rose-300">Les scores affichés peuvent être en retard.</p>}
		</div>
	);
}
