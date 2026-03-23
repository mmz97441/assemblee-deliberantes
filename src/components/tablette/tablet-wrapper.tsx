'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TabletteElu } from '@/components/seance/tablette-elu'
import { TabletAuthScreen } from '@/components/tablette/tablet-auth-screen'

// ─── Types ───────────────────────────────────────────────────────────────────

import type { ODJPointRow } from '@/lib/supabase/types'

interface VoteInfo {
  id: string
  odj_point_id: string
  type_vote: string | null
  statut: string | null
  total_votants: number | null
  question: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SeanceData extends Record<string, any> {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  lieu: string | null
  mode: string | null
  heure_ouverture: string | null
  instance_config: { id: string; nom: string; type_legal: string; voix_preponderante: boolean | null } | null
  odj_points: ODJPointRow[]
  president_effectif: { id: string; prenom: string; nom: string } | null
  secretaire_seance: { id: string; prenom: string; nom: string } | null
  votes?: VoteInfo[]
}

interface MemberInfo {
  id: string
  prenom: string
  nom: string
  email: string
  qualite_officielle: string | null
}

interface TabletWrapperProps {
  seance: SeanceData
  currentMember: MemberInfo | null
  isConvoque: boolean
  presenceData: { statut: string | null; heure_arrivee: string | null } | null
  votesParticipation: { vote_id: string; member_id: string }[]
  mandants: { id: string; prenom: string; nom: string }[]
  hasDeviceSession: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TabletWrapper({
  seance,
  currentMember,
  isConvoque,
  presenceData,
  votesParticipation,
  mandants,
  hasDeviceSession,
}: TabletWrapperProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  // Check localStorage for persisted session on mount
  useEffect(() => {
    const storageKey = `device_session_${seance.id}`
    try {
      const savedMemberId = localStorage.getItem(storageKey)
      if (savedMemberId && currentMember && savedMemberId === currentMember.id) {
        setIsAuthenticated(true)
      } else if (hasDeviceSession) {
        setIsAuthenticated(true)
      }
    } catch {
      // localStorage not available; fall back to server check
      if (hasDeviceSession) {
        setIsAuthenticated(true)
      }
    }
    setIsChecking(false)
  }, [seance.id, currentMember, hasDeviceSession])

  const handleAuthenticated = useCallback((memberId: string) => {
    try {
      localStorage.setItem(`device_session_${seance.id}`, memberId)
    } catch { /* ignore */ }
    setIsAuthenticated(true)
    // Refresh to get full data with the authenticated member context
    router.refresh()
  }, [seance.id, router])

  // Show loading while checking localStorage
  if (isChecking) {
    return null
  }

  // If not authenticated, show auth screen
  if (!isAuthenticated) {
    return (
      <TabletAuthScreen
        seanceId={seance.id}
        seanceTitre={seance.titre}
        onAuthenticated={handleAuthenticated}
      />
    )
  }

  // If authenticated, show the tablet view
  return (
    <TabletteElu
      seance={seance}
      currentMember={currentMember}
      isConvoque={isConvoque}
      presenceData={presenceData}
      votesParticipation={votesParticipation}
      mandants={mandants}
    />
  )
}
