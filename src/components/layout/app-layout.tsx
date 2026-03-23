'use client'

import { useState } from 'react'
import { AppSidebar } from './app-sidebar'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import type { UserRole } from '@/lib/supabase/types'

interface AppLayoutProps {
  children: React.ReactNode
  userFullName: string
  userRole: UserRole
  userEmail: string
}

export function AppLayout({ children, userFullName, userRole, userEmail }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — hidden below lg */}
      <div className="hidden lg:block">
        <AppSidebar
          userFullName={userFullName}
          userRole={userRole}
          userEmail={userEmail}
        />
      </div>

      {/* Mobile sidebar — Sheet overlay */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-[280px] sm:max-w-[280px]">
          <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
          <AppSidebar
            userFullName={userFullName}
            userRole={userRole}
            userEmail={userEmail}
            mobile
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 lg:ml-[260px] transition-all duration-200">
        {/* Mobile header with hamburger */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background px-4 py-3 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
            title="Ouvrir le menu de navigation"
            className="h-9 w-9"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold text-foreground">Assemblées Délibérantes</span>
        </div>

        <div className="animate-in fade-in duration-300">
          {children}
        </div>
      </div>
    </div>
  )
}
