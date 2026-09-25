-- Audit sécurité (S1, S2) : push_subscriptions est inscriptible par tout
-- utilisateur anonyme, et l'Edge Function send-goal-notification envoie une
-- requête POST à chaque `endpoint` enregistré. Sans contrôle, n'importe qui
-- pourrait lui faire appeler une URL arbitraire (SSRF / relais de trafic) ou
-- multiplier les lignes pour saturer l'envoi.

-- S1 : seuls les services push des navigateurs sont acceptés, et le JSON
-- d'abonnement doit être cohérent avec la colonne endpoint.
alter table public.push_subscriptions
	add constraint push_subscriptions_endpoint_allowed check (
		endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
		and length(endpoint) <= 1024
	),
	add constraint push_subscriptions_payload_valid check (
		subscription ->> 'endpoint' = endpoint
		and subscription -> 'keys' ->> 'p256dh' is not null
		and subscription -> 'keys' ->> 'auth' is not null
		and octet_length(subscription::text) <= 2048
	),
	add constraint push_subscriptions_user_agent_length check (
		user_agent is null or length(user_agent) <= 255
	);

-- S2 : au plus 5 appareils par utilisateur ; au-delà, les plus anciens sont
-- supprimés (un appareil qui se réabonne garde sa place).
create or replace function public.trim_push_subscriptions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	delete from public.push_subscriptions
	where user_id = new.user_id
		and id not in (
			select id from public.push_subscriptions
			where user_id = new.user_id
			order by created_at desc, id desc
			limit 5
		);
	return null;
end;
$$;

create trigger push_subscriptions_trim
	after insert on public.push_subscriptions
	for each row execute function public.trim_push_subscriptions();

-- Index du filtre de goal_alert_recipients (niveau + équipe préférée).
create index if not exists user_preferences_alerts_idx
	on public.user_preferences (notification_level, favorite_team_id)
	where notification_level <> 'none';

-- S3 (partiel) : purge hebdomadaire des sessions anonymes abandonnées.
-- last_sign_in_at n'est pas mis à jour par le rafraîchissement de token : on
-- ne s'y fie pas. Est « abandonnée » une session de plus de 90 jours sans
-- abonnement push (les abonnements expirés sont supprimés à l'envoi, 404/410)
-- et sans préférence modifiée depuis 90 jours.
select cron.schedule(
	'nations-league-anonymous-users-purge',
	'30 4 * * 1',
	$$delete from auth.users u
	  where u.is_anonymous
	    and u.created_at < now() - interval '90 days'
	    and not exists (select 1 from public.push_subscriptions s where s.user_id = u.id)
	    and not exists (
	      select 1 from public.user_preferences p
	      where p.user_id = u.id and p.updated_at >= now() - interval '90 days'
	    )$$
);
