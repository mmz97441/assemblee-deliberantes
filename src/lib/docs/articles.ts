/**
 * Documentation utilisateur — structure centralisée.
 *
 * Chaque article est un objet typé contenant :
 *  - métadonnées (id, titre, mots-clés, rôles autorisés, catégorie)
 *  - contenu structuré (sections de différents types : texte, liste,
 *    étapes, encadrés "astuce" / "attention" / "tip")
 *
 * La page /aide consomme cette structure pour afficher, rechercher et
 * filtrer les articles selon le rôle de l'utilisateur connecté.
 */

import type { UserRole } from '@/lib/supabase/types'

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocCategory =
  | 'premiers-pas'
  | 'seances'
  | 'convocations'
  | 'votes'
  | 'pv'
  | 'deliberations'
  | 'membres'
  | 'configuration'
  | 'audit'
  | 'glossaire'

export type DocBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'steps'; items: { title: string; details?: string }[] }
  | { type: 'tip'; text: string }
  | { type: 'warning'; text: string }
  | { type: 'success'; text: string }
  | { type: 'legal'; text: string; reference?: string }
  | { type: 'definition'; term: string; definition: string }
  /** Liste d'articles liés affichée comme cards cliquables */
  | { type: 'related'; articleIds: string[] }

/**
 * SYNTAXE DE LIENS dans les textes :
 *  - [Texte](article:id-article)  → lien interne vers un autre article
 *      (la page reste sur /aide, sélectionne l'article cible)
 *  - [Texte](/path/in/app)        → lien interne vers une page de l'app
 *      (navigation Next.js, ex: [Aller à l'historique](/historique))
 *  - [Texte](https://...)         → lien externe (ouvre nouvel onglet)
 *
 * Le rendu est géré par le helper renderInlineMarkdown() côté client.
 */

export interface DocArticle {
  id: string
  title: string
  /** Sous-titre / tagline d'1 ligne */
  summary: string
  category: DocCategory
  /** Rôles autorisés à voir l'article. Si vide, visible par tous. */
  roles: UserRole[]
  /** Mots-clés pour la recherche full-text (en plus du titre/summary/contenu) */
  keywords: string[]
  /** Pictogramme Lucide (nom du composant) */
  icon?: string
  /** Article visible en accès public (sans être loggé) ? Par défaut non. */
  publicAccess?: boolean
  /** Contenu structuré */
  blocks: DocBlock[]
}

export const CATEGORY_LABELS: Record<DocCategory, string> = {
  'premiers-pas': 'Premiers pas',
  'seances': 'Gestion des séances',
  'convocations': 'Convocations',
  'votes': 'Votes',
  'pv': 'Procès-verbaux',
  'deliberations': 'Délibérations',
  'membres': 'Gestion des membres',
  'configuration': 'Configuration',
  'audit': 'Sécurité & Audit',
  'glossaire': 'Glossaire',
}

export const CATEGORY_ORDER: DocCategory[] = [
  'premiers-pas',
  'seances',
  'convocations',
  'votes',
  'pv',
  'deliberations',
  'membres',
  'configuration',
  'audit',
  'glossaire',
]

// ─── Articles ────────────────────────────────────────────────────────────────

const ALL_ROLES: UserRole[] = [
  'super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire',
  'president', 'secretaire_seance', 'elu', 'preparateur',
]

const PRIVILEGED: UserRole[] = ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire']
const BUREAU: UserRole[] = ['president', 'secretaire_seance']

export const ARTICLES: DocArticle[] = [

  // ═══════════════════════════════════════════════════════════════════
  // GUIDES PAR RÔLE — un guide complet par profil, visible UNIQUEMENT
  // au membre de ce profil. Premier réflexe à conseiller à la connexion.
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'guide-super-admin',
    title: 'Votre rôle — Super-administrateur',
    summary: 'Tour complet de vos pouvoirs et responsabilités',
    category: 'premiers-pas',
    roles: ['super_admin'],
    keywords: ['super admin', 'role', 'pouvoirs', 'responsabilités', 'guide'],
    icon: 'Shield',
    blocks: [
      { type: 'paragraph', text: 'En tant que super-administrateur, vous avez les pouvoirs techniques les plus étendus de l\'application. Vous êtes responsable de la sécurité, de la conformité RGPD, et de la gestion des autres super-administrateurs.' },
      { type: 'heading', level: 2, text: 'Ce que vous pouvez faire (que les autres ne peuvent pas)' },
      { type: 'list', items: [
        'Inviter d\'autres super-administrateurs',
        'Modifier le toggle « QR strict » (impact CGCT direct)',
        'Anonymiser une entrée d\'audit log dans le cadre RGPD',
        'Consulter la table audit_log_redactions (trace des anonymisations)',
        'Modifier le rôle d\'un autre super-administrateur',
      ] },
      { type: 'heading', level: 2, text: 'Ce que vous partagez avec les DGS / Dir cabinet' },
      { type: 'list', items: [
        'Lecture totale de toute l\'activité (séances, votes, PV, audit)',
        'Préparation de l\'ordre du jour, ajout de pièces jointes',
        'Envoi de convocations, gestion des relances',
        'Configuration de l\'institution (instances, quorum, templates)',
        'Signature des PV',
        'Gestion des membres (invitation, archivage, modification)',
      ] },
      { type: 'heading', level: 2, text: 'Vos premières actions recommandées' },
      { type: 'steps', items: [
        { title: 'Vérifier la configuration de l\'institution', details: '/configuration → onglet Assistant. S\'assurer que le nom officiel, le SIREN et le type d\'institution sont corrects.' },
        { title: 'Créer les instances délibérantes', details: 'CM, CAO, commissions… Définir leur composition et leur quorum.' },
        { title: 'Inviter les premiers membres', details: '/membres → Ajouter un membre. Le DGS et les Directeurs de cabinet peuvent ensuite vous aider à inviter le reste.' },
        { title: 'Configurer les templates email Supabase', details: 'Voir avec votre prestataire technique pour personnaliser les 5 templates (invitation, reset password, etc.).' },
      ] },
      { type: 'warning', text: 'Tout ce que vous faites est tracé dans l\'audit log — y compris les anonymisations RGPD que vous effectuez. Personne (pas même vous) ne peut modifier ces traces a posteriori. Voir [Anonymiser une entrée d\'audit](article:anonymisation-rgpd).' },
      { type: 'related', articleIds: ['historique', 'anonymisation-rgpd', 'configuration-institution', 'inviter-membre'] },
    ],
  },

  {
    id: 'guide-dgs',
    title: 'Votre rôle — DGS (Directeur Général des Services)',
    summary: 'Vue complète de l\'activité, gestion opérationnelle des dossiers',
    category: 'premiers-pas',
    roles: ['dgs'],
    keywords: ['dgs', 'directeur général', 'services', 'role', 'pouvoirs', 'guide'],
    icon: 'Shield',
    blocks: [
      { type: 'paragraph', text: 'En tant que Directeur Général des Services, vous avez une visibilité complète sur l\'activité de l\'institution et vous pouvez agir sur l\'essentiel des opérations. Votre rôle est de garantir le bon fonctionnement administratif des séances délibérantes.' },
      { type: 'heading', level: 2, text: 'Ce que vous pouvez faire' },
      { type: 'list', items: [
        '✅ Lecture totale de toute l\'activité : séances, ODJ, votes, PV, présences, audit log',
        '✅ Préparer/modifier l\'ordre du jour, ajouter et retirer des pièces jointes',
        '✅ Envoyer les convocations, suivre les statuts, relancer un membre individuellement',
        '✅ Voir les statistiques détaillées : taux de participation, prévision de quorum chiffrée',
        '✅ Modifier la configuration de l\'institution (instances, règles de quorum, templates)',
        '✅ Inviter, modifier, archiver des membres (sauf super-administrateurs)',
        '✅ Signer un procès-verbal aux côtés du président',
        '✅ Consulter l\'historique des modifications (audit log) avec recherche et export CSV',
      ] },
      { type: 'heading', level: 2, text: 'Ce que vous NE pouvez PAS faire' },
      { type: 'list', items: [
        '❌ Inviter ou modifier un super-administrateur',
        '❌ Activer/désactiver le toggle « QR strict » (réservé super_admin)',
        '❌ Anonymiser une entrée d\'audit log RGPD (réservé super_admin)',
      ] },
      { type: 'heading', level: 2, text: 'Vos écrans clés au quotidien' },
      { type: 'list', items: [
        '/dashboard — Vue d\'ensemble de toute l\'activité avec stats détaillées',
        '/seances — Liste des séances actives + colonnes Convocations + Quorum prévisionnel',
        '/historique — Mouchard append-only de toutes les modifications avec filtres',
        '/configuration — Paramétrage institution + instances',
      ] },
      { type: 'tip', text: 'Vous voyez tout ce qu\'un gestionnaire voit — et plus encore (configuration). Vous êtes la « courroie de transmission » entre le politique (élus, président) et l\'administratif (gestionnaires, secrétariat). Aller à [/historique](/historique), [/configuration](/configuration) ou [/membres](/membres).' },
      { type: 'related', articleIds: ['guide-directeur-cabinet', 'historique', 'configuration-institution', 'envoyer-convocations', 'inviter-membre'] },
    ],
  },

  {
    id: 'guide-directeur-cabinet',
    title: 'Votre rôle — Directeur de cabinet',
    summary: 'Vue complète, préparation stratégique des dossiers',
    category: 'premiers-pas',
    roles: ['directeur_cabinet'],
    keywords: ['directeur cabinet', 'role', 'pouvoirs', 'guide', 'cab', 'collaborateur'],
    icon: 'Shield',
    blocks: [
      { type: 'paragraph', text: 'En tant que Directeur de cabinet, vous êtes le collaborateur politique du chef de l\'exécutif (maire, président). Vous avez une visibilité complète sur l\'activité institutionnelle et préparez les dossiers stratégiques.' },
      { type: 'heading', level: 2, text: 'Ce que vous pouvez faire' },
      { type: 'list', items: [
        '✅ Lecture totale de toute l\'activité : séances, ODJ, votes, PV (y compris brouillons), présences, audit log',
        '✅ Préparer/modifier l\'ordre du jour, ajouter et retirer des pièces jointes',
        '✅ Envoyer les convocations, suivre les statuts, relancer un membre individuellement',
        '✅ Voir les statistiques détaillées : taux de participation, prévision de quorum chiffrée',
        '✅ Modifier la configuration de l\'institution',
        '✅ Inviter, modifier, archiver des membres (sauf super-administrateurs et DGS)',
        '✅ Signer un procès-verbal aux côtés du président',
        '✅ Consulter l\'historique des modifications (audit log) avec recherche et export CSV',
      ] },
      { type: 'heading', level: 2, text: 'Ce que vous NE pouvez PAS faire' },
      { type: 'list', items: [
        '❌ Inviter ou modifier un super-administrateur ou un DGS',
        '❌ Activer/désactiver le toggle « QR strict » (réservé super_admin)',
        '❌ Anonymiser une entrée d\'audit log RGPD (réservé super_admin)',
      ] },
      { type: 'heading', level: 2, text: 'Différence DGS / Directeur de cabinet' },
      { type: 'paragraph', text: 'Vos rôles ont les mêmes fonctionnalités sur l\'application. La différence est institutionnelle : le DGS est le chef de l\'administration (long terme, technique), le Directeur de cabinet est un collaborateur politique du chef de l\'exécutif (stratégique, court terme). En pratique, vous êtes complémentaires.' },
      { type: 'tip', text: 'Utilisez la page [Historique](/historique) pour suivre qui a modifié quoi et quand — utile pour préparer un brief synthétique au maire/président.' },
      { type: 'related', articleIds: ['guide-dgs', 'historique', 'configuration-institution', 'envoyer-convocations'] },
    ],
  },

  {
    id: 'guide-gestionnaire',
    title: 'Votre rôle — Gestionnaire',
    summary: 'Vous orchestrez les séances de A à Z',
    category: 'premiers-pas',
    roles: ['gestionnaire'],
    keywords: ['gestionnaire', 'secrétariat', 'role', 'pouvoirs', 'guide', 'opérationnel'],
    icon: 'Shield',
    blocks: [
      { type: 'paragraph', text: 'En tant que gestionnaire (typiquement un agent du secrétariat administratif), vous êtes le maître d\'œuvre de la mécanique des séances. Vous préparez, convoquez, conduisez et clôturez. C\'est vous que les élus appellent quand ils ont une question.' },
      { type: 'heading', level: 2, text: 'Ce que vous pouvez faire' },
      { type: 'list', items: [
        '✅ Créer une séance (date, lieu, instance, mode)',
        '✅ Préparer l\'ordre du jour avec descriptions et pièces jointes',
        '✅ Sélectionner les convocataires et envoyer les convocations',
        '✅ Suivre le taux de confirmation, relancer individuellement',
        '✅ Voir les statistiques détaillées et la prévision de quorum chiffrée',
        '✅ Conduire la séance en direct (ouvrir/clôturer les votes, saisir les compteurs main levée)',
        '✅ Émarger physiquement les présents (page Émargement)',
        '✅ Générer les procès-verbaux',
        '✅ Inviter, modifier, archiver des membres opérationnels (élus, préparateurs, secrétaires de séance)',
        '✅ Consulter l\'historique des modifications (audit log)',
      ] },
      { type: 'heading', level: 2, text: 'Ce que vous NE pouvez PAS faire' },
      { type: 'list', items: [
        '❌ Modifier la configuration de l\'institution (instances, quorum) — réservé direction',
        '❌ Inviter un super_admin / DGS / Directeur de cabinet',
        '❌ Signer un procès-verbal (réservé président + secrétaire de séance)',
      ] },
      { type: 'heading', level: 2, text: 'Votre journée type' },
      { type: 'steps', items: [
        { title: 'Matin : préparer la prochaine séance', details: 'Compléter ODJ, charger les PJ, vérifier que le président + secrétaire de séance sont désignés.' },
        { title: 'Envoyer les convocations 5+ jours avant', details: 'Cliquer « Envoyer les convocations » sur la page séance. Suivre le taux de réponse.' },
        { title: 'Veille : relancer les non-répondus', details: 'Filtrer le tableau convocataires sur statut = ENVOYE (pas confirmé). Renvoyer individuellement avec motif.' },
        { title: 'Jour J : émargement à l\'entrée', details: 'Ouvrir /seances/[id]/emargement sur une tablette à la table d\'entrée. Scanner les QR codes.' },
        { title: 'En séance : conducteur', details: 'Ouvrir /seances/[id]/en-cours. Ouvrir les votes, saisir les résultats.' },
        { title: 'Après séance : générer le PV brouillon', details: 'Le secrétaire de séance complète puis transmet au président pour signature.' },
      ] },
      { type: 'related', articleIds: ['creer-seance', 'envoyer-convocations', 'renvoyer-convocation', 'pv-redaction', 'historique'] },
    ],
  },

  {
    id: 'guide-president',
    title: 'Votre rôle — Président de séance',
    summary: 'Vous présidez, validez les votes et signez les PV',
    category: 'premiers-pas',
    roles: ['president'],
    keywords: ['president', 'présider', 'role', 'pouvoirs', 'guide', 'signer'],
    icon: 'Shield',
    blocks: [
      { type: 'paragraph', text: 'En tant que président de séance, vous êtes le garant du bon déroulement de la séance et de la régularité de ses décisions. Vous signez les actes officiels.' },
      { type: 'heading', level: 2, text: 'Ce que vous pouvez faire' },
      { type: 'list', items: [
        '✅ Consulter toute la liste des séances et leur détail',
        '✅ Voir la liste des présents/absents/excusés en temps réel',
        '✅ Voir les procurations enregistrées',
        '✅ Relire les brouillons de PV avant signature',
        '✅ Signer électroniquement le PV',
        '✅ Présider la séance via votre tablette dédiée (/seances/[id]/president)',
        '✅ Ouvrir/clôturer les huis clos sur un point précis',
      ] },
      { type: 'heading', level: 2, text: 'Ce que vous NE pouvez PAS faire' },
      { type: 'list', items: [
        '❌ Voir les statistiques détaillées de convocation (envoyées/erreurs/quorum chiffré) — c\'est le rôle du gestionnaire, pas le vôtre',
        '❌ Modifier les ODJ, envoyer des convocations',
        '❌ Inviter/modifier des membres',
      ] },
      { type: 'heading', level: 2, text: 'Vos écrans clés' },
      { type: 'list', items: [
        '/seances/[id] — Détail d\'une séance',
        '/seances/[id]/president — Tablette président pour conduire la séance',
        '/seances/[id]/grande-scene — Vue vidéoprojecteur (résultats des votes en grand)',
        '/seances/[id]/pv — Lecture et signature des PV',
      ] },
      { type: 'legal', text: 'Le procès-verbal doit porter votre signature et celle du secrétaire de séance pour avoir valeur officielle.', reference: 'CGCT L2121-15' },
      { type: 'related', articleIds: ['pv-redaction', 'pv-consultation', 'recusation'] },
    ],
  },

  {
    id: 'guide-secretaire-seance',
    title: 'Votre rôle — Secrétaire de séance',
    summary: 'Vous tenez les notes et préparez le procès-verbal',
    category: 'premiers-pas',
    roles: ['secretaire_seance'],
    keywords: ['secrétaire', 'séance', 'role', 'pouvoirs', 'guide', 'pv', 'notes'],
    icon: 'Shield',
    blocks: [
      { type: 'paragraph', text: 'En tant que secrétaire de séance, vous êtes désigné(e) au début de chaque séance pour tenir les notes et préparer le procès-verbal qui sera signé conjointement avec le président.' },
      { type: 'heading', level: 2, text: 'Ce que vous pouvez faire' },
      { type: 'list', items: [
        '✅ Voir les présents/absents/excusés et procurations',
        '✅ Tenir les notes pendant la séance (page grande scène + notes manuscrites)',
        '✅ Émarger les arrivées tardives manuellement',
        '✅ Préparer et modifier le brouillon de PV',
        '✅ Lancer la phase de relecture (notification aux membres concernés)',
        '✅ Signer électroniquement le PV',
      ] },
      { type: 'heading', level: 2, text: 'Ce que vous NE pouvez PAS faire' },
      { type: 'list', items: [
        '❌ Voir les statistiques détaillées de convocation',
        '❌ Modifier les ODJ ou envoyer les convocations',
        '❌ Inviter/modifier des membres',
        '❌ Conduire la séance (rôle du gestionnaire/président)',
      ] },
      { type: 'heading', level: 2, text: 'Votre rôle précis dans le cycle PV' },
      { type: 'steps', items: [
        { title: 'Pendant la séance', details: 'Prendre des notes manuscrites en parallèle des votes enregistrés par le système.' },
        { title: 'Après la séance', details: 'Le système génère un brouillon automatique avec présents, votes et formules légales. Vous le complétez avec vos notes.' },
        { title: 'Mise en relecture', details: 'Vous partagez le brouillon avec le président et le bureau. Les commentaires sont consignés.' },
        { title: 'Signature', details: 'Une fois validé, vous signez. Le président signe à son tour. Le PV devient SIGNÉ et immuable.' },
      ] },
      { type: 'related', articleIds: ['pv-redaction', 'pv-consultation', 'guide-president'] },
    ],
  },

  {
    id: 'guide-elu',
    title: 'Votre rôle — Élu / Membre votant',
    summary: 'Vous participez aux séances et votez',
    category: 'premiers-pas',
    roles: ['elu'],
    keywords: ['élu', 'membre', 'votant', 'role', 'guide', 'voter', 'participer'],
    icon: 'Shield',
    blocks: [
      { type: 'paragraph', text: 'En tant qu\'élu, vous participez aux séances délibérantes : vous recevez les convocations, étudiez les dossiers, votez et consultez les procès-verbaux. Le système est conçu pour être très simple à utiliser pour vous.' },
      { type: 'heading', level: 2, text: 'Ce que vous pouvez faire' },
      { type: 'list', items: [
        '✅ Recevoir les convocations par email avec ODJ + pièces jointes',
        '✅ Confirmer votre présence ou signaler votre absence en 1 clic',
        '✅ Émarger à l\'entrée de la séance avec votre QR code personnel',
        '✅ Voter en séance (main levée, secret, nominal)',
        '✅ Consulter les procès-verbaux publiés des séances précédentes',
        '✅ Consulter les délibérations adoptées',
        '✅ Voir l\'annuaire des autres membres (nom, qualité, photo) — sans leurs coordonnées personnelles',
      ] },
      { type: 'heading', level: 2, text: 'Ce que vous NE voyez PAS (volontairement)' },
      { type: 'list', items: [
        '❌ Les statistiques de convocations des autres membres (qui a confirmé/pas confirmé)',
        '❌ La prévision de quorum chiffrée (info opérationnelle réservée au gestionnaire)',
        '❌ Les coordonnées personnelles des autres membres (RGPD)',
        '❌ Les procès-verbaux en cours de rédaction (brouillons réservés au bureau)',
        '❌ L\'historique des modifications (audit log)',
      ] },
      { type: 'tip', text: 'Si vous avez une question urgente sur un point ODJ, contactez votre secrétariat. Vous pouvez aussi donner procuration à un autre élu si vous ne pouvez pas être présent — voir [Procurations](article:procurations).' },
      { type: 'related', articleIds: ['recevoir-convocation', 'consulter-odj', 'vote-main-levee', 'vote-secret', 'procurations', 'pv-consultation'] },
    ],
  },

  {
    id: 'guide-preparateur',
    title: 'Votre rôle — Préparateur',
    summary: 'Vous aidez à préparer les dossiers en amont',
    category: 'premiers-pas',
    roles: ['preparateur'],
    keywords: ['préparateur', 'role', 'guide', 'préparation', 'dossiers'],
    icon: 'Shield',
    blocks: [
      { type: 'paragraph', text: 'En tant que préparateur, vous aidez à monter les dossiers de séance en amont. Votre rôle est exclusivement préparatoire — vous ne participez pas aux séances elles-mêmes.' },
      { type: 'heading', level: 2, text: 'Ce que vous pouvez faire' },
      { type: 'list', items: [
        '✅ Consulter les séances à venir et leur ODJ',
        '✅ Voir les pièces jointes téléchargées',
        '✅ Consulter les délibérations publiées',
        '✅ Voir l\'annuaire basique des membres (sans coordonnées)',
      ] },
      { type: 'heading', level: 2, text: 'Ce que vous NE pouvez PAS faire' },
      { type: 'list', items: [
        '❌ Modifier les ODJ (le gestionnaire le fait pour vous)',
        '❌ Voir les votes ou résultats',
        '❌ Voir les présences ou les statistiques',
        '❌ Voir les procès-verbaux (sauf publiés)',
        '❌ Accéder à la configuration ou aux membres en édition',
      ] },
      { type: 'tip', text: 'Si vous avez besoin de droits supplémentaires pour préparer un dossier, demandez à votre gestionnaire de vous transmettre temporairement le rôle « Secrétaire de séance » sur la séance concernée.' },
      { type: 'related', articleIds: ['consulter-odj', 'glossaire'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // PREMIERS PAS — articles transverses tous rôles
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'bienvenue',
    title: 'Bienvenue dans l\'application',
    summary: 'Découvrez en 2 minutes ce que l\'application fait pour vous',
    category: 'premiers-pas',
    roles: ALL_ROLES,
    keywords: ['bienvenue', 'introduction', 'découvrir', 'accueil', 'présentation'],
    icon: 'Sparkles',
    blocks: [
      { type: 'paragraph', text: 'Cette application centralise toute la gestion des assemblées délibérantes de votre institution : convocations, séances, votes, procès-verbaux et délibérations. Elle est conçue pour respecter strictement le Code Général des Collectivités Territoriales (CGCT) et le RGPD.' },
      { type: 'heading', level: 2, text: 'Ce que vous pouvez faire' },
      { type: 'list', items: [
        'Recevoir et répondre à vos convocations en quelques clics',
        'Consulter l\'ordre du jour et toutes les pièces jointes avant la séance',
        'Émarger numériquement à l\'aide d\'un QR code',
        'Voter à main levée, à bulletin secret ou par SMS (télévote)',
        'Consulter et signer les procès-verbaux',
        'Suivre les délibérations et leur transmission à la préfecture',
      ] },
      { type: 'tip', text: 'Si vous voyez ce guide pour la première fois, prenez 5 minutes pour parcourir les articles « Premiers pas ». Vous y trouverez tout ce dont vous avez besoin pour démarrer.' },
      { type: 'related', articleIds: ['activer-compte', 'se-connecter', 'securite-compte', 'glossaire'] },
    ],
  },

  {
    id: 'activer-compte',
    title: 'Activer mon compte (première connexion)',
    summary: 'Vous venez de recevoir un email d\'invitation — voici la marche à suivre',
    category: 'premiers-pas',
    roles: ALL_ROLES,
    keywords: ['activation', 'compte', 'première', 'connexion', 'invitation', 'mot de passe'],
    icon: 'KeyRound',
    blocks: [
      { type: 'paragraph', text: 'Lorsque le secrétariat vous invite, vous recevez un email intitulé « Bienvenue — Activez votre compte ». Cet email contient un lien personnel valable 24 heures.' },
      { type: 'steps', items: [
        { title: 'Ouvrir l\'email', details: 'Vérifiez aussi le dossier « Spam » ou « Indésirables » si vous ne le trouvez pas dans votre boîte de réception.' },
        { title: 'Cliquer sur « Activer mon compte »', details: 'Vous serez redirigé(e) vers une page sécurisée pour choisir votre mot de passe.' },
        { title: 'Choisir un mot de passe robuste', details: '12 caractères minimum, avec idéalement majuscules, minuscules, chiffres et caractères spéciaux. Une barre de force vous indique si votre mot de passe est solide.' },
        { title: 'Confirmer le mot de passe', details: 'Retapez-le à l\'identique. Une coche verte apparaît si les deux saisies correspondent.' },
        { title: 'Cliquer sur « Activer mon compte »', details: 'Vous arrivez directement sur votre tableau de bord.' },
      ] },
      { type: 'warning', text: 'Le lien expire 24 heures après son envoi. Passé ce délai, contactez votre secrétariat qui pourra vous le renvoyer en un clic.' },
      { type: 'tip', text: 'Notez votre adresse email — c\'est elle qui servira d\'identifiant pour toutes vos connexions futures. Voir aussi [Sécuriser mon compte](article:securite-compte) pour les bonnes pratiques.' },
      { type: 'related', articleIds: ['se-connecter', 'securite-compte'] },
    ],
  },

  {
    id: 'se-connecter',
    title: 'Se connecter / Mot de passe oublié',
    summary: 'Comment vous connecter ou récupérer votre accès',
    category: 'premiers-pas',
    roles: ALL_ROLES,
    keywords: ['connexion', 'login', 'mot de passe', 'oublié', 'récupération'],
    icon: 'LogIn',
    blocks: [
      { type: 'heading', level: 2, text: 'Connexion classique' },
      { type: 'steps', items: [
        { title: 'Aller sur la page de connexion', details: 'Saisissez l\'URL fournie par votre institution.' },
        { title: 'Saisir votre email + mot de passe', details: 'L\'email est celui où vous avez reçu votre invitation.' },
        { title: 'Cliquer sur « Se connecter »', details: 'Vous arrivez sur votre tableau de bord personnalisé.' },
      ] },
      { type: 'heading', level: 2, text: 'Mot de passe oublié' },
      { type: 'steps', items: [
        { title: 'Cliquer sur « Mot de passe oublié »', details: 'Le lien se trouve juste sous le bouton de connexion.' },
        { title: 'Saisir votre adresse email', details: 'Saisissez exactement la même adresse que d\'habitude.' },
        { title: 'Vérifier votre boîte mail', details: 'Vous recevez un email avec un lien valable 1 heure. Vérifiez aussi vos spams.' },
        { title: 'Cliquer sur le lien et choisir un nouveau mot de passe', details: 'Vous serez redirigé(e) vers une page sécurisée.' },
      ] },
      { type: 'tip', text: 'Le système ne vous indique jamais explicitement si l\'email est connu ou non — c\'est une mesure de sécurité contre l\'énumération de comptes.' },
    ],
  },

  {
    id: 'securite-compte',
    title: 'Sécuriser mon compte',
    summary: 'Bonnes pratiques pour protéger votre accès',
    category: 'premiers-pas',
    roles: ALL_ROLES,
    keywords: ['sécurité', 'mot de passe', '2fa', 'webauthn', 'empreinte', 'biométrie', 'session', 'inactivité', 'déconnexion'],
    icon: 'Shield',
    blocks: [
      { type: 'paragraph', text: 'Votre compte donne accès à des données institutionnelles sensibles. Voici les bonnes pratiques :' },
      { type: 'list', items: [
        'Utilisez un mot de passe long (12+ caractères) et unique à cette application',
        'Ne partagez jamais vos identifiants — chaque membre a son propre compte',
        'Déconnectez-vous après usage si vous êtes sur un appareil partagé',
        'Si vous suspectez une compromission, changez immédiatement votre mot de passe',
      ] },
      { type: 'heading', level: 2, text: 'Sessions et déconnexion automatique' },
      { type: 'paragraph', text: 'Pour limiter les risques en cas d\'oubli (tablette laissée ouverte, ordinateur partagé), l\'application applique une politique d\'inactivité stricte :' },
      { type: 'list', items: [
        'Vous restez connecté(e) aussi longtemps que vous travaillez — aucun timeout absolu, donc pas de coupure pénible en plein milieu d\'une tâche',
        'Si vous n\'avez aucune activité (pas de clic, pas de saisie, pas de scroll) pendant 1 heure, vous êtes déconnecté(e) automatiquement',
        '2 minutes avant la déconnexion, un popup vous prévient — bougez la souris ou cliquez « Rester connecté(e) » pour continuer',
      ] },
      { type: 'success', text: 'En cas de modification critique de votre compte (changement de mot de passe, de rôle ou d\'email), TOUTES vos sessions actives sur les autres appareils sont automatiquement fermées. Vous devrez vous reconnecter — c\'est volontaire et sécurisant.' },
      { type: 'heading', level: 2, text: 'WebAuthn / Empreinte (en séance)' },
      { type: 'paragraph', text: 'Sur les tablettes en séance, vous pouvez enrôler votre empreinte digitale. La fois suivante, votre identification est instantanée — plus besoin de scanner votre QR code à chaque action.' },
      { type: 'success', text: 'L\'empreinte ne quitte jamais votre appareil — c\'est une norme cryptographique (FIDO2). L\'application stocke seulement une signature publique impossible à usurper.' },
      { type: 'related', articleIds: ['se-connecter', 'activer-compte'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // CONVOCATIONS — pour l'élu
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'recevoir-convocation',
    title: 'Recevoir et répondre à une convocation',
    summary: 'Vous êtes convoqué(e) à une séance — voici comment répondre',
    category: 'convocations',
    roles: ['elu', 'preparateur', ...BUREAU, ...PRIVILEGED],
    keywords: ['convocation', 'invitation', 'séance', 'répondre', 'présent', 'absent', 'email'],
    icon: 'Mail',
    blocks: [
      { type: 'paragraph', text: 'Le secrétariat vous envoie un email officiel quand une séance vous concerne. Cet email contient toutes les infos pour répondre.' },
      { type: 'heading', level: 2, text: 'L\'email de convocation contient' },
      { type: 'list', items: [
        'La date, l\'heure et le lieu de la séance',
        'L\'ordre du jour avec la description de chaque point',
        'Les pièces jointes liées à chaque point (PDF, Word, etc.)',
        'Votre QR code personnel d\'émargement',
        'Deux boutons : « Je serai présent(e) » et « Je serai absent(e) »',
      ] },
      { type: 'heading', level: 2, text: 'Confirmer votre présence' },
      { type: 'paragraph', text: 'Cliquez sur le bouton bleu « ✓ Je serai présent(e) ». Vous arrivez sur une page de confirmation. Le secrétariat est immédiatement informé.' },
      { type: 'heading', level: 2, text: 'Signaler votre absence' },
      { type: 'paragraph', text: 'Cliquez sur le bouton « ✗ Je serai absent(e) ». Une page vous demande un motif optionnel (empêchement professionnel, raison personnelle, etc.).' },
      { type: 'legal', text: 'Pour donner procuration à un autre élu, contactez votre secrétariat. Les procurations nécessitent votre signature et l\'accord du mandataire. Voir l\'article [Procurations](article:procurations) pour le détail.', reference: 'CGCT L2121-20' },
      { type: 'tip', text: 'Si vous perdez votre email, demandez à votre secrétariat de vous le renvoyer — il peut le faire en un clic depuis l\'application.' },
      { type: 'related', articleIds: ['consulter-odj', 'procurations', 'vote-main-levee', 'vote-secret'] },
    ],
  },

  {
    id: 'consulter-odj',
    title: 'Consulter l\'ordre du jour et les pièces jointes',
    summary: 'Préparer la séance en amont',
    category: 'convocations',
    roles: ALL_ROLES,
    keywords: ['ordre du jour', 'odj', 'pièces jointes', 'documents', 'pdf', 'préparer'],
    icon: 'FileText',
    blocks: [
      { type: 'paragraph', text: 'Pour chaque point de l\'ordre du jour, vous voyez :' },
      { type: 'list', items: [
        'Le numéro et le titre du point',
        'Le type (Délibération, Information, Question diverse, Approbation PV, Élection)',
        'La description complète du sujet',
        'La note explicative de synthèse (CGCT L2121-12 — communes ≥ 3 500 habitants)',
        'La liste des pièces jointes téléchargeables',
      ] },
      { type: 'heading', level: 2, text: 'Télécharger les pièces jointes' },
      { type: 'paragraph', text: 'Depuis l\'email, cliquez sur « Consulter le détail et télécharger les documents en ligne ». Vous arrivez sur la page séance dans l\'application — connectez-vous, puis téléchargez chaque document en un clic.' },
      { type: 'tip', text: 'Les pièces jointes ne sont pas dans l\'email pour des raisons de sécurité — elles peuvent contenir des données sensibles qui ne doivent pas circuler hors de l\'application.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // CONVOCATIONS — pour le gestionnaire
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'envoyer-convocations',
    title: 'Envoyer les convocations d\'une séance',
    summary: 'Convoquer tous les membres en respectant les délais légaux',
    category: 'convocations',
    roles: PRIVILEGED,
    keywords: ['convocations', 'envoyer', 'email', 'délai', 'légal', 'cgct'],
    icon: 'Send',
    blocks: [
      { type: 'paragraph', text: 'Avant d\'envoyer les convocations, assurez-vous que :' },
      { type: 'list', items: [
        'L\'ordre du jour comporte au moins un point',
        'Le président de séance est désigné',
        'Les convocataires sont sélectionnés (par défaut tous les membres de l\'instance)',
        'La séance est en statut BROUILLON ou CONVOQUÉE',
      ] },
      { type: 'heading', level: 2, text: 'Procédure' },
      { type: 'steps', items: [
        { title: 'Aller sur la page de la séance', details: 'Cliquez sur le bouton « Envoyer les convocations » en haut à droite.' },
        { title: 'Confirmer dans la modale', details: 'Le système liste tous les destinataires et la liste des points ODJ. Vous pouvez encore annuler.' },
        { title: 'Cliquer sur « Envoyer maintenant »', details: 'Les emails partent en parallèle. Le statut de la séance passe à CONVOQUÉE.' },
      ] },
      { type: 'legal', text: 'Le délai légal de convocation est généralement de 3 jours francs avant la séance pour les communes (5 jours pour les communes ≥ 3 500 hab.). Pour les autres collectivités, vérifiez votre règlement intérieur.', reference: 'CGCT L2121-12' },
      { type: 'tip', text: 'Vous pouvez suivre le statut de chaque convocation dans le tableau : Envoyée → Lue → Confirmée présent / Absente. Les erreurs d\'envoi (boîte pleine, adresse erronée) sont signalées en rouge. Pour relancer un membre, voir [Renvoyer une convocation](article:renvoyer-convocation).' },
      { type: 'related', articleIds: ['renvoyer-convocation', 'creer-seance', 'configuration-quorum'] },
    ],
  },

  {
    id: 'renvoyer-convocation',
    title: 'Renvoyer une convocation individuelle',
    summary: 'Si un élu n\'a pas reçu / a perdu sa convocation',
    category: 'convocations',
    roles: PRIVILEGED,
    keywords: ['renvoyer', 'relance', 'perdu', 'spam', 'erreur', 'historique'],
    icon: 'RefreshCw',
    blocks: [
      { type: 'paragraph', text: 'Si un élu signale qu\'il n\'a pas reçu sa convocation (mail perdu, dans les spams, adresse changée), vous pouvez la renvoyer individuellement.' },
      { type: 'steps', items: [
        { title: 'Aller dans l\'onglet Convocations de la séance' },
        { title: 'Cliquer sur l\'icône 🔄 à côté du convocataire' },
        { title: 'Choisir un motif de renvoi', details: 'Email perdu, Spam, Adresse erronée, ou Autre. Vous pouvez ajouter une précision libre.' },
        { title: 'Confirmer le renvoi' },
      ] },
      { type: 'success', text: 'Le motif et la date du renvoi sont consignés dans l\'historique des envois, consultable dans la page [Historique](/historique). Visible aussi dans le rapport de contrôle préfectoral.' },
      { type: 'tip', text: 'Si l\'élu avait déjà confirmé sa présence, le renvoi conserve cette confirmation — elle n\'est pas effacée.' },
      { type: 'related', articleIds: ['envoyer-convocations', 'historique'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // SÉANCES
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'creer-seance',
    title: 'Créer une séance',
    summary: 'Du brouillon à la convocation, étape par étape',
    category: 'seances',
    roles: PRIVILEGED,
    keywords: ['créer', 'séance', 'wizard', 'préparer', 'odj', 'convocataires'],
    icon: 'Plus',
    blocks: [
      { type: 'paragraph', text: 'L\'application propose un assistant de création en plusieurs étapes pour ne rien oublier.' },
      { type: 'steps', items: [
        { title: 'Cliquer sur « Nouvelle séance »', details: 'Depuis la page Séances ou le tableau de bord.' },
        { title: 'Étape 1 — Informations générales', details: 'Choisissez l\'instance (CM, CAO, etc.), le titre, la date, l\'heure, le lieu, le mode (présentiel / hybride / visio).' },
        { title: 'Étape 2 — Ordre du jour', details: 'Ajoutez chaque point avec son titre, son type, sa description et ses pièces jointes. Vous pouvez réordonner par glisser-déposer.' },
        { title: 'Étape 3 — Convocataires', details: 'Sélectionnez les membres à convoquer (par défaut, tous les membres actifs de l\'instance).' },
        { title: 'Étape 4 — Récapitulatif', details: 'Vérifiez tout. La séance est créée en statut BROUILLON, modifiable.' },
      ] },
      { type: 'tip', text: 'L\'assistant sauvegarde automatiquement à chaque étape. Vous pouvez fermer et reprendre plus tard sans perdre votre saisie.' },
    ],
  },

  {
    id: 'archiver-seance',
    title: 'Archiver une séance',
    summary: 'Retirer une séance terminée de la liste active',
    category: 'seances',
    roles: PRIVILEGED,
    keywords: ['archiver', 'archive', 'séance', 'historique', 'clôturer'],
    icon: 'Archive',
    blocks: [
      { type: 'paragraph', text: 'Une fois une séance clôturée et son PV signé, vous pouvez l\'archiver pour désencombrer la liste active. Toutes les données (votes, présences, PV, délibérations) sont conservées et restent consultables dans l\'onglet « Archives ».' },
      { type: 'tip', text: 'L\'archivage est réversible — un bouton « Désarchiver » remet la séance dans la liste active.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // VOTES
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'vote-main-levee',
    title: 'Vote à main levée',
    summary: 'Le mode de vote par défaut en séance',
    category: 'votes',
    roles: ALL_ROLES,
    keywords: ['vote', 'main levée', 'pour', 'contre', 'abstention', 'unanimité'],
    icon: 'Hand',
    blocks: [
      { type: 'paragraph', text: 'Le vote à main levée est le mode standard. Le président demande qui est contre, puis qui s\'abstient. Les autres membres sont considérés POUR par défaut.' },
      { type: 'heading', level: 2, text: 'Côté gestionnaire / conducteur' },
      { type: 'list', items: [
        'Cliquer sur « Ouvrir le vote » sur le point ODJ concerné',
        'Saisir le nombre de CONTRE et d\'ABSTENTIONS (les noms peuvent être ajoutés pour traçabilité)',
        'Le système calcule automatiquement les POUR (total votants − contre − abstentions)',
        'Cliquer sur « Clôturer le vote »',
        'La formule légale du PV est générée automatiquement selon le résultat',
      ] },
      { type: 'heading', level: 2, text: 'Côté élu' },
      { type: 'paragraph', text: 'Vous votez physiquement en levant la main. Le secrétariat saisit votre vote. Vous pouvez vérifier l\'enregistrement final dans le PV publié.' },
      { type: 'legal', text: 'Le vote à main levée est interdit pour les élections de personnes — celles-ci se déroulent obligatoirement à bulletin secret.', reference: 'CGCT L2121-21' },
    ],
  },

  {
    id: 'vote-secret',
    title: 'Vote à bulletin secret',
    summary: 'Pour les élections et sur demande d\'1/3 des membres',
    category: 'votes',
    roles: ALL_ROLES,
    keywords: ['vote', 'secret', 'bulletin', 'élection', 'cryptographie', 'anonyme'],
    icon: 'Lock',
    blocks: [
      { type: 'paragraph', text: 'Le vote à bulletin secret garantit l\'anonymat absolu de chaque votant.' },
      { type: 'heading', level: 2, text: 'Architecture cryptographique' },
      { type: 'list', items: [
        'Chaque bulletin est chiffré (AES-256-GCM) avec une clé de session unique',
        'Deux tables séparées : qui a voté (sans le choix) / le choix (sans member_id)',
        'Aucun croisement possible entre identité du votant et bulletin',
        'À la clôture, la clé de session est nullifiée — les bulletins ne peuvent plus être déchiffrés',
      ] },
      { type: 'heading', level: 2, text: 'Procédure côté élu (tablette)' },
      { type: 'steps', items: [
        { title: 'Le président déclare le vote ouvert' },
        { title: 'Sur votre tablette, choisissez votre bulletin', details: 'POUR / CONTRE / ABSTENTION ou un nom de candidat.' },
        { title: 'Confirmer votre vote', details: 'Une fois validé, votre bulletin est immuable.' },
      ] },
      { type: 'success', text: 'Conformité CGCT L2121-21 — Le secret du vote est garanti même au gestionnaire de l\'application. Les développeurs ne peuvent pas non plus accéder aux bulletins individuels.' },
    ],
  },

  {
    id: 'procurations',
    title: 'Procurations',
    summary: 'Comment un élu absent peut donner procuration',
    category: 'votes',
    roles: ALL_ROLES,
    keywords: ['procuration', 'mandat', 'mandataire', 'mandant', 'absent'],
    icon: 'UserPlus',
    blocks: [
      { type: 'paragraph', text: 'Un membre empêché peut donner procuration à un autre membre, qui votera en son nom.' },
      { type: 'legal', text: 'Un même membre ne peut être porteur que d\'une seule procuration. La procuration est valable pour une seule séance (sauf décision contraire). La procuration peut être révoquée à tout moment avant la séance.', reference: 'CGCT L2121-20' },
      { type: 'heading', level: 2, text: 'Procédure' },
      { type: 'steps', items: [
        { title: 'L\'élu absent contacte le secrétariat', details: 'Pour déclarer son absence et désigner son mandataire.' },
        { title: 'Le secrétariat enregistre la procuration', details: 'Avec accord écrit du mandant et du mandataire.' },
        { title: 'En séance', details: 'Le mandataire vote pour lui-même ET pour son mandant. Le système le détecte automatiquement.' },
      ] },
    ],
  },

  {
    id: 'recusation',
    title: 'Récusation pour conflit d\'intérêt',
    summary: 'Quand un élu doit s\'abstenir sur un point précis',
    category: 'votes',
    roles: ALL_ROLES,
    keywords: ['récusation', 'conflit', 'intérêt', 'abstention', 'huis clos'],
    icon: 'UserX',
    blocks: [
      { type: 'paragraph', text: 'Un élu en situation de conflit d\'intérêt sur un point de l\'ODJ doit se récuser : il ne participe pas à la délibération ni au vote.' },
      { type: 'legal', text: 'Le défaut de récusation peut entraîner l\'annulation de la délibération par la préfecture ou le juge administratif.', reference: 'CGCT L2131-11' },
      { type: 'heading', level: 2, text: 'Procédure' },
      { type: 'list', items: [
        'L\'élu déclare lui-même son conflit d\'intérêt en début de séance',
        'Le gestionnaire / président enregistre la récusation sur le point concerné',
        'L\'élu sort de la salle pendant la délibération (selon usage)',
        'L\'élu n\'apparaît pas dans le décompte des votants pour ce point',
        'La récusation est mentionnée explicitement dans le PV',
      ] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // PV
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'pv-redaction',
    title: 'Rédiger le procès-verbal',
    summary: 'Du brouillon à la signature',
    category: 'pv',
    roles: [...PRIVILEGED, ...BUREAU],
    keywords: ['pv', 'procès-verbal', 'rédaction', 'brouillon', 'signer'],
    icon: 'PenLine',
    blocks: [
      { type: 'paragraph', text: 'Le procès-verbal est généré automatiquement à la clôture de la séance avec toutes les données : présents, votes, formules légales. Il reste modifiable jusqu\'à signature.' },
      { type: 'heading', level: 2, text: 'Étapes' },
      { type: 'steps', items: [
        { title: 'Brouillon généré automatiquement', details: 'Le secrétaire complète les notes manuscrites et discussions.' },
        { title: 'Mise en relecture', details: 'Le PV est partagé en interne. Les commentaires sont consignés.' },
        { title: 'Validation par le président + secrétaire de séance', details: 'Les deux signatures électroniques sont nécessaires.' },
        { title: 'Signature finale', details: 'Le PV passe en statut SIGNÉ — il devient immuable (impossible à modifier ensuite).' },
        { title: 'Approbation en séance suivante', details: 'Le PV est soumis au vote des élus pour approbation officielle.' },
      ] },
      { type: 'legal', text: 'Le PV doit être signé par le président de séance et le secrétaire. L\'approbation par l\'assemblée intervient à la séance suivante.', reference: 'CGCT L2121-15' },
    ],
  },

  {
    id: 'pv-consultation',
    title: 'Consulter un procès-verbal',
    summary: 'Lire les PV publiés des séances précédentes',
    category: 'pv',
    roles: ALL_ROLES,
    keywords: ['pv', 'consulter', 'lire', 'historique', 'téléchargement'],
    icon: 'FileSearch',
    blocks: [
      { type: 'paragraph', text: 'Une fois signé et publié, un PV est consultable par tous les membres convoqués à la séance, ainsi que par les profils privilégiés et le bureau.' },
      { type: 'list', items: [
        'Aller sur la page de la séance concernée',
        'Onglet « PV » (visible uniquement si le PV existe)',
        'Lecture en ligne ou téléchargement PDF',
      ] },
      { type: 'tip', text: 'Les PV en cours de rédaction (BROUILLON, EN_RELECTURE) ne sont pas visibles aux élus — uniquement au bureau de séance et aux profils privilégiés.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // MEMBRES
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'inviter-membre',
    title: 'Inviter un nouveau membre',
    summary: 'Créer un compte de connexion pour un nouvel élu / agent',
    category: 'membres',
    roles: PRIVILEGED,
    keywords: ['inviter', 'nouveau', 'membre', 'créer', 'compte', 'invitation', 'email'],
    icon: 'UserPlus',
    blocks: [
      { type: 'steps', items: [
        { title: 'Aller sur la page Membres' },
        { title: 'Cliquer sur « Ajouter un membre »' },
        { title: 'Remplir les informations', details: 'Prénom, nom, email, qualité officielle, rôle, instance(s) d\'appartenance.' },
        { title: 'Cocher « Envoyer l\'invitation par email maintenant »', details: 'Coché par défaut. Le membre recevra un email d\'activation valide 24 heures.' },
        { title: 'Valider', details: 'Le membre apparaît dans la liste avec le badge « En attente d\'activation ».' },
      ] },
      { type: 'tip', text: 'Si vous voulez juste créer la fiche pour l\'instant sans inviter (par exemple pour préparer un mandat futur), décochez l\'option d\'invitation. Vous pourrez l\'envoyer plus tard depuis le menu actions du membre. Voir [Comprendre l\'état du compte](article:etat-compte-membre).' },
      { type: 'tip', text: 'Aller directement à la page [Membres](/membres).' },
      { type: 'related', articleIds: ['etat-compte-membre', 'archiver-membre'] },
    ],
  },

  {
    id: 'etat-compte-membre',
    title: 'Comprendre l\'état du compte d\'un membre',
    summary: '« Pas de compte », « En attente », « Activé » — qu\'est-ce que ça veut dire ?',
    category: 'membres',
    roles: PRIVILEGED,
    keywords: ['compte', 'état', 'activation', 'pending', 'invité'],
    icon: 'CheckCircle2',
    blocks: [
      { type: 'paragraph', text: 'Chaque membre a deux statuts indépendants :' },
      { type: 'definition', term: 'Statut du mandat', definition: 'Actif / Suspendu / Fin de mandat / Décédé. Concerne sa situation politique vis-à-vis de l\'institution.' },
      { type: 'definition', term: 'État du compte', definition: 'Pas de compte / En attente d\'activation / Compte activé. Concerne sa capacité à se connecter à l\'application.' },
      { type: 'list', items: [
        '⚪ « Pas de compte » : créé en base mais aucune invitation envoyée. Bouton « Inviter à se connecter ».',
        '🟠 « En attente d\'activation » : invité mais n\'a pas cliqué sur le lien. Bouton « Renvoyer l\'invitation ».',
        '🟢 « Compte activé » : a défini son mot de passe, peut se connecter. Bouton « Envoyer un lien de réinitialisation » disponible.',
      ] },
      { type: 'tip', text: 'L\'état du compte se met à jour automatiquement dès que le membre clique sur le lien d\'activation et choisit son mot de passe.' },
    ],
  },

  {
    id: 'archiver-membre',
    title: 'Archiver un membre',
    summary: 'Retirer un membre de la liste active sans effacer ses données',
    category: 'membres',
    roles: PRIVILEGED,
    keywords: ['archiver', 'archive', 'retirer', 'rgpd', 'historique'],
    icon: 'Archive',
    blocks: [
      { type: 'paragraph', text: 'L\'archivage est différent de « Fin de mandat » ou « Suspendu » : il retire le membre de la liste active mais conserve toutes ses données (votes, présences, historique). Utile pour décharger l\'interface sans perdre les traces.' },
      { type: 'list', items: [
        'Le membre archivé n\'apparaît plus dans la liste active',
        'Il n\'est plus proposé pour les convocations futures',
        'Toutes ses données passées restent accessibles dans l\'onglet « Archives »',
        'Réversible — bouton « Désarchiver » à tout moment',
      ] },
      { type: 'warning', text: 'Vous ne pouvez pas archiver un membre qui occupe un rôle de bureau actif (président, secrétaire d\'une instance). Désignez d\'abord son remplaçant.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'configuration-institution',
    title: 'Paramétrer l\'institution',
    summary: 'Configuration initiale de l\'application',
    category: 'configuration',
    roles: ['super_admin', 'dgs', 'directeur_cabinet'],
    keywords: ['configuration', 'institution', 'paramètres', 'instance', 'quorum'],
    icon: 'Settings',
    blocks: [
      { type: 'paragraph', text: 'La configuration est accessible aux super-administrateurs, DGS et Directeurs de cabinet.' },
      { type: 'heading', level: 2, text: 'Sections principales' },
      { type: 'list', items: [
        'Identité de l\'institution (nom officiel, type, SIREN)',
        'Instances délibérantes (CM, CAO, commissions...) avec composition et règles de quorum',
        'Templates de documents (PDF de convocation, PV, etc.)',
        'Templates emails (invitation, convocation, rappels)',
        'Configuration des tablettes (mode QR strict, WebAuthn)',
      ] },
      { type: 'warning', text: 'Le toggle « QR strict » (impose le scan QR pour l\'émargement, sans pointage manuel possible sauf mode dégradé) est réservé au super-administrateur. Cette restriction est volontaire car ce paramètre a un impact direct sur la validité juridique des séances.' },
    ],
  },

  {
    id: 'configuration-quorum',
    title: 'Définir les règles de quorum',
    summary: 'Comment l\'application calcule le quorum d\'une instance',
    category: 'configuration',
    roles: PRIVILEGED,
    keywords: ['quorum', 'majorité', 'fraction', 'composition'],
    icon: 'Calculator',
    blocks: [
      { type: 'paragraph', text: 'Pour chaque instance, vous définissez les règles de quorum.' },
      { type: 'list', items: [
        'Composition maximale (nombre théorique de membres)',
        'Type de quorum : Majorité des membres / Tiers / Deux tiers / Selon statuts (fraction libre)',
        'Voix prépondérante du président activée ou non',
        'Majorité requise par défaut pour les délibérations (simple, qualifiée, etc.)',
      ] },
      { type: 'legal', text: 'Pour les conseils municipaux : la majorité des membres en exercice est requise. À défaut, une nouvelle convocation peut être envoyée sous 3 jours, et la séance peut alors se tenir avec n\'importe quel nombre de présents (séance dite de « reconvocation »).', reference: 'CGCT L2121-17' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // AUDIT
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'historique',
    title: 'Consulter l\'historique des modifications',
    summary: 'Mouchard append-only de toutes les actions sur l\'application',
    category: 'audit',
    roles: PRIVILEGED,
    keywords: ['historique', 'audit', 'log', 'mouchard', 'traçabilité', 'modification'],
    icon: 'History',
    blocks: [
      { type: 'paragraph', text: 'Toute action sur les données métier est enregistrée automatiquement avec : date, utilisateur, IP, user-agent, et les valeurs avant/après modification.' },
      { type: 'heading', level: 2, text: 'Filtres disponibles' },
      { type: 'list', items: [
        'Recherche libre dans les valeurs',
        'Utilisateur ayant effectué l\'action',
        'Type de modification (Création / Modification / Suppression)',
        'Table affectée (membres, séances, votes, etc.)',
        'Période (du / au)',
      ] },
      { type: 'success', text: 'L\'historique est strictement immuable : aucune entrée ne peut être modifiée ou supprimée — pas même par un super-administrateur via l\'interface normale. Les insertions ne se font que via les triggers SQL automatiques.' },
      { type: 'heading', level: 2, text: 'Export pour la préfecture' },
      { type: 'paragraph', text: 'Le bouton « Exporter CSV » génère un fichier conforme pour le contrôle de légalité.' },
      { type: 'tip', text: 'Pour accéder directement à la page : [Ouvrir l\'historique](/historique).' },
      { type: 'related', articleIds: ['anonymisation-rgpd'] },
    ],
  },

  {
    id: 'anonymisation-rgpd',
    title: 'Anonymiser une entrée d\'audit (RGPD)',
    summary: 'Réservé au super-administrateur uniquement',
    category: 'audit',
    roles: ['super_admin'],
    keywords: ['rgpd', 'anonymisation', 'redaction', 'effacement', 'droit'],
    icon: 'Lock',
    blocks: [
      { type: 'paragraph', text: 'Sur demande RGPD d\'effacement de données personnelles, le super-administrateur peut anonymiser une entrée d\'audit.' },
      { type: 'warning', text: 'Cette action est IRRÉVERSIBLE. Les valeurs avant/après sont remplacées par [REDACTED]. La trace de l\'anonymisation (qui, quand, motif) est elle-même conservée dans une table immuable.' },
      { type: 'steps', items: [
        { title: 'Identifier l\'entrée à anonymiser', details: 'Via la page Historique avec les filtres.' },
        { title: 'Cliquer sur l\'icône cadenas', details: 'Visible uniquement pour le super-administrateur.' },
        { title: 'Saisir le motif légal obligatoire', details: 'Minimum 10 caractères. Exemple : « Demande RGPD reçue le 15/04/2026, ref dossier XYZ ».' },
        { title: 'Confirmer', details: 'L\'entrée est anonymisée immédiatement, le motif et l\'horodatage sont stockés.' },
      ] },
      { type: 'legal', text: 'Conformément à l\'article 17 du RGPD, le droit à l\'effacement n\'est pas absolu. Vérifiez avec votre DPO avant d\'anonymiser une entrée.', reference: 'RGPD Art. 17' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // GLOSSAIRE
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'glossaire',
    title: 'Glossaire',
    summary: 'Tous les termes techniques expliqués simplement',
    category: 'glossaire',
    roles: ALL_ROLES,
    keywords: ['glossaire', 'définitions', 'termes', 'abréviations', 'vocabulaire'],
    icon: 'BookOpen',
    blocks: [
      { type: 'definition', term: 'CGCT', definition: 'Code Général des Collectivités Territoriales. Texte de loi qui régit le fonctionnement des collectivités locales.' },
      { type: 'definition', term: 'ODJ', definition: 'Ordre du jour. Liste des points à traiter pendant une séance.' },
      { type: 'definition', term: 'PV', definition: 'Procès-verbal. Compte rendu officiel d\'une séance, signé par le président et le secrétaire.' },
      { type: 'definition', term: 'Quorum', definition: 'Nombre minimum de membres présents requis pour qu\'une séance soit valide. Variable selon l\'instance.' },
      { type: 'definition', term: 'Délibération', definition: 'Décision officielle prise par l\'assemblée à l\'issue d\'un vote. Transmise à la préfecture pour contrôle de légalité.' },
      { type: 'definition', term: 'Procuration', definition: 'Mandat donné par un membre absent à un autre membre pour voter en son nom.' },
      { type: 'definition', term: 'Récusation', definition: 'Acte par lequel un membre se retire de la délibération sur un point en raison d\'un conflit d\'intérêt.' },
      { type: 'definition', term: 'Convocation', definition: 'Acte officiel par lequel le président appelle les membres à se réunir en séance. Doit respecter un délai légal.' },
      { type: 'definition', term: 'Convocataire', definition: 'Membre auquel une convocation a été adressée pour une séance précise.' },
      { type: 'definition', term: 'Émargement', definition: 'Acte de signer la liste de présence à l\'entrée de la séance, prouvant la présence physique.' },
      { type: 'definition', term: 'Reconvocation', definition: 'Si le quorum n\'est pas atteint à la première convocation, le président peut reconvoquer dans les 3 jours. La séance peut alors se tenir avec n\'importe quel nombre de présents.' },
      { type: 'definition', term: 'Voix prépondérante', definition: 'En cas d\'égalité des voix, celle du président compte double. Activable au niveau de l\'instance.' },
      { type: 'definition', term: 'Vote à bulletin secret', definition: 'Mode de vote où l\'identité du votant ne peut pas être reliée à son choix. Obligatoire pour les élections de personnes.' },
      { type: 'definition', term: 'Vote nominal', definition: 'Mode de vote où chaque membre vote individuellement à voix haute, et son nom est consigné avec son choix dans le PV.' },
      { type: 'definition', term: 'Télévote', definition: 'Vote à distance par SMS / OTP. Réservé aux situations exceptionnelles (membre empêché de se déplacer).' },
      { type: 'definition', term: 'WebAuthn / FIDO2', definition: 'Norme cryptographique d\'authentification matérielle sans mot de passe (empreinte, clé sécurité). Utilisée sur les tablettes en séance.' },
      { type: 'definition', term: 'Acte préfectoral', definition: 'Toute délibération qui doit être transmise à la préfecture pour contrôle de légalité avant entrée en vigueur.' },
      { type: 'definition', term: 'DGS', definition: 'Directeur Général des Services. Plus haut fonctionnaire de l\'administration de la collectivité.' },
      { type: 'definition', term: 'Dir. cabinet', definition: 'Directeur de cabinet. Collaborateur politique du chef de l\'exécutif (maire, président...).' },
    ],
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Filtre les articles selon le rôle de l'utilisateur connecté.
 * Si role est null/undefined, ne renvoie que les articles publicAccess.
 */
export function filterArticlesByRole(articles: DocArticle[], role: UserRole | null | undefined): DocArticle[] {
  if (!role) return articles.filter(a => a.publicAccess === true)
  return articles.filter(a => a.roles.length === 0 || a.roles.includes(role))
}

/**
 * Recherche full-text dans les articles (titre, summary, mots-clés, contenu).
 * Renvoie les articles matchant, ordonnés par pertinence (matches dans le
 * titre > matches dans les mots-clés > matches dans le contenu).
 */
export function searchArticles(articles: DocArticle[], query: string): DocArticle[] {
  const q = query.trim().toLowerCase()
  if (!q) return articles

  const scored = articles.map(a => {
    let score = 0
    const titleLower = a.title.toLowerCase()
    const summaryLower = a.summary.toLowerCase()
    const keywordsLower = a.keywords.map(k => k.toLowerCase()).join(' ')
    const contentLower = a.blocks.map(b => {
      if ('text' in b) return b.text
      if ('items' in b) return Array.isArray(b.items) ? b.items.map(i => typeof i === 'string' ? i : `${i.title} ${i.details || ''}`).join(' ') : ''
      if ('definition' in b) return `${b.term} ${b.definition}`
      return ''
    }).join(' ').toLowerCase()

    if (titleLower.includes(q)) score += 10
    if (summaryLower.includes(q)) score += 5
    if (keywordsLower.includes(q)) score += 3
    if (contentLower.includes(q)) score += 1

    return { article: a, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.article)
}

/**
 * Groupe les articles par catégorie, dans l'ordre défini par CATEGORY_ORDER.
 */
export function groupByCategory(articles: DocArticle[]): { category: DocCategory; label: string; articles: DocArticle[] }[] {
  const map = new Map<DocCategory, DocArticle[]>()
  for (const a of articles) {
    if (!map.has(a.category)) map.set(a.category, [])
    map.get(a.category)!.push(a)
  }
  return CATEGORY_ORDER
    .filter(c => map.has(c))
    .map(c => ({ category: c, label: CATEGORY_LABELS[c], articles: map.get(c)! }))
}
