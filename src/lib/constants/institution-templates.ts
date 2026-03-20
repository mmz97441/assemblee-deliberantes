/**
 * Templates d'instances pré-configurées par type d'institution.
 * Chaque type a ses propres instances typiques avec des valeurs par défaut adaptées.
 */

export type InstitutionType = 'commune' | 'syndicat' | 'cc' | 'departement' | 'asso'

export interface InstanceTemplate {
  nom: string
  type_legal: string
  composition_max: number | null
  delai_convocation_jours: number
  quorum_type: 'MAJORITE_MEMBRES' | 'TIERS_MEMBRES' | 'DEUX_TIERS' | 'STATUTS'
  majorite_defaut: 'SIMPLE' | 'ABSOLUE' | 'QUALIFIEE' | 'UNANIMITE'
  voix_preponderante: boolean
  vote_secret_nominations: boolean
  seances_publiques_defaut: boolean
  votes_qd_autorises: boolean
  mode_arrivee_tardive: 'STRICT' | 'SOUPLE' | 'SUSPENDU'
  description: string
}

export interface InstitutionTypeConfig {
  label: string
  shortLabel: string
  description: string
  icon: string // emoji
  examples: string
  color: string // tailwind color
  placeholders: {
    nom: string
    adresse: string
    email: string
    telephone: string
    prefecture: string
    portail: string
    prefixe_delib: string
  }
  instances: InstanceTemplate[]
  features: string[]
}

export const INSTITUTION_TYPES: Record<InstitutionType, InstitutionTypeConfig> = {
  commune: {
    label: 'Commune / Mairie',
    shortLabel: 'Commune',
    description: 'Gérez le conseil municipal, les commissions et le bureau municipal',
    icon: '🏛️',
    examples: 'Mairie de Lyon, Commune de Saint-Martin...',
    color: 'blue',
    placeholders: {
      nom: 'Commune de Saint-Martin',
      adresse: '1 place de la Mairie\n12345 Saint-Martin',
      email: 'secretariat@mairie-saint-martin.fr',
      telephone: '01 23 45 67 89',
      prefecture: 'Préfecture de l\'Hérault',
      portail: 'https://mairie-saint-martin.fr',
      prefixe_delib: 'DEL',
    },
    instances: [
      {
        nom: 'Conseil municipal',
        type_legal: 'Conseil municipal',
        composition_max: 33,
        delai_convocation_jours: 5,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: true,
        seances_publiques_defaut: true,
        votes_qd_autorises: false,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'Instance principale — votes des délibérations, budget, urbanisme',
      },
      {
        nom: 'Bureau municipal',
        type_legal: 'Bureau municipal',
        composition_max: null,
        delai_convocation_jours: 3,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: false,
        seances_publiques_defaut: false,
        votes_qd_autorises: true,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'Maire + adjoints — gestion courante et décisions rapides',
      },
      {
        nom: 'Commission finances',
        type_legal: 'Commission permanente',
        composition_max: null,
        delai_convocation_jours: 3,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: false,
        vote_secret_nominations: false,
        seances_publiques_defaut: false,
        votes_qd_autorises: true,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'Examen des dossiers financiers et budgétaires',
      },
      {
        nom: 'Commission urbanisme',
        type_legal: 'Commission permanente',
        composition_max: null,
        delai_convocation_jours: 3,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: false,
        vote_secret_nominations: false,
        seances_publiques_defaut: false,
        votes_qd_autorises: true,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'Permis de construire, PLU, aménagement du territoire',
      },
    ],
    features: [
      'Conseil municipal avec séances publiques',
      'Bureau municipal (maire + adjoints)',
      'Commissions permanentes et thématiques',
      'Vote à main levée et scrutin secret',
      'Procès-verbaux conformes au CGCT',
      'Transmission des actes à la préfecture',
    ],
  },

  syndicat: {
    label: 'Syndicat intercommunal',
    shortLabel: 'Syndicat',
    description: 'Gérez le conseil d\'administration, le bureau et l\'assemblée générale',
    icon: '🤝',
    examples: 'Syndicat des eaux, Syndicat scolaire, SIVOM...',
    color: 'emerald',
    placeholders: {
      nom: 'Syndicat Intercommunal des Eaux du Val',
      adresse: '15 rue de la République\n34000 Montpellier',
      email: 'secretariat@syndicat-eaux-val.fr',
      telephone: '04 67 00 00 00',
      prefecture: 'Préfecture de l\'Hérault',
      portail: 'https://syndicat-eaux-val.fr',
      prefixe_delib: 'CA',
    },
    instances: [
      {
        nom: 'Assemblée générale',
        type_legal: 'Assemblée générale',
        composition_max: null,
        delai_convocation_jours: 15,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: true,
        seances_publiques_defaut: true,
        votes_qd_autorises: false,
        mode_arrivee_tardive: 'STRICT',
        description: 'Réunit tous les délégués — votes statutaires et budget',
      },
      {
        nom: 'Conseil d\'administration',
        type_legal: 'Conseil d\'administration',
        composition_max: null,
        delai_convocation_jours: 5,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: true,
        seances_publiques_defaut: false,
        votes_qd_autorises: true,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'Gestion courante — délibérations, marchés, conventions',
      },
      {
        nom: 'Bureau',
        type_legal: 'Bureau',
        composition_max: null,
        delai_convocation_jours: 3,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: false,
        seances_publiques_defaut: false,
        votes_qd_autorises: true,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'Président + vice-présidents — décisions urgentes',
      },
    ],
    features: [
      'Assemblée générale des délégués',
      'Conseil d\'administration',
      'Bureau (président + VP)',
      'Gestion des représentants par commune',
      'Convocations avec délai statutaire',
      'Import des adhérents/délégués',
    ],
  },

  cc: {
    label: 'Communauté de communes',
    shortLabel: 'Intercommunalité',
    description: 'Gérez le conseil communautaire, le bureau et les commissions',
    icon: '🏘️',
    examples: 'CC du Grand Sud, CA de Montpellier...',
    color: 'violet',
    placeholders: {
      nom: 'Communauté de Communes du Grand Sud',
      adresse: '100 avenue de l\'Europe\n34000 Montpellier',
      email: 'secretariat@cc-grandsud.fr',
      telephone: '04 67 00 00 00',
      prefecture: 'Préfecture de l\'Hérault',
      portail: 'https://cc-grandsud.fr',
      prefixe_delib: 'CC',
    },
    instances: [
      {
        nom: 'Conseil communautaire',
        type_legal: 'Conseil communautaire',
        composition_max: null,
        delai_convocation_jours: 5,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: true,
        seances_publiques_defaut: true,
        votes_qd_autorises: false,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'Instance délibérante principale — tous les conseillers communautaires',
      },
      {
        nom: 'Bureau communautaire',
        type_legal: 'Bureau communautaire',
        composition_max: null,
        delai_convocation_jours: 3,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: false,
        seances_publiques_defaut: false,
        votes_qd_autorises: true,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'Président + VP — gestion courante entre les conseils',
      },
      {
        nom: 'Commission aménagement',
        type_legal: 'Commission thématique',
        composition_max: null,
        delai_convocation_jours: 5,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: false,
        vote_secret_nominations: false,
        seances_publiques_defaut: false,
        votes_qd_autorises: true,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'PLUi, SCOT, voirie, transports',
      },
    ],
    features: [
      'Conseil communautaire (tous délégués)',
      'Bureau communautaire',
      'Commissions thématiques',
      'Représentation pondérée par commune',
      'Compétences transférées (voirie, déchets...)',
      'Transmission préfectorale des actes',
    ],
  },

  departement: {
    label: 'Conseil départemental',
    shortLabel: 'Département',
    description: 'Gérez l\'assemblée départementale, la commission permanente et les commissions',
    icon: '🏰',
    examples: 'Département de l\'Hérault, Département du Nord...',
    color: 'amber',
    placeholders: {
      nom: 'Département de l\'Hérault',
      adresse: '1000 rue d\'Alco\n34087 Montpellier Cedex 4',
      email: 'secretariat@herault.fr',
      telephone: '04 67 67 67 67',
      prefecture: 'Préfecture de l\'Hérault',
      portail: 'https://herault.fr',
      prefixe_delib: 'CD',
    },
    instances: [
      {
        nom: 'Assemblée départementale',
        type_legal: 'Assemblée départementale',
        composition_max: null,
        delai_convocation_jours: 12,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: true,
        seances_publiques_defaut: true,
        votes_qd_autorises: false,
        mode_arrivee_tardive: 'STRICT',
        description: 'Session plénière — budget, grandes orientations',
      },
      {
        nom: 'Commission permanente',
        type_legal: 'Commission permanente',
        composition_max: null,
        delai_convocation_jours: 5,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: true,
        seances_publiques_defaut: false,
        votes_qd_autorises: true,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'Délégation de l\'assemblée — délibérations courantes',
      },
    ],
    features: [
      'Assemblée départementale plénière',
      'Commission permanente',
      'Commissions spécialisées',
      'Binômes cantonaux',
      'Délégations de compétences',
      'Contrôle de légalité préfectoral',
    ],
  },

  asso: {
    label: 'Association loi 1901',
    shortLabel: 'Association',
    description: 'Gérez l\'AG, le conseil d\'administration et le bureau',
    icon: '🏢',
    examples: 'Association sportive, ONG, fédération...',
    color: 'rose',
    placeholders: {
      nom: 'Association Sportive de Saint-Martin',
      adresse: '12 rue du Stade\n12345 Saint-Martin',
      email: 'contact@asso-saint-martin.fr',
      telephone: '06 00 00 00 00',
      prefecture: 'Préfecture de l\'Hérault',
      portail: 'https://asso-saint-martin.fr',
      prefixe_delib: 'AG',
    },
    instances: [
      {
        nom: 'Assemblée générale',
        type_legal: 'Assemblée générale ordinaire',
        composition_max: null,
        delai_convocation_jours: 15,
        quorum_type: 'STATUTS',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: true,
        seances_publiques_defaut: false,
        votes_qd_autorises: false,
        mode_arrivee_tardive: 'STRICT',
        description: 'Tous les membres — élections, bilan, budget prévisionnel',
      },
      {
        nom: 'AG extraordinaire',
        type_legal: 'Assemblée générale extraordinaire',
        composition_max: null,
        delai_convocation_jours: 15,
        quorum_type: 'DEUX_TIERS',
        majorite_defaut: 'QUALIFIEE',
        voix_preponderante: false,
        vote_secret_nominations: true,
        seances_publiques_defaut: false,
        votes_qd_autorises: false,
        mode_arrivee_tardive: 'STRICT',
        description: 'Modification des statuts, dissolution, fusion',
      },
      {
        nom: 'Conseil d\'administration',
        type_legal: 'Conseil d\'administration',
        composition_max: null,
        delai_convocation_jours: 7,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: false,
        seances_publiques_defaut: false,
        votes_qd_autorises: true,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'Administrateurs élus — gestion courante de l\'association',
      },
      {
        nom: 'Bureau',
        type_legal: 'Bureau',
        composition_max: null,
        delai_convocation_jours: 3,
        quorum_type: 'MAJORITE_MEMBRES',
        majorite_defaut: 'SIMPLE',
        voix_preponderante: true,
        vote_secret_nominations: false,
        seances_publiques_defaut: false,
        votes_qd_autorises: true,
        mode_arrivee_tardive: 'SOUPLE',
        description: 'Président, trésorier, secrétaire — exécutif au quotidien',
      },
    ],
    features: [
      'Assemblée générale (ordinaire et extraordinaire)',
      'Conseil d\'administration',
      'Bureau (président, trésorier, secrétaire)',
      'Gestion des adhérents et cotisations',
      'Procurations et votes par correspondance',
      'Conformité statuts loi 1901',
    ],
  },
}

export function getInstitutionConfig(type: string): InstitutionTypeConfig | null {
  return INSTITUTION_TYPES[type as InstitutionType] || null
}
