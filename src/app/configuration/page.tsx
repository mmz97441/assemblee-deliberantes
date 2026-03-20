export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { InstitutionWizard } from '@/components/configuration/institution-wizard'
import { InstancesList } from '@/components/configuration/instances-list'
import { Building2, Landmark } from 'lucide-react'
import type { InstitutionConfigRow, InstanceConfigRow } from '@/lib/supabase/types'

export default async function ConfigurationPage() {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
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

  return (
    <AuthenticatedLayout>
      <PageHeader
        title="Configuration"
        description="Paramètres de l'institution et des instances délibérantes"
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Configuration' },
        ]}
      />

      <main className="px-8 py-6 page-enter">
        <Tabs defaultValue="identite" className="space-y-6">
          <TabsList className="h-11 p-1 bg-muted/60">
            <TabsTrigger value="identite" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
              <Building2 className="h-4 w-4" />
              <span>Identité légale</span>
            </TabsTrigger>
            <TabsTrigger value="instances" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
              <Landmark className="h-4 w-4" />
              <span>Instances</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="identite" className="space-y-6 mt-6">
            <InstitutionWizard data={institutionConfig} />
          </TabsContent>

          <TabsContent value="instances" className="space-y-6 mt-6">
            <InstancesList data={instanceConfigs} />
          </TabsContent>
        </Tabs>
      </main>
    </AuthenticatedLayout>
  )
}
