export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { InstitutionWizard } from '@/components/configuration/institution-wizard'
import { InstancesList } from '@/components/configuration/instances-list'
import { Wand2, Settings2 } from 'lucide-react'
import type { InstitutionConfigRow, InstanceConfigRow } from '@/lib/supabase/types'

export default async function ConfigurationPage() {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Configuration is super_admin only
  const role = (userData.user.user_metadata?.role as string) || ''
  if (role !== 'super_admin') {
    redirect(ROUTES.DASHBOARD)
  }

  let institutionConfig: InstitutionConfigRow | null = null
  let instanceConfigs: InstanceConfigRow[] = []

  try {
    const { data: instData } = await supabase
      .from('institution_config')
      .select('*')
      .limit(1)
      .maybeSingle()

    institutionConfig = instData

    const { data: instancesData } = await supabase
      .from('instance_config')
      .select('*')
      .order('nom', { ascending: true })

    instanceConfigs = instancesData || []
  } catch (err) {
    console.error('Erreur chargement configuration:', err)
  }

  const isFirstSetup = !institutionConfig?.type_institution

  return (
    <AuthenticatedLayout>
      <PageHeader
        title={isFirstSetup ? 'Configuration initiale' : 'Configuration'}
        description={
          isFirstSetup
            ? 'Configurez votre institution en quelques étapes simples'
            : "Paramètres de l'institution et des instances délibérantes"
        }
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Configuration' },
        ]}
      />

      <main className="px-4 sm:px-8 py-6 page-enter">
        {isFirstSetup ? (
          <Suspense fallback={<WizardSkeleton />}>
            <InstitutionWizard data={institutionConfig} existingInstances={instanceConfigs} />
          </Suspense>
        ) : (
          <Tabs defaultValue="assistant" className="space-y-6">
            <TabsList className="h-11 p-1 bg-muted/60">
              <TabsTrigger value="assistant" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
                <Wand2 className="h-4 w-4" />
                <span>Assistant de configuration</span>
              </TabsTrigger>
              <TabsTrigger value="instances" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
                <Settings2 className="h-4 w-4" />
                <span>Gérer les instances</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assistant" className="space-y-6 mt-6">
              <Suspense fallback={<WizardSkeleton />}>
                <InstitutionWizard data={institutionConfig} existingInstances={instanceConfigs} />
              </Suspense>
            </TabsContent>

            <TabsContent value="instances" className="space-y-6 mt-6">
              <InstancesList data={instanceConfigs} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </AuthenticatedLayout>
  )
}

function WizardSkeleton() {
  return (
    <div className="max-w-3xl space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="h-4 w-48 bg-muted rounded" />
          <div className="h-8 w-12 bg-muted rounded" />
        </div>
        <div className="h-2 bg-muted rounded-full" />
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 h-16 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  )
}
