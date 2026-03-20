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
import { Plus, Pencil, ToggleLeft, ToggleRight, Landmark } from 'lucide-react'
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
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter une instance
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-institutional-blue" />
                {editingInstance ? "Modifier l'instance" : 'Nouvelle instance'}
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

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed">
          <Landmark className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium mb-1">Aucune instance</p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            Commencez par créer votre première instance délibérante
          </p>
          <Button onClick={handleCreate} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Créer une instance
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium">Nom</TableHead>
                <TableHead className="font-medium">Type légal</TableHead>
                <TableHead className="text-center font-medium">Composition max.</TableHead>
                <TableHead className="text-center font-medium">Délai convoc.</TableHead>
                <TableHead className="font-medium">Quorum</TableHead>
                <TableHead className="text-center font-medium">Statut</TableHead>
                <TableHead className="text-right font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((instance) => (
                <TableRow key={instance.id} className={instance.actif === false ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{instance.nom}</TableCell>
                  <TableCell className="text-muted-foreground">{instance.type_legal}</TableCell>
                  <TableCell className="text-center tabular-nums">
                    {instance.composition_max ?? '—'}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {instance.delai_convocation_jours ?? 5} j
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {QUORUM_TYPE_LABELS[instance.quorum_type || 'MAJORITE_MEMBRES'] || instance.quorum_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {instance.actif !== false ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-normal">
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal">Inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => handleEdit(instance)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                        disabled={isPending}
                        onClick={() => handleToggle(instance.id, instance.actif !== false)}
                      >
                        {instance.actif !== false ? (
                          <>
                            <ToggleRight className="h-3.5 w-3.5" />
                            Désactiver
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-3.5 w-3.5" />
                            Activer
                          </>
                        )}
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
