-- Source des données : Sofascore (bloque tout client non-navigateur, HTTP 403)
-- remplacé par l'API publique ESPN.
alter table public.teams rename column sofascore_id to espn_id;
alter table public.teams rename constraint teams_sofascore_id_key to teams_espn_id_key;

-- Correction des groupes des Ligues C et D (tirage réel, vérifié sur les
-- classements et le calendrier officiels ESPN). La Ligue D compte 2 groupes
-- de 3. Le scraper réaligne de toute façon teams.group_id sur les classements
-- ESPN à chaque passe ; pot = ordre de force dans le groupe (dernier critère
-- de départage uniquement).
update public.teams as t
set group_id = v.group_id, pot = v.pot
from (values
	('ALB', 'C1', 1), ('FIN', 'C1', 2), ('BLR', 'C1', 3), ('SMR', 'C1', 4),
	('MNE', 'C2', 1), ('ARM', 'C2', 2), ('CYP', 'C2', 3), ('LVA', 'C2', 4),
	('SVK', 'C3', 1), ('KAZ', 'C3', 2), ('FRO', 'C3', 3), ('MDA', 'C3', 4),
	('ISL', 'C4', 1), ('BUL', 'C4', 2), ('LUX', 'C4', 3), ('EST', 'C4', 4),
	('MLT', 'D1', 1), ('AND', 'D1', 2), ('GIB', 'D1', 3),
	('AZE', 'D2', 1), ('LTU', 'D2', 2), ('LIE', 'D2', 3)
) as v(team_id, group_id, pot)
where t.id = v.team_id;

-- Noms utilisés par ESPN absents des alias initiaux.
update public.teams set aliases = array_append(aliases, 'KOS') where id = 'KVX' and not ('KOS' = any (aliases));
update public.teams set aliases = array_append(aliases, 'Bosnia-Herzegovina') where id = 'BIH' and not ('Bosnia-Herzegovina' = any (aliases));
