'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  CheckCircle2,
  Circle,
  Clock,
  Download,
  Ban,
  Megaphone,
  Send,
  Trash2,
  Save,
  Plus,
  X,
  AlertTriangle,
  ExternalLink,
  CalendarDays,
} from 'lucide-react'
import {
  publishDeliberation,
  updateDeliberationContent,
  updateDeliberationTitle,
  markAffichage,
  markTransmissionPrefecture,
  annulDeliberation,
  deleteDeliberationDraft,
} from '@/lib/actions/deliberations'
import type { DeliberationContenu } from '@/lib/actions/deliberations'
import type { Json } from '@/lib/supabase/types'
import { VOTE_RESULTAT_CONFIG } from '@/lib/constants'
import { formatShortDate, formatDateTime } from '@/lib/utils/format-date'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeliberationVote {
  id: string
  resultat: string | null
  pour: number | null
  contre: number | null
  abstention: number | null
  total_votants: number | null
  formule_pv: string | null
  type_vote: string | null
}

interface DeliberationData {
  id: string
  numero: string | null
  titre: string
  contenu_articles: Json | null
  publie_at: string | null
  affiche_at: string | null
  transmis_prefecture_at: string | null
  pdf_url: string | null
  annulee: boolean | null
  motif_annulation: string | null
  created_at: string | null
  updated_at: string | null
  seance_id: string
  vote_id: string | null
  odj_point_id: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  seances: any
  votes: DeliberationVote | null
}

interface DeliberationDetailProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deliberation: any
  seanceTitle: string
  instanceName: string
  canManage: boolean
  isSuperAdmin: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Alias local : formatDate ici = date sans jour de la semaine
const formatDate = formatShortDate

// ─── Lifecycle Stepper ──────────────────────────────────────────────────────

type StepStatus = 'done' | 'current' | 'pending'

interface Step {
  label: string
  status: StepStatus
  date?: string | null
}

function getSteps(d: DeliberationData): Step[] {
  const steps: Step[] = [
    {
      label: 'Créée',
      status: 'done',
      date: d.created_at,
    },
    {
      label: 'Rédigée',
      status: d.contenu_articles ? 'done' : 'current',
      date: d.updated_at,
    },
    {
      label: 'Publication',
      status: d.publie_at ? 'done' : (!d.contenu_articles ? 'pending' : 'current'),
      date: d.publie_at,
    },
    {
      label: 'Affichage',
      status: d.affiche_at ? 'done' : (d.publie_at ? 'current' : 'pending'),
      date: d.affiche_at,
    },
    {
      label: 'Transmission',
      status: d.transmis_prefecture_at ? 'done' : (d.affiche_at ? 'current' : 'pending'),
      date: d.transmis_prefecture_at,
    },
  ]
  return steps
}

function LifecycleStepper({ steps }: { steps: Step[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          {i > 0 && (
            <div className={`h-px w-6 shrink-0 ${step.status === 'done' ? 'bg-green-400' : 'bg-muted'}`} />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                  step.status === 'done'
                    ? 'bg-green-100 text-green-700'
                    : step.status === 'current'
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.status === 'done' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : step.status === 'current' ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                {step.label}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {step.status === 'done' && step.date
                  ? `Fait le ${formatDateTime(step.date)}`
                  : step.status === 'current'
                  ? 'Étape en cours'
                  : 'À venir'
                }
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DeliberationDetail({
  deliberation: rawDelib,
  seanceTitle,
  instanceName,
  canManage,
  isSuperAdmin,
}: DeliberationDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const delib = rawDelib as DeliberationData

  const isPublished = !!delib.publie_at
  const isAnnulee = !!delib.annulee
  const isDraft = !isPublished && !isAnnulee
  const canEdit = isDraft && canManage

  // Parse content
  const initialContent: DeliberationContenu = (delib.contenu_articles as unknown as DeliberationContenu) || {
    vu: '',
    considerant: '',
    articles: [],
    formuleVote: null,
    projetDeliberation: null,
  }

  const [vu, setVu] = useState(initialContent.vu || '')
  const [considerant, setConsiderant] = useState(initialContent.considerant || '')
  const [articles, setArticles] = useState<string[]>(initialContent.articles || [])
  const [titre, setTitre] = useState(delib.titre)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Dialog states
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [annulDialogOpen, setAnnulDialogOpen] = useState(false)
  const [annulMotif, setAnnulMotif] = useState('')

  const steps = getSteps(delib)
  const vote = delib.votes as DeliberationVote | null
  const resultat = vote?.resultat ? VOTE_RESULTAT_CONFIG[vote.resultat] : null
  const seanceDate = delib.seances?.date_seance

  // Warnings
  const now = new Date()
  const publishedDate = delib.publie_at ? new Date(delib.publie_at) : null
  const hoursPublished = publishedDate ? (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60) : 0
  const showAffichageWarning = isPublished && !delib.affiche_at && hoursPublished > 24
  const showTransmissionWarning = isPublished && !delib.transmis_prefecture_at && hoursPublished > 10 * 24

  // ─── Handlers ─────────────────────────────────────────────────────────

  function markChanged() {
    setHasUnsavedChanges(true)
  }

  function handleAddArticle() {
    setArticles([...articles, ''])
    markChanged()
  }

  function handleUpdateArticle(index: number, value: string) {
    const updated = [...articles]
    updated[index] = value
    setArticles(updated)
    markChanged()
  }

  function handleRemoveArticle(index: number) {
    setArticles(articles.filter((_, i) => i !== index))
    markChanged()
  }

  function handleSave() {
    startTransition(async () => {
      // Save title if changed
      if (titre !== delib.titre) {
        const titleResult = await updateDeliberationTitle(delib.id, titre)
        if ('error' in titleResult) {
          toast.error(titleResult.error)
          return
        }
      }

      // Save content
      const content: DeliberationContenu = {
        vu,
        considerant,
        articles,
        formuleVote: initialContent.formuleVote,
        projetDeliberation: initialContent.projetDeliberation,
      }
      const result = await updateDeliberationContent(delib.id, content)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Modifications enregistrées')
        setHasUnsavedChanges(false)
        router.refresh()
      }
    })
  }

  function handlePublish() {
    startTransition(async () => {
      // Save content first
      const content: DeliberationContenu = {
        vu,
        considerant,
        articles,
        formuleVote: initialContent.formuleVote,
        projetDeliberation: initialContent.projetDeliberation,
      }
      await updateDeliberationContent(delib.id, content)

      if (titre !== delib.titre) {
        await updateDeliberationTitle(delib.id, titre)
      }

      const result = await publishDeliberation(delib.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Délibération publiée sous le numéro ${result.numero}`)
        router.refresh()
      }
      setPublishDialogOpen(false)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDeliberationDraft(delib.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Brouillon supprimé')
        router.push('/deliberations')
      }
      setDeleteDialogOpen(false)
    })
  }

  function handleAnnul() {
    if (!annulMotif.trim()) return
    startTransition(async () => {
      const result = await annulDeliberation(delib.id, annulMotif)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Délibération annulée')
        router.refresh()
      }
      setAnnulDialogOpen(false)
      setAnnulMotif('')
    })
  }

  function handleAffichage() {
    startTransition(async () => {
      const result = await markAffichage(delib.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Affichage enregistré')
        router.refresh()
      }
    })
  }

  function handleTransmission() {
    startTransition(async () => {
      const result = await markTransmissionPrefecture(delib.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Transmission en préfecture enregistrée')
        router.refresh()
      }
    })
  }

  return (
    <>
      {/* Annulation banner */}
      {isAnnulee && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-5 py-4 text-red-800">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <Ban className="h-5 w-5" />
            Délibération annulée
          </div>
          <p className="text-sm">
            Annulée le {delib.updated_at ? formatDateTime(delib.updated_at) : 'date inconnue'}.
            {delib.motif_annulation && (
              <> Motif : {delib.motif_annulation}</>
            )}
          </p>
        </div>
      )}

      {/* Warnings */}
      {showAffichageWarning && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          L&apos;affichage doit être effectué dans les 24h suivant la publication
        </div>
      )}
      {showTransmissionWarning && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          La transmission à la préfecture doit être effectuée dans les 15 jours
        </div>
      )}

      {/* Lifecycle stepper */}
      {!isAnnulee && (
        <div className="mb-6">
          <LifecycleStepper steps={steps} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ─── Left: Content ───────────────────────────────────────────── */}
        <div className={`lg:col-span-2 space-y-6 ${isAnnulee ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Header info */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {delib.numero ? (
                <span className="font-mono text-xl font-bold text-blue-700">
                  n&deg;&nbsp;{delib.numero}
                </span>
              ) : (
                <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                  Brouillon
                </Badge>
              )}
              {resultat && (
                <Badge className={`${resultat.color} border-0`}>
                  {resultat.label}
                </Badge>
              )}
              {instanceName && (
                <Badge variant="outline">{instanceName}</Badge>
              )}
            </div>

            {canEdit ? (
              <div className="space-y-2">
                <Label htmlFor="titre">Titre de la délibération</Label>
                <Input
                  id="titre"
                  value={titre}
                  onChange={e => { setTitre(e.target.value); markChanged() }}
                  className="text-lg font-semibold"
                />
              </div>
            ) : (
              <h2 className="text-lg font-semibold text-foreground">{delib.titre}</h2>
            )}

            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              {seanceDate && (
                <Link
                  href={`/seances/${delib.seance_id}`}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Séance du {formatDate(seanceDate)} — {seanceTitle}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>

            {/* Vote details */}
            {vote && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-1">Résultat du vote :</p>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>Pour : <strong className="text-green-700">{vote.pour ?? 0}</strong></span>
                  <span>Contre : <strong className="text-red-700">{vote.contre ?? 0}</strong></span>
                  <span>Abstentions : <strong>{vote.abstention ?? 0}</strong></span>
                  <span>Votants : <strong>{vote.total_votants ?? 0}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* VU section */}
          <div className="rounded-xl border bg-card p-6">
            <Label htmlFor="vu" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
              Vu
            </Label>
            {canEdit ? (
              <Textarea
                id="vu"
                value={vu}
                onChange={e => { setVu(e.target.value); markChanged() }}
                rows={4}
                placeholder="Vu le Code général des collectivités territoriales..."
                className="resize-y"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{vu || <span className="text-muted-foreground italic">Non renseigné</span>}</p>
            )}
          </div>

          {/* CONSIDERANT section */}
          <div className="rounded-xl border bg-card p-6">
            <Label htmlFor="considerant" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
              Considérant
            </Label>
            {canEdit ? (
              <Textarea
                id="considerant"
                value={considerant}
                onChange={e => { setConsiderant(e.target.value); markChanged() }}
                rows={4}
                placeholder="Considérant que..."
                className="resize-y"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{considerant || <span className="text-muted-foreground italic">Non renseigné</span>}</p>
            )}
          </div>

          {/* ARTICLES section */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Articles ({articles.length})
              </Label>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={handleAddArticle}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter un article
                </Button>
              )}
            </div>

            {articles.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                {canEdit
                  ? 'Aucun article. Cliquez sur "Ajouter un article" pour commencer.'
                  : 'Aucun article.'
                }
              </p>
            )}

            <div className="space-y-3">
              {articles.map((article, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 text-sm font-medium text-muted-foreground pt-2.5 w-20">
                    Article {i + 1}
                  </span>
                  {canEdit ? (
                    <>
                      <Textarea
                        value={article}
                        onChange={e => handleUpdateArticle(i, e.target.value)}
                        rows={2}
                        className="flex-1 resize-y"
                        placeholder={`Contenu de l'article ${i + 1}...`}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveArticle(i)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Supprimer cet article</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap flex-1 pt-2">{article}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Formule de vote (read-only) */}
          {initialContent.formuleVote && (
            <div className="rounded-xl border bg-card p-6">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
                Formule de vote (PV)
              </Label>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900 whitespace-pre-wrap">
                {initialContent.formuleVote}
              </div>
            </div>
          )}
        </div>

        {/* ─── Right: Actions panel ────────────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-24 self-start">
          {/* Actions */}
          {canManage && !isAnnulee && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </h3>

              {/* Draft: save + publish + delete */}
              {isDraft && (
                <>
                  {hasUnsavedChanges && (
                    <Button
                      onClick={handleSave}
                      disabled={isPending}
                      className="w-full"
                      variant="outline"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </Button>
                  )}
                  <Button
                    onClick={() => setPublishDialogOpen(true)}
                    disabled={isPending}
                    className="w-full"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Publier
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={isPending}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer le brouillon
                  </Button>
                </>
              )}

              {/* Published actions */}
              {isPublished && (
                <>
                  {!delib.affiche_at && (
                    <Button
                      variant="outline"
                      onClick={handleAffichage}
                      disabled={isPending}
                      className="w-full"
                    >
                      <Megaphone className="h-4 w-4 mr-2" />
                      {isPending ? 'Enregistrement...' : 'Marquer comme affichée'}
                    </Button>
                  )}
                  {!delib.transmis_prefecture_at && (
                    <Button
                      variant="outline"
                      onClick={handleTransmission}
                      disabled={isPending}
                      className="w-full"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {isPending ? 'Enregistrement...' : 'Marquer transmission préfecture'}
                    </Button>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        disabled
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Génération PDF bientôt disponible</p>
                    </TooltipContent>
                  </Tooltip>
                  {isSuperAdmin && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setAnnulMotif('')
                        setAnnulDialogOpen(true)
                      }}
                      disabled={isPending}
                      className="w-full"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Annuler la délibération
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Dates
            </h3>
            <div className="space-y-2.5 text-sm">
              <TimelineItem
                label="Création"
                date={delib.created_at}
              />
              <TimelineItem
                label="Publication"
                date={delib.publie_at}
                highlight={!delib.publie_at && !isAnnulee}
              />
              <TimelineItem
                label="Affichage"
                date={delib.affiche_at}
                highlight={!!delib.publie_at && !delib.affiche_at && !isAnnulee}
              />
              <TimelineItem
                label="Transmission en préfecture"
                date={delib.transmis_prefecture_at}
                highlight={!!delib.affiche_at && !delib.transmis_prefecture_at && !isAnnulee}
              />
              {isAnnulee && (
                <TimelineItem
                  label="Annulation"
                  date={delib.updated_at}
                  danger
                />
              )}
            </div>
          </div>

          {/* Seance link */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Séance associée
            </h3>
            <Link
              href={`/seances/${delib.seance_id}`}
              className="text-sm text-blue-700 hover:underline flex items-center gap-1"
            >
              {seanceTitle}
              <ExternalLink className="h-3 w-3" />
            </Link>
            {seanceDate && (
              <p className="text-xs text-muted-foreground mt-1">{formatDate(seanceDate)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Publish confirmation */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>Publier cette délibération ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un numéro officiel sera attribué automatiquement. Le contenu actuel sera enregistré avant publication.
              <br /><br />
              <strong>Cette action est irréversible</strong> : le numéro ne pourra pas être changé une fois attribué.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={isPending}>
              {isPending ? 'Publication...' : 'Publier et attribuer le numéro'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete draft confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce brouillon ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce brouillon sera définitivement supprimé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Annulation dialog */}
      <AlertDialog open={annulDialogOpen} onOpenChange={setAnnulDialogOpen}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette délibération ?</AlertDialogTitle>
            <AlertDialogDescription>
              La délibération n&deg;&nbsp;{delib.numero} &laquo;&nbsp;{delib.titre}&nbsp;&raquo; sera marquée comme annulée.
              Le numéro ne sera pas réutilisé.
              <br /><br />
              <strong>Motif d&apos;annulation (obligatoire)&nbsp;:</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Saisissez le motif d'annulation..."
            value={annulMotif}
            onChange={e => setAnnulMotif(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAnnul}
              disabled={isPending || !annulMotif.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Annulation...' : 'Confirmer l\'annulation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Timeline Item ──────────────────────────────────────────────────────────

function TimelineItem({
  label,
  date,
  highlight,
  danger,
}: {
  label: string
  date?: string | null
  highlight?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-muted-foreground ${highlight ? 'font-medium text-blue-700' : ''} ${danger ? 'text-red-700' : ''}`}>
        {label}
      </span>
      {date ? (
        <span className={`font-medium ${danger ? 'text-red-700' : ''}`}>
          {formatDate(date)}
        </span>
      ) : (
        <span className="text-muted-foreground italic text-xs">En attente</span>
      )}
    </div>
  )
}
