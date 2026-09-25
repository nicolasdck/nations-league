# Nations League 2026-27 — PWA

PWA React + TypeScript + Tailwind v4 + Supabase pour la Ligue des Nations UEFA 2026-27 : calendrier, scores en direct (Realtime), classements avec départages UEFA, projection du tableau final (mode théorique / mode supporter), thème aux couleurs de l'équipe préférée et alertes de buts Web Push.

## Architecture

```
pg_cron (1/min live, 1/30 min full) ─▶ Edge Function sync-nations-league ─▶ API ESPN
                                              │ upsert des matchs modifiés
                                              ▼
                                     Supabase Postgres (matches)
                     trigger matches_goal_alert ─▶ Edge Function send-goal-notification ─▶ Web Push
Navigateur ◀── REST (lecture) + Realtime (postgres_changes sur matches)
```

```
scripts/sync-nations-league.ts        lancement manuel de la synchro depuis un poste (Node ≥ 22.18)
supabase/
  migrations/…_init_nations_league.sql  schéma, enums, RLS, realtime, seed 54 équipes / 14 groupes, trigger but
  migrations/…_sync_cron.sql            planification pg_cron de la synchro
  functions/_shared/                    cœur de synchro ESPN + types BDD (partagés Deno / Node / app)
  functions/sync-nations-league/        Edge Function appelée par pg_cron
  functions/send-goal-notification/     Edge Function Deno (web-push)
src/
  sw.ts                               service worker (précache Workbox, SKIP_WAITING, push, clic notif)
  lib/                                client Supabase typé + types BDD
  types/competition.ts                modèles métier + mapping des lignes
  data/competition.ts                 règles 2026-27 (issues par place, appariements projetés…)
  data/tabs.ts                        onglets
  utils/standings.ts                  classements + départages UEFA (confrontations directes récursives)
  utils/projection.ts                 moteur de projection (groupes → quarts A/R → Final Four, barrages)
  utils/teamTheme.ts                  reteinte des rampes Tailwind emerald/cyan + contraste
  hooks/                              données (SWR + Realtime), préférences, thème, push, install, update SW
  components/                         vues Matchs / Classements / Projection / Réglages, bannières PWA
```

## Mise en route

1. **Supabase**
   - `npx supabase link --project-ref <ref>` puis `npx supabase db push` (applique la migration).
   - Authentication → Providers → activer **Anonymous sign-ins** (préférences et abonnements push protégés par RLS via `auth.uid()`).
   - Clés VAPID : `npx web-push generate-vapid-keys`.
   - Secrets de l'Edge Function :
     `npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:vous@exemple.com GOAL_WEBHOOK_SECRET=<chaîne aléatoire>`
   - Déploiement : `npx supabase functions deploy send-goal-notification --no-verify-jwt`
   - Secrets Vault lus par le trigger (SQL editor) :
     ```sql
     select vault.create_secret('https://<ref>.supabase.co', 'project_url');
     select vault.create_secret('<GOAL_WEBHOOK_SECRET>', 'goal_webhook_secret');
     ```
2. **Front** : copier `.env.example` en `.env`, remplir les variables `VITE_*`, puis `npm run dev`.
3. **Synchro des scores**
   - Déploiement : `npx supabase functions deploy sync-nations-league --no-verify-jwt` (protégée par `GOAL_WEBHOOK_SECRET`).
   - La migration `…_sync_cron.sql` planifie les appels : toutes les minutes en mode `live` (ESPN n'est contacté que si un match est en cours ou imminent), toutes les 30 min en mode `full`.
   - Manuel depuis un poste : `npm run sync` / `npm run sync:dry` (lit `.env`).
   - Source : API publique ESPN (`site.api.espn.com`, sans clé). Sofascore a été écarté : il renvoie 403 à tout client non-navigateur.

## Projection

- **Théorique** : matchs joués = score réel ; matchs en cours = score actuel figé ; matchs à venir = prédiction par l'indice `teams.strength` (≈ Elo) avec +60 à domicile (nul si écart < 50). Tirs au but : équipe la plus forte.
- **Supporter** : même modèle, mais l'équipe préférée gagne tous ses matchs restants (2-0, ou un but d'avance sur un match en cours) et les tirs au but.
- Quarts : 1er d'un groupe contre 2e d'un autre (A1-A2, A2-A1, A3-A4, A4-A3), le 1er reçoit au retour ; demi-finales QF1–QF3 / QF2–QF4. Dès que les vrais appariements (tirage UEFA) sont en base, ils remplacent la projection.
- Règles 2026-27 : en Ligue A, les deux moins bons 3es et les deux meilleurs 4es vont en barrages A/B contre les 2es de Ligue B ; les deux moins bons 4es sont relégués. Les 4es de Ligue B affrontent les 2es de Ligue C. Toute la Ligue D est promue.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | serveur de dev |
| `npm run build` | type-check (app, SW, scripts) + build PWA |
| `npm run lint` | ESLint |
| `npm run sync` / `sync:dry` | synchro manuelle ESPN → Supabase |
