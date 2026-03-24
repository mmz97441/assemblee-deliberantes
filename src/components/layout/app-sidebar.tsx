'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants'
import { ROLE_LABELS } from '@/lib/auth/helpers'
import type { UserRole } from '@/lib/supabase/types'
import {
  LayoutDashboard,
  Settings,
  Users,
  CalendarDays,
  FileText,
  LogOut,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { logoutAction } from '@/lib/auth/actions'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles?: UserRole[]
  disabled?: boolean
  disabledLabel?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { label: 'Séances', href: ROUTES.SEANCES, icon: CalendarDays },
  { label: 'Membres', href: ROUTES.MEMBRES, icon: Users },
  { label: 'Délibérations', href: ROUTES.DELIBERATIONS, icon: FileText },
  { label: 'Configuration', href: ROUTES.CONFIGURATION, icon: Settings, roles: ['super_admin'] },
]

interface AppSidebarProps {
  userFullName: string
  userRole: UserRole
  userEmail: string
  /** When true, sidebar renders in mobile mode (no collapse toggle, full width) */
  mobile?: boolean
  /** Called when user navigates, so mobile sheet can close */
  onNavigate?: () => void
  /** Controlled collapsed state (desktop only) */
  collapsed?: boolean
  /** Callback when collapsed state changes (desktop only) */
  onCollapsedChange?: (collapsed: boolean) => void
}

export function AppSidebar({ userFullName, userRole, mobile, onNavigate, collapsed: controlledCollapsed, onCollapsedChange }: AppSidebarProps) {
  const pathname = usePathname()
  const [internalCollapsed, setInternalCollapsed] = useState(false)

  // Use controlled state if provided, otherwise fallback to internal
  const collapsed = controlledCollapsed ?? internalCollapsed
  const setCollapsed = (value: boolean) => {
    setInternalCollapsed(value)
    onCollapsedChange?.(value)
  }

  // In mobile mode, never collapse
  const isCollapsed = mobile ? false : collapsed

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(userRole)
  )

  const initials = userFullName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  function handleNavClick() {
    if (onNavigate) onNavigate()
  }

  return (
    <aside
      className={`sidebar flex flex-col ${
        mobile
          ? 'w-full h-full'
          : `fixed left-0 top-0 z-40 h-screen ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}`
      }`}
      style={mobile ? undefined : { transition: 'width 0.2s ease' }}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white font-bold text-sm">
          <Building2 className="h-5 w-5" />
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">Assemblées</p>
            <p className="text-xs opacity-60 truncate">Délibérantes</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const isDisabled = item.disabled

          const linkContent = (
            <span
              className={`sidebar-link ${isActive ? 'active' : ''} ${
                isDisabled ? 'opacity-40 pointer-events-none' : ''
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!isCollapsed && (
                <span className="truncate">{item.label}</span>
              )}
              {!isCollapsed && isDisabled && (
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-white/10 text-white/50 border-0">
                  Bientôt
                </Badge>
              )}
            </span>
          )

          // Always wrap in Tooltip for collapsed mode or disabled items
          if (isCollapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  {isDisabled ? (
                    <div title={item.disabledLabel || 'Bientôt disponible'}>{linkContent}</div>
                  ) : (
                    <Link href={item.href} onClick={handleNavClick}>{linkContent}</Link>
                  )}
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>{item.label}{isDisabled ? ' (bientôt disponible)' : ''}</p>
                </TooltipContent>
              </Tooltip>
            )
          }

          // Expanded mode
          if (isDisabled) {
            return (
              <Tooltip key={item.href} delayDuration={300}>
                <TooltipTrigger asChild>
                  <div title={item.disabledLabel || 'Bientôt disponible'}>{linkContent}</div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>{item.disabledLabel || 'Bientôt disponible'}</p>
                </TooltipContent>
              </Tooltip>
            )
          }

          return (
            <Link key={item.href} href={item.href} title={item.label} onClick={handleNavClick}>
              {linkContent}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle — desktop only */}
      {!mobile && (
        <div className="px-3 py-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-link w-full justify-center"
            aria-label={isCollapsed ? 'Agrandir la barre latérale' : 'Réduire la barre latérale'}
            title={isCollapsed ? 'Agrandir la barre latérale' : 'Réduire la barre latérale'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs">Réduire</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* User section */}
      <div className="border-t px-3 py-3" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white text-xs font-bold">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userFullName}</p>
              <p className="text-xs opacity-50 truncate">{ROLE_LABELS[userRole]}</p>
            </div>
          )}
        </div>

        <form action={logoutAction} className="mt-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="submit"
                className={`sidebar-link w-full text-red-300 hover:text-red-200 hover:bg-red-500/15 ${
                  isCollapsed ? 'justify-center px-0' : ''
                }`}
                title="Déconnexion"
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                {!isCollapsed && <span>Déconnexion</span>}
              </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" sideOffset={8}>
                <p>Déconnexion</p>
              </TooltipContent>
            )}
          </Tooltip>
        </form>
      </div>
    </aside>
  )
}
