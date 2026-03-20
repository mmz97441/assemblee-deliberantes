// Re-export depuis les types generes par Supabase
// Tous les imports existants (import { UserRole } from '@/lib/supabase/types')
// continuent de fonctionner sans modification.
//
// Pour regenerer: npx supabase gen types typescript --project-id rvcyxgtqxqzmqecerjvy

export {
  type Database,
  type Json,
  type UserRole,
  type InstitutionType,
  type SeanceStatut,
  type SeanceMode,
  type PresenceStatut,
  type ConvocationStatut,
  type VoteType,
  type VoteStatut,
  type VoteResultat,
  type PVStatut,
  type MemberStatut,
  type ODJPointType,
  type MajoriteRequise,
  type LateArrivalMode,
  type QuorumType,
  type MemberRow,
  type SeanceRow,
  type VoteRow,
  type ODJPointRow,
  type PresenceRow,
  type ConvocataireRow,
  type PVRow,
  type DeliberationRow,
  type InstitutionConfigRow,
  type InstanceConfigRow,
} from './types.generated'
