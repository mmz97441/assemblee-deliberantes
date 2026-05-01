/**
 * Listes de valeurs prédéfinies pour les champs de qualité et fonction des
 * membres. Centralisées ici pour éviter les fautes de frappe et garantir
 * une saisie cohérente — important pour le contrôle préfectoral et le PV.
 *
 * Si une valeur manque pour un cas particulier, l'ajouter ici plutôt que
 * de revenir à la saisie libre.
 */

// ─── Qualités officielles ────────────────────────────────────────────────────
// Couvre les institutions publiques françaises (commune, EPCI, département)
// et les associations loi 1901.

export const QUALITES_OFFICIELLES = [
  // Communes
  'Maire',
  'Premier adjoint au maire',
  'Adjoint au maire',
  'Adjoint délégué',
  'Conseiller municipal délégué',
  'Conseiller municipal',
  'Conseiller municipal d\'opposition',

  // EPCI / syndicats / communautés
  'Président',
  'Vice-président',
  'Conseiller communautaire',
  'Délégué titulaire',
  'Délégué suppléant',

  // Conseil départemental
  'Président du conseil départemental',
  'Vice-président du conseil départemental',
  'Conseiller départemental',

  // Bureaux d'association
  'Secrétaire général',
  'Secrétaire',
  'Secrétaire adjoint',
  'Trésorier',
  'Trésorier adjoint',
  'Membre du bureau',
  'Membre actif',
  'Membre d\'honneur',
  'Censeur',
] as const

export type QualiteOfficielle = (typeof QUALITES_OFFICIELLES)[number]

// ─── Fonctions dans une instance (rôle pratique en séance) ──────────────────

export const FONCTIONS_INSTANCE = [
  'Membre',
  'Président',
  'Vice-président',
  'Secrétaire',
  'Secrétaire adjoint',
  'Rapporteur',
  'Rapporteur général',
  'Trésorier',
  'Membre suppléant',
  'Invité permanent',
] as const

export type FonctionInstance = (typeof FONCTIONS_INSTANCE)[number]
