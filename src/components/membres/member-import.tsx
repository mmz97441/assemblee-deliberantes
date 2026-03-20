'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { importMembers, type ImportRow, type ImportResult } from '@/lib/actions/members'
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  X,
  FileText,
} from 'lucide-react'

// ─── CSV/Excel Parsing ──────────────────────────────────────────────────────

// Known column aliases (French + English)
const COLUMN_MAP: Record<string, keyof ImportRow> = {
  // prenom
  'prenom': 'prenom',
  'prénom': 'prenom',
  'firstname': 'prenom',
  'first_name': 'prenom',
  'first name': 'prenom',
  // nom
  'nom': 'nom',
  'lastname': 'nom',
  'last_name': 'nom',
  'last name': 'nom',
  'nom de famille': 'nom',
  // email
  'email': 'email',
  'e-mail': 'email',
  'mail': 'email',
  'adresse email': 'email',
  'adresse mail': 'email',
  'adressemail': 'email',
  // telephone
  'telephone': 'telephone',
  'téléphone': 'telephone',
  'tel': 'telephone',
  'tél': 'telephone',
  'phone': 'telephone',
  'mobile': 'telephone',
  'portable': 'telephone',
  'numéro de téléphone': 'telephone',
  'numero de telephone': 'telephone',
  // qualite
  'qualite': 'qualite_officielle',
  'qualité': 'qualite_officielle',
  'qualite_officielle': 'qualite_officielle',
  'qualité officielle': 'qualite_officielle',
  'titre': 'qualite_officielle',
  'fonction': 'qualite_officielle',
  // groupe
  'groupe': 'groupe_politique',
  'groupe_politique': 'groupe_politique',
  'groupe politique': 'groupe_politique',
  'parti': 'groupe_politique',
  // role
  'role': 'role',
  'rôle': 'role',
  // mandat
  'mandat_debut': 'mandat_debut',
  'début mandat': 'mandat_debut',
  'debut mandat': 'mandat_debut',
  'mandat_fin': 'mandat_fin',
  'fin mandat': 'mandat_fin',
}

function detectSeparator(firstLine: string): string {
  const semicolonCount = (firstLine.match(/;/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length
  const tabCount = (firstLine.match(/\t/g) || []).length
  if (tabCount > commaCount && tabCount > semicolonCount) return '\t'
  if (semicolonCount > commaCount) return ';'
  return ','
}

function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === separator && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  // Remove BOM if present
  const cleaned = text.replace(/^\uFEFF/, '').trim()
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim())

  if (lines.length < 2) return { headers: [], rows: [] }

  const separator = detectSeparator(lines[0])
  const headers = parseCSVLine(lines[0], separator)
  const rows = lines.slice(1).map(line => parseCSVLine(line, separator))

  return { headers, rows }
}

function mapHeaders(headers: string[]): { mapping: (keyof ImportRow | null)[]; unmapped: string[] } {
  const mapping: (keyof ImportRow | null)[] = []
  const unmapped: string[] = []

  for (const header of headers) {
    const normalized = header.toLowerCase().trim()
      .replace(/[_\-]/g, ' ')
      .replace(/\s+/g, ' ')

    // Try exact match first, then normalized
    const mapped = COLUMN_MAP[normalized] || COLUMN_MAP[header.toLowerCase().trim()] || null

    mapping.push(mapped)
    if (!mapped) unmapped.push(header)
  }

  return { mapping, unmapped }
}

function rowsToImportData(headers: (keyof ImportRow | null)[], rows: string[][]): ImportRow[] {
  return rows
    .filter(row => row.some(cell => cell.trim())) // Skip empty rows
    .map(row => {
      const item: Record<string, string> = {}
      headers.forEach((key, i) => {
        if (key && row[i]) {
          item[key] = row[i]
        }
      })
      return item as unknown as ImportRow
    })
    .filter(item => item.nom || item.prenom || item.email) // Must have at least some data
}

// ─── Component ───────────────────────────────────────────────────────────────

interface MemberImportDialogProps {
  open: boolean
  onClose: () => void
}

type ImportStep = 'upload' | 'preview' | 'result'

export function MemberImportDialog({ open, onClose }: MemberImportDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<ImportStep>('upload')
  const [fileName, setFileName] = useState('')
  const [parsedData, setParsedData] = useState<ImportRow[]>([])
  const [, setHeaderMapping] = useState<(keyof ImportRow | null)[]>([])
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function reset() {
    setStep('upload')
    setFileName('')
    setParsedData([])
    setHeaderMapping([])
    setUnmappedHeaders([])
    setImportResult(null)
  }

  const handleFile = useCallback((file: File) => {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.csv') && !name.endsWith('.tsv') && !name.endsWith('.txt')) {
      toast.error('Format non supporté. Utilisez un fichier CSV ou TSV.')
      return
    }

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) {
        toast.error('Impossible de lire le fichier')
        return
      }

      const { headers, rows } = parseCSV(text)
      if (headers.length === 0) {
        toast.error('Fichier vide ou format invalide')
        return
      }

      const { mapping, unmapped } = mapHeaders(headers)
      setHeaderMapping(mapping)
      setUnmappedHeaders(unmapped)

      // Check that we have at least nom + prenom or email
      const hasPrenomOrNom = mapping.includes('prenom') || mapping.includes('nom')
      const hasEmail = mapping.includes('email')

      if (!hasPrenomOrNom && !hasEmail) {
        toast.error('Colonnes requises introuvables. Le fichier doit contenir au minimum : nom, prénom, email.')
        return
      }

      const data = rowsToImportData(mapping, rows)
      setParsedData(data)
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function handleImport() {
    startTransition(async () => {
      const result = await importMembers(parsedData)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setImportResult(result)
      setStep('result')
      router.refresh()
    })
  }

  function handleClose() {
    reset()
    onClose()
  }

  // Count valid rows for preview
  const validRows = parsedData.filter(r => r.prenom?.trim() && r.nom?.trim() && r.email?.trim())
  const invalidRows = parsedData.length - validRows.length

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-institutional-blue" />
            Importer des membres
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Importez vos membres depuis un fichier CSV ou Excel (enregistré en CSV).'}
            {step === 'preview' && `${parsedData.length} ligne(s) détectée(s) — vérifiez avant d'importer.`}
            {step === 'result' && "Résultat de l'import."}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step 1: Upload ─── */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            {/* Drop zone */}
            <div
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                ${dragOver
                  ? 'border-institutional-blue bg-institutional-blue/5'
                  : 'border-muted-foreground/20 hover:border-institutional-blue/40 hover:bg-muted/30'
                }
              `}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={handleFileInput}
              />
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-sm mb-1">
                Glissez un fichier ici ou cliquez pour parcourir
              </p>
              <p className="text-xs text-muted-foreground">
                CSV, TSV — séparateur auto-détecté (virgule, point-virgule, tabulation)
              </p>
            </div>

            {/* Instructions */}
            <div className="rounded-xl bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">Format attendu</p>
              <p className="text-xs text-muted-foreground">
                Votre fichier doit avoir une ligne d&apos;en-tête. Les colonnes sont détectées automatiquement :
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Prénom', required: true },
                  { name: 'Nom', required: true },
                  { name: 'Email', required: true },
                  { name: 'Téléphone', required: false },
                  { name: 'Qualité / Fonction', required: false },
                  { name: 'Groupe politique', required: false },
                ].map(col => (
                  <div key={col.name} className="flex items-center gap-2 text-xs">
                    <Badge variant={col.required ? 'default' : 'secondary'} className="text-[10px]">
                      {col.required ? 'Requis' : 'Optionnel'}
                    </Badge>
                    {col.name}
                  </div>
                ))}
              </div>

              {/* Download template */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 mt-2"
                onClick={() => {
                  const csv = 'Prénom;Nom;Email;Téléphone;Qualité;Groupe politique\nJean;Dupont;jean.dupont@mairie.fr;06 12 34 56 78;Adjoint au maire;Majorité\nMarie;Martin;marie.martin@mairie.fr;06 98 76 54 32;Conseillère;Opposition\n'
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'modele-import-membres.csv'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger le modèle CSV
              </Button>
            </div>

            {/* Excel tip */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800">
                <p className="font-medium mb-1">Vous avez un fichier Excel (.xlsx) ?</p>
                <p>Ouvrez-le dans Excel → Fichier → Enregistrer sous → choisissez <strong>CSV UTF-8 (délimité par des virgules)</strong> ou <strong>CSV (séparateur : point-virgule)</strong>.</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 2: Preview ─── */}
        {step === 'preview' && (
          <div className="space-y-4 py-2">
            {/* File info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {parsedData.length} ligne(s) · {validRows.length} valide(s)
                  {invalidRows > 0 && ` · ${invalidRows} incomplète(s)`}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={reset} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Unmapped warning */}
            {unmappedHeaders.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-medium mb-1">Colonnes non reconnues (ignorées) :</p>
                <p>{unmappedHeaders.join(', ')}</p>
              </div>
            )}

            {/* Preview table */}
            <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 20).map((row, i) => {
                    const isValid = row.prenom?.trim() && row.nom?.trim() && row.email?.trim()
                    return (
                      <TableRow key={i} className={!isValid ? 'bg-red-50/50' : ''}>
                        <TableCell className="text-xs text-muted-foreground">{i + 2}</TableCell>
                        <TableCell className="text-sm">{row.prenom || '—'}</TableCell>
                        <TableCell className="text-sm">{row.nom || '—'}</TableCell>
                        <TableCell className="text-sm font-mono text-xs">{row.email || '—'}</TableCell>
                        <TableCell className="text-sm">{row.telephone || '—'}</TableCell>
                        <TableCell>
                          {isValid ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">OK</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">Incomplet</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {parsedData.length > 20 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  ... et {parsedData.length - 20} ligne(s) de plus
                </p>
              )}
            </div>

            {/* Summary */}
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                {validRows.length} prêt(s) à importer
              </span>
              {invalidRows > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  {invalidRows} ignorée(s) (données manquantes)
                </span>
              )}
            </div>
          </div>
        )}

        {/* ─── Step 3: Result ─── */}
        {step === 'result' && importResult && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-semibold">Import terminé !</p>
                <p className="text-sm text-muted-foreground">
                  {importResult.created} membre(s) créé(s) sur {importResult.total} ligne(s)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{importResult.created}</p>
                <p className="text-xs text-muted-foreground">Créé(s)</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{importResult.skipped}</p>
                <p className="text-xs text-muted-foreground">Doublons ignorés</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{importResult.errors.length}</p>
                <p className="text-xs text-muted-foreground">Erreurs</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 max-h-[150px] overflow-y-auto">
                <p className="text-xs font-medium text-red-800 mb-2">Erreurs détectées :</p>
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-700">
                    Ligne {err.row} : {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Footer ─── */}
        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Fermer</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={reset}>Recommencer</Button>
              <Button
                onClick={handleImport}
                disabled={isPending || validRows.length === 0}
                className="gap-2"
              >
                {isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Import en cours...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Importer {validRows.length} membre(s)</>
                )}
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={handleClose}>Fermer</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
