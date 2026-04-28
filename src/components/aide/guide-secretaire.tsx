'use client'

import { Clock, FileText, PenTool, Wand2, Lightbulb } from 'lucide-react'

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

export function GuideSecretaire() {
  return (
    <div className="space-y-8 max-w-3xl" id="guide-secretaire">
      {/* Intro */}
      <div className="space-y-2">
        <p className="text-base text-muted-foreground leading-relaxed">
          Vous rédigez et signez le procès-verbal après la séance.
        </p>
      </div>

      {/* Étape 1 */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <StepNumber n={1} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Générer le brouillon
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
              <Clock className="h-3 w-3" /> après la séance
            </span>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Séances</span>{' → '}
            votre séance{' → '}
            <span className="font-medium text-foreground">Procès-verbal</span>{' → '}
            <span className="font-medium text-foreground">Générer</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            Le PV est pré-rempli avec les présences, les votes et les formules officielles.
          </p>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* Étape 2 */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <StepNumber n={2} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Compléter les discussions
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pour chaque point de {"l'ordre du jour"} : résumez ce qui a été dit.
          </p>
          <Astuce>
            {"Cliquez « Reformuler avec l'IA » pour mettre vos notes en forme officielle automatiquement."}
          </Astuce>
          <Astuce>
            {"Si un point a été adopté à l'unanimité sans discussion : passez au suivant, tout est déjà rempli."}
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
              <PenTool className="h-5 w-5 text-primary" />
              Finaliser et signer
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {"Étape "}
            <span className="font-medium text-foreground">Finaliser</span>
            {" → envoie un email au président pour sa signature."}
          </p>
          <p className="text-sm text-muted-foreground">
            {"Quand le président a signé → vous signez aussi → le PV est verrouillé."}
          </p>
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 mt-1">
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg">
              {"✓ PV verrouillé — Exportez en PDF si besoin"}
            </span>
          </div>
        </div>
      </div>

      {/* Temps gagné */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-5 flex items-start gap-3 print:bg-emerald-50">
        <Clock className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Temps gagné : le PV est pré-rempli au lieu de rédiger de zéro
          </p>
          <p className="text-sm text-emerald-700 mt-0.5">
            {"Présences, résultats de vote et formules légales sont déjà insérés automatiquement."}
          </p>
        </div>
      </div>
    </div>
  )
}
