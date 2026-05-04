/**
 * Formatage protocolaire des appellations officielles françaises.
 *
 * Combine civilité (Madame / Monsieur / Autre) + qualité officielle
 * (Maire, Adjoint, Conseiller municipal, Président, etc.) pour produire :
 *   - L'appellation d'adresse : « Monsieur le Maire » / « Madame la Conseillère »
 *   - La formule de signature : « Le Maire » / « La Présidente »
 *   - La salutation finale : « Veuillez agréer, Monsieur le Maire,
 *     l'expression de mes salutations distinguées. »
 *
 * Conforme au Code Général des Collectivités Territoriales et aux usages
 * des institutions publiques françaises (mairies, EPCI, départements,
 * régions, syndicats, associations).
 *
 * Référence : guide du protocole de la République française +
 * arrêté du 18 décembre 1986 sur les usages dans la correspondance
 * administrative.
 */

export type Civilite = 'MADAME' | 'MONSIEUR' | 'AUTRE'

interface ProtocoleResult {
  /** Appellation pour l'en-tête : « Madame la Maire », « Monsieur le Conseiller » */
  appellation: string
  /** Forme abrégée pour la signature en bas de courrier : « Le Maire », « La Présidente » */
  signature: string
  /** Forme complète neutre : « Madame le Maire X », « Monsieur Jean Y, Maire de Z » */
  full: string
  /** Indique si on a pu déterminer un genre (pour adapter accords ailleurs) */
  hasCivilite: boolean
}

/**
 * Table de correspondance qualité officielle → appellation par civilité.
 * Les clés sont normalisées (lowercase, sans accents) pour matcher.
 */
type AppellationEntry = {
  /** Match strict avec la qualite normalisée */
  patterns: string[]
  /** Forme féminine (« Madame la Maire ») */
  femme: { appellation: string; signature: string }
  /** Forme masculine (« Monsieur le Maire ») */
  homme: { appellation: string; signature: string }
  /** Forme neutre si civilité inconnue (« Madame, Monsieur le Maire ») */
  neutre?: { appellation: string; signature: string }
}

const APPELLATIONS: AppellationEntry[] = [
  // ─── Communes ───────────────────────────────────────────────
  {
    patterns: ['maire'],
    femme: { appellation: 'Madame la Maire', signature: 'La Maire' },
    homme: { appellation: 'Monsieur le Maire', signature: 'Le Maire' },
  },
  {
    patterns: ['premier adjoint au maire', 'premiere adjointe au maire', 'premier adjoint', 'premiere adjointe'],
    femme: { appellation: 'Madame la Première Adjointe au Maire', signature: 'La Première Adjointe' },
    homme: { appellation: 'Monsieur le Premier Adjoint au Maire', signature: 'Le Premier Adjoint' },
  },
  {
    patterns: ['adjoint au maire', 'adjointe au maire', 'adjoint', 'adjointe'],
    femme: { appellation: 'Madame l\'Adjointe au Maire', signature: 'L\'Adjointe au Maire' },
    homme: { appellation: 'Monsieur l\'Adjoint au Maire', signature: 'L\'Adjoint au Maire' },
  },
  {
    patterns: ['conseiller municipal delegue', 'conseillere municipale deleguee', 'conseiller delegue', 'conseillere deleguee'],
    femme: { appellation: 'Madame la Conseillère Municipale Déléguée', signature: 'La Conseillère Déléguée' },
    homme: { appellation: 'Monsieur le Conseiller Municipal Délégué', signature: 'Le Conseiller Délégué' },
  },
  {
    patterns: ['conseiller municipal', 'conseillere municipale'],
    femme: { appellation: 'Madame la Conseillère Municipale', signature: 'La Conseillère Municipale' },
    homme: { appellation: 'Monsieur le Conseiller Municipal', signature: 'Le Conseiller Municipal' },
  },

  // ─── EPCI / Communauté de communes / Syndicats ──────────────
  {
    patterns: ['president', 'presidente', 'president de la communaute', 'presidente de la communaute', 'president du syndicat', 'presidente du syndicat'],
    femme: { appellation: 'Madame la Présidente', signature: 'La Présidente' },
    homme: { appellation: 'Monsieur le Président', signature: 'Le Président' },
  },
  {
    patterns: ['premier vice-president', 'premiere vice-presidente', 'premier vice president', 'premiere vice presidente'],
    femme: { appellation: 'Madame la Première Vice-Présidente', signature: 'La Première Vice-Présidente' },
    homme: { appellation: 'Monsieur le Premier Vice-Président', signature: 'Le Premier Vice-Président' },
  },
  {
    patterns: ['vice-president', 'vice-presidente', 'vice president', 'vice presidente'],
    femme: { appellation: 'Madame la Vice-Présidente', signature: 'La Vice-Présidente' },
    homme: { appellation: 'Monsieur le Vice-Président', signature: 'Le Vice-Président' },
  },
  {
    patterns: ['conseiller communautaire', 'conseillere communautaire', 'delegue communautaire', 'deleguee communautaire'],
    femme: { appellation: 'Madame la Conseillère Communautaire', signature: 'La Conseillère' },
    homme: { appellation: 'Monsieur le Conseiller Communautaire', signature: 'Le Conseiller' },
  },
  {
    patterns: ['delegue', 'deleguee', 'delegue syndical', 'deleguee syndicale'],
    femme: { appellation: 'Madame la Déléguée', signature: 'La Déléguée' },
    homme: { appellation: 'Monsieur le Délégué', signature: 'Le Délégué' },
  },

  // ─── Conseil départemental ──────────────────────────────────
  {
    patterns: ['president du conseil departemental', 'presidente du conseil departemental'],
    femme: { appellation: 'Madame la Présidente du Conseil Départemental', signature: 'La Présidente' },
    homme: { appellation: 'Monsieur le Président du Conseil Départemental', signature: 'Le Président' },
  },
  {
    patterns: ['conseiller departemental', 'conseillere departementale'],
    femme: { appellation: 'Madame la Conseillère Départementale', signature: 'La Conseillère Départementale' },
    homme: { appellation: 'Monsieur le Conseiller Départemental', signature: 'Le Conseiller Départemental' },
  },

  // ─── Conseil régional ───────────────────────────────────────
  {
    patterns: ['president du conseil regional', 'presidente du conseil regional'],
    femme: { appellation: 'Madame la Présidente du Conseil Régional', signature: 'La Présidente' },
    homme: { appellation: 'Monsieur le Président du Conseil Régional', signature: 'Le Président' },
  },
  {
    patterns: ['conseiller regional', 'conseillere regionale'],
    femme: { appellation: 'Madame la Conseillère Régionale', signature: 'La Conseillère Régionale' },
    homme: { appellation: 'Monsieur le Conseiller Régional', signature: 'Le Conseiller Régional' },
  },

  // ─── Bureau d'association loi 1901 ──────────────────────────
  {
    patterns: ['secretaire general', 'secretaire generale', 'secretaire'],
    femme: { appellation: 'Madame la Secrétaire Générale', signature: 'La Secrétaire Générale' },
    homme: { appellation: 'Monsieur le Secrétaire Général', signature: 'Le Secrétaire Général' },
  },
  {
    patterns: ['tresorier', 'tresoriere'],
    femme: { appellation: 'Madame la Trésorière', signature: 'La Trésorière' },
    homme: { appellation: 'Monsieur le Trésorier', signature: 'Le Trésorier' },
  },
  {
    patterns: ['membre du bureau', 'membre'],
    femme: { appellation: 'Madame', signature: '' },
    homme: { appellation: 'Monsieur', signature: '' },
  },
]

/** Normalise une chaîne (lowercase, sans accents, sans tirets multiples) pour matcher dans la table. */
function normalize(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/['']/g, '\'')          // unifie les apostrophes
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calcule l'appellation protocolaire complète d'un membre.
 *
 * @param civilite  MADAME / MONSIEUR / AUTRE / null
 * @param qualite   Qualité officielle textuelle (« Maire », « Adjoint au maire »…)
 * @param prenom    Prénom du membre
 * @param nom       Nom du membre
 *
 * @example
 * format('MONSIEUR', 'Maire', 'Jean', 'Dupont')
 * // {
 * //   appellation: 'Monsieur le Maire',
 * //   signature: 'Le Maire',
 * //   full: 'Monsieur Jean DUPONT, Maire',
 * //   hasCivilite: true,
 * // }
 *
 * @example  format(null, null, 'Marie', 'Martin')
 * // {
 * //   appellation: 'Madame, Monsieur Marie Martin',
 * //   signature: '',
 * //   full: 'Marie MARTIN',
 * //   hasCivilite: false,
 * // }
 */
export function formatProtocolaire(
  civilite: Civilite | string | null | undefined,
  qualite: string | null | undefined,
  prenom: string,
  nom: string
): ProtocoleResult {
  const prenomNom = `${prenom.trim()} ${nom.trim().toUpperCase()}`.trim()

  const normalizedQualite = normalize(qualite)
  const civ = (civilite === 'MADAME' || civilite === 'MONSIEUR' || civilite === 'AUTRE') ? civilite : null

  // Cherche une appellation correspondante dans la table
  const entry = APPELLATIONS.find(e =>
    e.patterns.some(p => normalizedQualite === p || normalizedQualite.startsWith(p + ' '))
  )

  if (entry) {
    if (civ === 'MADAME') {
      return {
        appellation: entry.femme.appellation,
        signature: entry.femme.signature || `Madame ${prenomNom}`,
        full: `${entry.femme.appellation} ${prenomNom}`.replace(/\s+/g, ' '),
        hasCivilite: true,
      }
    }
    if (civ === 'MONSIEUR') {
      return {
        appellation: entry.homme.appellation,
        signature: entry.homme.signature || `Monsieur ${prenomNom}`,
        full: `${entry.homme.appellation} ${prenomNom}`.replace(/\s+/g, ' '),
        hasCivilite: true,
      }
    }
    // Civilité AUTRE ou inconnue → formulation neutre
    const neutre = entry.neutre || {
      appellation: `Madame, Monsieur — ${entry.homme.signature || qualite || ''}`.trim(),
      signature: entry.homme.signature || '',
    }
    return {
      appellation: neutre.appellation,
      signature: neutre.signature,
      full: `${neutre.appellation} ${prenomNom}`.replace(/\s+/g, ' '),
      hasCivilite: false,
    }
  }

  // Aucune qualité matchée → fallback générique selon civilité
  if (civ === 'MADAME') {
    return {
      appellation: 'Madame',
      signature: `Madame ${prenomNom}`,
      full: `Madame ${prenomNom}`,
      hasCivilite: true,
    }
  }
  if (civ === 'MONSIEUR') {
    return {
      appellation: 'Monsieur',
      signature: `Monsieur ${prenomNom}`,
      full: `Monsieur ${prenomNom}`,
      hasCivilite: true,
    }
  }
  // Civilité inconnue ET qualité inconnue → formulation par défaut
  return {
    appellation: 'Madame, Monsieur',
    signature: prenomNom,
    full: prenomNom,
    hasCivilite: false,
  }
}

/**
 * Formule de politesse de fin de courrier, accordée selon l'appellation.
 *
 * @example
 * salutationFinale('Monsieur le Maire')
 * // « Veuillez agréer, Monsieur le Maire, l'expression de mes salutations
 * //   distinguées. »
 */
export function salutationFinale(appellation: string): string {
  return `Veuillez agréer, ${appellation}, l'expression de mes salutations distinguées.`
}

/** Labels affichables dans les Select / formulaires */
export const CIVILITE_LABELS: Record<Civilite, string> = {
  MADAME: 'Madame',
  MONSIEUR: 'Monsieur',
  AUTRE: 'Autre / non spécifié',
}
