'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  FileText,
  RefreshCw,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  Scale,
  Vote,
  Clock,
  AlertTriangle,
  Sparkles,
  Eye,
  Handshake,
  Ban,
} from 'lucide-react'
import { generatePVBrouillon, savePVContent, type PVContenu } from '@/lib/actions/pv'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PVEditorProps {
  seanceId: string
  seanceTitre: string
  seanceStatut: string
  existingPV: {
    id: string
    contenu_json: unknown
    statut: string | null
    version: number | null
  } | null
  canEdit: boolean
}

const PV_STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: 'Brouillon', color: 'bg-amber-100 text-amber-700' },
  EN_RELECTURE: { label: 'En relecture', color: 'bg-blue-100 text-blue-700' },
  APPROUVE_EN_SEANCE: { label: 'Approuvé en séance', color: 'bg-emerald-100 text-emerald-700' },
  SIGNE: { label: 'Signé', color: 'bg-purple-100 text-purple-700' },
  PUBLIE: { label: 'Publié', color: 'bg-green-100 text-green-700' },
}

const RESULTAT_ICONS: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  ADOPTE: { icon: CheckCircle2, color: 'text-emerald-600' },
  ADOPTE_UNANIMITE: { icon: Sparkles, color: 'text-emerald-600' },
  ADOPTE_VOIX_PREPONDERANTE: { icon: Scale, color: 'text-blue-600' },
  REJETE: { icon: XCircle, color: 'text-red-600' },
  NUL: { icon: Ban, color: 'text-amber-600' },
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PVEditor({ seanceId, seanceStatut, existingPV, canEdit }: PVEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pvId, setPvId] = useState<string | null>(existingPV?.id || null)
  const [contenu, setContenu] = useState<PVContenu | null>(
    existingPV?.contenu_json as PVContenu | null
  )
  const [pvStatut] = useState(existingPV?.statut || 'BROUILLON')
  const [version] = useState(existingPV?.version || 0)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // ─── Handlers ──────────────────────────────────────────────────────────

  function handleGenerate() {
    startTransition(async () => {
      const result = await generatePVBrouillon(seanceId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setPvId(result.pvId)
      setContenu(result.contenu)
      toast.success('Brouillon du PV généré avec succès !')
      router.refresh()
    })
  }

  function handleSave() {
    if (!pvId || !contenu) return
    startTransition(async () => {
      const result = await savePVContent(pvId, contenu, seanceId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setLastSaved(new Date())
      toast.success('PV sauvegardé')
    })
  }

  function updateContenu(updates: Partial<PVContenu>) {
    if (!contenu) return
    setContenu({ ...contenu, ...updates })
  }

  // ─── No PV yet — generate button ──────────────────────────────────────

  if (!contenu) {
    const canGenerate = seanceStatut === 'CLOTUREE' || seanceStatut === 'ARCHIVEE'

    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16 rounded-xl border border-dashed">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Procès-verbal</h2>
          {canGenerate ? (
            <>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                La séance est clôturée. Générez le brouillon du procès-verbal automatiquement à partir des données de la séance.
              </p>
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={isPending}
                className="gap-2"
              >
                {isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Génération en cours...</>
                ) : (
                  <><Sparkles className="h-5 w-5" /> Générer le brouillon du PV</>
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Le procès-verbal pourra être généré une fois la séance clôturée.
              </p>
              <div className="flex items-center justify-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Séance en statut : {seanceStatut}</span>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── PV Editor ─────────────────────────────────────────────────────────

  const statutConfig = PV_STATUT_CONFIG[pvStatut] || PV_STATUT_CONFIG.BROUILLON
  const isReadOnly = !canEdit || pvStatut === 'SIGNE' || pvStatut === 'PUBLIE'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-3 border-b">
        <div className="flex items-center gap-3">
          <Badge className={`${statutConfig.color} border-0`}>{statutConfig.label}</Badge>
          {version > 0 && (
            <span className="text-xs text-muted-foreground">Version {version}</span>
          )}
          {lastSaved && (
            <span className="text-xs text-emerald-600">
              Sauvegardé à {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isPending}
              title="Regénérer le brouillon à partir des données actuelles de la séance"
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Regénérer
            </Button>
          )}
          {canEdit && !isReadOnly && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sauvegarde...</>
              ) : (
                <><Save className="h-4 w-4 mr-1.5" /> Sauvegarder</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ═══ PV Content ═══ */}
      <div className="space-y-6 print:space-y-4" id="pv-content">

        {/* ─── En-tête ─── */}
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground uppercase tracking-widest">
                {contenu.entete.institution}
              </p>
              <h1 className="text-xl font-bold">
                Procès-verbal de la séance du {contenu.entete.nomInstance}
              </h1>
              <p className="text-lg font-semibold text-institutional-blue">
                {contenu.entete.dateSeance}
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                {contenu.entete.lieu && <span>📍 {contenu.entete.lieu}</span>}
                <span>🕐 {contenu.entete.heureOuverture || '...'} — {contenu.entete.heureCloture || '...'}</span>
                <span>{contenu.entete.publique ? '🔓 Séance publique' : '🔒 Huis clos'}</span>
              </div>
              {contenu.entete.reconvocation && (
                <Badge variant="outline" className="border-amber-300 text-amber-700">
                  Reconvocation
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Bureau ─── */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
              <Scale className="h-4 w-4 text-muted-foreground" />
              Bureau de séance
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Président(e)</p>
                <p className="font-medium">{contenu.bureau.president || 'Non désigné'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Secrétaire de séance</p>
                <p className="font-medium">{contenu.bureau.secretaire || 'Non désigné'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Présences ─── */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-muted-foreground" />
              Présences
            </h2>

            {/* Quorum */}
            <div className={`rounded-lg p-3 mb-4 ${
              contenu.presences.quorum.atteint
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <p className={`text-sm font-medium ${
                contenu.presences.quorum.atteint ? 'text-emerald-700' : 'text-red-700'
              }`}>
                {contenu.presences.quorum.atteint ? '✅' : '❌'} Quorum {contenu.presences.quorum.atteint ? 'atteint' : 'non atteint'} : {contenu.presences.quorum.presents} présent{contenu.presences.quorum.presents > 1 ? 's' : ''} sur {contenu.presences.quorum.requis} requis
              </p>
            </div>

            {/* Presents */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Présents ({contenu.presences.presents.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {contenu.presences.presents.map((p, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {p.prenom} {p.nom}
                      {p.qualite && <span className="text-muted-foreground ml-1">— {p.qualite}</span>}
                    </Badge>
                  ))}
                </div>
              </div>

              {contenu.presences.excuses.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Excusés ({contenu.presences.excuses.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {contenu.presences.excuses.map((p, i) => (
                      <Badge key={i} variant="outline" className="text-xs border-amber-200 text-amber-700">
                        {p.prenom} {p.nom}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {contenu.presences.absents.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Absents ({contenu.presences.absents.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {contenu.presences.absents.map((p, i) => (
                      <Badge key={i} variant="outline" className="text-xs border-red-200 text-red-700">
                        {p.prenom} {p.nom}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {contenu.presences.procurations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    <Handshake className="h-3 w-3 inline mr-1" />
                    Procurations ({contenu.presences.procurations.length})
                  </p>
                  {contenu.presences.procurations.map((p, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {p.mandant} → {p.mandataire}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Introduction libre (editable) ─── */}
        {canEdit && !isReadOnly && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Introduction
              </h2>
              <Textarea
                value={contenu.introductionLibre}
                onChange={(e) => updateContenu({ introductionLibre: e.target.value })}
                placeholder="Introduction facultative du procès-verbal (contexte, observations préliminaires...)"
                rows={3}
                className="text-sm"
              />
            </CardContent>
          </Card>
        )}

        {/* ─── Points ODJ ─── */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Ordre du jour
          </h2>

          {contenu.points.map((point, idx) => {
            const resultatConfig = point.vote?.resultat
              ? RESULTAT_ICONS[point.vote.resultat]
              : null
            const ResultIcon = resultatConfig?.icon || Eye

            return (
              <Card key={idx}>
                <CardContent className="p-6">
                  {/* Point header */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shrink-0 ${
                      point.vote ? 'bg-blue-100 text-blue-700' : 'bg-muted'
                    }`}>
                      {point.position}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{point.titre}</h3>
                      {point.rapporteur && (
                        <p className="text-xs text-muted-foreground">Rapporteur : {point.rapporteur}</p>
                      )}
                    </div>
                    {point.vote?.resultat && (
                      <Badge className={`border-0 text-xs ${
                        point.vote.resultat.startsWith('ADOPTE') ? 'bg-emerald-100 text-emerald-700' :
                        point.vote.resultat === 'REJETE' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        <ResultIcon className={`h-3 w-3 mr-1 ${resultatConfig?.color || ''}`} />
                        {point.vote.resultat === 'ADOPTE_UNANIMITE' ? 'Unanimité' :
                         point.vote.resultat === 'ADOPTE' ? 'Adopté' :
                         point.vote.resultat === 'ADOPTE_VOIX_PREPONDERANTE' ? 'Voix prép.' :
                         point.vote.resultat === 'REJETE' ? 'Rejeté' : 'Nul'}
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  {point.description && (
                    <p className="text-sm text-muted-foreground mb-3">{point.description}</p>
                  )}

                  {/* Projet de délibération */}
                  {point.projetDeliberation && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">Résolution proposée :</p>
                      <p className="text-sm text-blue-800 whitespace-pre-line">{point.projetDeliberation}</p>
                    </div>
                  )}

                  {/* Vote results */}
                  {point.vote && (
                    <div className="space-y-3">
                      <Separator />

                      {/* Vote counts */}
                      <div className="flex items-center gap-2 mb-2">
                        <Vote className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Résultat du vote</span>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-lg font-bold text-emerald-600">{point.vote.pour}</p>
                          <p className="text-[10px] text-muted-foreground">Pour</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-lg font-bold text-red-600">{point.vote.contre}</p>
                          <p className="text-[10px] text-muted-foreground">Contre</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-lg font-bold text-amber-600">{point.vote.abstentions}</p>
                          <p className="text-[10px] text-muted-foreground">Abstentions</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-lg font-bold">{point.vote.totalVotants}</p>
                          <p className="text-[10px] text-muted-foreground">Votants</p>
                        </div>
                      </div>

                      {/* Names */}
                      {point.vote.nomsContre.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Contre : {point.vote.nomsContre.join(', ')}
                        </p>
                      )}
                      {point.vote.nomsAbstention.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Abstentions : {point.vote.nomsAbstention.join(', ')}
                        </p>
                      )}

                      {/* PV Formula — the official text */}
                      {point.vote.formulePV && (
                        <div className="rounded-lg bg-institutional-blue/5 border border-institutional-blue/20 p-4">
                          <p className="text-sm italic leading-relaxed text-institutional-blue">
                            {point.vote.formulePV}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No vote — information point */}
                  {!point.vote && (
                    <div className="flex items-center gap-2 text-muted-foreground mt-2">
                      <Eye className="h-4 w-4" />
                      <span className="text-xs">
                        {point.type === 'QUESTION_DIVERSE'
                          ? 'Questions diverses — point informatif'
                          : point.type === 'INFORMATION'
                            ? 'Point d\'information — pas de vote'
                            : 'Aucun vote enregistré sur ce point'}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* ─── Conclusion libre (editable) ─── */}
        {canEdit && !isReadOnly && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Observations complémentaires
              </h2>
              <Textarea
                value={contenu.conclusionLibre}
                onChange={(e) => updateContenu({ conclusionLibre: e.target.value })}
                placeholder="Observations complémentaires, remarques du secrétaire de séance..."
                rows={3}
                className="text-sm"
              />
            </CardContent>
          </Card>
        )}

        {/* ─── Clôture ─── */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Clôture de la séance
            </h2>
            <p className="text-sm italic text-muted-foreground">
              {contenu.cloture.texte}
            </p>
          </CardContent>
        </Card>

        {/* ─── Signatures placeholder ─── */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-base font-semibold mb-4">Signatures</h2>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-8">Le Président</p>
                <div className="border-t pt-2">
                  <p className="text-sm font-medium">{contenu.bureau.president || '...'}</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-8">Le Secrétaire de séance</p>
                <div className="border-t pt-2">
                  <p className="text-sm font-medium">{contenu.bureau.secretaire || '...'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
