'use client'

import { useState, useMemo } from 'react'
import {
  Search,
  Building2,
  Vote,
  UserCog,
  PenTool,
  ChevronDown,
  ChevronUp,
  Printer,
  ArrowLeft,
  HelpCircle,
} from 'lucide-react'
import { GuideGestionnaire } from '@/components/aide/guide-gestionnaire'
import { GuideElu } from '@/components/aide/guide-elu'
import { GuidePresident } from '@/components/aide/guide-president'
import { GuideSecretaire } from '@/components/aide/guide-secretaire'

// ─── Types ──────────────────────────────────────────────────────────────────

type RoleKey = 'gestionnaire' | 'elu' | 'president' | 'secretaire'

interface RoleCard {
  key: RoleKey
  icon: React.ElementType
  label: string
  sublabel: string
  color: string
  bgColor: string
  borderColor: string
}

interface FaqItem {
  question: string
  answer: string
  keywords: string[]
}

// ─── Data ───────────────────────────────────────────────────────────────────

const ROLE_CARDS: RoleCard[] = [
  {
    key: 'gestionnaire',
    icon: Building2,
    label: 'Gestionnaire',
    sublabel: 'Secrétaire de mairie',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    borderColor: 'border-blue-200 hover:border-blue-300',
  },
  {
    key: 'elu',
    icon: Vote,
    label: 'Élu / Membre votant',
    sublabel: 'Conseiller municipal, délégué...',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100',
    borderColor: 'border-emerald-200 hover:border-emerald-300',
  },
  {
    key: 'president',
    icon: UserCog,
    label: 'Président(e)',
    sublabel: 'Maire, président de commission...',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
    borderColor: 'border-purple-200 hover:border-purple-300',
  },
  {
    key: 'secretaire',
    icon: PenTool,
    label: 'Secrétaire de séance',
    sublabel: 'Rédaction et signature du PV',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 hover:bg-amber-100',
    borderColor: 'border-amber-200 hover:border-amber-300',
  },
]

const ROLE_TITLES: Record<RoleKey, string> = {
  gestionnaire: 'Guide rapide — Gestionnaire',
  elu: 'Guide rapide — Élu / Membre votant',
  president: 'Guide rapide — Président(e)',
  secretaire: 'Guide rapide — Secrétaire de séance',
}

const ROLE_EMOJIS: Record<RoleKey, string> = {
  gestionnaire: '🏛️',
  elu: '🗳️',
  president: '👔',
  secretaire: '✍️',
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "J'ai oublié mon mot de passe",
    answer: "Sur la page de connexion, cliquez « Mot de passe oublié ? » puis entrez votre adresse email. Vous recevrez un lien pour le réinitialiser.",
    keywords: ['mot de passe', 'oublié', 'connexion', 'réinitialiser', 'perdu'],
  },
  {
    question: 'Je ne vois pas ma séance',
    answer: "Vérifiez que vous êtes bien convoqué(e) pour cette séance. Si vous pensez devoir y participer, contactez votre gestionnaire (secrétaire de mairie) qui pourra vous ajouter à la liste des convocataires.",
    keywords: ['séance', 'voir', 'absente', 'manquante', 'convocation', 'introuvable'],
  },
  {
    question: 'Le vote ne fonctionne pas',
    answer: "Le vote ne peut être lancé que par le gestionnaire, et uniquement si le quorum est atteint (assez de membres présents). Si le bouton de vote est grisé, c'est que ces conditions ne sont pas encore remplies.",
    keywords: ['vote', 'fonctionne', 'bouton', 'grisé', 'quorum', 'impossible'],
  },
  {
    question: 'Comment imprimer la convocation ?',
    answer: "Sur la fiche séance, allez dans l'onglet « Convocations ». Cliquez sur l'icône PDF à côté du nom du membre pour télécharger sa convocation individuelle, ou utilisez le bouton « Toutes les convocations » pour un PDF groupé.",
    keywords: ['imprimer', 'convocation', 'PDF', 'papier', 'télécharger'],
  },
  {
    question: "Comment accéder à l'écran public ?",
    answer: "Le gestionnaire peut copier le lien depuis la fiche séance : menu « Actions » → « Copier le lien écran public ». Ce lien peut être ouvert sur un vidéoprojecteur pour que le public suive la séance.",
    keywords: ['écran', 'public', 'vidéoprojecteur', 'affichage', 'lien'],
  },
  {
    question: 'Le PV est bloqué, je ne peux plus modifier',
    answer: "Le procès-verbal est verrouillé après les deux signatures (président + secrétaire). C'est normal et conforme à la réglementation : un PV signé ne peut plus être modifié. Si une erreur doit être corrigée, elle fera l'objet d'une rectification en séance suivante.",
    keywords: ['PV', 'bloqué', 'modifier', 'verrouillé', 'signé', 'procès-verbal'],
  },
  {
    question: 'Comment changer le président pour une séance ?',
    answer: "Tant que la séance est en brouillon : cliquez sur « Non désigné » dans la section président de la fiche séance. Après l'envoi des convocations, le président ne peut plus être modifié.",
    keywords: ['président', 'changer', 'modifier', 'désigner', 'remplacer'],
  },
  {
    question: 'Comment donner procuration ?',
    answer: "Si vous ne pouvez pas assister à la séance, contactez votre gestionnaire avant la séance. Il enregistrera votre procuration : vous désignez un autre membre qui votera à votre place. Chaque membre ne peut détenir qu'une seule procuration.",
    keywords: ['procuration', 'absent', 'déléguer', 'mandat', 'représenter'],
  },
  {
    question: "Que faire si la tablette ne fonctionne pas ?",
    answer: "Prévenez le gestionnaire. Il peut enregistrer votre vote manuellement depuis son écran (mode assisté). Votre vote sera tracé normalement dans le système.",
    keywords: ['tablette', 'panne', 'marche pas', 'écran', 'bloquée'],
  },
  {
    question: "Comment exporter les délibérations ?",
    answer: "Dans la section « Délibérations », cliquez sur la délibération souhaitée puis sur « Exporter en PDF ». Vous pouvez aussi exporter un lot de délibérations via le bouton « Exporter » en haut de la liste.",
    keywords: ['exporter', 'délibération', 'PDF', 'télécharger', 'document'],
  },
]

// ─── Component ──────────────────────────────────────────────────────────────

export default function AidePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  // Filter FAQ based on search
  const filteredFaq = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_ITEMS
    const query = searchQuery.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return FAQ_ITEMS.filter((item) => {
      const searchable = [item.question, item.answer, ...item.keywords]
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
      return searchable.includes(query)
    })
  }, [searchQuery])

  // Match role cards too
  const matchingRoles = useMemo(() => {
    if (!searchQuery.trim()) return ROLE_CARDS
    const query = searchQuery.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return ROLE_CARDS.filter((card) => {
      const searchable = [card.label, card.sublabel]
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
      return searchable.includes(query)
    })
  }, [searchQuery])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-enter">

        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className="text-center space-y-4 mb-10 print:mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 text-primary mb-2">
            <HelpCircle className="h-7 w-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            {"Centre d'aide"}
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            {"Trouvez rapidement comment utiliser l'application. Choisissez votre rôle ou cherchez une question."}
          </p>

          {/* Search bar */}
          <div className="relative max-w-md mx-auto mt-6 print:hidden">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher une question..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-xl border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              aria-label="Rechercher dans le centre d'aide"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
                title="Effacer la recherche"
              >
                Effacer
              </button>
            )}
          </div>
        </div>

        {/* ─── Role cards ─────────────────────────────────────────────── */}
        {!selectedRole && (
          <section className="mb-12 print:mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4 print:text-xl">
              {"Quel est votre rôle ?"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-in">
              {matchingRoles.map((card) => {
                const Icon = card.icon
                return (
                  <button
                    key={card.key}
                    onClick={() => setSelectedRole(card.key)}
                    className={`flex items-start gap-4 p-5 rounded-xl border text-left transition-all duration-200 cursor-pointer min-h-[88px] ${card.bgColor} ${card.borderColor}`}
                    title={`Voir le guide pour ${card.label}`}
                  >
                    <div className={`flex items-center justify-center h-11 w-11 rounded-xl bg-white/80 shrink-0 ${card.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${card.color}`}>
                        {ROLE_EMOJIS[card.key]} {card.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.sublabel}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {matchingRoles.length === 0 && searchQuery && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {"Aucun rôle ne correspond à votre recherche."}
              </p>
            )}
          </section>
        )}

        {/* ─── Selected role guide ────────────────────────────────────── */}
        {selectedRole && (
          <section className="mb-12 print:mb-8">
            <div className="flex items-center justify-between mb-6 print:hidden">
              <button
                onClick={() => setSelectedRole(null)}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-3 -ml-3 rounded-lg hover:bg-muted/60"
                title="Retour au choix du rôle"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-3 rounded-lg hover:bg-muted/60"
                title="Imprimer ce guide"
              >
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <span>{ROLE_EMOJIS[selectedRole]}</span>
              {ROLE_TITLES[selectedRole]}
            </h2>

            {selectedRole === 'gestionnaire' && <GuideGestionnaire />}
            {selectedRole === 'elu' && <GuideElu />}
            {selectedRole === 'president' && <GuidePresident />}
            {selectedRole === 'secretaire' && <GuideSecretaire />}
          </section>
        )}

        {/* ─── FAQ ────────────────────────────────────────────────────── */}
        <section className="print:break-before-page">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Questions fréquentes
            </h2>
            {searchQuery && filteredFaq.length !== FAQ_ITEMS.length && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {filteredFaq.length} résultat{filteredFaq.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {filteredFaq.map((item, index) => {
              const isExpanded = expandedFaq === index
              return (
                <div
                  key={index}
                  className="rounded-xl border bg-card overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setExpandedFaq(isExpanded ? null : index)}
                    className="flex items-center justify-between w-full px-5 py-4 text-left min-h-[56px] hover:bg-muted/30 transition-colors"
                    aria-expanded={isExpanded}
                    title={isExpanded ? 'Fermer la réponse' : 'Voir la réponse'}
                  >
                    <span className="text-sm font-medium text-foreground pr-4">
                      {item.question}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-dashed mx-3 pt-3">
                      {item.answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {filteredFaq.length === 0 && searchQuery && (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground mb-2">
                {"Aucun résultat pour « "}{searchQuery}{" »."}
              </p>
              <p className="text-xs text-muted-foreground">
                {"Essayez avec d'autres mots-clés ou contactez votre gestionnaire."}
              </p>
            </div>
          )}
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────── */}
        <footer className="mt-16 pt-8 border-t text-center print:hidden">
          <p className="text-sm text-muted-foreground">
            {"Vous ne trouvez pas la réponse ? Contactez votre gestionnaire (secrétaire de mairie) ou écrivez à "}
            <span className="font-medium text-foreground">support@assemblee-deliberantes.fr</span>
          </p>
        </footer>

      </div>
    </div>
  )
}
