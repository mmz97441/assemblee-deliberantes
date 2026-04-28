'use client'

import { Clock, Mail, PlayCircle, FileText, BookOpen, Lightbulb, MonitorPlay } from 'lucide-react'

function Astuce({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800 print:bg-blue-50 print:border print:border-blue-200">
      <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
      <span>{children}</span>
    </div>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary text-primary-foreground font-bold text-base shrink-0 print:border-2 print:border-gray-700 print:bg-white print:text-gray-900">
      {n}
    </span>
  )
}

export function GuideGestionnaire() {
  return (
    <div className="space-y-8 max-w-3xl" id="guide-gestionnaire">
      {/* Intro */}
      <div className="space-y-2">
        <p className="text-base text-muted-foreground leading-relaxed">
          Vous gérez les séances de votre institution.
          Voici les <strong className="text-foreground">5 actions</strong> que vous ferez le plus souvent :
        </p>
      </div>

      {/* Étape 1 */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <StepNumber n={1} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              Créer une séance
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
              <Clock className="h-3 w-3" /> 2 minutes
            </span>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Séances</span>{' → '}
            <span className="font-medium text-foreground">+ Nouvelle séance</span>{' → '}
            Suivez le guide en 5 étapes.
          </p>
          <p className="text-sm text-muted-foreground">
            {"L'assistant vous guide : instance, date, ordre du jour, convocataires, envoi."}
          </p>
          <Astuce>
            {"Cliquez « Copier depuis la dernière séance » pour aller plus vite."}
          </Astuce>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* Étape 2 */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <StepNumber n={2} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Envoyer les convocations
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
              <Clock className="h-3 w-3" /> 30 secondes
            </span>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {"Sur la fiche séance → "}
            <span className="font-medium text-foreground">Envoyer les convocations</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            {"Chaque membre reçoit un email avec l'ordre du jour et son QR code personnel."}
          </p>
          <Astuce>
            {"Le statut (envoyé, lu, confirmé) se met à jour automatiquement."}
          </Astuce>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* Étape 3 */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <StepNumber n={3} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MonitorPlay className="h-5 w-5 text-primary" />
              Gérer la séance en direct
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mt-1">
              <Clock className="h-3 w-3" /> pendant la séance
            </span>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {"Fiche séance → "}
            <span className="font-medium text-foreground">Ouvrir la séance</span>{' → '}
            <span className="font-medium text-foreground">Conducteur de séance</span>.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-none">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">{"•"}</span>
              {"Naviguez entre les points de l'ordre du jour"}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">{"•"}</span>
              {"Lancez les votes (main levée ou bulletin secret)"}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">{"•"}</span>
              {"Le résultat et la formule PV s'affichent automatiquement"}
            </li>
          </ul>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* Étape 4 */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <StepNumber n={4} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Rédiger le procès-verbal
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
              <Clock className="h-3 w-3" /> 10 minutes après la séance
            </span>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {"Fiche séance → "}
            <span className="font-medium text-foreground">Procès-verbal</span>{' → '}
            <span className="font-medium text-foreground">Générer le brouillon</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            {"Le PV est pré-rempli à 90 %. Vous n'avez qu'à ajouter les discussions."}
          </p>
          <Astuce>
            {"L'IA peut reformuler vos notes en langage officiel si besoin."}
          </Astuce>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* Étape 5 */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <StepNumber n={5} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Publier les délibérations
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
              <Clock className="h-3 w-3" /> 2 minutes
            </span>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Délibérations</span>{' → '}
            <span className="font-medium text-foreground">Publier</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            Le numéro officiel est attribué automatiquement.
          </p>
        </div>
      </div>

      {/* Temps gagné */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-5 flex items-start gap-3 print:bg-emerald-50">
        <Clock className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Temps gagné : environ 3 heures par séance
          </p>
          <p className="text-sm text-emerald-700 mt-0.5">
            Plus de PV rédigé de mémoire, plus de numérotation manuelle, plus de convocations papier.
          </p>
        </div>
      </div>
    </div>
  )
}
