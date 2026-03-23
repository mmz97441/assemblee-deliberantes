# CAHIER DES CHARGES V3.0
## Système de Gestion des Séances Délibérantes
**Single-tenant · Next.js · Supabase · Vercel · GitHub**
*Version 3.0 — Mars 2026 — Destiné à Claude Sonnet 4.6*

---

## SOMMAIRE RAPIDE

1. Architecture single-tenant
2. Contexte et références légales
3. Structure des instances
4. Rôles et permissions
5. Identification tablette (WebAuthn)
6. Vérification des présences
7. Les votes — fonctionnement réel
8. Conflits d'intérêt
9. Intégrité cryptographique des votes
10. Émargement eIDAS art. 26
11. Sécurité et RGPD
12. AVANT la séance — convocations
13. PENDANT la séance — déroulement réel
14. APRÈS la séance — PV et archivage
15. Documents générés automatiquement
16. Module IA
17. Architecture technique
18. Règles métier critiques (32 règles)
19. Plan de développement — 5 phases
20. Module de configuration
21. Corrections terrain — 22 problèmes
22. UX/UI — spécifications complètes

---

## 1. ARCHITECTURE SINGLE-TENANT — PRINCIPE ABSOLU

**Ce système n'est PAS multi-tenant.**

Chaque institution dispose de sa propre application entièrement isolée :
- Base Supabase dédiée (projet distinct)
- Déploiement Vercel dédié (URL propre)
- Dépôt GitHub forké
- Clés de chiffrement propres (jamais partagées)

**Il n'existe PAS de colonne `org_id` dans ce projet.**

```
GitHub Template (code source)
  ├── Fork → Commune de Lyon
  │     Supabase: projet-lyon | Vercel: conseil.mairie-lyon.fr
  ├── Fork → CC Pays de Gex
  │     Supabase: projet-gex  | Vercel: conseil.cc-paysdegex.fr
  └── Fork → Syndicat des eaux du Rhône
        Supabase: projet-sder | Vercel: assemblee.sder.fr
```

---

## 2. CONTEXTE ET RÉFÉRENCES LÉGALES

### Institutions couvertes

| Type | Instances | Base légale |
|---|---|---|
| Syndicat intercommunal/mixte | Comité syndical, Bureau | CGCT art. L5212-1 |
| Syndicat professionnel | AG, CA, Bureau | Code du travail art. L2131-1 |
| Communauté de communes | Conseil communautaire, Bureau | CGCT art. L5214-1 |
| Commune | Conseil municipal, Bureau, Commissions | CGCT art. L2121-1 |
| Conseil Général/Département | Assemblée plénière, Commission permanente | CGCT art. L3121-1 |
| Association loi 1901 | AGO, AGE, CA, Bureau | Loi 1er juillet 1901 |

### Références légales clés

- **CGCT L2121-10** : ODJ joint à la convocation obligatoirement
- **CGCT L2121-11** : Délai min. 5 jours francs (3 jours < 3500 hab.)
- **CGCT L2121-17** : Quorum = majorité membres en exercice
- **CGCT L2121-20** : 1 procuration max par mandataire
- **CGCT L2121-21** : Vote secret obligatoire pour nominations + sur demande 1/3 membres
- **CGCT L2121-25** : Publicité délibérations sous 24h, transmission préfecture sous 15j
- **CGCT L2131-11** : Conflit d'intérêt — nullité des délibérations si élu intéressé
- **eIDAS art. 26** : Signature électronique avancée
- **WebAuthn/FIDO2 (W3C)** : Standard authentification biométrique
- **RFC 3161** : Horodatage qualifié
- **RGPD (UE) 2016/679** : Protection données personnelles

### Glossaire

| Terme | Définition |
|---|---|
| Séance | Réunion formelle d'une instance délibérante |
| ODJ | Ordre Du Jour |
| Quorum | Nombre minimum de membres pour délibérer valablement |
| Délibération | Décision prise par vote, valeur juridique, structurée en Articles |
| PV | Procès-Verbal — document officiel signé Président + Secrétaire de séance |
| Secrétaire de séance | **Élu désigné** par vote en début de séance — différent du secrétaire administratif |
| Secrétaire administratif | Agent gérant l'application — profil Gestionnaire |
| Main levée | Vote géré par le secrétaire : saisie des contre/abstentions seulement |
| Unanimité | 0 contre + 0 abstention — détectée et annoncée automatiquement |
| Single-tenant | 1 app = 1 institution = 1 base = 0 donnée partagée |

---

## 3. STRUCTURE HIÉRARCHIQUE DES INSTANCES

```
INSTITUTION
│
├── BUREAU (instance restreinte)
│     Composition : Président, Vice-présidents, Secrétaire, Trésorier
│     Vote et propose → transmission manuelle au Conseil
│
├── CONSEIL / ASSEMBLÉE (instance plénière)
│     Délibère et prend les décisions à valeur juridique
│
└── COMMISSIONS (instances préparatoires)
      Émettent des avis — pas de délibérations opposables
```

**Flux Bureau → Conseil : MANUEL uniquement**
Le Gestionnaire choisit explicitement ce qui remonte. Aucun automatisme. Le Conseil est toujours souverain.

---

## 4. RÔLES ET PROFILS UTILISATEURS

### Les 6 profils

| Profil | Qui | Rôle clé |
|---|---|---|
| Super-admin | DGS, Directeur de cabinet | Configure l'institution, accès total |
| Président de séance | Maire, Président syndicat | Dirige à l'oral, signe le PV |
| Gestionnaire | Secrétaire de mairie | Opère l'application en séance |
| Secrétaire de séance | **Élu désigné** par vote | Co-signe le PV |
| Élu / Membre votant | Conseiller, délégué | Vote sur tablette |
| Agent préparateur | DGS technique, juriste | Prépare les dossiers, ne vote pas |

### Matrice des permissions

| Permission | Super | Président | Gestionnaire | Élu/Secr. | Préparateur |
|---|:---:|:---:|:---:|:---:|:---:|
| Configurer institution | ✅ | ❌ | ❌ | ❌ | ❌ |
| Créer une séance | ✅ | ❌ | ✅ | ❌ | ❌ |
| Ouvrir la séance | ✅ | ✅ | ✅ | ❌ | ❌ |
| Lancer un vote | ✅ | ❌ | ✅ | ❌ | ❌ |
| Saisir résultats main levée | ✅ | ❌ | ✅ | ❌ | ❌ |
| Voter (tablette) | ❌ | ✅ | ❌ | ✅ | ❌ |
| Se récuser (conflit) | ❌ | ✅ | ❌ | ✅ | ❌ |
| Signer le PV | ✅ | ✅ (obligatoire) | ✅ | ✅ (secrétaire) | ❌ |
| Transmettre Bureau→Conseil | ✅ | ❌ | ✅ | ❌ | ❌ |

---

## 5. IDENTIFICATION SUR TABLETTE — DOUBLE AUTHENTIFICATION QR + WEBAUTHN

### Principe : tablettes NON-NOMINATIVES + double authentification

**Les tablettes ne sont PAS pré-assignées.** N'importe quel élu peut s'asseoir devant n'importe quelle tablette. L'identification se fait en 2 temps :

1. **QR code de convocation** = "quelque chose que j'AI" (identifie l'élu)
2. **WebAuthn / empreinte digitale** = "quelque chose que je SUIS" (prouve l'identité)

### Standard WebAuthn W3C — eIDAS art. 26

**Pourquoi WebAuthn satisfait eIDAS art. 26 :**
- Lié au signataire de manière univoque (biométrie non délégable)
- Identifie le signataire (QR code de convocation + biométrie)
- Sous contrôle exclusif (Secure Enclave — données biométriques jamais transmises)
- Lié aux données signées (hash SHA-256 avant signature)

> ⚠️ **CRITIQUE** : Les données biométriques ne quittent JAMAIS la tablette.
> La Secure Enclave retourne uniquement une assertion cryptographique signée.
> Zéro donnée biométrique en base de données.

### Flux d'identification en 2 temps

#### ÉTAPE 1 — Table d'émargement (entrée de la salle)

Tablette commune avec caméra à l'entrée :
1. L'élu scanne son QR code de convocation (unique, usage unique)
2. Le système identifie l'élu et affiche "Bonjour [Prénom Nom]"
3. L'élu est marqué PRÉSENT dans `presences` avec l'heure d'arrivée
4. Le QR code est invalidé (ne peut pas être réutilisé)

#### ÉTAPE 2 — Tablette de séance (à sa place)

Tablette générique (non-nominative) à la place de l'élu :
1. L'écran affiche "Identifiez-vous pour cette séance"
2. L'élu scanne son QR code sur la caméra de la tablette
3. La tablette identifie l'élu (association QR → member_id)

**CAS A — Première fois sur CETTE tablette :**
- Le système propose "Enregistrez votre empreinte pour les prochaines séances"
- L'admin assiste l'élu pour le premier enrollment
- `navigator.credentials.create()` → enrollment dans la Secure Enclave
- La credential WebAuthn est stockée DANS le navigateur de cette tablette
- Session verrouillée ✅

**CAS B — Déjà enregistré sur CETTE tablette :**
- Le système affiche "Vérifiez votre identité"
- `navigator.credentials.get()` → Face ID ou Touch ID
- Vérification instantanée
- Session verrouillée ✅

**CAS C — Pas de capteur biométrique / échec WebAuthn :**
- Le QR code seul suffit comme fallback
- Mode authentification enregistré : `QR_ONLY` dans `device_sessions`
- Le gestionnaire peut aussi valider manuellement (mode `ASSISTE`)

### Session verrouillée

Une fois authentifié :
- Badge permanent visible : "🔒 Session de [Prénom Nom]"
- L'élu peut voter sur tous les points sans se ré-identifier
- Si la tablette se met en veille → re-vérification empreinte au réveil (pas le QR)
- Si quelqu'un veut changer d'élu → bouton "Changer de session" → QR + empreinte obligatoires
- Impossible de modifier la session sans double authentification

### Table `device_sessions` (traçabilité)

```sql
CREATE TABLE device_sessions (
  id UUID PRIMARY KEY,
  seance_id UUID NOT NULL REFERENCES seances(id),
  member_id UUID NOT NULL REFERENCES members(id),
  device_fingerprint TEXT NOT NULL,  -- identifiant unique du navigateur
  auth_method TEXT NOT NULL,          -- QR_WEBAUTHN, QR_ONLY, ASSISTE
  authenticated_at TIMESTAMPTZ,
  webauthn_credential_id TEXT,        -- ID de la credential WebAuthn utilisée
  active BOOLEAN DEFAULT TRUE,
  UNIQUE(seance_id, member_id)        -- 1 élu = 1 tablette par séance
);
```

### Fallback gestionnaire (mode assisté)

Si un élu ne peut pas s'identifier (pas de QR, pas de biométrie, tablette défaillante) :
- Le gestionnaire identifie visuellement la personne
- Le gestionnaire valide manuellement depuis son interface
- Mode authentification = `ASSISTE` (tracé dans `device_sessions` et `audit_log`)
- Ce mode est exceptionnel et loggé

### Prérequis matériels
- iOS 14+ / Android 9+, Safari 14+ / Chrome 76+
- Batteries ≥ 10h (séances 2-8h)
- Caméra fonctionnelle (pour le scan QR)
- Mode kiosque recommandé (Guided Access iOS / Kiosk mode Android)

---

## 6. VÉRIFICATION DES PRÉSENCES

### Double point de contrôle

| Point de contrôle | Lieu | Méthode | Ce qui est enregistré |
|---|---|---|---|
| **Émargement** | Table d'entrée | QR code unique | `presences` : PRESENT + heure |
| **Identification tablette** | Place de l'élu | QR + WebAuthn | `device_sessions` : member ↔ tablette |

**Mécanisme principal** : QR code émargement (entrée) + QR + WebAuthn (tablette à sa place)

**Mécanisme secondaire** : Appel manuel par le Gestionnaire (cas exceptionnels, loggé comme `ASSISTE`)

**Mécanisme in-app** : L'élu connecté peut confirmer sa présence depuis l'app (bouton "Je suis présent")

**Calcul quorum temps réel** : Présents (QR/WebAuthn/Manuel) + Procurations valides

### Arrivée en retard — 3 modes configurables par type de séance

| Mode | Comportement | Usage |
|---|---|---|
| STRICT | L'élu ne peut pas voter ce scrutin | Grandes assemblées |
| SOUPLE | Gestionnaire peut accorder +2 min | Conseils courants |
| SUSPENDU | Vote mis en pause, élu s'installe, vote reprend | Petits bureaux |

> Règle : l'heure d'arrivée tardive figure OBLIGATOIREMENT dans le PV.

### Présence en visioconférence — 3 niveaux

| Niveau | Mécanisme | Obligatoire pour voter |
|---|---|---|
| 1 | Clic "Je suis connecté" | Non |
| 2 | Webhook Zoom/Teams confirme connexion | Non |
| 3 | OTP 4 chiffres avant chaque vote | Oui (mode hybride) |

---

## 7. LES VOTES — FONCTIONNEMENT RÉEL EN SÉANCE

### Principe central : qui saisit quoi

| Type de vote | Qui saisit | Comment | Tablette individuelle élu |
|---|---|---|---|
| Main levée | Gestionnaire | Saisie Contre + Abstentions | ❌ (lève la main physiquement) |
| Unanimité | Gestionnaire | 1 clic bouton | ❌ |
| Vote secret | Chaque élu | Sur sa tablette | ✅ |
| Appel nominal | Gestionnaire | Appel élu par élu | ❌ |
| Télévote OTP | Élu distant | Lien sécurisé + OTP | ✅ (son appareil) |
| Procuration | Mandataire | Via sa tablette | ✅ |

### 7.1 Vote à main levée — RÈGLE FONDAMENTALE

```
JAMAIS de saisie des "pour".
Pour = Total votants − Contre − Abstentions (calculé côté serveur à la clôture)

Interface Gestionnaire — 3 éléments MAXIMUM :
┌──────────────────────────────────────────┐
│  VOTE : Approbation du PLU               │
│  Votants : 23  (procurations : 2)        │
│  ────────────────────────────────────── │
│  CONTRE      [ 0 ]  [-]  [+]            │
│  Noms contre : ___________________       │
│                                          │
│  ABSTENTIONS [ 0 ]  [-]  [+]            │
│  Noms abstention : ________________      │
│  ────────────────────────────────────── │
│  [ADOPTÉ À L'UNANIMITÉ] [CLÔTURER]      │
└──────────────────────────────────────────┘
```

**Bouton UNANIMITÉ** : si Contre=0 ET Abstentions=0 → 1 clic direct.
**UX critique** : 3 touches maximum, opérable à une main, grand bouton UNANIMITÉ.

### 7.2 Les 7 formules PV automatiques

Générer automatiquement selon le résultat dans `/lib/formules-pv/` :

| Résultat | Formule générée |
|---|---|
| Contre=0, Abstentions=0 | "Le [instance], après en avoir délibéré, ADOPTE à l'unanimité la délibération suivante :" |
| Contre=0, Abstentions≥1 | "...ADOPTE à l'unanimité moins [N] abstention(s) ([noms si saisis])..." |
| Contre≥1, Abstentions=0 | "...par [N] voix pour et [N] voix contre ([noms si saisis]), ADOPTE..." |
| Contre≥1, Abstentions≥1 | "...par [N] pour, [N] contre ([noms]) et [N] abstention(s) ([noms]), ADOPTE..." |
| Majorité contre | "...par [N] voix contre, REJETTE la proposition." |
| Égalité + voix prépondérante | "...la voix du Président étant prépondérante, ADOPTE..." |
| Nul | "...constate que le vote est nul ([N] abstentions)." |

### 7.3 Vote à bulletin SECRET — dissociation physique obligatoire

> ⚠️ **SÉCURITÉ CRITIQUE** : Deux tables SÉPARÉES. Jamais dans la même table.

```sql
-- TABLE 1 : QUI a voté (non secret)
votes_participation (
  vote_id      UUID,
  member_id    UUID,    -- identité visible ici
  a_vote       BOOLEAN,
  horodatage   TIMESTAMPTZ,
  device_id    TEXT
)  -- INSERT ONLY

-- TABLE 2 : CE QU'IL a voté (secret absolu)
bulletins_secret (
  vote_id        UUID,
  bulletin_token TEXT,  -- token anonyme 32 bytes — PAS de member_id
  choix_chiffre  TEXT,  -- AES-256-GCM(choix, VOTE_KEY_SEANCE, iv)
  hash_integrite TEXT,
  nonce          TEXT,
  horodatage     TIMESTAMPTZ
)  -- INSERT ONLY
```

**Le mapping `token ↔ member_id` n'existe qu'en mémoire serveur pendant le scrutin.**
**Il est DÉTRUIT à la clôture. Jamais persisté.**

**3 déclencheurs légaux du vote secret :**
1. Nominations/élections → automatique (obligatoire, non désactivable)
2. Demande du tiers des membres → bouton sur tablette élu (compte jusqu'au seuil)
3. Décision du Président → bouton Gestionnaire avant ouverture du vote

**Pendant le vote secret** : aucun résultat partiel visible, ni pour le Gestionnaire ni pour les élus.
**Après clôture** : résultats agrégés uniquement (jamais nominatifs).

### 7.4 Vote par appel nominal

Interface Gestionnaire : liste des élus, clic sur POUR/CONTRE/ABSTENTION/NSVP pour chacun.
Résultat entièrement nominatif dans le PV.

### 7.5 Télévote OTP

1. Ouverture vote → SMS à l'élu distant (OTP 6 chiffres, 8 min, usage unique)
2. Élu ouvre le lien sécurisé, saisit l'OTP, vote
3. Lien invalide immédiatement après soumission
4. Confirmation SMS + email avec reçu horodaté
5. Rate limit : 3 tentatives OTP max avant blocage

### 7.6 Vote par procuration

- Max 1 procuration par mandataire par séance (CGCT L2121-20) — UNIQUE constraint SQL
- Le mandataire voit 2 bulletins : le sien + celui de son mandant
- Peut voter différemment pour lui-même et pour son mandant
- Formule PV automatique : "M. X, porteur de la procuration de M. Y, a voté..."

### 7.7 Égalité des voix — voix prépondérante

```typescript
if (pour === contre && settings.voix_preponderante) {
  resultat = "ADOPTÉ"
  formule = "...la voix du Président étant prépondérante, ADOPTE..."
} else if (pour === contre) {
  resultat = "NUL"
}
```

---

## 8. CONFLITS D'INTÉRÊT — CGCT L2131-11

**Un élu avec un intérêt personnel dans un dossier DOIT se récuser.**

### Flux
1. L'élu clique "Me récuser" sur le point ODJ (ou Gestionnaire l'active)
2. Tablette de l'élu → inactive pour ce vote (bloquée techniquement)
3. Quorum recalculé en excluant l'élu récusé pour ce vote spécifique
4. Formule PV auto : "M. X, ayant déclaré un intérêt, s'est retiré lors du débat et du vote."
5. L'élu récupère ses droits au point suivant

---

## 9. INTÉGRITÉ CRYPTOGRAPHIQUE DES VOTES

### Pour chaque bulletin soumis

```
ÉTAPE 1 — Vérifications pré-vote (serveur)
  ✓ Session WebAuthn valide
  ✓ Élu convoqué à cette séance
  ✓ Élu marqué présent
  ✓ Élu non récusé pour ce point
  ✓ Élu n'a pas encore voté ce scrutin (count=0)
  ✓ Scrutin en statut OUVERT

ÉTAPE 2 — Hash d'intégrité
  hash = SHA-256(vote_id + member_id + choix + timestamp_serveur
                  + nonce_32bytes + HMAC_SECRET_INSTITUTION)

ÉTAPE 3 — Insertion INSERT-ONLY
  → Vote public : bulletins_vote (avec member_id)
  → Vote secret : bulletins_secret (sans member_id, avec token anonyme)

ÉTAPE 4 — Chiffrement AES-256-GCM (vote secret)
  VOTE_KEY_SEANCE = clé en mémoire serveur UNIQUEMENT
  → Détruite après déchiffrement et agrégation à la clôture

ÉTAPE 5 — Horodatage RFC 3161 (asynchrone, non bloquant)
  → Certificat TSA en background
  → Si indisponible : retry toutes les 5 min pendant 24h
```

> **RÈGLE CRITIQUE** : Le quorum est enregistré À L'OUVERTURE du vote (snapshot).
> Si un élu part pendant le scrutin, le vote reste valide (CGCT L2121-17).
> Champ `votes.quorum_a_ouverture` obligatoire.

---

## 10. ÉMARGEMENT — eIDAS ART. 26 + RFC 3161

### Moment : à l'arrivée, avant l'ouverture formelle

### Interface tablette élu
```
┌──────────────────────────────────────────────┐
│  ÉMARGEMENT — Séance du 15 avril 2026        │
│  Jean Dupont — Conseiller municipal          │
│  Heure d'arrivée : 18h34                    │
│  ────────────────────────────────────────── │
│  Je certifie être présent(e) à la séance    │
│  ────────────────────────────────────────── │
│  [Zone signature manuscrite]                │
│  ────────────────────────────────────────── │
│  [EFFACER]    [VALIDER MA PRÉSENCE]         │
└──────────────────────────────────────────────┘
```

### Traitement serveur
1. Capture biométrique du tracé (X/Y, pression, vitesse)
2. Document signé JSON : `{seance_id, member_id, nom, qualite, heure, device_id, webauthn_valid: true}`
3. `hash_document = SHA-256(JSON.stringify(document_signe))`
4. Stockage : `signature_svg, biometrie_hash, hash_document, horodatage_serveur, device_id`
5. Certificat RFC 3161 en background

### Cas de repli
Si WebAuthn échoue : impression feuille papier → signature manuscrite → scan uploadé → exception loggée.

---

## 11. SÉCURITÉ ET RGPD

### Authentification
- Email + MDP (min 12 caractères, score zxcvbn ≥ 3)
- 2FA TOTP obligatoire : Super-admin et Gestionnaire
- WebAuthn/FIDO2 : élus sur tablettes
- Session : expire après 8h d'inactivité (configurable)
- Blocage : 5 tentatives échouées
- JWT : rotation clés toutes les 24h
- Cookies : HttpOnly, Secure, SameSite=Strict

### Infrastructure
- HTTPS TLS 1.3 minimum
- Supabase EU (Frankfurt) — données 100% en Europe
- Vercel Edge EU
- Sauvegardes auto quotidiennes — 30 jours

### RGPD — Durées de conservation

| Donnée | Durée | Suppression |
|---|---|---|
| Identité élus | Durée mandat + 5 ans | Auto |
| Feuilles d'émargement | 10 ans | Auto |
| Bulletins de vote (anonymisés) | 6 ans | Auto |
| Procès-verbaux signés | Définitive | Jamais |
| Délibérations | Définitive | Jamais |
| Audit logs | 10 ans | Auto |

> **RGPD IA** : Avant tout appel API Anthropic — noms remplacés par "Élu A", "Élu B".
> Résultats de votes transmis en agrégé uniquement. Jamais de données nominatives vers l'API.

---

## 12. AVANT LA SÉANCE — CONVOCATIONS

### Délais légaux

| Type institution | Délai minimum | Calcul (séance le 15) |
|---|---|---|
| Commune > 3500 hab. | 5 jours francs | Envoi avant le 9 |
| Commune < 3500 hab. | 3 jours francs | Envoi avant le 11 |
| Syndicat / EPCI | Selon statuts (3-5 j) | Configurable |
| Association | Selon statuts (8-15 j) | Configurable |

> **"Jours francs"** = ni le jour d'envoi ni le jour de séance ne comptent.
> Si envoi trop tardif → BLOCAGE (override Super-admin avec motif obligatoire + log).

### Contenu obligatoire du PDF

- En-tête officiel (logo, nom, adresse, SIREN)
- Formule de convocation légale selon le type d'instance
- Date, heure, lieu précis
- ODJ complet et numéroté
- Lien documents préparatoires (espace sécurisé)
- Procédure de procuration
- Signature numérique du Président
- QR code de présence individuel (token UUID unique par élu par séance)
- Date d'envoi (preuve délai légal)

### 4 canaux d'envoi

1. **Email (Resend)** : PDF en PJ + HTML avec 3 boutons :
   - `[✅ CONFIRMER MA PRÉSENCE]` (lien tokenisé, sans login requis)
   - `[❌ JE SERAI ABSENT — PROCURATION]`
   - `[📄 ACCÉDER AUX DOCUMENTS]`
2. **SMS (Twilio)** : texte court + lien court tokenisé
3. **In-app** : notification push
4. **Courrier postal** : PDF haute qualité pour impression — agent coche manuellement la date d'envoi

### Traçabilité complète

| Événement | Déclencheur | Mise à jour statut |
|---|---|---|
| Email envoyé | Resend | ENVOYÉ + horodatage |
| Email ouvert | Webhook Resend | LU + horodatage |
| Confirmation présence | Clic bouton tokenisé | CONFIRMÉ_PRÉSENT |
| Bouton absent cliqué | Clic bouton tokenisé | ABSENT — procuration proposée |
| Email bounce | Webhook Resend | ERREUR_EMAIL → alerte immédiate |
| Courrier postal coché | Manuel Gestionnaire | ENVOYÉ_COURRIER + date |

### Cas particuliers

**Modification ODJ après envoi** : INTERDIT sans convocation rectificative.
Le système génère automatiquement le rectificatif PDF avec mention "RECTIFICATIF" et force un nouvel envoi.
Le délai légal repart de l'envoi rectificatif.

**Procuration téléphonique** : Le Gestionnaire peut créer une procuration "au nom de" un élu avec mention du canal (téléphone/email/SMS) + confirmation email envoyée à l'élu.

### Rappels configurables par instance (défauts)

| # | Délai | Canal | Destinataires |
|---|---|---|---|
| 1 | J-3 | Email + SMS | Tous |
| 2 | J-1 | Email + SMS | Tous |
| 3 | H-2 | SMS | Confirmés présents |
| 4 | H-1 | SMS | Confirmés présents |
| A | J-2 (alerte) | Email | Gestionnaire + Super-admin (si confirmés < quorum) |

---

## 13. PENDANT LA SÉANCE — DÉROULEMENT RÉEL

### 13.1 Arrivée d'un élu avant la séance

1. L'élu prend sa tablette (son nom affiché)
2. Authentification WebAuthn (Face ID / Touch ID)
3. Émargement immédiatement proposé → signature manuscrite
4. Validation → présent enregistré + heure
5. Accès à l'ODJ et documents

### 13.2 Ouverture formelle

- Gestionnaire clique "Ouvrir la séance" (disponible H-30min)
- Statut → EN_COURS, heure d'ouverture enregistrée côté serveur

### 13.3 Séquence obligatoire en début de séance

**1er vote : Désignation du Secrétaire de séance**
- L'élu désigné obtient le rôle `secretaire_seance` pour cette séance
- Droits de signature du PV activés sur sa tablette
- Non bloquant : si non désigné → avertissement à la clôture (pas blocage)

**2e vote : Approbation du PV de la séance précédente**
- PV précédent affiché sur toutes les tablettes
- Si adopté → statut APPROUVÉ_EN_SÉANCE, immuable
- Si corrections demandées → noté, reporté à la séance suivante

### 13.4 Quorum

- Vérifié en temps réel (recalcul à chaque changement de présence)
- **Snapshot à l'ouverture de chaque vote** → enregistré dans `votes.quorum_a_ouverture`
- Bandeau vert (atteint) ou rouge (insuffisant) permanent sur écran Gestionnaire

**Reconvocation** : quorum non bloquant, marqué "séance sur reconvocation" dans PV.

### 13.5 Ce que voit l'élu pendant une présentation

```
┌──────────────────────────────────────────────────────┐
│  POINT 4/8 — Approbation PLU              ●○○○○○○○  │
│  Rapporteur : M. Bernard                             │
│  ─────────────────────────────────────────────────  │
│  DOCUMENTS                                           │
│  [📄 Rapport PLU]  [📄 Avis commission urbanisme]    │
│  ─────────────────────────────────────────────────  │
│  PROJET DE DÉLIBÉRATION                  [Ouvrir]   │
│  Vu le Code de l'urbanisme art. L153-1...            │
│  Considérant que...                                  │
│  ARTICLE 1 : Approuve le PLU révisé                 │
│  ARTICLE 2 : Dit que...                             │
│  ─────────────────────────────────────────────────  │
│  [✋ DEMANDER LA PAROLE] [🔒 DEMANDER VOTE SECRET]   │
│  ─────────────────────────────────────────────────  │
│  Prochain point : Budget primitif 2026              │
└──────────────────────────────────────────────────────┘
```

### 13.6 Ce qui se passe lors d'un vote

Gestionnaire ouvre le vote → **TOUTES les tablettes changent simultanément** :

**Élu (main levée)** : "Vote en cours — levez la main si contre ou abstention"
**Élu (vote secret)** : bulletin confidentiel avec choix + timer

**Grande Scène (vidéoprojecteur)** :
- Vote en cours : "VOTE EN COURS" animé
- Résultat : "ADOPTÉ À L'UNANIMITÉ" ou "Pour : 18 / Contre : 3 / Abstentions : 2"
- Vote secret : "🔒 VOTE À BULLETIN SECRET EN COURS" (aucun résultat partiel)

### 13.7 Vue par acteur pendant un vote

**Président** : dirige à l'oral. Ne touche pas l'application. Sa tablette affiche les résultats à la clôture.

**Gestionnaire** : saisit Contre + Abstentions → calcule automatiquement → clôture.

**Élu (main levée)** : lève la main physiquement. Ne touche pas sa tablette.

**Élu (vote secret)** : vote sur sa tablette.

**Public / Grande Scène** : résultats en grand, jamais les noms en mode secret.

### 13.8 Huis clos — procédure légale

1. Vote du conseil pour approuver le huis clos
2. Gestionnaire active → observateurs exclus, grande scène neutralisée, visio coupée
3. Séance en huis clos — PV distinct non public
4. Vote pour reprendre la séance publique

### 13.9 Questions diverses — JAMAIS de vote

> **LÉGAL** : Les QD sont informatives. Impossible de voter sur une QD (CGCT L2121-10).
> Blocage technique si tentative de lancement d'un vote sur un point QD.

### 13.10 Clôture

- Heure de clôture enregistrée côté serveur
- Brouillon PV compilé automatiquement
- Rapport d'intégrité global généré
- Notifications post-séance envoyées

---

## 14. APRÈS LA SÉANCE — PV ET ARCHIVAGE

### 14.1 Structure réelle d'un PV

```
1. En-tête légal (institution, date, type, référence)
2. Membres présents (liste nominative complète)
3. Membres excusés + procurations
4. Membres absents sans excuse
5. Constatation du quorum
6. Désignation secrétaire de séance (1er vote)
7. Approbation PV précédent (2e vote)
8. Pour chaque point ODJ :
   [Numéro] — [Titre]
   Vu [texte légal]...
   Considérant [motifs]...
   [Formule de vote automatique]
   ARTICLE 1 : Décide de...
   ARTICLE 2 : Dit que...
   ARTICLE 3 : Charge M. le Président de l'exécution...
9. Questions diverses (informatif, sans vote)
10. Clôture (heure précise)
11. Signatures : Président + Secrétaire de séance
```

### 14.2 Circuit de validation

```
BROUILLON → EN RELECTURE → APPROUVÉ EN SÉANCE → SIGNÉ → PUBLIÉ

BROUILLON      : Gestionnaire / Préparateur complète
EN RELECTURE   : Partagé aux élus (commentaires)
APPROUVÉ       : Vote en séance suivante (2e point ODJ)
SIGNÉ          : Président + Secrétaire signent — PV verrouillé — PDF/A généré
PUBLIÉ         : Accessible publiquement
```

> **PV signé = immuable.** Table `pv` : aucun UPDATE sur contenu après statut SIGNÉ.

### 14.3 Délibérations

- Numérotation séquentielle **à la publication** (jamais à la création)
- Format configurable : AAAA-NNN, préfixe optionnel (CM-2026-042)
- Structure : Vu / Considérant / ARTICLE 1 / ARTICLE 2 / ARTICLE 3
- Case "Transmis au contrôle de légalité préfectoral" avec date (alerte J+10 si non transmis)
- Délibération publiée = immuable

### 14.4 Archivage

| Document | Durée | Format |
|---|---|---|
| Convocations + accusés | 5 ans | PDF |
| Émargements signés | 10 ans | PDF/A + RFC 3161 |
| PV signés | Définitive | PDF/A-1b + JSON |
| Délibérations | Définitive | PDF/A-1b |
| Bulletins vote (anonymisés) | 6 ans | JSON chiffré |
| Audit log | 10 ans | JSON append-only |

---

## 15. DOCUMENTS GÉNÉRÉS AUTOMATIQUEMENT

| Document | Déclencheur | Format |
|---|---|---|
| Convocation officielle + ODJ | Envoi des convocations | PDF email + imprimable |
| Formulaire de procuration | Demande d'un élu | PDF à signer |
| Feuille d'émargement | Ouverture séance | PDF A4 + signatures |
| Rapport de résultats par vote | Clôture de chaque vote | PDF + JSON |
| Procès-verbal | Clôture séance | PDF/A-1b signé |
| Délibération numérotée | Vote adopté | PDF/A-1b |
| Registre annuel délibérations | Export manuel | PDF/A multi-pages |
| Export @CTES | Manuel (Phase 1) / Auto (Phase 5) | XML structuré |
| Rapport d'intégrité séance | Clôture séance | PDF + JSON |

---

## 16. MODULE IA — CLAUDE SONNET 4.6

```
Model   : claude-sonnet-4-20250514
Endpoint: POST https://api.anthropic.com/v1/messages
Auth    : Bearer ANTHROPIC_API_KEY (Server Action UNIQUEMENT)
```

> ⚠️ **RGPD** : Anonymisation OBLIGATOIRE avant chaque appel.
> Noms → "Élu A", "Élu B"... Résultats agrégés uniquement.

| Fonction | Déclencheur | Input | Output |
|---|---|---|---|
| Génération brouillon PV | Bouton après clôture | Notes + résultats + ODJ (anonymisés) | Texte PV structuré avec formules légales |
| Rédaction Vu/Considérant | Bouton sur point ODJ | Titre + contexte | Texte légal formalisé |
| Corps délibération | Bouton sur délibération | Titre + votes | ARTICLE 1, 2, 3 rédigés |
| Résumé post-séance | Auto H+1 | PV brouillon agrégé | Email résumé pour absents |
| Vérification conformité ODJ | Avant envoi convocations | ODJ + type institution | Alertes légales (lecture seule) |

> L'IA est TOUJOURS optionnelle. Si API indisponible → éditeur de texte classique.
> Jamais bloquant.

---

## 17. ARCHITECTURE TECHNIQUE

### Stack

| Couche | Technologie | Notes |
|---|---|---|
| Frontend | Next.js 14 App Router + TypeScript strict | SSR, PWA |
| UI | shadcn/ui + Tailwind CSS | RGAA 4.1 |
| Backend | Server Actions + API Routes | Logique métier côté serveur |
| BDD | Supabase PostgreSQL | RLS, Realtime, Storage |
| Auth web | Supabase Auth + TOTP 2FA | JWT, invitations |
| Auth tablette | WebAuthn / FIDO2 | Secure Enclave, biométrie |
| Temps réel | Supabase Realtime (WebSocket) | Votes live, présences live |
| Emails | Resend + React Email | Délivrabilité + SPF/DKIM/DMARC |
| SMS | Twilio | OTP télévote, rappels |
| PDF | **React-PDF uniquement** | PAS Puppeteer (incompatible Vercel) |
| IA | API Anthropic Sonnet 4.6 | Server Action uniquement |
| Stockage | Supabase Storage (S3) | Accès contrôlé |
| CI/CD | GitHub Actions → Vercel | Preview par PR |
| Monitoring | Sentry | Erreurs + alertes |

### Schéma base de données (tables principales)

```sql
-- Configuration institution
institution_config (id, nom_officiel, type_institution, siren, 
  adresse_siege, email_secretariat, logo_url, signature_president_url,
  session_timeout_heures, otp_expiration_minutes, ...)

-- Configuration par instance
instance_config (id, nom, type_legal, composition_max,
  delai_convocation_jours, quorum_type, voix_preponderante,
  vote_secret_nominations, mode_arrivee_tardive, ...)

-- Rappels configurables (N par instance)
rappels_config (id, instance_config_id, actif, ordre,
  delai_valeur, delai_unite, canal[], destinataires, ...)

-- Membres
members (id, user_id, role, function_title, phone,
  webauthn_credential_id, device_id, active,
  mandate_start, mandate_end)

-- Versioning membres (JAMAIS de suppression)
members_versions (id, member_id, data jsonb, valid_from, valid_until)

-- Séances
seances (id, instance_type, title, date_seance, lieu, mode,
  statut, quorum_requis, quorum_atteint, voix_preponderante,
  late_arrival_mode, public, secretaire_seance_id,
  president_effectif_seance_id, heure_ouverture, heure_cloture,
  reconvocation)

-- Convocataires
convocataires (id, seance_id, member_id, statut_presence,
  procuration_donnee_a, ar_recu_at, canal_communication)

-- Points ODJ
odj_points (id, seance_id, position, titre, type_traitement,
  huis_clos, votes_interdits, rapporteur_id, statut,
  notes_seance, source_bureau_deliberation_id, majorite_requise)

-- Présences (émargement)
presences (id, seance_id, member_id, statut,
  heure_arrivee, heure_depart, signature_svg, biometrie_hash,
  hash_document, horodatage_serveur, timestamp_tsa, device_id,
  webauthn_assertion_id, mode_authentification)

-- Récusations
recusations (id, seance_id, odj_point_id, member_id,
  motif, declared_by, horodatage)

-- Votes
votes (id, odj_point_id, seance_id, type_vote, statut,
  question, pour, contre, abstention, nul, total_votants,
  quorum_a_ouverture,  -- SNAPSHOT obligatoire
  voix_preponderante_activee, resultat, formule_pv,
  ouvert_at, clos_at)

-- Bulletins vote PUBLIC (avec identité)
bulletins_vote (id, vote_id, member_id, choix,
  horodatage_serveur, hash_integrite, nonce, device_id,
  est_procuration, mandant_id)  -- INSERT ONLY

-- Vote secret : participation (sans choix)
votes_participation (id, vote_id, member_id, a_vote,
  horodatage_serveur, device_id)  -- INSERT ONLY

-- Vote secret : bulletins (sans identité)
bulletins_secret (id, vote_id, bulletin_token,
  choix_chiffre, hash_integrite, nonce,
  horodatage_serveur)  -- INSERT ONLY

-- Procurations
procurations (id, seance_id, mandant_id, mandataire_id,
  valide, document_url, validee_par, validee_at,
  cree_par_gestionnaire, canal_communication)

-- PV
pv (id, seance_id, contenu_json, statut, version,
  signe_par jsonb, signe_at, pdf_url, approuve_en_seance_id)

-- Délibérations
deliberations (id, seance_id, vote_id, numero, titre,
  contenu_articles jsonb, publie_at, affiché_at,
  transmis_prefecture_at, pdf_url)

-- Audit log (APPEND ONLY — jamais effaçable)
audit_log (id, user_id, action, table_name, record_id,
  old_values jsonb, new_values jsonb, ip, user_agent, created_at)
```

### Variables d'environnement

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Institution (single-tenant)
NEXT_PUBLIC_INSTITUTION_NAME=
NEXT_PUBLIC_INSTITUTION_TYPE=    # commune|syndicat|cc|departement|asso
NEXT_PUBLIC_INSTITUTION_SIREN=
NEXT_PUBLIC_APP_URL=

# Services (SERVEUR UNIQUEMENT)
ANTHROPIC_API_KEY=
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Sécurité
NEXTAUTH_SECRET=
VOTE_HMAC_SECRET=
VOTE_ENCRYPTION_KEY=             # AES-256
WEBAUTHN_RP_ID=
WEBAUTHN_RP_NAME=

# Monitoring
SENTRY_DSN=
```

---

## 18. RÈGLES MÉTIER CRITIQUES — 32 RÈGLES

| ID | Règle | Niveau |
|---|---|---|
| RM-01 | Single-tenant absolu — aucune colonne org_id | Architectural |
| RM-02 | Délai légal convocation — blocage si dépassé | Légal critique |
| RM-03 | ODJ validé avant envoi convocations | Critique |
| RM-04 | Procurations validées avant ouverture séance | Critique |
| RM-05 | Secrétaire de séance désigné — avertissement (non bloquant) | Légal |
| RM-06 | Approbation PV précédent = 2e vote obligatoire en séance | Légal |
| RM-07 | Quorum vérifié avant activation des votes | Critique |
| RM-08 | Reconvocation : quorum non bloquant, marqué dans PV | Légal |
| RM-09 | 1 procuration max par mandataire par séance — UNIQUE constraint | Bloquant |
| RM-10 | 1 bulletin par élu par scrutin — UNIQUE constraint (vote_id, member_id) | Bloquant |
| RM-11 | Conflit d'intérêt : élu récusé ne peut PAS voter — blocage technique | Légal critique |
| RM-12 | Questions diverses : AUCUN vote possible — blocage technique | Légal |
| RM-13 | Huis clos : vote du conseil requis pour activer | Légal |
| RM-14 | Vote main levée : Pour = Total − Contre − Abstentions (côté serveur) | Métier central |
| RM-15 | Unanimité détectée automatiquement : Contre=0 ET Abstentions=0 | Métier central |
| RM-16 | Formule PV générée selon résultat — 7 cas couverts | Métier central |
| RM-17 | Voix prépondérante si égalité — configurable par instance | Légal/configurable |
| RM-18 | Vote secret : 3 déclencheurs légaux (nominations/1/3 membres/Président) | Légal critique |
| RM-18b | Vote secret : dissociation physique — 2 tables séparées | Sécurité critique |
| RM-18c | Vote secret : bulletin_token ≠ member_id | Sécurité critique |
| RM-18d | Vote secret : clé AES détruite à la clôture — jamais persistée | Sécurité critique |
| RM-18e | Vote secret : résultats agrégés uniquement — jamais nominatifs | Sécurité critique |
| RM-19 | Hash d'intégrité SHA-256 sur chaque bulletin | Intégrité légale |
| RM-20 | Tables bulletins : INSERT ONLY — aucun UPDATE/DELETE | Intégrité légale |
| RM-21 | PV signé = immuable — aucun UPDATE après statut SIGNÉ | Intégrité légale |
| RM-22 | PV approuvé = vote en séance suivante (pas circuit numérique seul) | Légal |
| RM-23 | Délibération publiée = immuable | Intégrité légale |
| RM-24 | Transmission préfecture sous 15 jours — alerte J+10 | Légal |
| RM-25 | Toutes les actions loggées dans audit_log — APPEND ONLY | Conformité |
| RM-26 | Tablette assignée à un élu unique — device_id ↔ member_id | Sécurité |
| RM-27 | WebAuthn : zéro donnée biométrique en base | RGPD + Sécurité |
| RM-28 | Émargement conforme eIDAS art. 26 | Légal |
| RM-29 | OTP télévote : usage unique, 8 min, 3 essais max | Sécurité |
| RM-30 | Données IA anonymisées avant appel API Anthropic | RGPD |
| RM-31 | Hébergement EU exclusivement (Supabase Frankfurt, Vercel EU) | RGPD |
| RM-32 | Bureau → Conseil : transmission manuelle uniquement | Métier |

---

## 19. PLAN DE DÉVELOPPEMENT — 5 PHASES

### Phase 1 — MVP Core (7 semaines)

**Périmètre :**
- Auth Supabase + invitations + 2FA TOTP
- Module Configuration (Blocs 1, 2, 3)
- Gestion membres + assignation tablettes WebAuthn basique
- Création séance + ODJ (drag & drop points)
- Convocations email (Resend) + boutons de confirmation tokenisés
- Présences : appel manuel + WebAuthn + émargement simple
- Vote à main levée (saisie Contre/Abstentions par Gestionnaire)
- Formules PV automatiques (7 cas)
- Détection unanimité automatique
- PV brouillon (éditeur texte)
- Déploiement Vercel + GitHub Actions

**Critère de validation :** 1 séance complète de bout en bout.

### Phase 2 — Votes complets (5 semaines)

- Vote à bulletin secret (AES-256 + 2 tables dissociées)
- Vote par appel nominal
- Télévote OTP SMS
- Procurations (dont création par Gestionnaire)
- Quorum snapshot à l'ouverture du vote
- Arrivée tardive configurable (3 modes)
- Voix prépondérante du Président
- Conflit d'intérêt (récusation)
- Huis clos (procédure légale)
- Désignation secrétaire de séance (vote formel ou direct)
- Approbation PV en séance

### Phase 3 — Documents officiels (4 semaines)

- Émargement eIDAS art. 26 + WebAuthn + RFC 3161
- React-PDF : tous les documents (convocation, PV, délibérations, émargement, procuration)
- Circuit validation PV complet
- Délibérations numérotées (attribution à la publication)
- Archivage PDF/A-1b
- Export @CTES (XML manuel)
- Rapport d'intégrité post-scrutin

### Phase 4 — IA + Notifications (3 semaines)

- Module Claude Sonnet 4.6 (PV, Vu/Considérant, Articles délibérations)
- Anonymisation RGPD obligatoire avant appel API
- Rappels automatiques configurables (SMS + Email)
- Résumé post-séance automatique
- Vérification conformité ODJ avant envoi convocations

### Phase 5 — Finalisation (3 semaines)

- Mode offline de secours (vote public en queue locale)
- OTP présence visio avant chaque vote
- Mode Grande Scène vidéoprojecteur
- Dashboard analytics
- PWA installable (iOS + Android)
- Recherche plein texte délibérations (pg_trgm + tsvector)
- @CTES automatisé (testé préfecture par préfecture)
- Import données historiques (membres CSV + délibérations PDF)

---

## 20. MODULE DE CONFIGURATION — PARAMÉTRAGE INSTITUTIONNEL

### Architecture à 2 niveaux

**Niveau 1 — Institution** (Super-admin, modifié très rarement) :
Identité légale, sécurité, intégrations externes, numérotation

**Niveau 2 — Par instance** (Super-admin + Gestionnaire, début de mandat) :
Membres, quorum, votes, templates, rappels — séparé pour chaque instance

### Bloc 1 — Identité légale
Nom officiel, type institution, SIREN/SIRET, adresse du siège, email secrétariat, logo, signature Président, DPO (nom + email), URL portail public, préfecture de rattachement.

### Bloc 2 — Instances
Pour chaque instance (Bureau / Conseil / AG...) :
Nom, type légal, composition max, délai convocation, règle quorum, voix prépondérante, vote secret auto pour nominations, mode arrivée tardive, séances publiques par défaut, votes QD autorisés.

### Bloc 3 — Membres
Nom/prénom, qualité officielle, instance(s), rôle, adresse postale, email, téléphone, préférences notification, tablette assignée (device_id), dates de mandat, groupe politique (optionnel).

> **Versioning obligatoire** : modification = nouvelle version (jamais d'écrasement).
> Statuts : ACTIF → SUSPENDU → FIN_DE_MANDAT → DÉCÉDÉ (jamais de suppression physique).

### Bloc 4 — Rappels configurables

Pour chaque rappel :
- `actif` (on/off sans suppression)
- `delai_valeur` + `delai_unite` (jours ou heures)
- `canal[]` (email, SMS, in-app)
- `destinataires` (tous / non_confirmés / confirmés)
- Template du message (variables dynamiques)

**Variables disponibles dans les templates :**
`{{prenom}}`, `{{nom}}`, `{{date_seance}}`, `{{heure_seance}}`, `{{lieu}}`,
`{{instance}}`, `{{lien_confirmation}}`, `{{lien_documents}}`, `{{lien_procuration}}`,
`{{nom_institution}}`, `{{secretariat_email}}`, `{{secretariat_tel}}`

### Bloc 5 — Templates documents
Convocation, email HTML, SMS, PV, délibération, émargement, procuration, rappels.
Variables dynamiques, versioning activé.

### Bloc 6 — Règles de vote
Majorité par défaut (simple/absolue/qualifiée/unanimité), voix prépondérante, vote secret auto nominations, appel nominal disponible, télévote disponible, identification nominative votes.

### Bloc 7 — Délais légaux
Délai convocation (configurable), affichage délibérations (défaut 24h), transmission préfecture (défaut 15j), délai reconvocation.

### Bloc 8 — Sécurité
Session timeout, tentatives login, 2FA par rôle, mode kiosque tablette, longueur MDP, durée OTP.

### Bloc 9 — Intégrations
Resend (clé API, domaine expéditeur), Twilio (SID, token, numéro), Anthropic (clé API), @CTES (endpoint), Sentry (DSN). Bouton "Tester" pour chaque intégration.

**Checklist délivrabilité email obligatoire :**
- SPF configuré dans les DNS
- DKIM configuré (Resend génère automatiquement)
- DMARC configuré
- Sous-domaine dédié recommandé (conseil@mairie-x.fr)

### Bloc 10 — Numérotation délibérations
Format (AAAA-NNN, préfixe optionnel), remise à zéro annuelle, numéro de départ (pour migration).

> **Règle** : numéro attribué à la PUBLICATION, jamais à la création.

### Checklist de mise en service (10 étapes)

1. Renseigner l'identité légale
2. Créer les instances (Bureau, Conseil...)
3. Importer ou créer les membres
4. Assigner les tablettes aux membres
5. Configurer les rappels
6. Personnaliser les templates
7. Configurer Resend (email + SPF/DKIM/DMARC)
8. Configurer Twilio (SMS)
9. Tester un envoi de convocation complet
10. Configurer la numérotation des délibérations

---

## 21. CORRECTIONS TERRAIN — 22 PROBLÈMES À NE PAS OUBLIER

### 21.1 Interface vote — ultra-simplifiée (PRIORITÉ 1)
3 éléments max : compteur Contre, compteur Abstention, bouton Clôturer.
Bouton UNANIMITÉ : priorité visuelle maximale, accessible en 1 tap.
Raccourcis clavier : U=unanimité, C=+contre, A=+abstention, Entrée=clôturer.

### 21.2 Tablette en veille en séance
À l'ouverture de séance : activer **Screen Wake Lock API** (`navigator.wakeLock.request('screen')`).
Session WebAuthn maintenue active toute la séance (pas de re-authentification).
Si tablette se rallume pendant un vote : retour automatique sur le bulletin en cours.

### 21.3 Secrétaire de séance non bloquant
Deux modes : vote formel OU désignation directe par le Président (loggée).
La clôture sans secrétaire = avertissement uniquement, pas blocage.

### 21.4 Vote secret impossible offline
Vote secret nécessite le serveur (clé AES en mémoire serveur).
Si réseau absent : bascule automatique en main levée avec confirmation Gestionnaire + log.
Timer 3 min pour reconnexion si réseau tombe pendant un vote secret en cours.

### 21.5 Quorum = snapshot à l'ouverture
Champ `votes.quorum_a_ouverture` : enregistrer le quorum AU MOMENT DE L'OUVERTURE.
Le vote reste valide si un élu part après le début du scrutin (CGCT L2121-17).

### 21.6 Procuration par téléphone
Gestionnaire peut créer la procuration "au nom de" l'élu.
Champ obligatoire : canal de communication (téléphone/email/SMS).
Email de confirmation automatique envoyé à l'élu.

### 21.7 Président absent — Vice-Président remplaçant
Champ `seances.president_effectif_seance_id` (peut différer du président permanent).
PV automatique : "Présidée par M. X, Vice-Président, en l'absence de M. Y, Président".

### 21.8 Vote contesté après clôture
Bouton "Contester" disponible 30 min après clôture (non configurable).
Contestation → délibération suspendue (statut CONTESTÉE) → alerte Super-admin.
Si annulé : délibération annulée avec motif + mention dans PV.

### 21.9 Versioning des membres
`members_versions` : snapshot de chaque modification.
Votes historiques pointent vers la version du membre au moment du vote.
Jamais de suppression physique si historique de vote.

### 21.10 Numérotation sans trous
Numéro attribué à la publication, pas à la création.
Délibération annulée après publication → note d'annulation même numéro (jamais réutilisé).

### 21.11 Race conditions — authentifications simultanées
Calcul quorum via fonction SQL atomique (COUNT avec FOR UPDATE).
Mise à jour quorum toutes les 2 secondes sur écran Gestionnaire (pas Realtime pur).

### 21.12 TSA asynchrone
RFC 3161 = jamais bloquant. Vote/signature enregistré immédiatement.
Certificat TSA en background, retry toutes les 5 min si indisponible.

### 21.13 Approbation PV — alternatives
Mode 1 (défaut) : vote en séance suivante.
Mode 2 (configurable) : circuit numérique si séance suivante tarde.

### 21.14 Mode assistance élus seniors
Gestionnaire peut opérer la tablette d'un élu en sa présence → loggé "assisté".
Formation tablette dans la checklist de mise en service.

### 21.15 Vote secret + réseau coupé
Si votes partiels reçus avant coupure : conservés (INSERT ONLY).
À la reconnexion : Gestionnaire choisit annuler ou forcer la clôture partielle.

### 21.16 Délivrabilité email
SPF + DKIM + DMARC obligatoires (checklist Bloc 9).
Alerte si taux d'ouverture < 50%.

### 21.17 Sessions longues (AG 6-8h)
Refresh token JWT silencieux sans interruption.
Session configurable jusqu'à 24h.

### 21.18 Scrutin de liste (Phase 3)
Prévoir la structure de données extensible dès la Phase 1.

### 21.19 Majorité requise par point ODJ
Renseignée lors de la préparation (pas en séance).
Affichée avant ouverture du vote : "⚠ Ce point requiert une MAJORITÉ QUALIFIÉE (2/3)".

### 21.20 Prérequis WebAuthn
iOS 14+ / Android 9+, Safari 14+ / Chrome 76+.
Si tablette incompatible → PIN uniquement (valeur eIDAS réduite, documenter).

### 21.21 Gestionnaire = Secrétaire de séance
Un utilisateur peut cumuler les deux rôles dans la même séance.
L'interface affiche les deux panneaux simultanément.

### 21.22 @CTES — Manuel Phase 1
Export XML généré, transmission par l'agent (manuelle).
Automatisation Phase 5, testée préfecture par préfecture.

---

## 22. UX/UI — SPÉCIFICATIONS COMPLÈTES

### 22.1 Les 4 contextes d'usage — LAYOUTS DISTINCTS

| Contexte | Appareil | Contraintes | Style |
|---|---|---|---|
| Bureau (préparation) | PC/Mac | Calme, à l'avance | Dense, back-office |
| Séance (conduite) | Tablette/PC en salle | Sous pression, public | Épuré, très grands boutons |
| Vote (élu en séance) | Tablette kiosque | 30 secondes, stress | Ultra-minimal, 1 action |
| Consultation (hors séance) | Smartphone | Détendu, anywhere | Lecture, navigation standard |

> **4 layouts distincts** — pas du responsive sur un seul layout.

### 22.2 Design system — tokens

```css
--color-primary: #0D2B55;    /* Navy — institutionnel */
--color-secondary: #1565C0;  /* Bleu — actions principales */
--color-action: #1E88E5;     /* Bleu clair — secondaires */
--color-success: #1B5E20;    /* Vert — quorum OK, confirmé */
--color-warning: #E65100;    /* Orange — alertes */
--color-danger: #B71C1C;     /* Rouge — erreurs, bloquants */
--color-bg: #F5F5F5;
--color-surface: #FFFFFF;
--color-text: #212121;
--color-text-subtle: #757575;
```

**Typographie** : Inter (Google Fonts)
- Bureau : 16px base
- Séance Gestionnaire : 18px base
- Tablette élu : 22px base
- Grande Scène : 60px minimum

**Tailles tactiles** :
- Mobile standard : 44px
- Tablette séance : 56px
- Vote élu : 80px (stress, maladresse)

### 22.3 États d'interface — tous obligatoires

**Vide** : illustration + CTA. "Créez votre première séance"
**Chargement** : skeleton screens par composant (pas de spinner global)
**Erreur réseau** : bannière "Mode hors ligne — votes synchronisés à la reconnexion"
**Erreur serveur** : message + code (ERR-VOTE-001) + bouton réessayer
**Succès vote** : animation checkmark + vibration haptique (`navigator.vibrate(50)`)
**Hors-ligne** : bannière orange permanente + icône nuage barré sur actions impossibles offline

### 22.4 Hiérarchie des alertes

| Niveau | Exemples | Composant | Comportement |
|---|---|---|---|
| CRITIQUE | Quorum non atteint, doublon procuration | Modal plein écran rouge | Bloque l'action, ne disparaît pas seul |
| IMPORTANT | Élu arrivé en retard, réseau instable | Toast persistant rouge/orange | Reste jusqu'à action consciente |
| INFO | Convocations envoyées, vote clôturé | Toast temporaire vert | Disparaît après 4 secondes |
| DISCRET | 3 non-confirmés | Badge chiffré sur icône nav | Visible, non perturbant |

### 22.5 Tablette élu — spécifications précises

- Taille min. éléments tactiles : **56px** (élus stressés, mains qui tremblent)
- Police min. : **18px** pour tout texte opérationnel
- Contraste min. : **7:1** (WCAG AAA — salles éclairées, reflets)
- Support portrait ET paysage
- **Mode grande lisibilité** : +150% sur tout, activable en 2 taps
- **Feedback haptique** : `navigator.vibrate(50)` à la validation d'un vote
- **Timeout confirmation** : 5 secondes après vote avant retour à l'ODJ (compteur visible)
- Screen Wake Lock activé pendant toute la séance

### 22.6 Mode Grande Scène

- Résolution cible : 1920×1080
- Texte visible depuis 10m : 60px minimum
- Activation : 1 bouton Gestionnaire → nouvel onglet fullscreen
- Pas de photosensibilité (pas de clignotements)

| Mode | Affiché | Masqué |
|---|---|---|
| Attente | Logo + instance + point en cours | Tout le reste |
| Vote en cours | "VOTE EN COURS" + décompte | Résultats partiels |
| Résultat | "ADOPTÉ À L'UNANIMITÉ" ou chiffres | Noms si vote secret |
| Vote secret | "🔒 VOTE À BULLETIN SECRET EN COURS" | Tout résultat |
| Huis clos | Logo + "Séance en cours" | Tout le contenu |

### 22.7 Confirmations actions irréversibles

| Action | Pattern |
|---|---|
| Signer le PV | Modal + avertissement légal + bouton "SIGNER DÉFINITIVEMENT" |
| Publier délibération | Modal + saisie obligatoire du mot "PUBLIER" |
| Annuler un vote clôturé | Modal + motif obligatoire (min 20 caractères) |
| Supprimer un document | Toast avec undo 5 secondes |
| Clôturer la séance | Modal avec checklist (PV en cours ? docs manquants ?) |
| Envoyer les convocations | Prévisualisation + liste destinataires + délai légal OK |

### 22.8 Smartphone élu — hors séance

- Navigation bottom bar : 4 onglets (Séances / Documents / Délibérations / Mon compte)
- Swipe horizontal entre documents d'une séance
- PDF viewer intégré optimisé mobile + mode nuit
- Téléchargement PDF hors ligne
- Bouton confirmation présence accessible depuis la notification (sans ouvrir l'app)
- Biométrie smartphone pour signature PV hors séance

### 22.9 Emails transactionnels

| Email | Design | Éléments clés |
|---|---|---|
| Convocation | Sobre, institutionnel, logo | 3 boutons : Confirmer / Absent+Proc / Documents. ODJ inline. |
| Rappel | Court, urgent selon délai | 1 bouton, date/heure/lieu en évidence |
| PV pour relecture | Simple | Lien PV + deadline |
| Résultats post-séance | Structuré | Liste délibérations ✅/❌ |
| Invitation | Chaleureux mais sobre | Instructions connexion + WebAuthn |

Version texte brut en fallback obligatoire pour chaque email.
Tester sur : Gmail, Outlook, Apple Mail, Roundcube.

### 22.10 Aide contextuelle

- Tooltip sur chaque action non évidente (survol desktop / long press mobile)
- Guide "Première séance" : wizard 5 étapes à la première connexion Gestionnaire
- Icône `?` à côté des champs légaux complexes → définition + réf. légale

### 22.11 Navigation et flux

- Bouton "Point suivant" : toujours visible en bas de l'écran Gestionnaire (pas de scroll)
- Undo 10 secondes : ajout point ODJ, ajout document, modification note
- Aucun undo : votes, signatures, envoi convocations, publications
- Fil d'Ariane sur toutes les pages de gestion
- Raccourcis clavier documentés : K=suivant, V=vote, U=unanimité, Esc=annuler
- Deep linking : `/seances/[id]` · `/seances/[id]/vote` · `/deliberations/[numero]`

### 22.12 Moteur de recherche délibérations

- Recherche plein texte : titre, contenu, articles
- Filtres : période, instance, résultat (adopté/rejeté), rapporteur
- Highlight du terme dans les extraits
- Accès public (publiées) / membres (toutes)
- Export PDF ou CSV
- Technique : PostgreSQL `pg_trgm` + `tsvector` sur Supabase

### 22.13 Pages d'erreur

- `404` : message + bouton retour + recherche
- `403` : "Accès refusé"
- `500` : "Équipes notifiées" + réessayer
- PWA hors ligne : "Données locales disponibles"
- Session expirée : retour à la page en cours après reconnexion

---

## RÉSUMÉ POUR CLAUDE CODE — LES 10 POINTS LES PLUS IMPORTANTS

1. **SINGLE-TENANT** : Pas de colonne org_id. Jamais.
2. **Vote main levée** : Pour = Total − Contre − Abstentions. L'interface a 3 éléments max.
3. **Vote secret** : 2 tables séparées (`votes_participation` + `bulletins_secret`). Clé AES détruite à la clôture.
4. **Formules PV** : 7 cas dans `/lib/formules-pv/`. Générées automatiquement.
5. **Quorum** : Enregistrer le snapshot `quorum_a_ouverture` au lancement du vote.
6. **Tables votes** : INSERT ONLY. Aucun UPDATE ni DELETE en RLS.
7. **PDF** : React-PDF uniquement. Jamais Puppeteer sur Vercel.
8. **IA** : Server Action uniquement. Anonymisation obligatoire avant appel.
9. **Screen Wake Lock** : Activer à l'ouverture de séance sur les tablettes.
10. **Numérotation** : Délibération numérotée à la publication, jamais à la création.

---

*CDC V3.0 — Mars 2026 — Single-tenant · WebAuthn/FIDO2 · Next.js · Supabase · Vercel · GitHub*
