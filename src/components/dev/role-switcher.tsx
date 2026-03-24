'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Eye, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { setRoleOverride } from '@/lib/actions/dev'
import type { UserRole } from '@/lib/supabase/types'

interface RoleSwitcherProps {
  /** The real role of the authenticated user */
  realRole: UserRole
}

const SWITCHABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super-administrateur' },
  { value: 'gestionnaire', label: 'Gestionnaire' },
  { value: 'president', label: 'President(e)' },
  { value: 'secretaire_seance', label: 'Secretaire de seance' },
  { value: 'elu', label: 'Elu(e) / Membre votant' },
  { value: 'preparateur', label: 'Preparateur(trice)' },
]

export function RoleSwitcher({ realRole }: RoleSwitcherProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [currentOverride, setCurrentOverride] = useState<string | null>(null)

  // Only render for super_admin
  if (realRole !== 'super_admin') return null

  // Read current override from cookie on mount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const cookies = document.cookie.split(';').reduce<Record<string, string>>((acc, c) => {
      const [key, val] = c.trim().split('=')
      if (key && val) acc[key] = decodeURIComponent(val)
      return acc
    }, {})
    setCurrentOverride(cookies['dev_role_override'] || null)
  }, [])

  const handleSelect = (role: string) => {
    startTransition(async () => {
      if (role === 'super_admin') {
        await setRoleOverride(null)
        setCurrentOverride(null)
      } else {
        await setRoleOverride(role)
        setCurrentOverride(role)
      }
      setOpen(false)
      router.refresh()
    })
  }

  const handleReset = () => {
    startTransition(async () => {
      await setRoleOverride(null)
      setCurrentOverride(null)
      setOpen(false)
      router.refresh()
    })
  }

  const activeLabel = currentOverride
    ? SWITCHABLE_ROLES.find(r => r.value === currentOverride)?.label || currentOverride
    : null

  return (
    <>
      {/* Top banner when override is active */}
      {currentOverride && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-purple-600 text-white text-center py-1.5 text-xs font-medium shadow-md">
          <div className="flex items-center justify-center gap-2">
            <Eye className="h-3.5 w-3.5" />
            <span>
              Mode test : vous voyez l&apos;app en tant que <strong>{activeLabel}</strong>
            </span>
            <button
              onClick={handleReset}
              disabled={isPending}
              className="ml-2 inline-flex items-center gap-1 underline hover:no-underline disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              Reinitialiser
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <div className="fixed bottom-4 left-4 z-50">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`
                shadow-lg border-2 gap-2 h-11 px-3 text-xs font-medium
                ${currentOverride
                  ? 'border-purple-500 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900'
                  : 'border-purple-300 bg-white text-purple-600 hover:bg-purple-50 dark:bg-gray-900 dark:text-purple-400 dark:hover:bg-gray-800'
                }
              `}
              title="Tester un role (super_admin uniquement)"
            >
              {currentOverride ? (
                <Eye className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              {currentOverride ? `Vue : ${activeLabel}` : 'Tester un role'}
            </Button>
          </PopoverTrigger>

          <PopoverContent
            side="top"
            align="start"
            className="w-64 p-2"
          >
            <div className="flex items-center justify-between mb-2 px-2 pt-1">
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
                Tester un role
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setOpen(false)}
                title="Fermer"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-0.5">
              {SWITCHABLE_ROLES.map((r) => {
                const isActive =
                  (r.value === 'super_admin' && !currentOverride) ||
                  r.value === currentOverride
                return (
                  <button
                    key={r.value}
                    onClick={() => handleSelect(r.value)}
                    disabled={isPending}
                    className={`
                      w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors
                      min-h-[44px] flex items-center justify-between
                      disabled:opacity-50
                      ${isActive
                        ? 'bg-purple-100 text-purple-800 font-medium dark:bg-purple-900 dark:text-purple-200'
                        : 'hover:bg-muted text-foreground'
                      }
                    `}
                  >
                    <span>{r.label}</span>
                    {isActive && (
                      <span className="text-purple-500 text-xs font-bold">
                        {r.value === 'super_admin' ? 'reel' : 'actif'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {currentOverride && (
              <div className="mt-2 pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-purple-600 hover:text-purple-800 hover:bg-purple-50 gap-2"
                  onClick={handleReset}
                  disabled={isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reinitialiser (revenir a super_admin)
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}
