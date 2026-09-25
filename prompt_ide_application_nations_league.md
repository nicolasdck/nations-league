# Prompt d'initialisation du projet : Application UEFA Nations League

> **Instruction :** Copiez-collez l'intégralité du texte ci-dessous dans votre IDE (Cursor, Windsurf, Claude Dev, etc.) pour lancer la génération de l'application.

---

```markdown
### C — Contexte
Vous êtes un développeur web fullstack expert spécialisé en React, TypeScript, Tailwind CSS, Supabase et Progressive Web Apps (PWA). 

Nous développons une application web PWA moderne dédiée à la **UEFA Nations League**. L'architecture globale s'appuie sur la même structure, les mêmes principes UX/UI et la même logique métier que mon projet existant `worldcup2026` situé localement sur ma machine sous :
`C:\Users\nicol\Documents\projects\reactjs\worldcup-2026`

**Architecture globale :**
- **Client (Frontend) :** React, TypeScript, Tailwind CSS, Vite PWA.
- **Base de données / Backend :** Supabase (PostgreSQL, Authentification / Stockage, Row Level Security, Web Push Notifications).
- **Scraping & Mise à jour :** Un script / cron automatisé tourne durant les plages de matchs pour scrapper un site de résultats sportifs en temps réel fiable (ex. Flashscore / Sofascore) et insérer/mettre à jour les données de matchs, scores et classements directement dans Supabase.
- **Accès données clients :** Les utilisateurs interrogent directement Supabase (requêtes REST / Realtime).

---

### O — Objectif
Générer l'architecture complète, la structure des dossiers, le schéma de base de données Supabase, les scripts de scraping/cron et le code de l'application React PWA répondant à l'ensemble des fonctionnalités ci-dessous.

**Fonctionnalités requises :**

1. **Fonctionnalités PWA & UX Mobile-First :**
   - **PWA Install Banner :** Détection de l'événement `beforeinstallprompt` avec une bannière personnalisée pour inciter à l'installation de l'application.
   - **Update Banner (Auto-update) :** Détection d'une nouvelle version du Service Worker / du code déployé avec affichage d'une bannière « *Une nouvelle version est disponible — Rafraîchir* ».
   - Design 100 % **Mobile-First**, ultra-fluide, adapté aux écrans tactiles.

2. **Données de compétition (UEFA Nations League) :**
   - Affichage du **calendrier complet**, des **résultats en direct / passés** et des **classements par ligues/groupes** (Ligue A, B, C, D).

3. **Personnalisation & Thématisation dynamique :**
   - Sélecteur d'**Équipe Préférée** (ex. Belgique, France, Espagne, etc.).
   - L'application adapte dynamiquement sa charte graphique (variables CSS / Tailwind) aux couleurs principales et secondaires de l'équipe sélectionnée.

4. **Système de Notifications Push (Goal Alerts) :**
   - Gestion des notifications PWA / Web Push via Supabase.
   - L'utilisateur peut choisir son niveau d'alerte et le modifier à tout moment :
     - *Mon équipe préférée uniquement*
     - *Toutes les équipes*
     - *Aucune notification*

5. **Outil de Projection / Arbre de simulation jusqu'à la finale :**
   - **Projection 1 (Théorique / Logique) :** Calcule la suite du tableau final selon les classements actuels / règles UEFA réelles.
   - **Projection 2 (Mode Supporter / Optimiste) :** Calcule le parcours dynamique en simulant que l'équipe préférée sélectionnée gagne tous ses matchs à venir.

6. **Backend & Automation (Supabase + Cron Scraper) :**
   - Schéma de base de données PostgreSQL clair (`teams`, `groups`, `matches`, `user_preferences`, `push_subscriptions`).
   - Script Node.js / Python (ou Edge Function Supabase) de scraping automatisé à exécuter via un cron pendant les heures de match pour mettre à jour les données dans Supabase.

---

### C — Contraintes
- **Qualité du code :** Écrire du code TypeScript strict, modulaire et entièrement fonctionnel sans raccourcis ni commentaires de type `// TODO: implement later`. Reprendre la totalité des composants et des fichiers fournis.
- **Style :** Exploiter pleinement Tailwind CSS pour la mise en page responsive et la thématisation dynamique par variables CSS.
- **Cohérence :** S'aligner rigoureusement sur la structure et les patterns du projet `worldcup2026`.
- **Performance :** Optimiser les requêtes Supabase (mise en cache locale ou gestion optimiste des états React).

---

### S — Sortie
Fournir la réponse structurée étape par étape dans l'ordre suivant :

1. **Schéma de Base de Données Supabase (SQL) :** Tables, clés étrangères, énumérations, et règles RLS nécessaires.
2. **Architecture des Fichiers :** Arborescence claire du projet React/TypeScript.
3. **Configuration PWA & Service Worker :** Configuration `vite.config.ts` et gestionnaires de bannières (`InstallBanner` et `UpdateBanner`).
4. **Script de Scraping & Sync Supabase :** Script autonome (Node.js/TypeScript) prêt à être exécuté par un job cron pour la récupération des scores en direct.
5. **Composants Clés React / Hooks :**
   - Hook de thématisation dynamique selon l'équipe préférée.
   - Hook/Composant de gestion des notifications Web Push.
   - Composant de l'arbre de projection (mode logique vs mode supporter).
   - Composants de la liste des matchs, calendriers et classements.

---

### V — Vérification
Pour valider que la réponse générée est correcte et complète, s'assurer que :
- Le schéma SQL inclut toutes les tables nécessaires au stockage des matchs, des groupes, des profils/notifications et des équipes (avec leurs couleurs hexadécimales).
- La détection du Service Worker et l'installation PWA disposent de leurs composants de bannière fonctionnels.
- Le hook de thème applique correctement les couleurs dynamiques au DOM.
- Les deux modes du module de projection (théorique vs supporter) calculent les chemins d'accès à la finale sans erreur de logique.
- Le code TypeScript fourni est complet, typé sans `any`, et sans omission de lignes.
```