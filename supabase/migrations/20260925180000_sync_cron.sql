-- Planification de la synchronisation ESPN → Supabase (Edge Function
-- sync-nations-league) via pg_cron + pg_net. Réutilise les secrets Vault
-- project_url et goal_webhook_secret créés pour l'alerte « but ».
create extension if not exists pg_cron;

create or replace function public.invoke_nations_league_sync(p_mode text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_url text;
	v_secret text;
begin
	if p_mode not in ('live', 'full') then
		raise exception 'mode inconnu : %', p_mode;
	end if;

	select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
	select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'goal_webhook_secret';
	if v_url is null or v_secret is null then
		raise warning 'invoke_nations_league_sync: vault secrets project_url / goal_webhook_secret manquants';
		return null;
	end if;

	return net.http_post(
		url := v_url || '/functions/v1/sync-nations-league?mode=' || p_mode,
		headers := jsonb_build_object(
			'Content-Type', 'application/json',
			'x-webhook-secret', v_secret
		),
		body := '{}'::jsonb,
		-- La synchro complète peut écrire ~150 lignes au premier passage.
		timeout_milliseconds := 120000
	);
end;
$$;

revoke all on function public.invoke_nations_league_sync(text) from public, anon, authenticated;

-- Toutes les minutes : ne contacte ESPN que si un match est en cours ou imminent.
select cron.schedule(
	'nations-league-sync-live',
	'* * * * *',
	$$select public.invoke_nations_league_sync('live')$$
);

-- Toutes les 30 minutes : synchro complète (calendrier, reports, groupes).
select cron.schedule(
	'nations-league-sync-full',
	'*/30 * * * *',
	$$select public.invoke_nations_league_sync('full')$$
);

-- Purge de l'historique pg_cron (1 440 exécutions / jour) au-delà de 3 jours.
select cron.schedule(
	'nations-league-cron-history-purge',
	'15 3 * * *',
	$$delete from cron.job_run_details where end_time < now() - interval '3 days'$$
);
