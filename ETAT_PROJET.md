# État du Projet — Assemblées Délibérantes

**Dernière mise à jour :** 29 avril 2026
**Commits :** 124
**Stack :** Next.js 14 + TypeScript + Supabase + shadcn/ui + Tailwind

---

## ARCHITECTURE

- **Single-tenant** : 1 institution = 1 app déployée = 1 base Supabase
- **Hébergement** : Vercel (assemblee-deliberantes.vercel.app)
- **Base de données** : Supabase (projet GestionAG, rvcyxgtqxqzmqecerjvy)
- **21 migrations appliquées** (00001 à 00021)

---

## CE QUI EST FAIT (✅)

### Auth & Utilisateurs
- Login / Register (inscription par invitation uniquement)
- Mot de passe oublié + réinitialisation
- Page profil (/profil) + changement mot de passe
- Rôles : super_admin, gestionnaire, président, secrétaire, élu
- Rôles vérifiés via table members (pas user_metadata modifiable)
- Middleware avec routes publiques
- Simulateur de rôle (super_admin only, pour tests)

### Configuration
- Wizard 6 étapes (Type, Identité, Contact, Légal, Numéros, Instances)
- Instances configurables (CM, CAO, commissions, AG...)
- Bureau par instance (président, VP, secrétaire, trésorier + ordre de succession)
- Options par instance : écran public, tablette président, type secrétaire, tablettes individuelles

### Membres
- CRUD complet + import CSV
- Assignation aux instances avec rôle bureau
- Invitations par email
- Protection : membre avec rôle actif non supprimable

### Séances
- Wizard création 5 étapes (Instance → Date → ODJ → Convocataires → Récap+envoi)
- Président et secrétaire sélectionnables dans le wizard (hérités du bureau)
- ODJ : drag & drop, documents uploadables, résolutions, rapporteur avec recherche
- Points standards auto (Approbation PV + Questions diverses)
- Duplication de séance
- Archivage (pas de suppression des séances convoquées)
- Recherche archives par nom/date/instance/année

### Convocations
- Email via Resend avec template HTML
- Mention "Sur convocation de [Président]" (CGCT L2121-10)
- QR code unique par convocation
- Rappels email aux non-confirmés
- Webhook Resend (statuts : envoyé, lu, cliqué, erreur)
- Signature HMAC webhook (svix)
- Filtres : Tous, Envoyés, Lu, Confirmés, En attente, Erreurs, Non envoyés
- Confirmation de présence depuis l'email (page publique)
- Délai légal vérifié (warning, pas bloquant)
- Président obligatoire avant envoi

### Présences & Émargement
- Émargement tablette avec scan QR (caméra)
- Pointage manuel avec confirmation "Mode assisté" (tracé dans audit)
- Badges : QR scanné (vert) / Pointage manuel (ambre)
- Confirmation présence in-app (élu connecté)
- Identification tablette : QR + WebAuthn (enrollment simulé Phase 2)
- Device sessions (tablettes non-nominatives)
- Quorum temps réel (exclut les membres partis)
- Alerte quorum perdu en cours de séance
- Arrivée tardive : 3 modes (strict/souple/suspendu)
- Jauge prédiction quorum sur fiche séance

### Procurations
- CGCT L2121-20 : max 1 par mandataire par séance
- Mandant ≠ mandataire, les deux convocataires
- Upload document procuration (scan/photo)
- Irrévocable pendant les votes
- Comptée pour le quorum

### Votes
- **Main levée** : gestionnaire saisit Contre + Abstentions, Pour calculé auto
- Bouton UNANIMITÉ 1 clic
- Sélection noms avec recherche (Combobox)
- **Vote secret** : AES-256-GCM, 2 tables (participation ≠ bulletin), clé détruite
- **Télévote OTP** : SMS Twilio, OTP 6 chiffres, 8 min, page publique
- Récusation / conflit d'intérêt (CGCT L2131-11) — tablette bloquée
- Huis clos (4 étapes : vote → activation → scène neutralisée → reprise)
- Vote secret obligatoire pour élections (CGCT L2121-21)
- Double vote bloqué (annulation nécessaire pour revoter)
- Quorum vérifié à l'ouverture du vote
- Reconvocation : vote sans quorum si reconvoquée (L2121-17)
- Points ajoutés en séance (vote assemblée requis)
- Compte administratif : rappel que le président quitte la salle
- 7 formules PV automatiques
- Hash intégrité HMAC-SHA256 sur chaque vote clos

### PV (Procès-verbal)
- Wizard 6 étapes (Présences → Discussions → Observations → Relecture → Finaliser → Signatures)
- Pré-rempli à 90% (présences, votes, formules auto)
- Discussion : 1 zone par point, IA reformulation (Claude Sonnet 4.6)
- Warnings intelligents (opposition → recommandé, rejeté → fortement recommandé)
- Récap avant signature avec checklist par point
- Signatures président + secrétaire (hash SHA-256)
- Emails notification : PV prêt → président, président signe → secrétaire
- PV verrouillé après signatures (serveur + trigger SQL)
- PV de carence (quorum non atteint — 3 étapes)
- PV de reconvocation (mention CGCT L2121-17)
- Mention remplacement si VP préside
- Auto-save 30s + beforeunload warning

### Délibérations
- Numéro attribué à la PUBLICATION (pas création)
- Numéro jamais réutilisé (même si annulée)
- Format configurable (DEL-2026-042, CA-2026-001...)
- Remise à zéro annuelle optionnelle
- Verrou PostgreSQL anti-doublons
- Affichage obligatoire (24h) + transmission préfecture (15j) — tracés
- Registre annuel PDF (couverture, TDM, chaque délibération, certification)
- Création auto à la clôture de séance

### PDFs (7 templates React-PDF)
- Convocation (avec QR code)
- Dossier de séance complet (version papier pour élus)
- Feuille d'émargement
- Récapitulatif post-séance (1 page)
- Procès-verbal
- Délibération individuelle
- Registre annuel des délibérations

### Écrans (23 pages)
1. `/login` — Connexion
2. `/register` — Inscription (invitation uniquement)
3. `/mot-de-passe-oublie` — Réinitialisation mot de passe
4. `/reset-password` — Nouveau mot de passe
5. `/invite/confirm` — Accepter invitation
6. `/` — Accueil (redirige)
7. `/dashboard` — Tableau de bord (personnalisé par rôle : gestionnaire, élu, président, secrétaire)
8. `/profil` — Mon profil + changement mot de passe
9. `/seances` — Liste séances (Actives + Archives)
10. `/seances/new` — Wizard création séance (5 étapes)
11. `/seances/[id]` — Détail séance (4 onglets : Résumé, ODJ, Convocations, Procurations)
12. `/seances/[id]/preparation` — Espace préparation élu (notes, questions, avis par point)
13. `/seances/[id]/en-cours` — Conducteur de séance (gestionnaire)
14. `/seances/[id]/emargement` — Émargement tablette (entrée salle)
15. `/seances/[id]/tablette` — Tablette élu (sidebar ODJ, documents, demande parole)
16. `/seances/[id]/president` — Tablette président (direction débats)
17. `/seances/[id]/grande-scene` — Vidéoprojecteur (point en cours en grand)
18. `/seances/[id]/public` — Écran public (progression séance, sans auth)
19. `/seances/[id]/pv` — PV wizard (6 étapes)
20. `/membres` — Gestion des membres
21. `/deliberations` — Liste délibérations
22. `/deliberations/[id]` — Détail délibération
23. `/configuration` — Configuration institution + instances
24. `/aide` — Centre d'aide + guides + glossaire + FAQ
25. `/convocation/confirmer` — Confirmation présence (publique)
26. `/vote/[voteId]` — Télévote OTP (publique)

### Sécurité
- RLS sur toutes les tables
- Headers HTTP (CSP, HSTS, X-Frame-Options, Permissions-Policy)
- Rate limiting (convocations, QR scan, votes, PDFs, OTP)
- HMAC-SHA256 intégrité votes
- AES-256-GCM chiffrement votes secrets
- Inscription verrouillée (invitation only)
- Rôles vérifiés via table members (pas user_metadata)
- Webhook Resend avec vérification signature HMAC
- Rate limiter en mémoire sur routes PDF + QR
- Audit trail (trigger SQL sur toutes les tables métier)
- Pas de PII dans Sentry

### Temps réel
- Supabase Realtime (WebSocket postgres_changes)
- Fallback polling automatique si Realtime déconnecté
- Indicateur visuel (vert = temps réel, ambre = polling)
- Tables en réplication : convocataires, presences, odj_points, votes, votes_participation, procurations

### Monitoring
- Sentry intégré (client + serveur + edge)
- Erreurs capturées automatiquement
- Replay on error (100%)
- sendDefaultPii: false (RGPD)

### Tests
- Vitest configuré
- 28 tests unitaires (determineVoteResult + generateFormulePV)

### Documentation
- Centre d'aide in-app (/aide)
- 4 guides détaillés par rôle (gestionnaire, élu, président, secrétaire)
- Glossaire searchable (18 termes + références CGCT)
- FAQ 10 questions (accordéon)
- Tooltips contextuels (composant HelpTip) dans toute l'app
- 16+ textes d'aide partagés (HELP_TEXTS)

### Logique métier & gardes
- Machine à états séance (BROUILLON → CONVOQUÉE → EN_COURS → CLÔTURÉE → ARCHIVÉE)
- ODJ verrouillé après envoi convocations
- Convocataires verrouillés après envoi
- Président obligatoire pour convoquer (CGCT L2121-10)
- Date dépassée → séance non ouvrable (strict à minuit)
- Vote secret obligatoire pour élections (L2121-21)
- Quorum vérifié à l'ouverture du vote
- Votes immutables après clôture (RLS UPDATE seulement OUVERT/CLOS)
- PV verrouillé après signatures
- Délibérations non modifiables après publication
- Archivage conditionné (PV signé + délibérations publiées)
- Suspension exige votes fermés
- Procuration irrévocable pendant votes

---

## CE QUI RESTE À FAIRE (🔲)

### Bugs à corriger
- [ ] Page publique (/seances/[id]/public) retourne 404 — tester sur URL production (pas preview), tester en incognito
- [ ] Vérifier que le dernier commit est bien déployé sur Vercel

### V2 (prochaine version)
- [ ] Notes secrétaire en live pendant la séance
- [ ] Enregistrement audio par point ODJ + transcription IA (Whisper)
- [ ] Mode hors-ligne (Service Worker, IndexedDB, sync queue)
- [ ] RFC 3161 timestamping (horodatage certifié)
- [ ] WebAuthn réel (pas simulé)
- [ ] Scanner QR par caméra sur l'écran d'auth tablette (actuellement champ texte)

### Améliorations futures
- [ ] Upload documents dans le wizard création séance (actuellement après création seulement)
- [ ] Multi-tenant (Option B ou C si commercialisation SaaS)
- [ ] Rappels automatiques programmés (cron J-3, J-1)
- [ ] Transmission préfecture dématérialisée (@actes, FAST)
- [ ] Vote blanc distinct de l'abstention (4ème bouton)
- [ ] Note de synthèse obligatoire (communes > 3500 hab)

---

## CONFIGURATION VERCEL (variables d'environnement)

### Obligatoires
- `NEXT_PUBLIC_SUPABASE_URL` — URL Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Clé anonyme Supabase
- `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY` — Clé service role
- `NEXT_PUBLIC_APP_URL` — URL de l'app (ex: https://assemblee-deliberantes.vercel.app)
- `NEXT_PUBLIC_INSTITUTION_NAME` — Nom de l'institution
- `NEXT_PUBLIC_INSTITUTION_TYPE` — Type (commune/syndicat/cc/departement/asso)
- `RESEND_API_KEY` — Clé API Resend (emails)

### Recommandées
- `RESEND_WEBHOOK_SECRET` — Signing secret webhook Resend (whsec_...)
- `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` — Monitoring erreurs
- `VOTE_HMAC_SECRET` — Clé HMAC intégrité votes
- `VOTE_ENCRYPTION_KEY` — Clé AES-256 votes secrets
- `ANTHROPIC_API_KEY` — IA reformulation PV

### Optionnelles
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER` — Télévote SMS
- `NEXTAUTH_SECRET` — Secret sessions
- `WEBAUTHN_RP_ID` + `WEBAUTHN_RP_NAME` — WebAuthn

---

## SUPABASE — Tables de réplication Realtime

Activer dans le dashboard Supabase → Database → Replication → supabase_realtime :
- convocataires
- presences
- odj_points
- votes
- votes_participation
- procurations

---

## STRUCTURE FICHIERS PRINCIPALE

```
src/
  app/                    — Pages Next.js (23 routes)
  components/
    aide/                 — Guides d'aide par rôle + glossaire
    configuration/        — Wizard institution + instances
    dashboard/            — 4 dashboards par rôle
    deliberations/        — Liste + détail délibérations
    layout/               — Sidebar, header, authenticated layout
    membres/              — Liste, formulaire, import CSV
    pv/                   — Éditeur PV wizard
    presence/             — Émargement + signature
    profil/               — Page profil utilisateur
    seance/               — Détail, wizard, conducteur, tablettes, préparation
    tablette/             — Auth tablette, wrapper
    vote/                 — Main levée, secret, télévote
    ui/                   — Composants shadcn + help-tip
    dev/                  — Role switcher (super_admin)
  lib/
    actions/              — Server actions (seances, votes, pv, membres, config, etc.)
    ai/                   — Assistant IA PV (anonymisation + Claude API)
    auth/                 — Login, register, rôle vérifié
    constants/            — Routes, statuts, help-texts, institution-templates
    crypto/               — AES-256-GCM, HMAC, tokens
    email/                — Templates Resend (convocation, PV signature, rappel)
    hooks/                — useRealtime, useAutoRefresh, useClientDate
    pdf/templates/        — 7 templates React-PDF
    security/             — Rate limiter (DB + API), rôle vérifié
    sms/                  — Helper Twilio
    supabase/             — Client, server, types générés
    utils/                — Format date partagé
    validators/           — Vote result, formules PV
  middleware.ts           — Auth, routes publiques, redirections
supabase/
  migrations/             — 21 migrations SQL (00001-00021)
```
