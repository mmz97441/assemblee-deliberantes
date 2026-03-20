'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toggleInstanceActive } from '@/lib/actions/configuration'
import { InstanceForm } from './instance-form'
import type { InstanceConfigRow } from '@/lib/supabase/types'

const QUORUM_TYPE_LABELS: Record<string, string> = {
  MAJORITE_MEMBRES: 'Majorité des membres',
  TIERS_MEMBRES: 'Tiers des membres',
  DEUX_TIERS: 'Deux tiers',
  STATUTS: 'Selon les statuts',
}

interface InstancesListProps {
  data: InstanceConfigRow[]
}

export function InstancesList({ data }: InstancesListProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingInstance, setEditingInstance] = useState<InstanceConfigRow | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleEdit(instance: InstanceConfigRow) {
    setEditingInstance(instance)
    setSheetOpen(true)
  }

  function handleCreate() {
    setEditingInstance(null)
    setSheetOpen(true)
  }

  function handleFormSuccess() {
    setSheetOpen(false)
    setEditingInstance(null)
  }

  function handleToggle(id: string, currentActif: boolean) {
    startTransition(async () => {
      const result = await toggleInstanceActive(id, !currentActif)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(currentActif ? 'Instance désactivée' : 'Instance activée')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.length === 0
            ? 'Aucune instance configurée. Créez votre première instance délibérante.'
            : `${data.length} instance${data.length > 1 ? 's' : ''} configurée${data.length > 1 ? 's' : ''}`}
        </p>
        <Button onClick={handleCreate}>Ajouter une instance</Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>
                {editingInstance ? 'Modifier l\'instance' : 'Nouvelle instance'}
              </SheetTitle>
              <SheetDescription>
                {editingInstance
                  ? 'Modifiez les paramètres de cette instance délibérante.'
                  : 'Configurez une nouvelle instance délibérante (conseil municipal, bureau, commission...).'}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <InstanceForm data={editingInstance} onSuccess={handleFormSuccess} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {data.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type légal</TableHead>
                <TableHead className="text-center">Composition max.</TableHead>
                <TableHead className="text-center">Délai convoc.</TableHead>
                <TableHead>Quorum</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((instance) => (
                <TableRow key={instance.id} className={instance.actif === false ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{instance.nom}</TableCell>
                  <TableCell>{instance.type_legal}</TableCell>
                  <TableCell className="text-center">
                    {instance.composition_max ?? '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    {instance.delai_convocation_jours ?? 5} j
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {QUORUM_TYPE_LABELS[instance.quorum_type || 'MAJORITE_MEMBRES'] || instance.quorum_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {instance.actif !== false ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(instance)}
                      >
                        Modifier
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggle(instance.id, instance.actif !== false)}
                      >
                        {instance.actif !== false ? 'Désactiver' : 'Activer'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
