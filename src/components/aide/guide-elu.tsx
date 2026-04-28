'use client'

import { Clock, Mail, Smartphone, CheckCircle, Lightbulb } from 'lucide-react'

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

export function GuideElu() {
  return (
    <div className="space-y-8 max-w-3xl" id="guide-elu">
      {/* Intro */}
      <div className="space-y-2">
        <p className="text-base text-muted-foreground leading-relaxed">
          Vous participez aux séances et votez.
          Voici les <strong className="text-foreground">3 choses</strong> que vous devez savoir :
        </p>
      </div>

      {/* Étape 1 */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <StepNumber n={1} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Avant la séance
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Vous recevez un <span className="font-medium text-foreground">email de convocation</span>.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-none">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">{"→"}</span>
              {"Cliquez « Confirmer ma présence » dans l'email"}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">{"→"}</span>
              {"Consultez l'ordre du jour et les documents joints"}
            </li>
          </ul>
          <Astuce>
            {"Vous pouvez préparer vos notes : Séances → Ma préparation"}
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
              <Smartphone className="h-5 w-5 text-primary" />
              Le jour de la séance
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">{"À l'entrée de la salle"}</p>
            <p className="text-sm text-muted-foreground">
              {"Présentez votre QR code (reçu par email) pour confirmer votre présence."}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">À votre place</p>
            <p className="text-sm text-muted-foreground">
              La tablette affiche le point en cours de discussion.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Pour voter</p>
            <p className="text-sm text-muted-foreground">
              {"Appuyez sur le bouton "}
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs">POUR</span>
              {", "}
              <span className="inline-flex items-center gap-1 font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs">CONTRE</span>
              {" ou "}
              <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs">ABSTENTION</span>
              .
            </p>
          </div>
          <Astuce>
            {"C'est tout. Pas besoin de faire autre chose."}
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
              <CheckCircle className="h-5 w-5 text-primary" />
              Après la séance
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {"Les résultats des votes sont disponibles dans l'application."}
          </p>
          <p className="text-sm text-muted-foreground">
            Le procès-verbal sera signé par le président et le secrétaire de séance.
          </p>
          <Astuce>
            {"Vous n'avez rien à faire après la séance."}
          </Astuce>
        </div>
      </div>

      {/* Temps nécessaire */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-5 flex items-start gap-3 print:bg-emerald-50">
        <Clock className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Temps nécessaire : 2 minutes avant + la durée de la séance
          </p>
          <p className="text-sm text-emerald-700 mt-0.5">
            Confirmer sa présence + voter quand demandé. Rien de plus.
          </p>
        </div>
      </div>
    </div>
  )
}
