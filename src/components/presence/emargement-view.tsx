'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  CheckCircle2,
  Clock,
  Users,
  Search,
  UserCheck,
  ArrowLeft,
  RefreshCw,
  Loader2,
  PenLine,
  Shield,
  AlertTriangle,
} from 'lucide-react'
import { SignaturePad } from '@/components/presence/signature-pad'
import { markPresence } from '@/lib/actions/presences'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberInfo {
  id: string
  prenom: string
  nom: string
  email: string
  qualite_officielle: string | null
}

interface ConvocataireItem {
  id: string
  member_id: string
  member: MemberInfo | null
}

interface PresenceItem {
  id: string
  member_id: string
  statut: string | null
  heure_arrivee: string | null
  heure_depart: string | null
  signature_svg: string | null
  mode_authentification: string | null
}

interface InstanceConfig {
  id: string
  nom: string
  quorum_type: string | null
  quorum_fraction_numerateur: number | null
  quorum_fraction_denominateur: number | null
  composition_max: number | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SeanceData extends Record<string, any> {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  instance_id: string
  instance_config: InstanceConfig | null
  convocataires: ConvocataireItem[]
  presences: PresenceItem[]
}

interface EmargementViewProps {
  seance: SeanceData
  instanceMemberCount: number
}

// ─── Quorum calculation ───────────────────────────────────────────────────────

function calculateQuorumLocal(
  presents: number,
  totalMembers: number,
  config: InstanceConfig | null
) {
  const total = config?.composition_max || totalMembers
  const quorumType = config?.quorum_type || 'MAJORITE_MEMBRES'
  const numerateur = config?.quorum_fraction_numerateur || 1
  const denominateur = config?.quorum_fraction_denominateur || 2

  let quorumRequired: number
  let fractionLabel: string

  switch (quorumType) {
    case 'MAJORITE_MEMBRES':
      quorumRequired = Math.ceil(total / 2) + 1
      fractionLabel = 'Majorité des membres'
      break
    case 'TIERS_MEMBRES':
      quorumRequired = Math.ceil(total / 3)
      fractionLabel = 'Tiers des membres'
      break
    case 'DEUX_TIERS':
      quorumRequired = Math.ceil((total * 2) / 3)
      fractionLabel = 'Deux tiers des membres'
      break
    case 'STATUTS':
      quorumRequired = Math.ceil((total * numerateur) / denominateur)
      fractionLabel = `${numerateur}/${denominateur} des membres`
      break
    default:
      quorumRequired = Math.ceil(total / 2) + 1
      fractionLabel = 'Majorité des membres'
  }

  return {
    quorumRequired,
    fractionLabel,
    quorumReached: presents >= quorumRequired,
    totalMembers: total,
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmargementView({ seance, instanceMemberCount }: EmargementViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [signingMember, setSigningMember] = useState<MemberInfo | null>(null)

  // Build presence map: member_id -> presence
  const presenceMap = useMemo(() => {
    const map = new Map<string, PresenceItem>()
    for (const p of seance.presences) {
      map.set(p.member_id, p)
    }
    return map
  }, [seance.presences])

  // Members list with presence status
  const membersWithStatus = useMemo(() => {
    return seance.convocataires
      .filter(c => c.member)
      .map(c => ({
        member: c.member!,
        presence: presenceMap.get(c.member_id),
      }))
      .sort((a, b) => a.member.nom.localeCompare(b.member.nom))
  }, [seance.convocataires, presenceMap])

  // Filter by search
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return membersWithStatus
    const q = search.toLowerCase()
    return membersWithStatus.filter(m =>
      `${m.member.prenom} ${m.member.nom}`.toLowerCase().includes(q)
    )
  }, [membersWithStatus, search])

  // Stats
  const presents = membersWithStatus.filter(m => m.presence?.statut === 'PRESENT').length
  const excuses = membersWithStatus.filter(m => m.presence?.statut === 'EXCUSE').length
  const procurations = membersWithStatus.filter(m => m.presence?.statut === 'PROCURATION').length
  const total = membersWithStatus.length

  // Quorum (presents + procurations count)
  const quorum = calculateQuorumLocal(
    presents + procurations,
    instanceMemberCount,
    seance.instance_config
  )

  const quorumPercent = quorum.totalMembers > 0
    ? Math.min(100, Math.round(((presents + procurations) / quorum.quorumRequired) * 100))
    : 0

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleMemberTap(member: MemberInfo) {
    const existing = presenceMap.get(member.id)
    // Already present → don't re-sign
    if (existing?.statut === 'PRESENT') {
      toast.info(`${member.prenom} ${member.nom} est déjà enregistré(e) comme présent(e)`)
      return
    }
    setSigningMember(member)
  }

  function handleSignatureConfirm(signatureSvg: string) {
    if (!signingMember) return
    const member = signingMember
    setSigningMember(null)

    startTransition(async () => {
      const result = await markPresence(seance.id, member.id, signatureSvg, 'PRESENT')
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`${member.prenom} ${member.nom} — Présence enregistrée !`, {
          icon: '✅',
          duration: 3000,
        })
        router.refresh()
      }
    })
  }

  function handleRefresh() {
    router.refresh()
  }

  const isSessionActive = seance.statut === 'EN_COURS' || seance.statut === 'CONVOQUEE'

  // ─── Render: Signature mode ─────────────────────────────────────────────

  if (signingMember) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <SignaturePad
            memberName={`${signingMember.prenom} ${signingMember.nom}`}
            onConfirm={handleSignatureConfirm}
            onCancel={() => setSigningMember(null)}
            isPending={isPending}
            width={Math.min(450, typeof window !== 'undefined' ? window.innerWidth - 48 : 450)}
            height={220}
          />
        </div>
      </div>
    )
  }

  // ─── Render: Member list ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header — sticky */}
      <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/seances/${seance.id}`)}
                title="Retour à la séance"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold leading-tight">{seance.titre}</h1>
                <p className="text-sm text-muted-foreground">
                  {seance.instance_config?.nom} — Émargement
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                title="Rafraîchir la liste"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Badge className={`text-sm px-3 py-1 ${
                seance.statut === 'EN_COURS'
                  ? 'bg-emerald-100 text-emerald-700'
                  : seance.statut === 'CONVOQUEE'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
              }`}>
                {seance.statut === 'EN_COURS' ? 'En cours' :
                 seance.statut === 'CONVOQUEE' ? 'Convoquée' :
                 seance.statut || 'Brouillon'}
              </Badge>
            </div>
          </div>

          {/* ─── Quorum gauge ─── */}
          <div className={`rounded-xl p-3 ${
            quorum.quorumReached
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield className={`h-5 w-5 ${quorum.quorumReached ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span className="text-sm font-semibold">
                  Quorum : {presents + procurations} / {quorum.quorumRequired} requis
                </span>
                {quorum.quorumReached ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Atteint
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Manque {quorum.quorumRequired - (presents + procurations)}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {quorum.fractionLabel}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  quorum.quorumReached ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, quorumPercent)}%` }}
              />
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1 text-emerald-700">
                <UserCheck className="h-3.5 w-3.5" />
                {presents} présent{presents > 1 ? 's' : ''}
              </span>
              {excuses > 0 && (
                <span className="flex items-center gap-1 text-slate-500">
                  {excuses} excusé{excuses > 1 ? 's' : ''}
                </span>
              )}
              {procurations > 0 && (
                <span className="flex items-center gap-1 text-blue-600">
                  {procurations} procuration{procurations > 1 ? 's' : ''}
                </span>
              )}
              <span className="flex items-center gap-1 text-muted-foreground ml-auto">
                <Users className="h-3.5 w-3.5" />
                {total} convoqué{total > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un membre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
        </div>
      </header>

      {/* Member grid */}
      <main className="p-4">
        {!isSessionActive && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Séance pas encore ouverte</p>
              <p className="text-xs text-amber-600">
                L&apos;émargement est possible mais la séance n&apos;a pas encore démarré.
                Les présences seront enregistrées.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredMembers.map(({ member, presence }) => {
            const isPresent = presence?.statut === 'PRESENT'
            const isExcuse = presence?.statut === 'EXCUSE'
            const isProcuration = presence?.statut === 'PROCURATION'
            const hasSigned = !!presence?.signature_svg
            const arrivalTime = presence?.heure_arrivee
              ? new Date(presence.heure_arrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              : null

            return (
              <button
                key={member.id}
                onClick={() => handleMemberTap(member)}
                disabled={isPending}
                className={`
                  relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all
                  min-h-[130px] touch-manipulation
                  ${isPresent
                    ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                    : isExcuse
                      ? 'border-slate-200 bg-slate-50 opacity-60'
                      : isProcuration
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50 hover:shadow-md active:scale-95'
                  }
                `}
              >
                {/* Avatar */}
                <div className={`
                  flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold
                  ${isPresent
                    ? 'bg-emerald-200 text-emerald-800'
                    : isExcuse
                      ? 'bg-slate-200 text-slate-500'
                      : isProcuration
                        ? 'bg-blue-200 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                  }
                `}>
                  {member.prenom[0]}{member.nom[0]}
                </div>

                {/* Name */}
                <div className="text-center">
                  <p className="text-sm font-semibold leading-tight">
                    {member.prenom}
                  </p>
                  <p className="text-sm font-semibold leading-tight">
                    {member.nom}
                  </p>
                  {member.qualite_officielle && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                      {member.qualite_officielle}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                {isPresent && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                )}
                {isExcuse && (
                  <Badge className="bg-slate-200 text-slate-600 border-0 text-[10px] absolute top-2 right-2">
                    Excusé
                  </Badge>
                )}
                {isProcuration && (
                  <Badge className="bg-blue-200 text-blue-700 border-0 text-[10px] absolute top-2 right-2">
                    Procuration
                  </Badge>
                )}

                {/* Time + signature info */}
                {isPresent && arrivalTime && (
                  <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {arrivalTime}
                    {hasSigned && <PenLine className="h-2.5 w-2.5 ml-1" />}
                  </p>
                )}

                {/* Tap hint for unsigned */}
                {!isPresent && !isExcuse && !isProcuration && (
                  <p className="text-[10px] text-muted-foreground">
                    Appuyez pour signer
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {search ? 'Aucun membre ne correspond à la recherche' : 'Aucun convocataire'}
            </p>
          </div>
        )}

        {/* Pending overlay */}
        {isPending && (
          <div className="fixed inset-0 bg-white/60 flex items-center justify-center z-50">
            <div className="flex items-center gap-3 bg-white rounded-xl shadow-lg px-6 py-4">
              <Loader2 className="h-6 w-6 animate-spin text-institutional-blue" />
              <p className="text-lg font-medium">Enregistrement en cours...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
