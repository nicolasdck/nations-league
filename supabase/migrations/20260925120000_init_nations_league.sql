-- =====================================================================
-- UEFA Nations League 2026-27 — schéma initial
--   teams / groups / matches          : données de compétition (lecture publique,
--                                       écriture réservée au service_role = scraper)
--   user_preferences / push_subscriptions : données utilisateur (RLS par auth.uid(),
--                                       sessions anonymes Supabase Auth)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.league_code as enum ('A', 'B', 'C', 'D');

-- NS = pas commencé, LIVE = en cours, HT = mi-temps, FT = terminé,
-- PST = reporté, CANC = annulé
create type public.match_status as enum ('NS', 'LIVE', 'HT', 'FT', 'PST', 'CANC');

-- GROUP = phase de ligue, QF = quarts (Ligue A, aller/retour),
-- SF / THIRD / F = Final Four, PO = barrages promotion/relégation
create type public.match_stage as enum ('GROUP', 'QF', 'SF', 'THIRD', 'F', 'PO');

create type public.notification_level as enum ('favorite', 'all', 'none');

-- ---------------------------------------------------------------------
-- Tables de compétition
-- ---------------------------------------------------------------------
create table public.groups (
	id text primary key check (id ~ '^[A-D][1-4]$'),
	league public.league_code not null,
	number smallint not null check (number between 1 and 4),
	unique (league, number)
);

create table public.teams (
	id text primary key check (id ~ '^[A-Z]{3}$'),       -- code FIFA
	name text not null,                                    -- nom affiché (FR)
	name_en text not null,                                 -- nom anglais (matching scraper)
	aliases text[] not null default '{}',                  -- variantes de nom côté source
	flag text not null,                                    -- emoji drapeau
	primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
	secondary_color text not null check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
	dark_color text not null default '#000000' check (dark_color ~ '^#[0-9A-Fa-f]{6}$'),
	group_id text references public.groups (id) on update cascade on delete set null,
	pot smallint not null check (pot between 1 and 4),     -- position dans le tirage (liste d'accès)
	strength smallint not null,                            -- indice de force (≈ Elo) pour les projections
	sofascore_id integer unique
);

create index teams_group_id_idx on public.teams (group_id);

create table public.matches (
	id bigint generated always as identity primary key,
	external_id bigint not null unique,                    -- id Sofascore
	stage public.match_stage not null,
	group_id text references public.groups (id) on delete set null,
	matchday smallint,
	leg smallint check (leg in (1, 2)),
	home_team_id text references public.teams (id),
	away_team_id text references public.teams (id),
	placeholder_home text,
	placeholder_away text,
	kickoff_at timestamptz not null,
	venue text,
	status public.match_status not null default 'NS',
	minute smallint,
	home_score smallint check (home_score >= 0),
	away_score smallint check (away_score >= 0),
	home_penalty_score smallint check (home_penalty_score >= 0),
	away_penalty_score smallint check (away_penalty_score >= 0),
	home_scorers text[] not null default '{}',
	away_scorers text[] not null default '{}',
	-- Vainqueur du match ; pour un match retour (leg = 2) : vainqueur de la
	-- confrontation sur l'ensemble des deux matchs (prolongation / t.a.b. compris).
	winner_id text references public.teams (id),
	updated_at timestamptz not null default now(),
	check (stage <> 'GROUP' or group_id is not null)
);

create index matches_kickoff_at_idx on public.matches (kickoff_at);
create index matches_group_id_idx on public.matches (group_id);
create index matches_status_idx on public.matches (status) where status in ('LIVE', 'HT');
create index matches_home_team_idx on public.matches (home_team_id);
create index matches_away_team_idx on public.matches (away_team_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.updated_at := now();
	return new;
end;
$$;

create trigger matches_touch_updated_at
	before update on public.matches
	for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Tables utilisateur
-- ---------------------------------------------------------------------
create table public.user_preferences (
	user_id uuid primary key references auth.users (id) on delete cascade,
	favorite_team_id text references public.teams (id) on delete set null,
	notification_level public.notification_level not null default 'favorite',
	updated_at timestamptz not null default now()
);

create trigger user_preferences_touch_updated_at
	before update on public.user_preferences
	for each row execute function public.touch_updated_at();

create table public.push_subscriptions (
	id bigint generated always as identity primary key,
	user_id uuid not null references auth.users (id) on delete cascade,
	endpoint text not null unique,
	subscription jsonb not null,
	user_agent text,
	created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.user_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

-- Données de compétition : lecture pour tous, aucune écriture côté client
-- (le scraper utilise la clé service_role, qui contourne la RLS).
create policy "groups are readable by everyone"
	on public.groups for select to anon, authenticated using (true);

create policy "teams are readable by everyone"
	on public.teams for select to anon, authenticated using (true);

create policy "matches are readable by everyone"
	on public.matches for select to anon, authenticated using (true);

-- Préférences : chaque utilisateur (anonyme ou non) ne voit / modifie que sa ligne.
create policy "users read their preferences"
	on public.user_preferences for select to authenticated
	using ((select auth.uid()) = user_id);

create policy "users insert their preferences"
	on public.user_preferences for insert to authenticated
	with check ((select auth.uid()) = user_id);

create policy "users update their preferences"
	on public.user_preferences for update to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

create policy "users delete their preferences"
	on public.user_preferences for delete to authenticated
	using ((select auth.uid()) = user_id);

create policy "users read their push subscriptions"
	on public.push_subscriptions for select to authenticated
	using ((select auth.uid()) = user_id);

create policy "users insert their push subscriptions"
	on public.push_subscriptions for insert to authenticated
	with check ((select auth.uid()) = user_id);

create policy "users update their push subscriptions"
	on public.push_subscriptions for update to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

create policy "users delete their push subscriptions"
	on public.push_subscriptions for delete to authenticated
	using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Realtime : les clients écoutent les mises à jour de scores
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.matches;

-- ---------------------------------------------------------------------
-- Destinataires d'une alerte but (appelée par l'Edge Function, service_role)
-- ---------------------------------------------------------------------
create or replace function public.goal_alert_recipients(p_home_team_id text, p_away_team_id text)
returns table (endpoint text, subscription jsonb)
language sql
stable
security definer
set search_path = ''
as $$
	select s.endpoint, s.subscription
	from public.push_subscriptions s
	join public.user_preferences p on p.user_id = s.user_id
	where p.notification_level = 'all'
		or (
			p.notification_level = 'favorite'
			and p.favorite_team_id is not null
			and p.favorite_team_id in (p_home_team_id, p_away_team_id)
		);
$$;

revoke all on function public.goal_alert_recipients(text, text) from public, anon, authenticated;
grant execute on function public.goal_alert_recipients(text, text) to service_role;

-- ---------------------------------------------------------------------
-- Déclencheur « but » → Edge Function send-goal-notification (via pg_net)
-- Secrets à créer une fois dans le Vault (SQL editor) :
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<même valeur que GOAL_WEBHOOK_SECRET>', 'goal_webhook_secret');
-- ---------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_url text;
	v_secret text;
begin
	select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
	select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'goal_webhook_secret';

	if v_url is null or v_secret is null then
		raise warning 'notify_goal: vault secrets project_url / goal_webhook_secret manquants';
		return new;
	end if;

	perform net.http_post(
		url := v_url || '/functions/v1/send-goal-notification',
		headers := jsonb_build_object(
			'Content-Type', 'application/json',
			'x-webhook-secret', v_secret
		),
		body := jsonb_build_object('record', to_jsonb(new), 'old_record', to_jsonb(old))
	);
	return new;
end;
$$;

-- Un but = augmentation réelle d'un score pendant que le match est en cours.
-- Les passages NS→LIVE (null → 0) et les rattrapages sur un match déjà FT
-- ne déclenchent rien.
create trigger matches_goal_alert
	after update of home_score, away_score on public.matches
	for each row
	when (
		new.status in ('LIVE', 'HT')
		and (
			coalesce(new.home_score, 0) > coalesce(old.home_score, 0)
			or coalesce(new.away_score, 0) > coalesce(old.away_score, 0)
		)
	)
	execute function public.notify_goal();

-- ---------------------------------------------------------------------
-- Seed : groupes (tirage du 12 février 2026)
-- ---------------------------------------------------------------------
insert into public.groups (id, league, number) values
	('A1', 'A', 1), ('A2', 'A', 2), ('A3', 'A', 3), ('A4', 'A', 4),
	('B1', 'B', 1), ('B2', 'B', 2), ('B3', 'B', 3), ('B4', 'B', 4),
	('C1', 'C', 1), ('C2', 'C', 2), ('C3', 'C', 3), ('C4', 'C', 4),
	('D1', 'D', 1), ('D2', 'D', 2);

-- ---------------------------------------------------------------------
-- Seed : équipes (couleurs hex issues des drapeaux / maillots,
-- strength ≈ classement Elo, pot = ordre dans le tirage)
-- ---------------------------------------------------------------------
insert into public.teams
	(id, name, name_en, aliases, flag, primary_color, secondary_color, dark_color, group_id, pot, strength)
values
	-- Ligue A
	('FRA', 'France', 'France', '{}', '🇫🇷', '#0055A4', '#EF4135', '#000000', 'A1', 1, 2090),
	('ITA', 'Italie', 'Italy', '{}', '🇮🇹', '#008C45', '#CD212A', '#000000', 'A1', 2, 1910),
	('BEL', 'Belgique', 'Belgium', '{}', '🇧🇪', '#FFD90C', '#ED2939', '#000000', 'A1', 3, 1920),
	('TUR', 'Turquie', 'Türkiye', '{"Turkey","Turkiye"}', '🇹🇷', '#E30A17', '#FFFFFF', '#000000', 'A1', 4, 1870),
	('GRE', 'Grèce', 'Greece', '{}', '🇬🇷', '#0D5EAF', '#FFFFFF', '#000000', 'A2', 1, 1790),
	('GER', 'Allemagne', 'Germany', '{}', '🇩🇪', '#FFCE00', '#DD0000', '#000000', 'A2', 2, 1960),
	('NED', 'Pays-Bas', 'Netherlands', '{"Holland"}', '🇳🇱', '#FF6B00', '#21468B', '#000000', 'A2', 3, 1990),
	('SRB', 'Serbie', 'Serbia', '{}', '🇷🇸', '#C6363C', '#0C4076', '#000000', 'A2', 4, 1790),
	('ESP', 'Espagne', 'Spain', '{}', '🇪🇸', '#FFC400', '#AA151B', '#000000', 'A3', 1, 2150),
	('CRO', 'Croatie', 'Croatia', '{}', '🇭🇷', '#FF0000', '#171796', '#000000', 'A3', 2, 1930),
	('ENG', 'Angleterre', 'England', '{}', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '#CE1124', '#FFFFFF', '#000000', 'A3', 3, 2040),
	('CZE', 'Tchéquie', 'Czechia', '{"Czech Republic"}', '🇨🇿', '#D7141A', '#11457E', '#000000', 'A3', 4, 1780),
	('NOR', 'Norvège', 'Norway', '{}', '🇳🇴', '#BA0C2F', '#00205B', '#000000', 'A4', 1, 1880),
	('POR', 'Portugal', 'Portugal', '{}', '🇵🇹', '#FF0000', '#006600', '#000000', 'A4', 2, 2000),
	('DEN', 'Danemark', 'Denmark', '{}', '🇩🇰', '#C8102E', '#FFFFFF', '#000000', 'A4', 3, 1880),
	('WAL', 'Pays de Galles', 'Wales', '{}', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', '#D30731', '#00B140', '#000000', 'A4', 4, 1740),
	-- Ligue B
	('SCO', 'Écosse', 'Scotland', '{}', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '#0065BD', '#FFFFFF', '#000000', 'B1', 1, 1760),
	('SUI', 'Suisse', 'Switzerland', '{}', '🇨🇭', '#FF0000', '#FFFFFF', '#000000', 'B1', 2, 1860),
	('SVN', 'Slovénie', 'Slovenia', '{}', '🇸🇮', '#005DA4', '#ED1C24', '#000000', 'B1', 3, 1720),
	('MKD', 'Macédoine du Nord', 'North Macedonia', '{"Macedonia","FYR Macedonia"}', '🇲🇰', '#D20000', '#FFE600', '#000000', 'B1', 4, 1620),
	('HUN', 'Hongrie', 'Hungary', '{}', '🇭🇺', '#CD2A3E', '#436F4D', '#000000', 'B2', 1, 1760),
	('UKR', 'Ukraine', 'Ukraine', '{}', '🇺🇦', '#FFD500', '#005BBB', '#000000', 'B2', 2, 1800),
	('GEO', 'Géorgie', 'Georgia', '{}', '🇬🇪', '#FF0000', '#FFFFFF', '#000000', 'B2', 3, 1720),
	('NIR', 'Irlande du Nord', 'Northern Ireland', '{}', '🇬🇧', '#00A650', '#FFFFFF', '#000000', 'B2', 4, 1640),
	('AUT', 'Autriche', 'Austria', '{}', '🇦🇹', '#ED2939', '#FFFFFF', '#000000', 'B3', 1, 1850),
	('KVX', 'Kosovo', 'Kosovo', '{}', '🇽🇰', '#244AA5', '#D0A650', '#000000', 'B3', 2, 1640),
	('IRL', 'Irlande', 'Republic of Ireland', '{"Ireland","Rep. of Ireland"}', '🇮🇪', '#169B62', '#FF883E', '#000000', 'B3', 3, 1710),
	('ISR', 'Israël', 'Israel', '{}', '🇮🇱', '#0038B8', '#FFFFFF', '#000000', 'B3', 4, 1650),
	('POL', 'Pologne', 'Poland', '{}', '🇵🇱', '#DC143C', '#FFFFFF', '#000000', 'B4', 1, 1770),
	('BIH', 'Bosnie-Herzégovine', 'Bosnia and Herzegovina', '{"Bosnia & Herzegovina","Bosnia-Herzegovina"}', '🇧🇦', '#FECB00', '#002395', '#000000', 'B4', 2, 1650),
	('ROU', 'Roumanie', 'Romania', '{}', '🇷🇴', '#FCD116', '#002B7F', '#000000', 'B4', 3, 1720),
	('SWE', 'Suède', 'Sweden', '{}', '🇸🇪', '#FECC02', '#006AA7', '#000000', 'B4', 4, 1740),
	-- Ligue C
	('ISL', 'Islande', 'Iceland', '{}', '🇮🇸', '#02529C', '#DC1E35', '#000000', 'C1', 1, 1640),
	('ALB', 'Albanie', 'Albania', '{}', '🇦🇱', '#E41E20', '#FFFFFF', '#000000', 'C1', 2, 1700),
	('MNE', 'Monténégro', 'Montenegro', '{}', '🇲🇪', '#C40308', '#D3AE3B', '#000000', 'C1', 3, 1600),
	('KAZ', 'Kazakhstan', 'Kazakhstan', '{}', '🇰🇿', '#00AFCA', '#FEC50C', '#000000', 'C1', 4, 1520),
	('FIN', 'Finlande', 'Finland', '{}', '🇫🇮', '#2A6EBB', '#FFFFFF', '#002F6C', 'C2', 1, 1620),
	('SVK', 'Slovaquie', 'Slovakia', '{}', '🇸🇰', '#0B4EA2', '#EE1C25', '#000000', 'C2', 2, 1730),
	('BUL', 'Bulgarie', 'Bulgaria', '{}', '🇧🇬', '#00966E', '#D62612', '#000000', 'C2', 3, 1560),
	('ARM', 'Arménie', 'Armenia', '{}', '🇦🇲', '#D90012', '#F2A800', '#000000', 'C2', 4, 1520),
	('BLR', 'Biélorussie', 'Belarus', '{}', '🇧🇾', '#C8313E', '#4AA657', '#000000', 'C3', 1, 1540),
	('FRO', 'Îles Féroé', 'Faroe Islands', '{"Faroe Is."}', '🇫🇴', '#0065BD', '#EF303E', '#000000', 'C3', 2, 1450),
	('CYP', 'Chypre', 'Cyprus', '{}', '🇨🇾', '#D57800', '#4E5B31', '#000000', 'C3', 3, 1440),
	('EST', 'Estonie', 'Estonia', '{}', '🇪🇪', '#0072CE', '#FFFFFF', '#000000', 'C3', 4, 1420),
	('LVA', 'Lettonie', 'Latvia', '{}', '🇱🇻', '#9E3039', '#FFFFFF', '#000000', 'C4', 1, 1380),
	('LUX', 'Luxembourg', 'Luxembourg', '{}', '🇱🇺', '#00A1DE', '#EF3340', '#000000', 'C4', 2, 1500),
	('MDA', 'Moldavie', 'Moldova', '{}', '🇲🇩', '#0046AE', '#FFD200', '#000000', 'C4', 3, 1400),
	('SMR', 'Saint-Marin', 'San Marino', '{}', '🇸🇲', '#5EB6E4', '#FFFFFF', '#000000', 'C4', 4, 1050),
	-- Ligue D
	('AZE', 'Azerbaïdjan', 'Azerbaijan', '{}', '🇦🇿', '#00B5E2', '#EF3340', '#000000', 'D1', 1, 1450),
	('LTU', 'Lituanie', 'Lithuania', '{}', '🇱🇹', '#FDB913', '#006A44', '#000000', 'D1', 2, 1400),
	('MLT', 'Malte', 'Malta', '{}', '🇲🇹', '#CF142B', '#FFFFFF', '#000000', 'D1', 3, 1350),
	('GIB', 'Gibraltar', 'Gibraltar', '{}', '🇬🇮', '#DA000C', '#FFFFFF', '#000000', 'D1', 4, 1150),
	('LIE', 'Liechtenstein', 'Liechtenstein', '{}', '🇱🇮', '#2A5DB0', '#CE1126', '#002B7F', 'D2', 1, 1150),
	('AND', 'Andorre', 'Andorra', '{}', '🇦🇩', '#2F5BD8', '#FEDF00', '#10069F', 'D2', 2, 1200);
