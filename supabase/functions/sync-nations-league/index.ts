// Appelée par pg_cron (migration …_sync_cron.sql) via pg_net :
//   ?mode=live  toutes les minutes : ne sollicite ESPN que si un match est en
//               cours ou imminent en base (sinon retour immédiat) ;
//   ?mode=full  toutes les 30 min : synchro complète (calendrier, reports,
//               groupes, horaires). Hors période de matchs (aucun match à ±2
//               jours), elle n'est effectuée que toutes les 2 h.
//
// Chaque tentative réelle met à jour public.sync_status ; au 3e échec
// consécutif, un e-mail d'alerte part (puis un e-mail au rétablissement) si
// RESEND_API_KEY et ALERT_EMAIL_TO sont configurés.
//
// Déploiement : supabase functions deploy sync-nations-league --no-verify-jwt
// Protégée par le même secret interne que send-goal-notification
// (en-tête x-webhook-secret = GOAL_WEBHOOK_SECRET).
import { createClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../_shared/database.types.ts';
import {
	hasActiveOrImminentMatch,
	hasMatchNear,
	runSync,
	type SyncClient,
	type SyncSummary,
} from '../_shared/nations-league-sync.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const MATCH_PERIOD_WINDOW_MS = 2 * DAY_MS;
const OFF_PERIOD_FULL_INTERVAL_MS = 2 * 60 * 60 * 1000;
// Petite marge : le cron de 2 h pile ne doit pas être sauté pour quelques
// secondes d'écart avec la réussite précédente.
const INTERVAL_TOLERANCE_MS = 2 * 60 * 1000;
const ALERT_THRESHOLD = 3;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type SyncStatus = Tables<'sync_status'>;

async function readStatus(supabase: SyncClient): Promise<SyncStatus | null> {
	const { data, error } = await supabase.from('sync_status').select('*').eq('id', 'espn').maybeSingle();
	if (error) console.error('Lecture de sync_status impossible :', error.message);
	return data;
}

// E-mail via Resend (facultatif). N'échoue jamais : une alerte ratée ne doit
// pas masquer le résultat de la synchro.
async function sendAlertEmail(subject: string, text: string): Promise<boolean> {
	const apiKey = Deno.env.get('RESEND_API_KEY');
	const to = Deno.env.get('ALERT_EMAIL_TO');
	if (!apiKey || !to) return false;
	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: Deno.env.get('ALERT_EMAIL_FROM') ?? 'Nations League <onboarding@resend.dev>',
				to: [to],
				subject,
				text,
			}),
		});
		if (!res.ok) console.error(`Envoi de l'e-mail d'alerte impossible : HTTP ${res.status} ${await res.text()}`);
		return res.ok;
	} catch (error) {
		console.error("Envoi de l'e-mail d'alerte impossible :", error);
		return false;
	}
}

function shortError(error: unknown): string {
	const message =
		error instanceof Error
			? error.message
			: typeof error === 'object' && error !== null && 'message' in error
				? String((error as { message: unknown }).message)
				: String(error);
	return message.slice(0, 300);
}

async function recordSuccess(supabase: SyncClient, previous: SyncStatus | null, full: boolean) {
	const now = new Date().toISOString();
	const { error } = await supabase
		.from('sync_status')
		.update({
			last_attempt_at: now,
			last_success_at: now,
			...(full ? { last_full_success_at: now } : {}),
			consecutive_failures: 0,
			last_error: null,
			alerted_at: null,
		})
		.eq('id', 'espn');
	if (error) console.error('Mise à jour de sync_status impossible :', error.message);

	if (previous?.alerted_at) {
		await sendAlertEmail(
			'✅ Nations League : synchronisation rétablie',
			`La synchronisation ESPN fonctionne de nouveau (${now}).\nPanne signalée depuis ${previous.alerted_at}, ${previous.consecutive_failures} échec(s) consécutif(s).`,
		);
	}
}

async function recordFailure(supabase: SyncClient, previous: SyncStatus | null, message: string) {
	const now = new Date().toISOString();
	const failures = (previous?.consecutive_failures ?? 0) + 1;
	let alertedAt = previous?.alerted_at ?? null;

	if (failures >= ALERT_THRESHOLD && !alertedAt) {
		const sent = await sendAlertEmail(
			`⚠️ Nations League : synchronisation en échec (${failures} fois)`,
			[
				`La synchronisation des scores ESPN a échoué ${failures} fois de suite.`,
				`Dernière erreur : ${message}`,
				`Dernière réussite : ${previous?.last_success_at ?? 'jamais'}`,
				'',
				'Les scores de l’app peuvent être figés. Détails : Supabase > Edge Functions > sync-nations-league > Logs.',
			].join('\n'),
		);
		// Marquée même sans e-mail configuré : l'état « alerte » reste visible
		// dans Réglages et l'e-mail de rétablissement n'est tenté qu'une fois.
		alertedAt = sent || !Deno.env.get('RESEND_API_KEY') ? now : null;
	}

	const { error } = await supabase
		.from('sync_status')
		.update({ last_attempt_at: now, consecutive_failures: failures, last_error: message, alerted_at: alertedAt })
		.eq('id', 'espn');
	if (error) console.error('Mise à jour de sync_status impossible :', error.message);
}

Deno.serve(async (req) => {
	const expectedSecret = Deno.env.get('GOAL_WEBHOOK_SECRET');
	if (!expectedSecret || req.headers.get('x-webhook-secret') !== expectedSecret) {
		return json({ error: 'unauthorized' }, 401);
	}

	const url = new URL(req.url);
	const mode = url.searchParams.get('mode') === 'full' ? 'full' : 'live';
	const dryRun = url.searchParams.get('dryRun') === '1';

	const supabase = createClient<Database>(
		Deno.env.get('SUPABASE_URL') ?? '',
		Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
		{ auth: { persistSession: false, autoRefreshToken: false } },
	);

	let status: SyncStatus | null = null;
	try {
		status = await readStatus(supabase);

		if (mode === 'live' && !(await hasActiveOrImminentMatch(supabase))) {
			return json({ mode, skipped: 'aucun match en cours ou imminent' });
		}
		if (mode === 'full' && !(await hasMatchNear(supabase, MATCH_PERIOD_WINDOW_MS))) {
			const lastFull = status?.last_full_success_at ? new Date(status.last_full_success_at).getTime() : 0;
			// On ne ralentit que si la dernière synchro complète a réussi : en
			// cas de panne, chaque créneau de 30 min retente.
			if (!status?.consecutive_failures && Date.now() - lastFull < OFF_PERIOD_FULL_INTERVAL_MS - INTERVAL_TOLERANCE_MS) {
				return json({ mode, skipped: 'hors période de matchs (synchro complète toutes les 2 h)' });
			}
		}

		const summary: SyncSummary = await runSync(supabase, { scope: mode, dryRun });
		if (!dryRun) {
			if (summary.errors > 0) {
				await recordFailure(supabase, status, `${summary.errors} écriture(s) en base refusée(s)`);
			} else {
				await recordSuccess(supabase, status, mode === 'full');
			}
		}
		return json({ mode, dryRun, ...summary });
	} catch (error) {
		console.error('sync-nations-league a échoué :', error);
		if (!dryRun) await recordFailure(supabase, status, shortError(error));
		// 200 pour ne pas polluer l'historique pg_net d'erreurs en cascade ; le
		// détail reste uniquement dans les logs de la fonction.
		return json({ mode, error: 'sync failed' });
	}
});
