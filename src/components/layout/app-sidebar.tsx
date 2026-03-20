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
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { label: 'Séances', href: ROUTES.SEANCES, icon: CalendarDays },
  { label: 'Membres', href: ROUTES.MEMBRES, icon: Users },
  { label: 'Délibérations', href: '/deliberations', icon: FileText, disabled: true },
  { label: 'Configuration', href: ROUTES.CONFIGURATION, icon: Settings, roles: ['super_admin'] },
]

interface AppSidebarProps {
  userFullName: string
  userRole: UserRole
  userEmail: string
}

export function AppSidebar({ userFullName, userRole }: AppSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(userRole)
  )

  const initials = userFullName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside
      className={`sidebar flex flex-col fixed left-0 top-0 z-40 h-screen ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
      style={{ transition: 'width 0.2s ease' }}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white font-bold text-sm">
          <Building2 className="h-5 w-5" />
        </div>
        {!collapsed && (
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
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
              {!collapsed && isDisabled && (
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-white/10 text-white/50 border-0">
                  Bientôt
                </Badge>
              )}
            </span>
          )

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  {isDisabled ? (
                    <div>{linkContent}</div>
                  ) : (
                    <Link href={item.href}>{linkContent}</Link>
                  )}
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>{item.label}{isDisabled ? ' (bientôt)' : ''}</p>
                </TooltipContent>
              </Tooltip>
            )
          }

          return isDisabled ? (
            <div key={item.href}>{linkContent}</div>
          ) : (
            <Link key={item.href} href={item.href}>{linkContent}</Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 py-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-link w-full justify-center"
          aria-label={collapsed ? 'Agrandir la barre latérale' : 'Réduire la barre latérale'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">Réduire</span>
            </>
          )}
        </button>
      </div>

      {/* User section */}
      <div className="border-t px-3 py-3" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white text-xs font-bold">
            {initials}
          </div>
          {!collapsed && (
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
                  collapsed ? 'justify-center px-0' : ''
                }`}
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>Déconnexion</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
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
