'use client'

import { Clock, Mail, Smartphone, CheckCircle, CheckCircle2, Lightbulb, AlertTriangle, QrCode, Hand, UserX } from 'lucide-react'

function Astuce({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800 print:bg-blue-50 print:border print:border-blue-200">
      <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
      <span>{children}</span>
    </div>
  )
}

function PasDePanique({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 print:bg-emerald-50 print:border print:border-emerald-200">
      <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
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

export function GuideElu() {
  return (
    <div className="space-y-8 max-w-3xl" id="guide-elu">
      {/* Intro */}
      <div className="space-y-2">
        <p className="text-base text-muted-foreground leading-relaxed">
          Vous participez aux séances et votez.
          Voici tout ce que vous devez savoir, pas à pas. <strong className="text-foreground">C&apos;est très simple.</strong>
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
              <Mail className="h-5 w-5 text-primary" />
              Avant la séance — Votre convocation
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <SubStep num="1.1">
            Vous recevez un <span className="font-medium text-foreground">email de convocation</span> quelques jours avant la séance.
            L&apos;objet ressemble à : « Convocation — Conseil municipal du 15 mai 2025 ».
            Vérifiez aussi vos spams si vous ne le trouvez pas.
          </SubStep>

          <SubStep num="1.2">
            Dans l&apos;email, vous trouverez :
            <span className="flex items-center gap-1.5 mt-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> La date, l&apos;heure et le lieu</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> L&apos;ordre du jour complet (tous les sujets qui seront traités)</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Les documents annexes (rapports, budgets, projets)</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Votre <span className="font-medium text-foreground">QR code personnel</span> (important : gardez-le)</span>
          </SubStep>

          <SubStep num="1.3">
            Cliquez le bouton <span className="font-medium text-foreground">Confirmer ma présence</span> dans l&apos;email pour prévenir le gestionnaire que vous serez là.
            Ce n&apos;est pas obligatoire, mais cela aide à prévoir le quorum.
          </SubStep>

          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              À quoi sert le QR code ?
            </p>
            <p className="text-sm text-muted-foreground">
              C&apos;est votre « carte d&apos;entrée » numérique. Le jour de la séance, vous le présentez à l&apos;entrée de la salle pour prouver votre présence (émargement).
              Il est unique, à usage unique, et lié à cette séance uniquement.
            </p>
          </div>

          <Astuce>
            Vous pouvez aussi consulter votre convocation et préparer vos notes directement dans l&apos;application : Séances puis cliquez sur la séance concernée.
          </Astuce>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 2 — Le jour de la séance */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
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

          {/* Émargement */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              À l&apos;entrée de la salle — Émargement
            </p>
            <p className="text-sm text-muted-foreground">
              Présentez votre QR code (sur votre téléphone ou imprimé) devant le scanner à l&apos;entrée.
              Le système enregistre votre présence automatiquement.
            </p>
            <p className="text-sm text-muted-foreground italic">
              Si vous avez oublié votre QR code : pas de panique, le gestionnaire peut vous identifier visuellement et valider votre présence manuellement.
            </p>
          </div>

          {/* Tablette */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">À votre place — La tablette</p>
            <p className="text-sm text-muted-foreground">
              Une tablette est posée à votre place. Elle affiche en temps réel :
            </p>
            <div className="text-sm text-muted-foreground space-y-1 ml-2">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Le point de l&apos;ordre du jour en cours de discussion</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Les documents associés à ce point</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Les boutons de vote quand un vote est ouvert</span>
            </div>
            <p className="text-sm text-muted-foreground italic">
              Les tablettes ne sont pas nominatives : vous pouvez vous asseoir où vous voulez.
            </p>
          </div>

          {/* Vote */}
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Hand className="h-4 w-4 text-primary" />
              Pour voter — 3 boutons, c&apos;est tout
            </p>
            <p className="text-sm text-muted-foreground">
              Quand le président demande le vote, 3 gros boutons apparaissent sur votre tablette :
            </p>
            <div className="flex items-center gap-3 py-2">
              <span className="inline-flex items-center justify-center font-bold text-emerald-700 bg-emerald-100 border-2 border-emerald-300 px-5 py-2.5 rounded-xl text-sm">
                POUR
              </span>
              <span className="inline-flex items-center justify-center font-bold text-red-700 bg-red-100 border-2 border-red-300 px-5 py-2.5 rounded-xl text-sm">
                CONTRE
              </span>
              <span className="inline-flex items-center justify-center font-bold text-amber-700 bg-amber-100 border-2 border-amber-300 px-5 py-2.5 rounded-xl text-sm">
                ABSTENTION
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Appuyez sur votre choix. Un message de confirmation s&apos;affiche : « Votre vote a été enregistré ».
              Vous ne pouvez pas modifier votre vote après avoir appuyé.
            </p>
          </div>

          <PasDePanique>
            C&apos;est tout. Vous n&apos;avez rien d&apos;autre à faire sur la tablette. Le gestionnaire s&apos;occupe de tout le reste.
          </PasDePanique>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 3 — Après la séance */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <StepNumber n={3} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Après la séance
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les résultats des votes sont consultables à tout moment dans l&apos;application : <span className="font-medium text-foreground">Séances</span> puis cliquez sur la séance.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Le procès-verbal sera rédigé par le gestionnaire et le secrétaire de séance, puis signé par le président.
          </p>
          <PasDePanique>
            Vous n&apos;avez rien à faire après la séance. Les délibérations et le PV sont gérés par le gestionnaire.
          </PasDePanique>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Cas particuliers */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Cas particuliers
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Je suis en retard</p>
            <p className="text-sm text-muted-foreground">
              Présentez votre QR code à l&apos;entrée comme d&apos;habitude. Votre arrivée sera horodatée.
              Si des votes ont déjà eu lieu, vous ne pourrez pas voter rétroactivement, mais vous participerez aux suivants.
              Le quorum sera mis à jour automatiquement.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <UserX className="h-4 w-4 text-amber-500" />
              Je ne peux pas assister à la séance
            </p>
            <p className="text-sm text-muted-foreground">
              Vous pouvez donner <span className="font-medium text-foreground">procuration</span> à un autre membre : il votera à votre place.
              Contactez votre gestionnaire avant la séance pour qu&apos;il enregistre la procuration.
              Chaque membre ne peut recevoir qu&apos;une seule procuration.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Je dois me récuser</p>
            <p className="text-sm text-muted-foreground">
              Si vous avez un intérêt personnel dans un sujet (ex : un marché qui vous concerne), signalez-le au président.
              Le gestionnaire vous enregistrera comme récusé pour ce point : vous ne participerez pas au vote.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">La tablette ne fonctionne pas</p>
            <p className="text-sm text-muted-foreground">
              Prévenez le gestionnaire. Il peut enregistrer votre vote manuellement depuis son écran.
              Votre vote sera tracé normalement dans le système (mode assisté).
            </p>
          </div>
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
            Confirmer sa présence, présenter son QR code, voter quand demandé. Rien de plus.
          </p>
        </div>
      </div>
    </div>
  )
}
