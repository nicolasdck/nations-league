// Fiche match à la demande (appelée par l'app via supabase.functions.invoke).
// Lecture-cache : ESPN n'est contacté que si public.match_details est
// périmé selon l'état du match (1 min en direct, 6 h avant-match, définitif
// après la fin). Le nombre d'appels ESPN ne dépend donc pas du nombre
// d'utilisateurs, et seuls les matchs présents en base sont acceptés.
//
// Déploiement : supabase functions deploy match-details
// (JWT vérifié : l'app envoie sa clé anon / session automatiquement.)
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '../_shared/database.types.ts';
import { isDetailsStale, normalizeSummary, type MatchDetails } from '../_shared/match-details.ts';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.nations/summary?event=';

async function fetchSummary(eventId: number): Promise<unknown> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 12_000);
	try {
		const res = await fetch(`${ESPN_SUMMARY}${eventId}`, {
			signal: controller.signal,
			headers: { Accept: 'application/json', 'User-Agent': 'NationsLeaguePWA/1.0' },
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
	} finally {
		clearTimeout(timeout);
	}
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
	if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

	let matchId: number;
	try {
		const body: unknown = await req.json();
		matchId = Number((body as { matchId?: unknown }).matchId);
	} catch {
		return json({ error: 'invalid body' }, 400);
	}
	if (!Number.isSafeInteger(matchId) || matchId <= 0) return json({ error: 'invalid matchId' }, 400);

	const supabase = createClient<Database>(
		Deno.env.get('SUPABASE_URL') ?? '',
		Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
		{ auth: { persistSession: false, autoRefreshToken: false } },
	);

	const [{ data: match }, { data: cached }] = await Promise.all([
		supabase.from('matches').select('id, external_id, status, kickoff_at').eq('id', matchId).maybeSingle(),
		supabase.from('match_details').select('payload, fetched_at').eq('match_id', matchId).maybeSingle(),
	]);
	if (!match) return json({ error: 'unknown match' }, 404);

	if (cached && !isDetailsStale(match.status, match.kickoff_at, cached.fetched_at)) {
		return json({ details: cached.payload, fetchedAt: cached.fetched_at, cached: true });
	}

	try {
		const details: MatchDetails = normalizeSummary(await fetchSummary(match.external_id));
		const fetchedAt = new Date().toISOString();
		const { error } = await supabase
			.from('match_details')
			.upsert({ match_id: matchId, payload: details as unknown as Json, fetched_at: fetchedAt });
		if (error) console.error(`Cache match_details ${matchId} non écrit :`, error.message);
		return json({ details, fetchedAt, cached: false });
	} catch (error) {
		console.error(`Fiche du match ${matchId} (ESPN ${match.external_id}) indisponible :`, error);
		// ESPN indisponible : on sert la dernière version connue plutôt que rien.
		if (cached) return json({ details: cached.payload, fetchedAt: cached.fetched_at, cached: true, stale: true });
		return json({ error: 'details unavailable' }, 502);
	}
});
