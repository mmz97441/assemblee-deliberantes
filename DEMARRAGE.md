# GUIDE DE DÉMARRAGE — COWORK / CLAUDE CODE
## Système de gestion des séances délibérantes

---

## CE QU'IL FAUT FAIRE AVANT D'OUVRIR CLAUDE DESKTOP

### 1. Créer le dépôt GitHub

1. Va sur github.com → New repository
2. Nom : `assemblee-deliberantes` (ou le nom de ton institution)
3. Visibilité : **Private**
4. Ne pas initialiser avec README (Claude Code le fera)
5. Copie l'URL SSH ou HTTPS du repo

### 2. Créer le projet Supabase

1. Va sur supabase.com → New project
2. **Région : Europe West (Frankfurt) — OBLIGATOIRE pour le RGPD**
3. Nom du projet : nom de ton institution
4. Mot de passe BDD : génère-en un fort et note-le
5. Une fois créé, va dans Settings → API
6. Copie :
   - `Project URL`
   - `anon public key`
   - `service_role key` (⚠️ garder secret)

### 3. Créer le projet Vercel

1. Va sur vercel.com → Add New Project
2. Import le dépôt GitHub que tu viens de créer
3. Framework preset : **Next.js**
4. Ne pas déployer encore (laisser Claude Code configurer d'abord)
5. Note : tu ajouteras les variables d'environnement plus tard

### 4. Créer les comptes services (optionnel Phase 1, utile d'avoir)

**Resend (emails)** :
- resend.com → Free tier disponible
- Créer et vérifier ton domaine d'envoi
- Copier la clé API

**Twilio (SMS)** :
- twilio.com → Compte d'essai possible
- Copier Account SID + Auth Token
- Avoir un numéro d'envoi

---

## CE QU'IL FAUT FAIRE DANS CLAUDE DESKTOP

### Étape 1 — Ouvrir Claude Desktop

Lance l'application Claude Desktop sur ton ordinateur.

### Étape 2 — Choisir le bon onglet

**Pour le développement de l'application → onglet `Code`** (Claude Code)

> ℹ️ Cowork est excellent pour les documents et fichiers,
> mais pour coder une application Next.js, c'est Claude Code qu'il faut.
> Les deux sont dans la même application, onglet différent.

### Étape 3 — Donner accès au dossier projet

Dans l'onglet Code :
1. Indique à Claude Code le chemin vers ce dossier
2. Ce dossier contient déjà :
   - `CLAUDE.md` (ses instructions)
   - `CDC_V3.md` (le cahier des charges complet)
   - `.env.example` (template des variables)

### Étape 4 — Premier message à envoyer

Copie-colle exactement ce message :

---

```
Lis le fichier CLAUDE.md dans ce dossier, puis lis le fichier CDC_V3.md en entier.

Ce sont respectivement tes instructions de travail et le cahier des charges complet 
de l'application à développer.

Avant de coder quoi que ce soit, dis-moi :

1. En 5 points, ce que tu as compris du projet
2. Les 3 points qui te semblent les plus complexes techniquement
3. Les questions que tu as avant de commencer
4. Ton plan détaillé de la Phase 1 avec les étapes dans l'ordre

Attends ma validation avant de commencer à coder.

Mes infos de connexion pour quand tu seras prêt :
- GitHub repo : [COLLER TON URL GITHUB ICI]
- Supabase URL : [COLLER TON URL SUPABASE ICI]
- Supabase anon key : [COLLER TA CLÉ ICI]
```

---

### Étape 5 — Valider le plan et démarrer

Claude Code va te proposer un plan.

**Ce qu'il doit faire en premier :**
1. `npx create-next-app@latest` avec TypeScript + Tailwind + ESLint
2. Initialiser Git et connecter au repo GitHub
3. Créer les fichiers de migrations SQL Supabase (Phase 1)
4. Configurer Supabase Auth
5. Créer la structure de fichiers décrite dans CLAUDE.md

**Ce que tu dois surveiller :**
- Il ne doit PAS créer de colonne `org_id`
- Il doit utiliser React-PDF (pas Puppeteer)
- Les tables de votes doivent être INSERT-ONLY
- Les Server Actions pour tout ce qui est sensible

---

## CONSEILS PRATIQUES

### Travailler phase par phase

Ne demande pas tout en une seule session.
Phase 1 → tester → corriger → Phase 2 → etc.

### Si Claude Code s'arrête en plein milieu

C'est normal pour les longues tâches. Tu peux lui dire :
"Continue là où tu t'es arrêté" et il reprend.

### Si il fait quelque chose d'incorrect

Arrête-le immédiatement et corrige :
"Stop. Tu as créé une colonne org_id — ce projet est single-tenant,
cette colonne ne doit pas exister. Supprime-la et continue."

### Commits réguliers

Demande-lui de committer après chaque feature :
"Committe ce qui est fait avec un message clair avant de continuer."

### Tester au fur et à mesure

"Lance `npm run dev` et dis-moi si tout compile sans erreur avant de continuer."

---

## SI QUELQUE CHOSE NE MARCHE PAS

**Erreur TypeScript** : "Corrige toutes les erreurs TypeScript avant de continuer."

**Erreur de build Vercel** : "Regarde les logs de build Vercel et corrige les erreurs."

**Problème Supabase RLS** : "Vérifie que toutes les tables ont bien des policies RLS activées."

**PDF ne génère pas** : "Assure-toi d'utiliser React-PDF et non Puppeteer — Puppeteer ne fonctionne pas sur Vercel."

---

## VALIDATION DE LA PHASE 1

Pour valider que la Phase 1 est terminée, tu dois pouvoir faire :

1. ✅ Se connecter avec un compte Gestionnaire
2. ✅ Créer une séance avec un ODJ
3. ✅ Envoyer une convocation par email
4. ✅ Confirmer la présence depuis l'email (lien tokenisé)
5. ✅ Ouvrir la séance
6. ✅ Lancer un vote à main levée
7. ✅ Saisir 0 contre, 0 abstention → affichage "ADOPTÉ À L'UNANIMITÉ"
8. ✅ Saisir 2 contre, 1 abstention → formule PV correcte générée
9. ✅ Clôturer la séance
10. ✅ Voir le brouillon de PV généré

Si tout ça fonctionne → Phase 1 validée → passer à la Phase 2.
