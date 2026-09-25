import { StrictMode, Component, type ReactNode, type ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

type ErrorBoundaryState = { error: Error | null };

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
	state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error('Erreur React non gérée :', error, info.componentStack);
	}

	render() {
		if (this.state.error) {
			return (
				<div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
					<div className="text-center max-w-md">
						<p className="text-4xl mb-4">⚠️</p>
						<h1 className="text-xl font-black text-slate-100 mb-2">Une erreur est survenue</h1>
						<p className="text-slate-400 text-sm mb-6">{this.state.error.message}</p>
						<button
							onClick={() => window.location.reload()}
							className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm transition-colors"
						>
							Recharger la page
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

// Le service worker est enregistré par useServiceWorkerUpdate (App), qui
// pilote aussi la bannière de mise à jour.
createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</StrictMode>,
);

// Le splash HTML statique n'a plus d'utilité une fois React monté.
document.getElementById('app-loader')?.remove();
