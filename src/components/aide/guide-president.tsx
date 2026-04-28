'use client'

import { BarChart3, MonitorPlay, PenTool, Lightbulb } from 'lucide-react'

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

export function GuidePresident() {
  return (
    <div className="space-y-8 max-w-3xl" id="guide-president">
      {/* Intro */}
      <div className="space-y-2">
        <p className="text-base text-muted-foreground leading-relaxed">
          Vous présidez les séances et signez les procès-verbaux.
        </p>
      </div>

      {/* Étape 1 */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <StepNumber n={1} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Avant la séance
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Votre <span className="font-medium text-foreground">tableau de bord</span> vous montre vos prochaines séances et les actions en attente.
          </p>
          <Astuce>
            {"Vérifiez la prédiction de quorum : assez de confirmations pour que la séance ait lieu ?"}
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
              <MonitorPlay className="h-5 w-5 text-primary" />
              Pendant la séance
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {"Si vous avez une tablette : la "}
            <span className="font-medium text-foreground">vue président</span>
            {" affiche le point en cours, les demandes de parole et le quorum en temps réel."}
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-none">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">{"→"}</span>
              {"Appuyez sur « Demander le vote » quand vous êtes prêt"}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">{"→"}</span>
              Le gestionnaire lance le vote depuis son écran
            </li>
          </ul>
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
              Signer le procès-verbal
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {"Vous recevez un email : « Le PV est prêt pour votre signature »."}
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-none">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">{"→"}</span>
              Cliquez le lien dans le mail
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">{"→"}</span>
              Relisez le procès-verbal
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">{"→"}</span>
              {"Signez en un clic"}
            </li>
          </ul>
          <Astuce>
            La signature est définitive — relisez bien le PV avant de signer.
          </Astuce>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-5 flex items-start gap-3 print:bg-blue-50">
        <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">
            {"Votre rôle en résumé"}
          </p>
          <p className="text-sm text-blue-700 mt-0.5">
            {"Vous présidez la séance, demandez les votes, et signez le PV. Le gestionnaire s'occupe de toute la logistique."}
          </p>
        </div>
      </div>
    </div>
  )
}
