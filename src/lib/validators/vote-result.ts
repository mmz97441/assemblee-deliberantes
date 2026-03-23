// ─── Pure functions for vote result calculation and PV formula generation ────
// These are NOT server actions — they are pure functions used by the server actions
// and can also be used client-side for preview/validation.

export type VoteResultat =
  | 'ADOPTE'
  | 'REJETE'
  | 'NUL'
  | 'ADOPTE_UNANIMITE'
  | 'ADOPTE_VOIX_PREPONDERANTE'

export type MajoriteRequise = 'SIMPLE' | 'ABSOLUE' | 'QUALIFIEE' | 'UNANIMITE'

/**
 * Determines the vote result based on counts and majority rules.
 */
export function determineVoteResult(
  pour: number,
  contre: number,
  abstention: number,
  totalVotants: number,
  majoriteRequise: MajoriteRequise,
  voixPreponderante: boolean
): VoteResultat {
  // Unanimité : aucun contre, aucune abstention
  if (contre === 0 && abstention === 0 && totalVotants > 0) {
    return 'ADOPTE_UNANIMITE'
  }

  // Tout le monde s'abstient → vote nul
  if (abstention === totalVotants) {
    return 'NUL'
  }

  // Calcul du seuil selon le type de majorité
  let threshold: number

  switch (majoriteRequise) {
    case 'SIMPLE': {
      // Majorité simple = basée sur les suffrages exprimés (pour + contre)
      const suffragesExprimes = pour + contre
      threshold = Math.floor(suffragesExprimes / 2) + 1
      break
    }
    case 'ABSOLUE': {
      // Majorité absolue = basée sur les votants (y compris abstentions)
      threshold = Math.floor(totalVotants / 2) + 1
      break
    }
    case 'QUALIFIEE': {
      // Majorité qualifiée = 2/3 des votants
      threshold = Math.ceil((totalVotants * 2) / 3)
      break
    }
    case 'UNANIMITE': {
      // Unanimité requise = tous les votants
      threshold = totalVotants
      break
    }
    default:
      threshold = Math.floor((pour + contre) / 2) + 1
  }

  // Adopté si pour >= seuil
  if (pour >= threshold) {
    return 'ADOPTE'
  }

  // Égalité : voix prépondérante du président
  if (pour === contre && voixPreponderante) {
    return 'ADOPTE_VOIX_PREPONDERANTE'
  }

  return 'REJETE'
}

/**
 * Generates the official PV formula for the vote result.
 * 7 cases as defined in the CDC section 7.2.
 */
export function generateFormulePV(params: {
  pour: number
  contre: number
  abstention: number
  totalVotants: number
  resultat: VoteResultat
  nomsContre: string[]
  nomsAbstention: string[]
  titrePoint: string
  recuses?: string[]
}): string {
  const { pour, contre, abstention, totalVotants, resultat, nomsContre, nomsAbstention, titrePoint, recuses = [] } = params

  const titre = titrePoint || 'la délibération'
  const contreStr = nomsContre.length > 0
    ? `(${nomsContre.join(', ')})`
    : ''
  const abstStr = nomsAbstention.length > 0
    ? `(${nomsAbstention.join(', ')})`
    : ''

  // Prepend recusation text if applicable (CGCT L2131-11)
  const recusationPrefix = recuses.length > 0
    ? recuses.map(nom =>
        `${nom}, ayant déclaré un intérêt personnel dans ce dossier, s'est retiré(e) lors du débat et du vote.`
      ).join(' ') + '\n\n'
    : ''

  let formula: string

  switch (resultat) {
    case 'ADOPTE_UNANIMITE':
      formula = `Après en avoir délibéré, ADOPTE à l'unanimité des ${totalVotants} votant${totalVotants > 1 ? 's' : ''} la délibération relative à : ${titre}.`
      break

    case 'ADOPTE':
    case 'ADOPTE_VOIX_PREPONDERANTE': {
      if (resultat === 'ADOPTE_VOIX_PREPONDERANTE') {
        formula = `Les voix étant partagées (${pour} voix pour, ${contre} voix contre ${contreStr}), la voix du Président étant prépondérante, ADOPTE la délibération relative à : ${titre}.`
      } else if (contre === 0 && abstention > 0) {
        formula = `Après en avoir délibéré, ADOPTE à l'unanimité des suffrages exprimés (${pour} voix pour) la délibération relative à : ${titre}, ${abstention} membre${abstention > 1 ? 's' : ''} s'étant abstenu${abstention > 1 ? 's' : ''} ${abstStr}.`
      } else if (contre > 0 && abstention === 0) {
        formula = `Après en avoir délibéré, par ${pour} voix pour et ${contre} voix contre ${contreStr}, ADOPTE la délibération relative à : ${titre}.`
      } else {
        formula = `Après en avoir délibéré, par ${pour} voix pour, ${contre} voix contre ${contreStr} et ${abstention} abstention${abstention > 1 ? 's' : ''} ${abstStr}, ADOPTE la délibération relative à : ${titre}.`
      }
      break
    }

    case 'REJETE':
      formula = `Après en avoir délibéré, par ${contre} voix contre ${contreStr} et ${pour} voix pour, REJETTE la délibération relative à : ${titre}.`
      break

    case 'NUL':
      formula = `Constate que le vote est nul, l'ensemble des ${totalVotants} membre${totalVotants > 1 ? 's' : ''} présent${totalVotants > 1 ? 's' : ''} s'étant abstenu${totalVotants > 1 ? 's' : ''}.`
      break

    default:
      formula = `Vote clos. Pour : ${pour}, Contre : ${contre}, Abstentions : ${abstention}.`
  }

  return recusationPrefix + formula
}
