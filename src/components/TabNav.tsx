import { TABS, type ActiveTab } from '../data/tabs';

type TabNavProps = {
	activeTab: ActiveTab;
	onTabChange: (tab: ActiveTab) => void;
	liveCount: number;
};

export default function TabNav({ activeTab, onTabChange, liveCount }: TabNavProps) {
	return (
		<nav className="bg-slate-950/95 backdrop-blur border-b border-slate-800 sticky top-0 z-40 px-1">
			<div className="max-w-3xl mx-auto grid grid-cols-4">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						onClick={() => onTabChange(tab.id)}
						aria-current={activeTab === tab.id ? 'page' : undefined}
						className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition-all border-b-2 ${
							activeTab === tab.id
								? 'text-emerald-400 border-emerald-400 bg-slate-900/50'
								: 'text-slate-400 border-transparent'
						}`}
					>
						<span className="text-lg leading-none">{tab.icon}</span>
						{tab.label}
						{tab.id === 'matches' && liveCount > 0 && (
							<span className="absolute top-1.5 right-[calc(50%-1.6rem)] min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[9px] leading-4 font-black text-white animate-pulse">
								{liveCount}
							</span>
						)}
					</button>
				))}
			</div>
		</nav>
	);
}
