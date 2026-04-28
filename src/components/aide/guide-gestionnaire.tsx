'use client'

import { Clock, Mail, PlayCircle, FileText, BookOpen, Lightbulb, MonitorPlay, AlertTriangle, CheckCircle2, Settings } from 'lucide-react'

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

export function GuideGestionnaire() {
  return (
    <div className="space-y-8 max-w-3xl" id="guide-gestionnaire">
      {/* Intro */}
      <div className="space-y-2">
        <p className="text-base text-muted-foreground leading-relaxed">
          Vous gérez les séances de votre institution.
          Voici les <strong className="text-foreground">5 actions</strong> que vous ferez le plus souvent, expliquées pas à pas.
        </p>
        <p className="text-sm text-muted-foreground">
          Pas de panique si vous débutez : chaque écran vous guide avec des étapes numérotées et des messages explicatifs.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 1 — Créer une séance */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
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
        <div className="ml-[52px] space-y-3">
          <SubStep num="1.1">
            Allez dans <span className="font-medium text-foreground">Séances</span> puis cliquez le bouton{' '}
            <span className="font-medium text-foreground">+ Nouvelle séance</span> en haut à droite.
          </SubStep>

          <SubStep num="1.2">
            <span className="font-medium text-foreground">Étape 1 — Choisissez l&apos;instance</span>
            <br />
            Cliquez sur la carte de votre instance (ex : Conseil municipal).
            Si vous n&apos;avez qu&apos;une seule instance, elle est automatiquement sélectionnée et vous passez directement à l&apos;étape suivante.
          </SubStep>

          <SubStep num="1.3">
            <span className="font-medium text-foreground">Étape 2 — Date et lieu</span>
            <br />
            <span className="flex items-center gap-1.5 mt-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> La date est pré-remplie à J+7 — modifiez si nécessaire</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> L&apos;heure est à 14h00 par défaut</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Choisissez le mode : présentiel, hybride ou visioconférence</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Le président et le secrétaire sont hérités du bureau si déjà configurés</span>
          </SubStep>

          <SubStep num="1.4">
            <span className="font-medium text-foreground">Étape 3 — Ordre du jour</span>
            <br />
            Les points standards sont déjà ajoutés (Approbation du PV + Questions diverses).
            Cliquez <span className="font-medium text-foreground">+ Ajouter un point</span> pour chaque sujet.
            Pour chaque point, renseignez : titre, type (Délibération, Information, Élection), rapporteur, et majorité requise.
          </SubStep>

          <Astuce>
            Cliquez « Copier depuis la dernière séance » pour reprendre l&apos;ordre du jour de la séance précédente — tous les titres, rapporteurs et descriptions sont recopiés.
          </Astuce>

          <SubStep num="1.5">
            <span className="font-medium text-foreground">Étape 4 — Convocataires</span>
            <br />
            Tous les membres de l&apos;instance sont pré-cochés. Décochez ceux qui ne doivent pas être convoqués.
            Vous pouvez aussi ajouter des membres qui ne font pas partie de l&apos;instance (invités).
            Utilisez la barre de recherche si la liste est longue.
          </SubStep>

          <SubStep num="1.6">
            <span className="font-medium text-foreground">Étape 5 — Récapitulatif et envoi</span>
            <br />
            Vérifiez le résumé complet. Activez <span className="font-medium text-foreground">Envoyer les convocations maintenant</span> (recommandé) puis cliquez{' '}
            <span className="font-medium text-foreground">Créer la séance et envoyer</span>.
            Si vous préférez envoyer plus tard, désactivez le toggle : la séance sera créée en brouillon.
          </SubStep>

          <ProblemesSolutions items={[
            { probleme: '"Impossible de convoquer"', solution: 'Vérifiez que le président est désigné à l\'étape 2.' },
            { probleme: 'Pas de membres à sélectionner', solution: 'Allez dans Configuration puis Instance puis ajoutez des membres.' },
            { probleme: 'La date est en rouge', solution: 'Le délai légal de convocation (5 jours francs) n\'est pas respecté. Activez le mode urgence si nécessaire.' },
          ]} />
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 2 — Envoyer les convocations */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
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
        <div className="ml-[52px] space-y-3">
          <SubStep num="2.1">
            Ouvrez la <span className="font-medium text-foreground">fiche séance</span> (cliquez sur la séance dans la liste).
            Si les convocations n&apos;ont pas été envoyées à la création, cliquez le bouton{' '}
            <span className="font-medium text-foreground">Envoyer les convocations</span> dans la barre de préparation.
          </SubStep>

          <SubStep num="2.2">
            Chaque membre reçoit un email contenant :
            <span className="flex items-center gap-1.5 mt-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> L&apos;ordre du jour complet</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Un QR code personnel pour l&apos;émargement le jour J</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Un bouton « Confirmer ma présence »</span>
          </SubStep>

          <SubStep num="2.3">
            Suivez les confirmations dans l&apos;onglet <span className="font-medium text-foreground">Convocations</span> :
            les compteurs en haut indiquent combien ont confirmé, combien sont en attente, et combien ont signalé un problème.
          </SubStep>

          <Astuce>
            Le statut de chaque convocation se met à jour automatiquement (envoyé, lu, confirmé). Pas besoin de rafraîchir la page.
          </Astuce>

          <SubStep num="2.4">
            Pour renvoyer une convocation à un membre spécifique : dans l&apos;onglet Convocations, cliquez sur l&apos;icône{' '}
            <span className="font-medium text-foreground">Renvoyer</span> à côté du nom du membre.
          </SubStep>

          <Astuce>
            Besoin d&apos;imprimer ? Cliquez l&apos;icône PDF à côté du nom pour télécharger la convocation individuelle, ou utilisez « Toutes les convocations » pour un PDF groupé.
          </Astuce>

          <ProblemesSolutions items={[
            { probleme: 'Un membre n\'a pas reçu l\'email', solution: 'Vérifiez son adresse dans Membres. Puis cliquez Renvoyer.' },
            { probleme: 'Le bouton Envoyer est grisé', solution: 'Il manque probablement le président de séance. Désignez-le dans la section Bureau.' },
            { probleme: 'Erreur d\'envoi en rouge', solution: 'L\'adresse email est invalide. Corrigez-la dans la fiche du membre.' },
          ]} />
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 3 — Gérer la séance en direct */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
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
        <div className="ml-[52px] space-y-3">
          <SubStep num="3.1">
            Sur la fiche séance, cliquez <span className="font-medium text-foreground">Ouvrir la séance</span>.
            Le système vérifie automatiquement le quorum (nombre minimum de membres présents).
            Si le quorum n&apos;est pas atteint, vous pouvez proposer une reconvocation.
          </SubStep>

          <SubStep num="3.2">
            Le <span className="font-medium text-foreground">conducteur de séance</span> s&apos;ouvre.
            C&apos;est votre tableau de bord en temps réel :
            <span className="flex items-center gap-1.5 mt-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Jauge de quorum en haut (vert = OK, rouge = attention)</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Liste des points de l&apos;ordre du jour à gauche</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Détail du point en cours au centre</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Actions (vote, récusation, huis clos) à droite</span>
          </SubStep>

          <SubStep num="3.3">
            <span className="font-medium text-foreground">Naviguer entre les points</span> : cliquez sur un point dans la liste de gauche, ou utilisez les boutons Précédent / Suivant.
          </SubStep>

          <SubStep num="3.4">
            <span className="font-medium text-foreground">Lancer un vote à main levée</span> : cliquez{' '}
            <span className="font-medium text-foreground">Ouvrir le vote</span>. Saisissez le nombre de voix Contre et Abstentions.
            Le système calcule automatiquement les Pour (total des présents moins les Contre et Abstentions).
            Si tous ont voté Pour, l&apos;unanimité est détectée automatiquement.
          </SubStep>

          <SubStep num="3.5">
            <span className="font-medium text-foreground">Lancer un vote à bulletin secret</span> : changez le mode de vote avant d&apos;ouvrir.
            Les élus votent sur leur tablette. Le résultat s&apos;affiche automatiquement à la clôture.
          </SubStep>

          <SubStep num="3.6">
            <span className="font-medium text-foreground">Récusation (conflit d&apos;intérêt)</span> : si un élu a un intérêt personnel dans un sujet,
            cliquez « Ajouter une récusation ». L&apos;élu est retiré du vote et le quorum est recalculé.
          </SubStep>

          <Astuce>
            La formule officielle du PV est générée automatiquement après chaque vote. Vous la retrouverez dans le procès-verbal.
          </Astuce>

          <ProblemesSolutions items={[
            { probleme: 'Le bouton de vote est grisé', solution: 'Vérifiez que le quorum est atteint et que le point est de type Délibération.' },
            { probleme: 'Un élu a quitté la salle', solution: 'Marquez-le comme absent dans la gestion des présences. Le quorum sera recalculé.' },
            { probleme: 'La tablette d\'un élu ne fonctionne pas', solution: 'Enregistrez son vote manuellement depuis votre écran (mode assisté).' },
          ]} />
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 4 — Rédiger le procès-verbal */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
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
        <div className="ml-[52px] space-y-3">
          <SubStep num="4.1">
            Ouvrez la fiche séance puis cliquez l&apos;onglet{' '}
            <span className="font-medium text-foreground">Procès-verbal</span> puis{' '}
            <span className="font-medium text-foreground">Générer le brouillon</span>.
            Le PV est pré-rempli avec les présences, les résultats de vote et les formules officielles.
          </SubStep>

          <SubStep num="4.2">
            <span className="font-medium text-foreground">Complétez les discussions</span> : pour chaque point, résumez en quelques lignes ce qui a été dit.
            Si un point a été adopté à l&apos;unanimité sans discussion, tout est déjà rempli — passez au suivant.
          </SubStep>

          <SubStep num="4.3">
            Utilisez le bouton <span className="font-medium text-foreground">Reformuler avec l&apos;IA</span> pour transformer vos notes en texte officiel.
            L&apos;IA reformule dans un style juridique formel adapté aux PV. Vos données sont anonymisées avant traitement.
          </SubStep>

          <SubStep num="4.4">
            <span className="font-medium text-foreground">Relisez</span> l&apos;ensemble, vérifiez les observations et les mentions légales, puis passez à l&apos;étape de finalisation.
          </SubStep>

          <SubStep num="4.5">
            Cliquez <span className="font-medium text-foreground">Finaliser et envoyer pour signature</span>.
            Le président et le secrétaire reçoivent un email avec un lien pour signer.
            Après les deux signatures, le PV est verrouillé définitivement.
          </SubStep>

          <Astuce>
            Les avertissements intelligents vous signalent les incohérences : discussion vide sur un point rejeté, observation manquante, etc. C&apos;est normal — corrigez si nécessaire.
          </Astuce>

          <ProblemesSolutions items={[
            { probleme: 'Le PV ne se génère pas', solution: 'Vérifiez que la séance a bien été clôturée et qu\'au moins un vote a été enregistré.' },
            { probleme: '"Le PV est verrouillé"', solution: 'C\'est normal après les deux signatures. Pour une correction, elle se fera en séance suivante.' },
            { probleme: 'Le président n\'a pas reçu l\'email de signature', solution: 'Renvoyez la notification depuis l\'écran de finalisation.' },
          ]} />
        </div>
      </div>

      <hr className="border-dashed" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Étape 5 — Publier les délibérations */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
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
        <div className="ml-[52px] space-y-3">
          <SubStep num="5.1">
            Allez dans <span className="font-medium text-foreground">Délibérations</span> depuis le menu principal.
            Vous voyez la liste de toutes les délibérations issues de vos séances, classées par statut.
          </SubStep>

          <SubStep num="5.2">
            Pour chaque délibération en brouillon, cliquez <span className="font-medium text-foreground">Publier</span>.
            Le numéro officiel (ex : DEL-2024-0042) est attribué automatiquement au moment de la publication, pas avant.
          </SubStep>

          <SubStep num="5.3">
            <span className="font-medium text-foreground">Affichage en mairie</span> : après la publication, marquez la délibération comme affichée.
            Un avertissement s&apos;affiche si plus de 24 heures se sont écoulées sans affichage.
          </SubStep>

          <SubStep num="5.4">
            <span className="font-medium text-foreground">Transmission en préfecture</span> : marquez la délibération comme transmise.
            Un avertissement s&apos;affiche si plus de 15 jours se sont écoulés sans transmission.
            Exportez le PDF pour l&apos;envoyer au contrôle de légalité.
          </SubStep>

          <Astuce>
            Utilisez les filtres (par statut, par instance, par date) pour retrouver rapidement vos délibérations. L&apos;export groupé en PDF est disponible en haut de la liste.
          </Astuce>

          <ProblemesSolutions items={[
            { probleme: 'Je ne vois pas la délibération', solution: 'Vérifiez que le point était de type Délibération et que le vote a bien été enregistré.' },
            { probleme: 'Le numéro est incorrect', solution: 'Le numéro est attribué dans l\'ordre de publication. Pour corriger, annulez et republiez.' },
          ]} />
        </div>
      </div>

      {/* Bonus : configuration initiale */}
      <hr className="border-dashed" />

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-muted text-muted-foreground font-bold text-base shrink-0">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Configuration initiale (une seule fois)
            </h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full mt-1">
              <Clock className="h-3 w-3" /> 15 minutes la première fois
            </span>
          </div>
        </div>
        <div className="ml-[52px] space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Avant votre première séance, configurez votre institution dans{' '}
            <span className="font-medium text-foreground">Configuration</span> :
          </p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Informations de l&apos;institution (nom, SIREN, adresse)</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Création de vos instances (Conseil municipal, commissions...)</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Ajout des membres (import CSV possible)</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Affectation des membres aux instances</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Désignation du bureau (président, secrétaire) pour chaque instance</span>
          </div>
          <Astuce>
            C&apos;est fait une seule fois. Ensuite, tout est hérité automatiquement à chaque nouvelle séance.
          </Astuce>
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
