'use client'

import { AppSidebar } from './app-sidebar'
import type { UserRole } from '@/lib/supabase/types'

interface AppLayoutProps {
  children: React.ReactNode
  userFullName: string
  userRole: UserRole
  userEmail: string
}

export function AppLayout({ children, userFullName, userRole, userEmail }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        userFullName={userFullName}
        userRole={userRole}
        userEmail={userEmail}
      />
      {/* Main content - offset by sidebar */}
      <div className="flex-1 ml-[260px] transition-all duration-200">
        {children}
      </div>
    </div>
  )
}
