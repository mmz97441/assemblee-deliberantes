'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { searchAuditLog, redactAuditEntry, type AuditEntry, type AuditSearchResult } from '@/lib/actions/audit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Search,
  Filter,
  RotateCcw,
  Eye,
  Lock,
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Plus,
  Pencil,
  Trash2,
  Download,
} from 'lucide-react'

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  INSERT: { label: 'Création', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Plus },
  UPDATE: { label: 'Modification', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Pencil },
  DELETE: { label: 'Suppression', color: 'bg-red-100 text-red-700 border-red-200', icon: Trash2 },
}

interface MemberOption {
  id: string
  label: string
}

interface HistoriqueClientProps {
  initial: AuditSearchResult | null
  availableTables: string[]
  allMembers: MemberOption[]
  isSuperAdmin: boolean
}

export function HistoriqueClient({ initial, availableTables, allMembers, isSuperAdmin }: HistoriqueClientProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<AuditSearchResult | null>(initial)

  const [search, setSearch] = useState('')
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [memberFilter, setMemberFilter] = useState<string | null>(null)
  const [memberSelectOpen, setMemberSelectOpen] = useState(false)
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null)
  const [redactDialog, setRedactDialog] = useState<AuditEntry | null>(null)
  const [redactMotif, setRedactMotif] = useState('')

  function applyFilters(page = 1) {
    startTransition(async () => {
      const r = await searchAuditLog({
        search: search.trim() || null,
        table_name: tableFilter === 'all' ? null : tableFilter,
        action: actionFilter === 'all' ? null : actionFilter,
        user_member_id: memberFilter,
        from_date: fromDate || null,
        to_date: toDate || null,
        page,
        page_size: 50,
      })
      if ('error' in r) {
        toast.error(r.error)
      } else {
        setResult(r)
      }
    })
  }

  function resetFilters() {
    setSearch('')
    setTableFilter('all')
    setActionFilter('all')
    setMemberFilter(null)
    setFromDate('')
    setToDate('')
    startTransition(async () => {
      const r = await searchAuditLog({ page: 1, page_size: 50 })
      if (!('error' in r)) setResult(r)
    })
  }

  const memberFilterLabel = memberFilter
    ? allMembers.find(m => m.id === memberFilter)?.label || 'Membre'
    : null

  function handleRedact() {
    if (!redactDialog) return
    startTransition(async () => {
      const r = await redactAuditEntry(redactDialog.id, redactMotif)
      if ('error' in r) {
        toast.error(r.error)
      } else {
        toast.success('Entrée anonymisée — la trace est conservée dans audit_log_redactions')
        setRedactDialog(null)
        setRedactMotif('')
        applyFilters(result?.page || 1)
      }
    })
  }

  function exportCSV() {
    if (!result?.data || result.data.length === 0) return
    const header = 'Date,Action,Table,Utilisateur,IP,Record_ID\n'
    const rows = result.data.map(e => [
      new Date(e.created_at).toISOString(),
      e.action,
      e.table_name,
      e.user_label || (e.user_id || '—'),
      e.ip || '—',
      e.record_id || '—',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `historique-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = result ? Math.ceil(result.total / result.page_size) : 0

  return (
    <div className="space-y-5">
      {/* Bandeau info */}
      <div className="rounded-lg border bg-blue-50/50 border-blue-100 p-3 text-sm text-blue-900 flex items-start gap-2">
        <Lock className="h-4 w-4 mt-0.5 shrink-0 text-blue-700" />
        <div>
          <strong>Journal append-only.</strong> Chaque action sur les données est enregistrée
          automatiquement avec horodatage, IP et user-agent. Aucune entrée ne peut être
          modifiée ni supprimée — seul le super-administrateur peut anonymiser une entrée
          (RGPD), avec motif obligatoire et trace immuable de cette anonymisation.
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtres
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Recherche libre */}
          <div className="space-y-1.5">
            <Label htmlFor="search">Recherche libre</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="ID, valeur, contenu…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFilters(1)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Combobox utilisateur */}
          <div className="space-y-1.5">
            <Label>Utilisateur ayant modifié</Label>
            <Popover open={memberSelectOpen} onOpenChange={setMemberSelectOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {memberFilterLabel || 'Tous les utilisateurs'}
                  <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Rechercher un membre…" />
                  <CommandList>
                    <CommandEmpty>Aucun membre trouvé</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => { setMemberFilter(null); setMemberSelectOpen(false) }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${!memberFilter ? 'opacity-100' : 'opacity-0'}`} />
                        Tous les utilisateurs
                      </CommandItem>
                      {allMembers.map(m => (
                        <CommandItem
                          key={m.id}
                          value={m.label}
                          onSelect={() => { setMemberFilter(m.id); setMemberSelectOpen(false) }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${memberFilter === m.id ? 'opacity-100' : 'opacity-0'}`} />
                          {m.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Type d'action */}
          <div className="space-y-1.5">
            <Label htmlFor="action-filter">Type de modification</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger id="action-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="INSERT">Création</SelectItem>
                <SelectItem value="UPDATE">Modification</SelectItem>
                <SelectItem value="DELETE">Suppression</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table affectée */}
          <div className="space-y-1.5">
            <Label htmlFor="table-filter">Table affectée</Label>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger id="table-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les tables</SelectItem>
                {availableTables.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date from */}
          <div className="space-y-1.5">
            <Label htmlFor="from-date">Du</Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>

          {/* Date to */}
          <div className="space-y-1.5">
            <Label htmlFor="to-date">au</Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => applyFilters(1)} disabled={isPending}>
            <Search className="h-4 w-4 mr-2" />
            Appliquer
          </Button>
          <Button variant="outline" onClick={resetFilters} disabled={isPending}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={!result?.data?.length}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Résultats */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {!result || result.data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {isPending ? 'Chargement…' : 'Aucune entrée trouvée pour ces filtres.'}
          </div>
        ) : (
          <>
            <div className="px-4 py-2 border-b bg-muted/30 text-xs text-muted-foreground">
              {result.total} entrée{result.total > 1 ? 's' : ''} · Page {result.page}/{Math.max(1, totalPages)}
            </div>

            <div className="divide-y">
              {result.data.map(entry => {
                const cfg = ACTION_CONFIG[entry.action] || ACTION_CONFIG.UPDATE
                const Icon = cfg.icon
                return (
                  <div key={entry.id} className="p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Badge variant="outline" className={`${cfg.color} text-[11px] gap-1 shrink-0`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            <span className="text-muted-foreground">Table :</span> {entry.table_name}
                            {entry.record_id && (
                              <span className="text-muted-foreground ml-2 font-mono text-[11px]">
                                #{entry.record_id.slice(0, 8)}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center flex-wrap gap-x-3">
                            <span>Par <strong className="text-foreground">{entry.user_label || (entry.user_id ? 'Utilisateur supprimé' : 'Système')}</strong></span>
                            <span>·</span>
                            <span>{new Date(entry.created_at).toLocaleString('fr-FR')}</span>
                            {entry.ip && <><span>·</span><span className="font-mono text-[10px]">{entry.ip}</span></>}
                            {entry.is_redacted && (
                              <>
                                <span>·</span>
                                <Badge variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-700 bg-amber-50">
                                  <AlertTriangle className="h-3 w-3" /> Anonymisée RGPD
                                </Badge>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailEntry(entry)} title="Voir le détail">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isSuperAdmin && !entry.is_redacted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-700 hover:bg-amber-50"
                            onClick={() => { setRedactDialog(entry); setRedactMotif('') }}
                            title="Anonymiser cette entrée (RGPD)"
                          >
                            <Lock className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t p-3 text-sm">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page <= 1 || isPending}
                  onClick={() => applyFilters(result.page - 1)}
                >
                  Précédent
                </Button>
                <span className="text-muted-foreground">
                  Page {result.page} sur {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page >= totalPages || isPending}
                  onClick={() => applyFilters(result.page + 1)}
                >
                  Suivant
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal détail */}
      <Dialog open={!!detailEntry} onOpenChange={(o) => !o && setDetailEntry(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Détail de l&rsquo;action</DialogTitle>
            <DialogDescription>
              {detailEntry && (
                <>
                  <strong>{ACTION_CONFIG[detailEntry.action]?.label || detailEntry.action}</strong>
                  {' '}sur la table <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{detailEntry.table_name}</code>
                  {' '}par <strong>{detailEntry.user_label || 'Utilisateur inconnu'}</strong>
                  {' '}le {detailEntry.created_at && new Date(detailEntry.created_at).toLocaleString('fr-FR')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {detailEntry && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">ID enregistrement</Label>
                  <p className="font-mono text-xs">{detailEntry.record_id || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">IP source</Label>
                  <p className="font-mono text-xs">{detailEntry.ip || '—'}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">User-Agent</Label>
                <p className="text-xs break-all">{detailEntry.user_agent || '—'}</p>
              </div>
              {detailEntry.is_redacted ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <strong>Cette entrée a été anonymisée (RGPD).</strong> Les valeurs originales
                  ne sont plus consultables. La trace de l&rsquo;anonymisation (qui, quand,
                  pourquoi) est conservée dans <code>audit_log_redactions</code>, accessible
                  au super-administrateur.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Valeurs avant</Label>
                    <pre className="bg-slate-50 border rounded p-2 text-[11px] font-mono overflow-x-auto max-h-64 overflow-y-auto">
                      {detailEntry.old_values ? JSON.stringify(detailEntry.old_values, null, 2) : '—'}
                    </pre>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Valeurs après</Label>
                    <pre className="bg-slate-50 border rounded p-2 text-[11px] font-mono overflow-x-auto max-h-64 overflow-y-auto">
                      {detailEntry.new_values ? JSON.stringify(detailEntry.new_values, null, 2) : '—'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal anonymisation RGPD */}
      <Dialog open={!!redactDialog} onOpenChange={(o) => !o && setRedactDialog(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Anonymiser cette entrée (RGPD)
            </DialogTitle>
            <DialogDescription>
              Les valeurs sensibles seront remplacées par <code>[REDACTED]</code>. La trace
              de l&rsquo;anonymisation (qui, quand, motif) sera enregistrée dans une table
              <strong> totalement immuable</strong>. Cette action est <strong>irréversible</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="motif-redact">
              Motif légal (obligatoire, minimum 10 caractères)
            </Label>
            <Textarea
              id="motif-redact"
              value={redactMotif}
              onChange={e => setRedactMotif(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Ex : demande d'effacement RGPD reçue le JJ/MM/AAAA — référence dossier XYZ"
            />
            <p className="text-xs text-muted-foreground">
              {redactMotif.length}/1000 caractères
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedactDialog(null)} disabled={isPending}>
              Annuler
            </Button>
            <Button
              onClick={handleRedact}
              disabled={isPending || redactMotif.trim().length < 10}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Lock className="h-4 w-4 mr-2" />
              Anonymiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
