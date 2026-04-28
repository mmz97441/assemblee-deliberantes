'use client'

import { BarChart3, MonitorPlay, PenTool, Lightbulb, CheckCircle2, AlertTriangle, Users, Eye, Hand } from 'lucide-react'

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

function SubStep({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="inline-flex items-center justify-center h-6 min-w-[24px] rounded-md bg-muted text-muted-foreground font-mono text-xs shrink-0 mt-0.5">
        {num}
      </span>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  )
}

function ProblemesSolutions({ items }: { items: { probleme: string; solution: string }[] }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-2">
      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" />
        Problèmes courants
      </p>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <span className="text-amber-600 shrink-0 mt-0.5">{"•"}</span>
          <span>
            <span className="font-medium text-amber-900">{item.probleme}</span>
            <span className="text-amber-700">{" → "}{item.solution}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export function GuidePresident() {
  return (
    <div className="space-y-8 max-w-3xl" id="guide-president">
      {/* Intro */}
      <div className="space-y-2">
        <p className="text-base text-muted-foreground leading-relaxed">
          Vous présidez les séances et signez les procès-verbaux.
          Voici votre rôle détaillé à chaque étape.
        </p>
        <p className="text-sm text-muted-foreground">
          Le gestionnaire s&apos;occupe de toute la logistique. Vous vous concentrez sur la conduite des débats et les décisions.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 1 — Avant la séance */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <StepNumber n={1} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Avant la séance — Préparer
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <SubStep num="1.1">
            Votre <span className="font-medium text-foreground">tableau de bord</span> vous montre vos prochaines séances et les actions en attente.
            Un indicateur vous indique si vous avez des PV à signer.
          </SubStep>

          <SubStep num="1.2">
            <span className="font-medium text-foreground">Vérifiez la prédiction de quorum</span> : sur la fiche de la séance, la jauge de quorum affiche le nombre de confirmations reçues.
            <span className="flex items-center gap-1.5 mt-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Jauge verte : le quorum est atteint avec les confirmations</span>
            <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Jauge orange : le quorum est incertain, des membres n&apos;ont pas répondu</span>
            <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Jauge rouge : trop d&apos;absences déclarées, le quorum risque de ne pas être atteint</span>
          </SubStep>

          <SubStep num="1.3">
            Consultez l&apos;ordre du jour et les documents joints dans l&apos;onglet{' '}
            <span className="font-medium text-foreground">Ordre du jour</span> de la fiche séance.
            Préparez vos remarques pour chaque point si nécessaire.
          </SubStep>

          <Astuce>
            Si le quorum ne sera probablement pas atteint, prévenez le gestionnaire pour qu&apos;il envisage une reconvocation (à 3 jours minimum).
          </Astuce>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 2 — Pendant la séance */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <StepNumber n={2} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MonitorPlay className="h-5 w-5 text-primary" />
              Pendant la séance — Présider
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">

          {/* Vue président */}
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Votre tablette — Vue président
            </p>
            <p className="text-sm text-muted-foreground">
              Si vous avez une tablette à votre place, elle affiche une vue spéciale pour vous :
            </p>
            <div className="text-sm text-muted-foreground space-y-1 ml-2">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Le point en cours de discussion (titre et documents)</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Le quorum en temps réel (mis à jour si un membre quitte la salle)</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Les demandes de parole des élus</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Un bouton « Demander le vote » quand le débat est terminé</span>
            </div>
          </div>

          <SubStep num="2.1">
            <span className="font-medium text-foreground">Ouvrir la séance</span> : le gestionnaire ouvre la séance depuis son écran.
            Le quorum est vérifié automatiquement. Si le quorum n&apos;est pas atteint, vous décidez :
            attendre d&apos;autres arrivées ou procéder à une reconvocation.
          </SubStep>

          <SubStep num="2.2">
            <span className="font-medium text-foreground">Conduire les débats</span> : pour chaque point, présentez le sujet, donnez la parole aux élus, puis passez au vote.
          </SubStep>

          {/* Demandes de parole */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Hand className="h-4 w-4 text-primary" />
              Demandes de parole
            </p>
            <p className="text-sm text-muted-foreground">
              Les élus peuvent appuyer sur « Demander la parole » depuis leur tablette.
              Vous voyez la liste des demandes en temps réel sur votre tablette.
              Donnez la parole dans l&apos;ordre ou comme vous le souhaitez.
            </p>
          </div>

          <SubStep num="2.3">
            <span className="font-medium text-foreground">Demander le vote</span> : quand vous estimez que le débat est terminé,
            appuyez sur « Demander le vote » sur votre tablette.
            Le gestionnaire lance alors le vote depuis son écran.
          </SubStep>

          <SubStep num="2.4">
            <span className="font-medium text-foreground">Voix prépondérante</span> : en cas d&apos;égalité des voix, votre voix départage le résultat
            (si cette option est activée pour l&apos;instance). Le système applique automatiquement cette règle.
          </SubStep>

          <SubStep num="2.5">
            <span className="font-medium text-foreground">Huis clos</span> : vous pouvez demander le huis clos pour un point sensible.
            Le gestionnaire l&apos;active depuis son écran. Le public est prié de quitter la salle et l&apos;écran public est neutralisé.
          </SubStep>

          <Astuce>
            Vous n&apos;avez pas besoin de compter les votes vous-même. Le système calcule tout automatiquement et affiche le résultat immédiatement.
          </Astuce>

          <ProblemesSolutions items={[
            { probleme: 'Le quorum n\'est plus atteint en cours de séance', solution: 'Un membre a quitté la salle. Attendez qu\'il revienne ou suspendez la séance.' },
            { probleme: 'Un élu veut changer son vote', solution: 'Ce n\'est pas possible une fois le vote enregistré. C\'est la procédure réglementaire.' },
            { probleme: 'Égalité des voix sans voix prépondérante', solution: 'Le point est rejeté. Vérifiez dans Configuration que la voix prépondérante est bien activée pour cette instance.' },
          ]} />
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 3 — Signer le procès-verbal */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <StepNumber n={3} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" />
              Signer le procès-verbal
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <SubStep num="3.1">
            Après la séance, vous recevez un <span className="font-medium text-foreground">email</span> :
            « Le procès-verbal est prêt pour votre signature ». Cliquez le lien dans le mail.
          </SubStep>

          <SubStep num="3.2">
            Vous arrivez sur la page du procès-verbal. <span className="font-medium text-foreground">Relisez attentivement</span> :
            <span className="flex items-center gap-1.5 mt-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Les présences sont-elles correctes ?</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Les résultats de vote sont-ils fidèles ?</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Les discussions sont-elles bien résumées ?</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Les observations éventuelles sont-elles mentionnées ?</span>
          </SubStep>

          <SubStep num="3.3">
            Si tout est correct, cliquez <span className="font-medium text-foreground">Signer le procès-verbal</span>.
            Une confirmation vous est demandée car la signature est définitive.
          </SubStep>

          <SubStep num="3.4">
            Après votre signature, le secrétaire de séance signe à son tour. Une fois les deux signatures apposées, le PV est{' '}
            <span className="font-medium text-foreground">verrouillé définitivement</span>.
          </SubStep>

          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <span>
              <span className="font-medium">Attention :</span> la signature est irréversible. Relisez bien le PV avant de signer.
              Si une erreur est constatée après signature, elle devra être corrigée par rectification en séance suivante.
            </span>
          </div>

          <ProblemesSolutions items={[
            { probleme: 'Je n\'ai pas reçu l\'email de signature', solution: 'Le gestionnaire peut renvoyer la notification depuis l\'écran de finalisation du PV.' },
            { probleme: 'Le PV contient une erreur', solution: 'Signalez-la au gestionnaire avant de signer. Il peut encore corriger le brouillon.' },
          ]} />
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-5 flex items-start gap-3 print:bg-blue-50">
        <Users className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">
            Votre rôle en résumé
          </p>
          <p className="text-sm text-blue-700 mt-0.5">
            Vous présidez la séance, donnez la parole, demandez les votes, et signez le PV.
            Le gestionnaire s&apos;occupe de toute la logistique technique (convocations, émargement, saisie des votes, publication des délibérations).
          </p>
        </div>
      </div>
    </div>
  )
}
