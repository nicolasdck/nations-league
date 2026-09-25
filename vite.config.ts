import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	define: {
		// Horodatage du build, affiché dans Réglages pour identifier la version servie.
		__APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
	},
	build: {
		rollupOptions: {
			output: {
				// Bibliothèques (React, Supabase) dans un fichier séparé : il ne
				// change pas d'un déploiement à l'autre et reste en cache, une mise
				// à jour de l'app ne retélécharge que son propre code.
				manualChunks(id) {
					if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
					if (id.includes('node_modules/@supabase')) return 'supabase';
					return undefined;
				},
			},
		},
	},
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			// 'prompt' : le nouveau SW attend la confirmation de l'utilisateur
			// (UpdateBanner) au lieu de recharger la page en plein match.
			registerType: 'prompt',
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'sw.ts',
			injectManifest: {
				injectionPoint: 'self.__WB_MANIFEST',
				globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
				// Image source des icônes (2 Mo) : inutile hors ligne.
				globIgnores: ['**/logo.png'],
			},
			devOptions: {
				enabled: false,
				type: 'module',
			},
			includeAssets: ['favicon.png', 'apple-touch-icon.png'],
			manifest: {
				id: '/',
				name: 'Ligue des Nations UEFA 2026-27',
				short_name: 'Nations League',
				description:
					'Calendrier, résultats en direct, classements et projections de la Ligue des Nations UEFA.',
				lang: 'fr',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				orientation: 'portrait',
				theme_color: '#020617',
				background_color: '#020617',
				icons: [
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'pwa-maskable-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
		}),
	],
});
