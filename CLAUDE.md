# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Système de Gestion des Séances Délibérantes
## Instructions pour Claude Code

---

## LIRE EN PREMIER

- `CDC_V3.md` — cahier des charges complet (toutes les décisions techniques y sont justifiées)
- `ETAT_PROJET.md` — état réel et à jour de ce qui est livré (source de vérité pour ce qui existe déjà ; le périmètre Phase 1 ci-dessous est historique)

---

## COMMANDES COURANTES

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # Build production (Next.js + type-check)
npm run lint         # ESLint (next/core-web-vitals)
npm run test         # Vitest une passe
npm run test:watch   # Vitest en mode watch
npx vitest run src/lib/validators/__tests__/vote-result.test.ts   # un seul fichier de test
```

Régénérer les types Supabase après une migration :
```bash
supabase gen types typescript --project-id <PROJECT_ID> --schema public > src/lib/supabase/types.generated.ts
```

- Path alias TypeScript : `@/*` → `./src/*` (utiliser `@/lib/...`, `@/components/...`).
- Migrations SQL versionnées sous `supabase/migrations/` (24 appliquées au dernier point — voir `ETAT_PROJET.md`). Toute nouvelle migration garde la numérotation séquentielle `000NN_*.sql`.
- Tests Vitest : `globals: true`, `environment: 'node'`. Pas de tests DOM pour l'instant — uniquement les fonctions pures (`vote-result`, formules PV). Une nouvelle fonction métier pure doit être testée.

---

## ⚠️ RÈGLE ABSOLUE N°1 — APPLIQUER À CHAQUE LIGNE DE CODE

**⚠️ L'expérience utilisateur est la PRIORITÉ N°1 de ce projet.**
**Ce n'est PAS "faire marcher techniquement". C'est livrer une UX top tier mondial : intuitive, instinctive, facile pour TOUT utilisateur — qu'il soit secrétaire de mairie de 60 ans ou élu qui découvre l'application.**
**Chaque écran doit être pensé du point de vue de CHAQUE profil utilisateur (gestionnaire, élu, président). Si un utilisateur doit réfléchir à comment fonctionne quelque chose, c'est un échec.**

---

## ⚠️ RÈGLE ABSOLUE N°2 — CONFORMITÉ CGCT + RIGUEUR MÉTIER

**AVANT de coder quoi que ce soit, Claude DOIT vérifier :**

1. **Est-ce conforme au CGCT ?** (Code Général des Collectivités Territoriales)
   - Convocations : L2121-10 à L2121-12 (qui convoque, délai, ODJ obligatoire)
   - Quorum : L2121-17 (majorité des membres, reconvocation)
   - Votes : L2121-20 (procurations), L2121-21 (vote secret élections), L2121-22 (voix prépondérante)
   - PV : L2121-15 (contenu, signatures, approbation séance suivante)
   - Remplacement : L2122-17 (ordre des adjoints)
   - Conflit d'intérêt : L2131-11 (récusation)

2. **Est-ce que la logique métier est cohérente ?**
   - Peut-on arriver dans un état incohérent ? (ex: voter sans quorum, modifier un PV signé)
   - Chaque action a-t-elle les GARDES nécessaires ? (vérifications serveur, pas juste UI)
   - Les transitions de statut sont-elles contrôlées ? (machine à états)

3. **Est-ce que CHAQUE rôle est correctement limité ?**
   - Le président ne gère PAS les votes (il préside)
   - L'élu ne voit PAS les brouillons de PV
   - Le gestionnaire ne signe PAS le PV
   - Les droits dépendent de l'INSTANCE (CM, CAO, commission), pas du rôle global

**Claude ne code JAMAIS une fonctionnalité sans avoir vérifié ces 3 points.**
**L'utilisateur ne devrait JAMAIS avoir à rappeler ces règles.**

---

## CONTEXTE DU PROJET

Application web de gestion des assemblées délibérantes pour institutions publiques françaises :
communes, syndicats, communautés de communes, conseils départementaux, associations loi 1901.

**Architecture : SINGLE-TENANT ABSOLU**
- 1 institution = 1 application déployée = 1 base Supabase = 0 donnée partagée
- Il n'existe PAS de colonne `org_id` dans ce projet
- Toute mutualisation entre institutions est INTERDITE

---

## STACK IMPOSÉ

```
Frontend    : Next.js 14 (App Router) + TypeScript strict
UI          : shadcn/ui + Tailwind CSS
Backend     : Next.js API Routes + Server Actions
Base de données : Supabase (PostgreSQL + Auth + Realtime + Storage)
Auth        : Supabase Auth + TOTP 2FA + WebAuthn/FIDO2 (tablettes)
Emails      : Resend + React Email
SMS         : Twilio
IA          : API Anthropic Claude Sonnet 4.6 (claude-sonnet-4-20250514)
PDF         : React-PDF (PAS Puppeteer)
CI/CD       : GitHub Actions → Vercel
Monitoring  : Sentry
```

---

## RÈGLES DE CODE NON NÉGOCIABLES

### TypeScript
- `strict: true` dans tsconfig — aucun `any` sans commentaire explicite
- Composants React fonctionnels uniquement (pas de classes)
- Types générés depuis Supabase (`supabase gen types typescript`)

### Sécurité
- JAMAIS de clé API côté client (`NEXT_PUBLIC_` interdit pour les secrets)
- Tous les appels API sensibles via Server Actions uniquement
- RLS Supabase activée sur TOUTES les tables métier
- API Anthropic : anonymisation obligatoire avant tout appel (noms → "Élu A"...)

### Base de données
- Migrations versionnées dans `/supabase/migrations/`
- Tables de votes en INSERT-ONLY (aucun UPDATE ni DELETE autorisé en RLS)
- Vote à bulletin secret = 2 tables séparées :
  - `votes_participation` (qui a voté — sans le choix)
  - `bulletins_secret` (le choix — sans member_id)
- `audit_log` en APPEND-ONLY (trigger SQL sur toutes les tables métier)

### PDF
- Utiliser React-PDF (pas Puppeteer — incompatible Vercel serverless)
- Documents > 5 pages : génération en background via Supabase Edge Function

---

## STRUCTURE DE FICHIERS RÉELLE

Le code est sous `src/` (pas à la racine). Voir `ETAT_PROJET.md` pour l'inventaire détaillé des écrans et features livrés.

```
src/
  app/                          — Pages Next.js (pas de groupes (auth)/(app) ici, routes à plat)
    api/
      pdf/<type>/[id]/route.tsx — Génération PDF React-PDF (un fichier par template)
      qr/route.ts               — Lecture / validation QR
      webhooks/email/route.ts   — Webhook Resend (signature HMAC svix)
    seances/[id]/{preparation,en-cours,emargement,tablette,president,grande-scene,public,pv}/...
    vote/[voteId]/              — Télévote OTP (publique)
    convocation/confirmer/      — Confirmation présence depuis email (publique)
    configuration/, membres/, deliberations/, dashboard/, profil/, login/, register/, ...
  components/
    vote/, presence/, seance/, tablette/, pv/, membres/, configuration/,
    deliberations/, dashboard/, aide/, layout/, profil/, dev/,
    ui/                         — shadcn/ui + composants partagés (help-tip, etc.)
  lib/
    actions/                    — Server Actions (votes, seances, pv, membres, convocations,
                                  procurations, deliberations, configuration, recusations,
                                  controle-prefecture, phase2-features, ai-pv, dev, ...)
    auth/                       — getUserRole, getVerifiedRole, getEffectiveRole, requireVerifiedRole
    supabase/                   — client.ts (browser), server.ts (RSC+actions+service-role), types.generated.ts
    crypto/vote-encryption.ts   — AES-256-GCM + HMAC pour vote secret
    security/                   — Rate limiters (DB + en mémoire)
    validators/vote-result.ts   — determineVoteResult + generateFormulePV (fonctions PURES, testées)
    ai/                         — Wrappers Claude (PV + note de synthèse) + anonymisation
    email/                      — Templates Resend
    sms/                        — Helper Twilio
    pdf/templates/              — Templates React-PDF (utilisés par /api/pdf/...)
    hooks/                      — useRealtime, useAutoRefresh, useClientDate
    constants/, constants.ts    — Routes, libellés statuts, help-texts, templates institution
    utils/, utils.ts            — Format date, cn (Tailwind merge), divers
  middleware.ts                 — Auth + routes publiques + garde /configuration
  instrumentation.ts            — Sentry register
supabase/
  migrations/                   — 000NN_*.sql versionnées (24 appliquées)
sentry.{client,server,edge}.config.ts
CLAUDE.md, CDC_V3.md, ETAT_PROJET.md, DEMARRAGE.md
.env.example                    — Template variables (committé)
.env.local                      — Secrets (jamais committé)
```

---

## VARIABLES D'ENVIRONNEMENT REQUISES

Voir `.env.example` pour la liste complète.
Toutes les clés API sont dans `.env.local` (non committé).

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Institution (single-tenant — configurer pour cette institution)
NEXT_PUBLIC_INSTITUTION_NAME=
NEXT_PUBLIC_INSTITUTION_TYPE=   # commune|syndicat|cc|departement|asso
NEXT_PUBLIC_INSTITUTION_SIREN=
NEXT_PUBLIC_APP_URL=

# Services
ANTHROPIC_API_KEY=              # SERVEUR UNIQUEMENT
RESEND_API_KEY=                 # SERVEUR UNIQUEMENT
TWILIO_ACCOUNT_SID=             # SERVEUR UNIQUEMENT
TWILIO_AUTH_TOKEN=              # SERVEUR UNIQUEMENT
TWILIO_FROM_NUMBER=

# Sécurité
NEXTAUTH_SECRET=
VOTE_HMAC_SECRET=               # Clé HMAC propre à l'institution
VOTE_ENCRYPTION_KEY=            # AES-256 — jamais en clair dans le code
WEBAUTHN_RP_ID=
WEBAUTHN_RP_NAME=

# Monitoring
SENTRY_DSN=
```

---

## ÉTAT D'AVANCEMENT

La Phase 1 est livrée depuis longtemps. Le périmètre réel (Phase 2+) couvre déjà : vote secret AES-256-GCM, télévote OTP (Twilio), récusation, huis clos, reconvocation, PV wizard 6 étapes + IA, délibérations numérotées à la publication, contrôle préfecture, 7 templates PDF React-PDF, dashboards par rôle, écran public, tablette président, audit append-only.

**Avant d'ajouter une feature** : ouvrir `ETAT_PROJET.md` pour confirmer ce qui existe déjà (et donc n'a PAS à être recréé). Les sections « Ce qui reste à faire » + « V2 » y listent le backlog actif.

---

## KEY ARCHITECTURAL PATTERNS — À CONNAÎTRE AVANT DE TOUCHER LE CODE

### Auth & rôles : toujours via la table `members`, jamais via `user_metadata`
- `user_metadata.role` est modifiable côté client (`supabase.auth.updateUser`) — c'est un vecteur d'élévation de privilèges.
- Toute server action sensible utilise `requireVerifiedRole(supabase, user, [...])` (`src/lib/auth/require-role.ts`) qui lit `members.role` (protégé par RLS).
- Les composants serveur qui ont besoin du rôle utilisent `getEffectiveRole` — qui supporte un override par cookie `dev_role_override` UNIQUEMENT si le rôle réel en DB est `super_admin` (simulateur de rôle pour tests).
- Le middleware (Edge Runtime) refait la vérification rôle pour `/configuration` directement depuis `members` (pas d'import de `lib/auth` possible — restriction Edge).

### Variables d'environnement : doubles noms à supporter
L'intégration Supabase-Vercel utilise des noms différents de `.env.local`. Toujours lire avec fallback :
- URL : `NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL`
- Anon : `NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY || NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY`
- Service role : `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SECRET_KEY`

Voir `src/lib/supabase/server.ts` et `src/middleware.ts` pour le pattern canonique.

### Middleware Edge : routes publiques dupliquées
`src/middleware.ts` ne peut pas importer `lib/constants.ts` (restriction Edge Runtime). La liste `publicPaths` y est **dupliquée volontairement** et doit rester synchronisée avec `PUBLIC_ROUTES` dans `src/lib/constants.ts`. Si tu ajoutes une route publique, modifie les deux endroits.

### Vote secret : 2 tables, jamais jointes
- `votes_participation` (qui a voté, sans le choix) + `bulletins_secret` (le choix, sans `member_id`).
- Clé AES-256-GCM **par session de vote** (`vote-encryption.ts`), détruite après dépouillement.
- Hash HMAC-SHA256 sur chaque bulletin pour l'intégrité.
- Toutes les tables de votes sont **INSERT-ONLY** par RLS — pas d'UPDATE ni DELETE possible côté client après clôture (vérifier `00019_fix_votes_update_rls.sql` pour la transition OUVERT/CLOS).

### Server Actions vs API routes
- **Server Actions** (`src/lib/actions/*.ts`) = tout ce qui mute la DB ou consomme une clé secrète (Anthropic, Resend, Twilio). Toujours `'use server'`, toujours `requireVerifiedRole` en premier.
- **API routes** (`src/app/api/...`) = uniquement pour :
  - Génération PDF (`/api/pdf/<type>/[id]/route.tsx`, retourne un stream)
  - Webhooks externes (`/api/webhooks/email` — vérifie signature svix)
  - Endpoints publics non liés à un formulaire (`/api/qr`)
- Les routes PDF utilisent `@react-pdf/renderer` côté serveur (Node runtime, pas Edge — Puppeteer interdit).

### Realtime + fallback polling
`useRealtime` (`src/lib/hooks/`) écoute `postgres_changes` sur les tables clés (convocataires, presences, odj_points, votes, votes_participation, procurations) — ces tables doivent être activées dans Supabase → Database → Replication → `supabase_realtime`. Si la connexion WS échoue, le hook bascule en polling et l'UI affiche un indicateur ambre.

### Migrations SQL
- Une seule branche linéaire `000NN_*.sql`. **Ne jamais éditer une migration déjà appliquée** — toujours en ajouter une nouvelle pour corriger.
- Activer RLS sur **toute** table métier dans la même migration que sa création (ou immédiatement après).
- Le trigger `audit_log` (append-only) doit être attaché à toute nouvelle table métier.

### IA Anthropic : anonymisation obligatoire
Avant tout appel à l'API Anthropic, anonymiser les noms (`Élu A`, `Élu B`, …). Le wrapper dans `src/lib/ai/` gère ça — ne jamais appeler `@anthropic-ai/sdk` directement depuis le code applicatif.

### Numérotation délibérations
Le numéro est attribué **à la publication**, pas à la création. Verrou Postgres anti-doublon. Un numéro n'est **jamais réutilisé**, même si la délibération est annulée. Voir `src/lib/actions/deliberations.ts`.

---

## PHASE 1 — HISTORIQUE (livrée)

Périmètre originel (conservé pour mémoire) :
1. Auth Supabase (email + mot de passe + invitation)
2. Configuration institution
3. Gestion des membres et des instances
4. Assignation tablettes (device_id)
5. Création de séance + ODJ
6. Convocations email (Resend)
7. Présences (appel manuel + WebAuthn basique)
8. Vote à main levée
9. Détection unanimité automatique
10. Formules PV automatiques (7 cas)
11. PV simple (brouillon texte)
12. Déploiement Vercel

---

## COMPORTEMENT ATTENDU DE CLAUDE CODE

1. **Avant de coder** : confirmer la compréhension du CDC, poser les questions
2. **Migrations d'abord** : créer le schéma SQL avant les composants
3. **Types ensuite** : générer les types TypeScript depuis Supabase
4. **Composants ensuite** : dans l'ordre de dépendance
5. **Tester au fur et à mesure** : `npm run dev` + vérifier dans le navigateur
6. **Corriger immédiatement** : si erreur TypeScript ou build → corriger avant de continuer
7. **Committer régulièrement** : un commit par feature significative

---

## RÈGLES UX OBLIGATOIRES — APPLIQUER SYSTÉMATIQUEMENT

**⚠️ RÈGLE ABSOLUE : L'expérience utilisateur est la PRIORITÉ N°1 de ce projet.**
**Ce n'est PAS "faire marcher techniquement". C'est livrer une UX top tier mondial : intuitive, instinctive, facile pour TOUT utilisateur — qu'il soit secrétaire de mairie de 60 ans ou élu qui découvre l'application.**
**Chaque écran doit être pensé du point de vue de CHAQUE profil utilisateur (gestionnaire, élu, président). Si un utilisateur doit réfléchir à comment fonctionne quelque chose, c'est un échec.**

Ces règles doivent être appliquées à CHAQUE composant, CHAQUE formulaire, CHAQUE liste.
Ne pas attendre que l'utilisateur le demande. C'est le STANDARD MINIMUM.

### Listes et sélections
- **Multi-sélection** : toute liste où l'utilisateur ajoute des éléments doit permettre la sélection multiple (cases à cocher + "Tout sélectionner" + bouton "Ajouter N éléments")
- **Recherche** : tout Select/Combobox avec plus de 5 options doit avoir une barre de recherche (utiliser le composant `Command` de shadcn, pas un Select basique)
- **Drag & drop** : toute liste ordonnée doit être réordonnable par glisser-déposer (utiliser `@dnd-kit`)
- **Tri et filtres** : toute liste de plus de 10 éléments doit proposer un tri et/ou un filtre

### Formulaires et wizards
- **Sauvegarde automatique** : un wizard multi-étapes doit sauvegarder à chaque "Suivant", pas avec un bouton "Enregistrer" séparé
- **Reprise** : un wizard doit reprendre là où l'utilisateur s'est arrêté (persister l'étape courante)
- **Validation inline** : montrer les erreurs sous chaque champ, pas dans un toast générique
- **Pas de double action** : un seul bouton principal par étape — pas "Suivant" ET "Enregistrer"

### Confirmations et actions
- **Confirmation enrichie** : toute action destructive ou irréversible doit avoir un dialog de confirmation avec le contexte (nom de l'élément, conséquences, nombre d'éléments affectés)
- **Pas d'action silencieuse** : après une action, toujours un feedback (toast success, badge mis à jour, compteur incrémenté)
- **Boutons désactivés avec explication** : si un bouton est disabled, l'utilisateur doit comprendre pourquoi (title/tooltip)
- **Guidage proactif** : quand une page est vide ou qu'il manque une étape, afficher un message contextuel qui guide l'utilisateur

### Philosophie : faciliter la vie de l'utilisateur
L'objectif n°1 est que l'utilisateur n'ait JAMAIS à réfléchir à comment fonctionne l'application.
Tout doit être évident, guidé, et demander le minimum d'efforts.
- **Moins de clics** : si une action peut se faire en 1 clic au lieu de 3, faire en 1 clic
- **Valeurs par défaut intelligentes** : pré-remplir tout ce qui peut l'être (date du jour, membres de l'instance, paramètres hérités de la config)
- **Actions groupées** : ne jamais forcer l'utilisateur à répéter N fois la même action (ex: ajouter 24 convocataires un par un)
- **Anticipation** : proposer automatiquement l'étape suivante logique ("Vous avez créé l'ODJ → voulez-vous ajouter les convocataires ?")
- **Pas de jargon technique** : les messages d'erreur doivent être compréhensibles par un secrétaire de mairie, pas par un développeur
- **Tolérance** : permettre d'annuler, de revenir en arrière, de modifier — ne pas enfermer l'utilisateur dans un parcours rigide

**IMPORTANT — CLAUDE DOIT PENSER COMME UN PRODUCT DESIGNER, PAS COMME UN DÉVELOPPEUR :**
Claude ne doit PAS attendre que l'utilisateur demande une amélioration UX. À chaque composant créé ou modifié, Claude doit SE POSER CES QUESTIONS avant de coder :
1. Est-ce que je force l'utilisateur à faire une action répétitive ? → Si oui, grouper.
2. Est-ce que je peux pré-remplir ou deviner une valeur ? → Si oui, pré-remplir.
3. Est-ce que l'utilisateur sait quoi faire ensuite ? → Si non, ajouter un guidage.
4. Est-ce qu'un bouton est grisé sans explication ? → Si oui, ajouter un tooltip.
5. Est-ce que je peux réduire le nombre de clics ? → Si oui, simplifier.
6. Est-ce que l'utilisateur peut se tromper sans pouvoir revenir en arrière ? → Si oui, ajouter confirmation + annulation.
7. Est-ce qu'une icône n'a pas de texte ? → Si oui, ajouter un tooltip.
8. Est-ce que la liste est longue sans recherche ? → Si oui, ajouter recherche.
9. Est-ce qu'un wizard a un bouton "Enregistrer" séparé du "Suivant" ? → Si oui, fusionner.
10. Est-ce que la page est vide sans guidage ? → Si oui, ajouter un empty state avec action.

Claude applique ces 10 règles AUTOMATIQUEMENT. L'utilisateur ne devrait JAMAIS avoir à demander ces améliorations.

### Tooltips et aide contextuelle
- **Tooltip sur CHAQUE icône** sans texte (title ou Tooltip shadcn) — l'utilisateur doit savoir ce que fait un bouton au survol
- **Tooltip sur les badges** : expliquer ce que signifie chaque statut (ex: "Convoquée : les convocations ont été envoyées")
- **Tooltip sur les boutons désactivés** : expliquer POURQUOI le bouton est grisé (ex: "Ajoutez d'abord des points à l'ordre du jour")
- **Labels descriptifs** : chaque champ de formulaire doit avoir un label + une description courte si le champ n'est pas évident
- **Aide inline** : pour les concepts métier complexes (quorum, majorité qualifiée, voix prépondérante), ajouter une icône ℹ️ avec tooltip explicatif

### Penser aux 3 profils utilisateurs
À chaque composant, se demander :
1. **Gestionnaire** (crée, configure, prépare) → a-t-il accès à tout ce dont il a besoin ? Le flux est-il logique ? Peut-il tout faire vite ?
2. **Élu** (consulte, vote, signe) → l'interface est-elle lisible sans formation ? Les actions sont-elles évidentes ? Peut-il comprendre sans aide ?
3. **Président** (dirige, valide) → peut-il voir l'état global rapidement ? Les actions prioritaires sont-elles mises en avant ?

### Responsive et accessibilité
- **Mobile-first** : tous les layouts doivent fonctionner sur tablette (usage principal en séance)
- **Touch-friendly** : boutons minimum 44px, espacement suffisant entre les éléments cliquables
- **Accents français** : utiliser les accents dans l'interface (é, è, ê, ç, à, ù...) — c'est une application française

### Anti-patterns à éviter
- ❌ Select basique pour une liste de personnes → ✅ Combobox avec recherche
- ❌ Ajout un par un dans une liste → ✅ Multi-sélection + "Tout ajouter"
- ❌ Bouton "Enregistrer" séparé dans un wizard → ✅ Sauvegarde sur "Suivant"
- ❌ `value=""` dans un SelectItem Radix → ✅ `value="_none"` ou `value="placeholder"`
- ❌ Message d'erreur générique "Erreur inattendue" → ✅ Message précis avec action suggérée
- ❌ Page vide sans explication → ✅ Empty state avec icône + texte + bouton d'action
- ❌ Action destructive sans confirmation → ✅ AlertDialog avec contexte
- ❌ Flèches haut/bas pour réordonner → ✅ Drag & drop (avec flèches en fallback mobile)
- ❌ Action irréversible (cocher sans pouvoir décocher) → ✅ Toujours permettre d'annuler/modifier
- ❌ "Scanner QR" sans caméra (juste un champ texte) → ✅ Vrai scanner caméra + champ texte en fallback
- ❌ Fonctionnalité qui utilise le hardware sans l'utiliser vraiment (caméra, GPS, biométrie) → ✅ Utiliser l'API native du navigateur (getUserMedia, Geolocation, WebAuthn)
- ❌ Champ "coller le code" quand la caméra peut lire directement → ✅ Scanner automatique d'abord, saisie manuelle en fallback

---

## RÈGLE DE LÉGALITÉ — SÉANCES OFFICIELLES

Ce sont des assemblées délibérantes officielles (communes, associations loi 1901, syndicats...).
Toute fonctionnalité doit être pensée sous l'angle de la **validité juridique**.

### Identification des membres — Double authentification en 2 temps

**ÉMARGEMENT (table d'entrée de la salle) :**
- **QR code unique à usage unique** = preuve de présence physique
  - Généré par convocation (1 QR = 1 membre + 1 séance)
  - Expire après scan (non réutilisable)
  - Envoyé dans l'email de convocation + affichable dans l'app

**TABLETTE DE SÉANCE (à la place de l'élu) :**
- **QR code + WebAuthn/empreinte** = identification pour voter
  - 1ère fois sur la tablette : enrollment empreinte avec assistance admin
  - Fois suivantes : vérification empreinte instantanée
  - Fallback si pas de capteur : QR code seul (mode QR_ONLY, tracé dans audit_log)
- **Tablettes NON-NOMINATIVES** : n'importe quel élu sur n'importe quelle tablette
- **Table `device_sessions`** trace : qui, quelle tablette, quel mode d'auth, quand
- **Session verrouillée** pour toute la séance (re-auth empreinte au réveil, QR+empreinte pour changer d'élu)

**INTERDIT :**
- **PAS de code PIN** pour l'émargement — un PIN se partage, aucune valeur légale

**FALLBACK :**
- Le gestionnaire identifie visuellement la personne et valide manuellement (mode ASSISTE, loggé)

### Procurations
- Le membre absent déclare sa procuration AVANT la séance
- Le gestionnaire enregistre : "X donne procuration à Y"
- Au scan du QR code de Y, le système affiche "Vous représentez aussi X"
- Y confirme → 2 présences enregistrées

### Principes généraux
- Toute action en séance doit être **horodatée** et **tracée** (audit_log)
- Les votes sont **INSERT-ONLY** — pas de modification après coup
- Les signatures et émargements sont des **preuves** — les stocker avec soin
- En cas de doute sur la légalité d'une fonctionnalité → être plus strict, pas moins

---

## POINTS D'ATTENTION CRITIQUES

Ces points ont été identifiés comme risques en production (voir section 21 du CDC) :

- **Interface vote main levée** : 3 éléments max visibles, bouton UNANIMITÉ prioritaire
- **Tablette en veille** : activer Screen Wake Lock API à l'ouverture de séance
- **Vote secret offline** : IMPOSSIBLE — basculer automatiquement en main levée si réseau absent
- **Quorum** : vérifier et enregistrer le quorum À L'OUVERTURE du vote (pas à la clôture)
- **Secrétaire de séance** : non bloquant — avertissement seulement si non désigné
- **PDF** : React-PDF uniquement, jamais Puppeteer sur Vercel
- **Numérotation délibérations** : attribuer le numéro À LA PUBLICATION, pas à la création
