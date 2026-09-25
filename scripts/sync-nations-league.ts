/**
 * Lancement manuel de la synchronisation ESPN → Supabase depuis un poste.
 * En production, c'est pg_cron qui appelle l'Edge Function sync-nations-league
 * (voir supabase/migrations/…_sync_cron.sql) ; ce script partage exactement le
 * même code (supabase/functions/_shared/nations-league-sync.ts).
 *
 * Usage :
 *   npm run sync        une passe complète
 *   npm run sync:dry    affiche les changements sans écrire
 *   ajouter -- --live   ne lire que les matchs de la veille et du jour (mode du cron)
 *
 * Variables d'environnement (.env) : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/functions/_shared/database.types.ts';
import { runSync } from '../supabase/functions/_shared/nations-league-sync.ts';

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`Variable d'environnement manquante : ${name}`);
		process.exit(1);
	}
	return value;
}

const supabase = createClient<Database>(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
	auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`[${new Date().toISOString()}] Synchronisation`);
runSync(supabase, {
	scope: process.argv.includes('--live') ? 'live' : 'full',
	dryRun: process.argv.includes('--dry-run'),
})
	.then((summary) => process.exit(summary.errors > 0 ? 1 : 0))
	.catch((error: unknown) => {
		console.error('Synchronisation échouée :', error);
		process.exit(1);
	});
