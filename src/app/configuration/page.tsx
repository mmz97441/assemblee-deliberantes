export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { InstitutionForm } from '@/components/configuration/institution-form'
import { InstancesList } from '@/components/configuration/instances-list'
import type { InstitutionConfigRow, InstanceConfigRow } from '@/lib/supabase/types'

export default async function ConfigurationPage() {
  // Auth check — en dehors du try/catch car redirect() lance une erreur speciale
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Fetch data — ici on peut try/catch car pas de redirect()
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <nav className="text-sm text-muted-foreground">
            <span>Tableau de bord</span>
            <span className="mx-2">/</span>
            <span className="text-foreground font-medium">Configuration</span>
          </nav>
          <h1 className="mt-2 text-2xl font-bold text-institutional-navy">
            Configuration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paramètres de l&apos;institution et des instances délibérantes
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Tabs defaultValue="identite" className="space-y-6">
          <TabsList>
            <TabsTrigger value="identite">Identité légale</TabsTrigger>
            <TabsTrigger value="instances">Instances</TabsTrigger>
          </TabsList>

          <Separator />

          <TabsContent value="identite" className="space-y-6">
            <InstitutionForm data={institutionConfig} />
          </TabsContent>

          <TabsContent value="instances" className="space-y-6">
            <InstancesList data={instanceConfigs} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
