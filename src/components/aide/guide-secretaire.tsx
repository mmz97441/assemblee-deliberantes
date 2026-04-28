'use client'

import { Clock, FileText, PenTool, Wand2, Lightbulb, CheckCircle2, AlertTriangle, Eye, Lock, Sparkles } from 'lucide-react'

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

export function GuideSecretaire() {
  return (
    <div className="space-y-8 max-w-3xl" id="guide-secretaire">
      {/* Intro */}
      <div className="space-y-2">
        <p className="text-base text-muted-foreground leading-relaxed">
          Vous rédigez et signez le procès-verbal après la séance.
          L&apos;application fait 90 % du travail à votre place : tout est pré-rempli.
        </p>
        <p className="text-sm text-muted-foreground">
          Voici le guide pas à pas du PV, de la génération du brouillon jusqu&apos;à la signature finale.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 1 — Générer le brouillon */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <StepNumber n={1} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Étape 1 — Générer le brouillon
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
              <Clock className="h-3 w-3" /> après la séance
            </span>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <SubStep num="1.1">
            Allez dans <span className="font-medium text-foreground">Séances</span> puis cliquez sur votre séance
            puis onglet <span className="font-medium text-foreground">Procès-verbal</span>.
          </SubStep>

          <SubStep num="1.2">
            Cliquez <span className="font-medium text-foreground">Générer le brouillon</span>. Le système crée automatiquement un PV complet avec :
            <span className="flex items-center gap-1.5 mt-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> En-tête officiel (institution, date, heure, lieu)</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Liste des présents, absents, excusés et procurations</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Pour chaque point : titre, résultat du vote, formule légale</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Mentions de clôture</span>
          </SubStep>

          <Astuce>
            Vous pouvez regénérer le brouillon à tout moment si des données ont changé (présences corrigées, par exemple). Le brouillon précédent est écrasé.
          </Astuce>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 2 — Vérifier les présences */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <StepNumber n={2} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Étape 2 — Vérifier les présences
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <SubStep num="2.1">
            L&apos;assistant PV affiche les listes de présences telles qu&apos;enregistrées pendant la séance.
            Vérifiez que les membres sont dans la bonne catégorie (présent, absent, excusé, procuration).
          </SubStep>

          <SubStep num="2.2">
            Le quorum est rappelé. S&apos;il y a eu des changements de présence en cours de séance (arrivée tardive, départ anticipé), ils sont mentionnés.
          </SubStep>

          <Astuce>
            C&apos;est normal que tout soit pré-rempli. Vous n&apos;avez à corriger que les éventuelles erreurs.
          </Astuce>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 3 — Compléter les discussions */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <StepNumber n={3} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Étape 3 — Compléter les discussions
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <SubStep num="3.1">
            Pour chaque point de l&apos;ordre du jour, vous voyez :
            <span className="flex items-center gap-1.5 mt-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Le titre et le rapporteur (pré-rempli)</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Le résultat du vote et la formule légale (pré-rempli)</span>
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 text-amber-500 font-bold text-xs ml-0.5 mr-0.5">?</span> La discussion — c&apos;est ce que vous devez compléter</span>
          </SubStep>

          <SubStep num="3.2">
            Résumez ce qui a été dit pour chaque point. Quelques lignes suffisent.
            Pas besoin d&apos;un compte-rendu mot à mot : un résumé fidèle des échanges.
          </SubStep>

          {/* AI reformulation */}
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Reformuler avec l&apos;IA
            </p>
            <p className="text-sm text-muted-foreground">
              Tapez vos notes comme vous le souhaitez (même en style télégraphique), puis cliquez{' '}
              <span className="font-medium text-foreground">Reformuler avec l&apos;IA</span>.
              L&apos;intelligence artificielle transforme vos notes en texte officiel, dans le style juridique formel adapté aux procès-verbaux.
            </p>
            <p className="text-sm text-muted-foreground italic">
              Exemple : « Le maire explique que la subvention est nécessaire, les élus sont d&apos;accord » devient
              « M. le Maire expose que l&apos;attribution de cette subvention est justifiée par... L&apos;assemblée, après en avoir délibéré... »
            </p>
            <p className="text-sm text-muted-foreground">
              Vos données sont anonymisées avant d&apos;être envoyées à l&apos;IA. Relisez toujours le résultat.
            </p>
          </div>

          <SubStep num="3.3">
            Si un point a été adopté <span className="font-medium text-foreground">à l&apos;unanimité sans discussion</span> :
            passez au suivant, tout est déjà rempli. Rien à ajouter.
          </SubStep>

          {/* Smart warnings */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Les avertissements intelligents
            </p>
            <p className="text-sm text-muted-foreground">
              Le système analyse votre PV et vous signale les incohérences potentielles :
            </p>
            <div className="text-sm text-muted-foreground space-y-1 ml-2">
              <span className="flex items-start gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-red-100 border border-red-300 shrink-0 mt-1" />
                <span><span className="font-medium text-red-700">Rouge</span> : problème probable — discussion vide sur un point rejeté ou controversé</span>
              </span>
              <span className="flex items-start gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-amber-100 border border-amber-300 shrink-0 mt-1" />
                <span><span className="font-medium text-amber-700">Orange</span> : à vérifier — observation manquante ou formulation inhabituelle</span>
              </span>
              <span className="flex items-start gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-blue-100 border border-blue-300 shrink-0 mt-1" />
                <span><span className="font-medium text-blue-700">Bleu</span> : suggestion — l&apos;IA propose une amélioration optionnelle</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground italic">
              C&apos;est normal de voir des avertissements. Ils sont là pour vous aider, pas pour vous bloquer.
            </p>
          </div>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 4 — Observations et relecture */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <StepNumber n={4} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Étape 4 — Observations et relecture
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <SubStep num="4.1">
            Ajoutez les <span className="font-medium text-foreground">observations</span> si nécessaire : incidents de séance, déclarations particulières, mentions spéciales.
          </SubStep>

          <SubStep num="4.2">
            Relisez le PV complet dans l&apos;aperçu. Vérifiez les formules de vote, les noms, les résultats.
          </SubStep>

          <Astuce>
            Utilisez le bouton Imprimer pour une relecture papier si vous préférez. Le PDF est mis en forme automatiquement.
          </Astuce>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 5 — Finaliser et envoyer pour signature */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <StepNumber n={5} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" />
              Étape 5 — Finaliser et envoyer pour signature
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <SubStep num="5.1">
            Cliquez <span className="font-medium text-foreground">Finaliser</span>. Le système envoie un email au président avec un lien pour signer le PV.
          </SubStep>

          <SubStep num="5.2">
            Attendez que le président signe. Vous recevez une notification quand c&apos;est fait.
          </SubStep>

          <SubStep num="5.3">
            Signez à votre tour en cliquant <span className="font-medium text-foreground">Signer le procès-verbal</span>.
            Une confirmation vous est demandée.
          </SubStep>
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 6 — PV verrouillé */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <StepNumber n={6} />
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Étape 6 — PV verrouillé
            </h3>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Après les deux signatures (président + secrétaire), le PV est <span className="font-medium text-foreground">verrouillé définitivement</span>.
            Plus aucune modification n&apos;est possible. C&apos;est conforme à la réglementation.
          </p>
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 mt-1">
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
              PV verrouillé — Exportez en PDF si besoin
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Si une erreur est constatée après verrouillage, elle devra être corrigée par rectification en début de séance suivante
            (dans le cadre de l&apos;approbation du PV de la séance précédente).
          </p>
        </div>
      </div>

      <ProblemesSolutions items={[
        { probleme: 'Le PV ne se génère pas', solution: 'Vérifiez que la séance a bien été clôturée.' },
        { probleme: 'L\'IA reformule mal', solution: 'C\'est normal parfois. Ajustez le texte manuellement. L\'IA est une aide, pas un rédacteur final.' },
        { probleme: 'Le président ne reçoit pas l\'email de signature', solution: 'Renvoyez la notification depuis l\'écran de finalisation.' },
        { probleme: '"Le PV est verrouillé"', solution: 'C\'est normal après les deux signatures. La correction se fera en séance suivante.' },
      ]} />

      {/* Temps gagné */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-5 flex items-start gap-3 print:bg-emerald-50">
        <Clock className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Temps gagné : le PV est pré-rempli au lieu de rédiger de zéro
          </p>
          <p className="text-sm text-emerald-700 mt-0.5">
            Présences, résultats de vote et formules légales sont déjà insérés automatiquement.
            Vous n&apos;avez qu&apos;à compléter les discussions et relire.
          </p>
        </div>
      </div>
    </div>
  )
}
