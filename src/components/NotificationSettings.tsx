import { useState } from 'react';
import toast from 'react-hot-toast';
import type { NotificationLevel, Team } from '../types/competition';
import type { PushSupport } from '../hooks/usePushNotifications';

type NotificationSettingsProps = {
	level: NotificationLevel;
	favoriteTeam: Team | null;
	support: PushSupport;
	isSubscribed: boolean;
	isBusy: boolean;
	onChangeLevel: (level: NotificationLevel) => Promise<boolean>;
	subscribe: () => Promise<boolean>;
	unsubscribe: () => Promise<void>;
};

const OPTIONS: { id: NotificationLevel; icon: string; label: string }[] = [
	{ id: 'favorite', icon: '⭐', label: 'Mon équipe préférée uniquement' },
	{ id: 'all', icon: '🌍', label: 'Toutes les équipes' },
	{ id: 'none', icon: '🔕', label: 'Aucune notification' },
];

export default function NotificationSettings({
	level,
	favoriteTeam,
	support,
	isSubscribed,
	isBusy,
	onChangeLevel,
	subscribe,
	unsubscribe,
}: NotificationSettingsProps) {
	const [pending, setPending] = useState<NotificationLevel | null>(null);

	// L'état « actif » affiché = niveau choisi ET abonnement navigateur présent.
	const effective: NotificationLevel = isSubscribed ? level : 'none';

	const choose = async (next: NotificationLevel) => {
		if (next === effective || pending) return;
		if (next === 'favorite' && !favoriteTeam) {
			toast.error("Choisissez d'abord votre équipe préférée.");
			return;
		}
		setPending(next);
		try {
			if (next === 'none') {
				await unsubscribe();
			} else if (!isSubscribed) {
				const ok = await subscribe();
				if (!ok) {
					toast.error('Notifications refusées par le navigateur.');
					return;
				}
			}
			const synced = await onChangeLevel(next);
			if (!synced) {
				toast.error('Réglage enregistré sur cet appareil, synchronisation serveur en échec.');
				return;
			}
			toast.success(
				next === 'none'
					? 'Alertes désactivées'
					: next === 'all'
						? 'Alertes activées pour tous les buts'
						: `Alertes activées pour ${favoriteTeam?.name ?? 'votre équipe'}`,
			);
		} catch (error) {
			console.error(error);
			toast.error("Impossible de modifier les alertes.");
		} finally {
			setPending(null);
		}
	};

	if (support === 'unsupported') {
		return (
			<p className="text-xs text-slate-400">
				Ce navigateur ne gère pas les notifications push. Sur iPhone, installez d'abord l'app sur l'écran
				d'accueil (iOS 16.4+).
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{support === 'denied' && (
				<p className="text-xs text-amber-400 mb-1">
					Notifications bloquées : autorisez-les dans les réglages du navigateur pour ce site.
				</p>
			)}
			{OPTIONS.map((option) => {
				const active = effective === option.id;
				const loading = pending === option.id;
				return (
					<button
						key={option.id}
						onClick={() => void choose(option.id)}
						disabled={isBusy || pending !== null || (support === 'denied' && option.id !== 'none')}
						role="radio"
						aria-checked={active}
						className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors disabled:opacity-60 ${
							active ? 'bg-emerald-950/50 border-emerald-400' : 'bg-slate-950 border-slate-800'
						}`}
					>
						<span className="text-xl">{option.icon}</span>
						<span className="flex-1 min-w-0">
							<span className="block text-sm font-bold text-slate-100">{option.label}</span>
							{option.id === 'favorite' && (
								<span className="block text-[11px] text-slate-500">
									{favoriteTeam ? `${favoriteTeam.flag} ${favoriteTeam.name}` : 'Aucune équipe choisie'}
								</span>
							)}
						</span>
						<span
							className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
								active ? 'border-emerald-400' : 'border-slate-600'
							}`}
						>
							{loading ? (
								<span className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
							) : (
								active && <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
							)}
						</span>
					</button>
				);
			})}
		</div>
	);
}
