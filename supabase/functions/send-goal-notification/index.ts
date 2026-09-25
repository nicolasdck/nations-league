// Appelée par le trigger SQL matches_goal_alert (pg_net) quand un score
// augmente pendant un match. Envoie une notification Web Push aux abonnés
// concernés selon leur niveau d'alerte (fonction SQL goal_alert_recipients).
//
// Déploiement : supabase functions deploy send-goal-notification --no-verify-jwt
// Secrets     : supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
//               VAPID_SUBJECT=mailto:... GOAL_WEBHOOK_SECRET=...
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type MatchRecord = {
	id: number;
	status: string;
	home_team_id: string | null;
	away_team_id: string | null;
	placeholder_home: string | null;
	placeholder_away: string | null;
	home_score: number | null;
	away_score: number | null;
	home_scorers: string[] | null;
	away_scorers: string[] | null;
	minute: number | null;
	group_id: string | null;
};

type WebhookPayload = {
	record: MatchRecord;
	old_record: MatchRecord;
};

type TeamInfo = { id: string; name: string; flag: string };

type PushError = { statusCode?: number };

// Même liste que la contrainte push_subscriptions_endpoint_allowed.
const PUSH_SERVICE_PATTERN =
	/^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;
const BATCH_SIZE = 50;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});

const increased = (next: number | null, prev: number | null) =>
	(next ?? 0) > (prev ?? 0);

Deno.serve(async (req) => {
	const expectedSecret = Deno.env.get('GOAL_WEBHOOK_SECRET');
	if (!expectedSecret || req.headers.get('x-webhook-secret') !== expectedSecret) {
		return json({ error: 'unauthorized' }, 401);
	}

	try {
		const { record, old_record }: WebhookPayload = await req.json();

		// Garde-fous (le trigger filtre déjà) : pas d'alerte pour un rattrapage
		// sur un match terminé ni pour un passage null → 0.
		if (record.status !== 'LIVE' && record.status !== 'HT') {
			return json({ skipped: 'match non en cours' });
		}
		const homeScored = increased(record.home_score, old_record.home_score);
		const awayScored = increased(record.away_score, old_record.away_score);
		if (!homeScored && !awayScored) return json({ skipped: 'pas de but' });

		const supabase = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
			{ auth: { persistSession: false } },
		);

		const teamIds = [record.home_team_id, record.away_team_id].filter(
			(id): id is string => id !== null,
		);
		const { data: teamRows, error: teamsError } = await supabase
			.from('teams')
			.select('id, name, flag')
			.in('id', teamIds);
		if (teamsError) throw teamsError;
		const teams = new Map((teamRows as TeamInfo[]).map((t) => [t.id, t]));

		const label = (id: string | null, placeholder: string | null) => {
			const team = id ? teams.get(id) : undefined;
			return team ? `${team.flag} ${team.name}` : (placeholder ?? '?');
		};
		const homeLabel = label(record.home_team_id, record.placeholder_home);
		const awayLabel = label(record.away_team_id, record.placeholder_away);

		// Le champ buteurs est cumulatif : on ne garde que les nouveaux.
		const newScorers = [
			...(homeScored ? (record.home_scorers ?? []).slice((old_record.home_scorers ?? []).length) : []),
			...(awayScored ? (record.away_scorers ?? []).slice((old_record.away_scorers ?? []).length) : []),
		];

		const scoringLabel = [homeScored ? homeLabel : null, awayScored ? awayLabel : null]
			.filter(Boolean)
			.join(' & ');
		const title = `⚽ But ${scoringLabel} !`;
		const body = [
			`${homeLabel} ${record.home_score ?? 0} - ${record.away_score ?? 0} ${awayLabel}`,
			newScorers.join(', '),
			record.minute ? `${record.minute}'` : null,
		]
			.filter(Boolean)
			.join(' · ');

		const { data: recipients, error: recipientsError } = await supabase.rpc(
			'goal_alert_recipients',
			{
				p_home_team_id: record.home_team_id ?? '',
				p_away_team_id: record.away_team_id ?? '',
			},
		);
		if (recipientsError) throw recipientsError;

		webpush.setVapidDetails(
			Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
			Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
			Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
		);

		const message = JSON.stringify({ title, body, tag: `match-${record.id}` });
		const list = (recipients ?? []) as { endpoint: string; subscription: webpush.PushSubscription }[];
		const expired: string[] = [];

		// Défense en profondeur (la contrainte SQL filtre déjà) : on ne contacte
		// que les services push des navigateurs, jamais une URL arbitraire.
		const allowed = list.filter(({ endpoint }) => PUSH_SERVICE_PATTERN.test(endpoint));

		// Envoi par lots pour borner le nombre de connexions simultanées.
		let sent = 0;
		for (let i = 0; i < allowed.length; i += BATCH_SIZE) {
			const results = await Promise.allSettled(
				allowed.slice(i, i + BATCH_SIZE).map(({ endpoint, subscription }) =>
					webpush.sendNotification(subscription, message, { TTL: 300, urgency: 'high' }).catch(
						(err: PushError) => {
							// Abonnement expiré ou révoqué : à supprimer.
							if (err.statusCode === 404 || err.statusCode === 410) expired.push(endpoint);
							throw err;
						},
					),
				),
			);
			sent += results.filter((r) => r.status === 'fulfilled').length;
		}

		if (expired.length > 0) {
			const { error } = await supabase.from('push_subscriptions').delete().in('endpoint', expired);
			if (error) console.error('Nettoyage des abonnements expirés impossible :', error.message);
		}

		console.log(`${title} — ${body} → ${sent}/${list.length} envoyées, ${expired.length} expirées`);
		return json({ sent, total: list.length, expired: expired.length });
	} catch (error) {
		console.error('send-goal-notification a échoué :', error);
		// Détail dans les logs uniquement.
		return json({ error: 'internal error' }, 500);
	}
});
