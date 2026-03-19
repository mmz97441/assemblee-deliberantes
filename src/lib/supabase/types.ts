// Types générés depuis Supabase — sera écrasé par `supabase gen types typescript`
// Placeholder en attendant les migrations

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type InstitutionType = 'commune' | 'syndicat' | 'cc' | 'departement' | 'asso'

export type UserRole = 'super_admin' | 'president' | 'gestionnaire' | 'secretaire_seance' | 'elu' | 'preparateur'

export type SeanceStatut = 'BROUILLON' | 'CONVOQUEE' | 'EN_COURS' | 'SUSPENDUE' | 'CLOTUREE' | 'ARCHIVEE'

export type SeanceMode = 'PRESENTIEL' | 'HYBRIDE' | 'VISIO'

export type PresenceStatut = 'PRESENT' | 'ABSENT' | 'EXCUSE' | 'PROCURATION'

export type ConvocationStatut =
  | 'NON_ENVOYE'
  | 'ENVOYE'
  | 'LU'
  | 'CONFIRME_PRESENT'
  | 'ABSENT_PROCURATION'
  | 'ERREUR_EMAIL'
  | 'ENVOYE_COURRIER'

export type VoteType = 'MAIN_LEVEE' | 'SECRET' | 'NOMINAL' | 'TELEVOTE'

export type VoteStatut = 'OUVERT' | 'CLOS' | 'ANNULE' | 'CONTESTE'

export type VoteResultat = 'ADOPTE' | 'REJETE' | 'NUL' | 'ADOPTE_UNANIMITE' | 'ADOPTE_VOIX_PREPONDERANTE'

export type PVStatut = 'BROUILLON' | 'EN_RELECTURE' | 'APPROUVE_EN_SEANCE' | 'SIGNE' | 'PUBLIE'

export type MemberStatut = 'ACTIF' | 'SUSPENDU' | 'FIN_DE_MANDAT' | 'DECEDE'

export type ODJPointType = 'DELIBERATION' | 'INFORMATION' | 'QUESTION_DIVERSE' | 'ELECTION' | 'APPROBATION_PV'

export type MajoriteRequise = 'SIMPLE' | 'ABSOLUE' | 'QUALIFIEE' | 'UNANIMITE'

export type LateArrivalMode = 'STRICT' | 'SOUPLE' | 'SUSPENDU'

export type QuorumType = 'MAJORITE_MEMBRES' | 'TIERS_MEMBRES' | 'DEUX_TIERS' | 'STATUTS'

// Placeholder Database type — sera remplacé par les types générés
export interface Database {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
