import type { ReactNode } from 'react';
import type { NotificationLevel, Team } from '../types/competition';
import type { PushSupport } from '../hooks/usePushNotifications';
import NotificationSettings from './NotificationSettings';
import SyncStatusPanel from './SyncStatusPanel';

type SettingsViewProps = {
	favoriteTeam: Team | null;
	onPickTeam: () => void;
	notificationLevel: NotificationLevel;
	onChangeNotificationLevel: (level: NotificationLevel) => Promise<boolean>;
	push: {
		support: PushSupport;
		isSubscribed: boolean;
		isBusy: boolean;
		subscribe: () => Promise<boolean>;
		unsubscribe: () => Promise<void>;
	};
	fetchedAt: string | null;
};

function Card({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
			<h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">{title}</h2>
			{children}
		</section>
	);
}

export default function SettingsView({
	favoriteTeam,
	onPickTeam,
	notificationLevel,
	onChangeNotificationLevel,
	push,
	fetchedAt,
}: SettingsViewProps) {
	return (
		<div className="flex flex-col gap-4">
			<Card title="Équipe préférée">
				<button
					onClick={onPickTeam}
					className="w-full flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-left"
				>
					<span className="flags text-3xl leading-none">{favoriteTeam?.flag ?? '⭐'}</span>
					<span className="flex-1">
						<span className="block text-sm font-black text-slate-100">
							{favoriteTeam?.name ?? 'Aucune équipe'}
						</span>
						<span className="block text-[11px] text-slate-500">
							L'app adopte les couleurs de votre équipe
						</span>
					</span>
					{favoriteTeam && (
						<span className="flex gap-1" aria-hidden>
							<span className="w-4 h-4 rounded-full border border-slate-700" style={{ background: favoriteTeam.primaryColor }} />
							<span className="w-4 h-4 rounded-full border border-slate-700" style={{ background: favoriteTeam.secondaryColor }} />
						</span>
					)}
					<span className="text-slate-500">›</span>
				</button>
			</Card>

			<Card title="Alertes de buts">
				<NotificationSettings
					level={notificationLevel}
					favoriteTeam={favoriteTeam}
					support={push.support}
					isSubscribed={push.isSubscribed}
					isBusy={push.isBusy}
					onChangeLevel={onChangeNotificationLevel}
					subscribe={push.subscribe}
					unsubscribe={push.unsubscribe}
				/>
			</Card>

			<Card title="Synchronisation des scores">
				<SyncStatusPanel />
			</Card>

			<Card title="À propos">
				<ul className="text-xs text-slate-400 flex flex-col gap-1.5">
					<li>Scores synchronisés automatiquement pendant les matchs, mises à jour en temps réel.</li>
					{fetchedAt && (
						<li>
							Dernière lecture complète :{' '}
							{new Date(fetchedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
						</li>
					)}
					<li>Version {__APP_VERSION__}</li>
				</ul>
			</Card>
		</div>
	);
}
