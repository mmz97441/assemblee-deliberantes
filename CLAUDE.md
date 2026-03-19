# Système de Gestion des Séances Délibérantes
## Instructions pour Claude Code

---

## LIRE EN PREMIER

Lis le fichier `CDC_V3.md` dans ce dossier avant de faire quoi que ce soit.
C'est le cahier des charges complet. Toutes les décisions techniques y sont justifiées.

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

## STRUCTURE DE FICHIERS CIBLE

```
/app
  /(auth)/login /register /invite/[token] /2fa /webauthn/register
  /(app)/dashboard
  /(app)/seances
  /(app)/seances/new
  /(app)/seances/[id]
  /(app)/seances/[id]/preparation
  /(app)/seances/[id]/en-cours
  /(app)/seances/[id]/pv
  /(app)/seances/[id]/archive
  /(app)/membres
  /(app)/deliberations
  /(app)/configuration

/components
  /vote        — VoteMainLevee, VoteSecret, VoteNominal, VoteBulletin, VoteResultat
  /presence    — AppelList, SignaturePad, WebAuthnAuth, EmargementForm
  /seance      — SeanceHeader, ODJList, QuorumGauge, GrandeScene
  /tablette    — TabletteElu, TabletteVote, TabletteEmargement
  /pv          — PVEditor, PVValidation, PVSignature
  /documents   — PDFViewer, DocumentUpload, PDFGenerator

/lib
  /supabase    — client.ts, server.ts, types.ts (généré)
  /pdf         — templates React-PDF par type de document
  /email       — templates Resend (convocation, rappels, PV...)
  /sms         — helpers Twilio
  /ai          — wrapper API Anthropic + anonymisation OBLIGATOIRE
  /crypto      — hash votes HMAC, AES-256, WebAuthn, RFC 3161
  /validators  — quorum, procurations, délais légaux, QD, conflits
  /formules-pv — générateur des 7 formules légales selon résultat vote
  /offline     — queue locale, sync, conflict resolution

/app/api
  /votes/[id]/open /close /ballot /nominal
  /presence/webauthn/[id]
  /pdf/[type]
  /ai/[feature]
  /webhooks/email /twilio /visio
  /deliberations/[id]/actes-export

/supabase
  /migrations  — schéma SQL versionné
  /seed.sql    — données de test

CLAUDE.md      — ce fichier
CDC_V3.md      — cahier des charges complet
.env.local     — variables d'environnement (jamais committé)
.env.example   — template des variables (committé)
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

## PHASE EN COURS : PHASE 1 — MVP CORE

Voir section 19 du CDC_V3.md pour le plan complet.

**Périmètre Phase 1 :**
1. Auth Supabase (email + mot de passe + invitation)
2. Configuration institution (Bloc 1 et 2 du module config)
3. Gestion des membres et des instances
4. Assignation tablettes (device_id)
5. Création de séance + ODJ
6. Convocations email (Resend)
7. Présences (appel manuel + WebAuthn basique)
8. Vote à main levée (Gestionnaire saisit Contre + Abstentions)
9. Détection unanimité automatique
10. Formules PV automatiques (7 cas)
11. PV simple (brouillon texte)
12. Déploiement Vercel

**Critère de validation Phase 1 :**
Une séance complète de bout en bout : convocation envoyée → présences enregistrées → vote main levée → unanimité détectée → formule PV correcte générée.

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

## POINTS D'ATTENTION CRITIQUES

Ces points ont été identifiés comme risques en production (voir section 21 du CDC) :

- **Interface vote main levée** : 3 éléments max visibles, bouton UNANIMITÉ prioritaire
- **Tablette en veille** : activer Screen Wake Lock API à l'ouverture de séance
- **Vote secret offline** : IMPOSSIBLE — basculer automatiquement en main levée si réseau absent
- **Quorum** : vérifier et enregistrer le quorum À L'OUVERTURE du vote (pas à la clôture)
- **Secrétaire de séance** : non bloquant — avertissement seulement si non désigné
- **PDF** : React-PDF uniquement, jamais Puppeteer sur Vercel
- **Numérotation délibérations** : attribuer le numéro À LA PUBLICATION, pas à la création
