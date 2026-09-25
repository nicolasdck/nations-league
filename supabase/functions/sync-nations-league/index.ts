// Appelée par pg_cron (migration …_sync_cron.sql) via pg_net :
//   ?mode=live  toutes les minutes : ne sollicite ESPN que si un match est en
//               cours ou imminent en base (sinon retour immédiat) ;
//   ?mode=full  toutes les 30 min : synchro complète (calendrier, reports,
//               groupes, horaires).
//
// Déploiement : supabase functions deploy sync-nations-league --no-verify-jwt
// Protégée par le même secret interne que send-goal-notification
// (en-tête x-webhook-secret = GOAL_WEBHOOK_SECRET).
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../_shared/database.types.ts';
import { hasActiveOrImminentMatch, runSync } from '../_shared/nations-league-sync.ts';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
	const expectedSecret = Deno.env.get('GOAL_WEBHOOK_SECRET');
	if (!expectedSecret || req.headers.get('x-webhook-secret') !== expectedSecret) {
		return json({ error: 'unauthorized' }, 401);
	}

	const url = new URL(req.url);
	const mode = url.searchParams.get('mode') === 'full' ? 'full' : 'live';
	const dryRun = url.searchParams.get('dryRun') === '1';

	try {
		const supabase = createClient<Database>(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
			{ auth: { persistSession: false, autoRefreshToken: false } },
		);

		if (mode === 'live' && !(await hasActiveOrImminentMatch(supabase))) {
			return json({ mode, skipped: 'aucun match en cours ou imminent' });
		}

		const summary = await runSync(supabase, { scope: mode, dryRun });
		return json({ mode, dryRun, ...summary });
	} catch (error) {
		console.error('sync-nations-league a échoué :', error);
		// 200 pour ne pas polluer l'historique pg_net d'erreurs en cascade ; le
		// détail reste uniquement dans les logs de la fonction.
		return json({ mode, error: 'sync failed' });
	}
});
