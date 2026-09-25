type UpdateBannerProps = {
	onRefresh: () => void;
	onDismiss: () => void;
};

// Affichée quand un nouveau service worker est installé et en attente.
export default function UpdateBanner({ onRefresh, onDismiss }: UpdateBannerProps) {
	return (
		<div
			role="status"
			aria-live="polite"
			className="fixed inset-x-0 top-0 z-60 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] animate-slide-down"
		>
			<div className="mx-auto max-w-xl flex items-center gap-3 rounded-xl bg-slate-900/95 backdrop-blur border border-emerald-500/60 shadow-lg shadow-black/40 px-4 py-3">
				<span className="text-xl" aria-hidden>
					✨
				</span>
				<p className="flex-1 text-sm text-slate-100 font-semibold leading-tight">
					Une nouvelle version est disponible
				</p>
				<button
					onClick={onRefresh}
					className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950 transition-colors"
				>
					Rafraîchir
				</button>
				<button
					onClick={onDismiss}
					className="text-slate-500 hover:text-slate-300 text-lg leading-none px-1"
					aria-label="Plus tard"
					title="Plus tard"
				>
					×
				</button>
			</div>
		</div>
	);
}
