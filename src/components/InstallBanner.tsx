type InstallBannerProps = {
	mode: 'prompt' | 'ios';
	onInstall: () => void;
	onDismiss: () => void;
};

// Incite à installer la PWA : bouton natif (beforeinstallprompt) sur
// Chrome/Edge/Android, instructions manuelles sur iOS Safari.
export default function InstallBanner({ mode, onInstall, onDismiss }: InstallBannerProps) {
	return (
		<div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-slide-up">
			<div className="mx-auto max-w-xl rounded-2xl bg-slate-900/95 backdrop-blur border border-slate-700 shadow-2xl shadow-black/50 p-4">
				<div className="flex items-start gap-3">
					<img src="/pwa-192x192.png" alt="" className="w-12 h-12 rounded-xl shrink-0" />
					<div className="flex-1 min-w-0">
						<p className="text-sm font-black text-slate-100">Installer l'application</p>
						{mode === 'prompt' ? (
							<p className="text-xs text-slate-400 mt-0.5">
								Accès en un geste, plein écran et alertes de buts même app fermée.
							</p>
						) : (
							<p className="text-xs text-slate-400 mt-0.5">
								Touchez <span className="font-bold text-slate-200">Partager</span>{' '}
								<span aria-hidden>⎋</span> puis{' '}
								<span className="font-bold text-slate-200">Sur l'écran d'accueil</span> pour
								recevoir les alertes de buts.
							</p>
						)}
					</div>
					<button
						onClick={onDismiss}
						className="text-slate-500 hover:text-slate-300 text-xl leading-none -mt-1"
						aria-label="Masquer"
					>
						×
					</button>
				</div>
				{mode === 'prompt' && (
					<div className="mt-3 flex gap-2">
						<button
							onClick={onDismiss}
							className="flex-1 rounded-lg border border-slate-700 py-2.5 text-xs font-bold text-slate-300"
						>
							Plus tard
						</button>
						<button
							onClick={onInstall}
							className="flex-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 py-2.5 text-xs font-black text-slate-950 transition-colors"
						>
							Installer
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
