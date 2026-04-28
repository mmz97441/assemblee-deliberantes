'use client'

import { useState, useMemo } from 'react'
import { Search, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'

interface GlossaryEntry {
  terme: string
  definition: string
  reference?: string
  keywords: string[]
}

const GLOSSAIRE_ENTRIES: GlossaryEntry[] = [
  {
    terme: 'Quorum',
    definition:
      'Nombre minimum de membres présents pour que les votes soient valables. En règle générale, la majorité des membres en exercice doit être présente. Si le quorum n\'est pas atteint, la séance ne peut pas délibérer et une reconvocation est nécessaire.',
    reference: 'CGCT L2121-17',
    keywords: ['quorum', 'minimum', 'présents', 'valable', 'nombre'],
  },
  {
    terme: 'Procuration',
    definition:
      'Un membre absent confie son droit de vote à un membre présent. Le mandataire (celui qui reçoit la procuration) vote à la place du mandant (celui qui la donne). Chaque membre ne peut détenir qu\'une seule procuration.',
    reference: 'CGCT L2121-20',
    keywords: ['procuration', 'absent', 'mandataire', 'mandant', 'déléguer'],
  },
  {
    terme: 'Voix prépondérante',
    definition:
      'En cas d\'égalité des voix lors d\'un vote, la voix du président de séance départage le résultat. Cette règle doit être activée dans la configuration de l\'instance. Elle ne s\'applique pas aux votes à bulletin secret.',
    reference: 'CGCT L2121-22',
    keywords: ['voix', 'prépondérante', 'égalité', 'président', 'départage'],
  },
  {
    terme: 'Majorité simple',
    definition:
      'Plus de voix « pour » que de voix « contre », sans tenir compte des abstentions. C\'est le mode de scrutin le plus courant pour les délibérations ordinaires.',
    keywords: ['majorité', 'simple', 'pour', 'contre', 'abstention'],
  },
  {
    terme: 'Majorité absolue',
    definition:
      'Plus de la moitié de tous les votants, y compris les abstentions. Par exemple, pour 20 votants, il faut au moins 11 voix « pour ». Requise pour certaines décisions importantes.',
    keywords: ['majorité', 'absolue', 'moitié', 'votants', 'abstention'],
  },
  {
    terme: 'Huis clos',
    definition:
      'Séance fermée au public. Les débats sont confidentiels et ne figurent pas dans le compte-rendu public. Le huis clos peut être demandé par le président ou voté par l\'assemblée.',
    keywords: ['huis', 'clos', 'public', 'confidentiel', 'fermé'],
  },
  {
    terme: 'Délibération',
    definition:
      'Acte juridique résultant d\'un vote de l\'assemblée. La délibération est publiée, affichée en mairie et transmise à la préfecture pour le contrôle de légalité. Elle devient exécutoire après transmission.',
    keywords: ['délibération', 'acte', 'juridique', 'vote', 'publier'],
  },
  {
    terme: 'Reconvocation',
    definition:
      'Nouvelle convocation envoyée après un défaut de quorum (pas assez de membres présents). La reconvocation doit respecter un délai minimum de 3 jours. Lors de la séance reconvoquée, il n\'y a plus de condition de quorum.',
    reference: 'CGCT L2121-17',
    keywords: ['reconvocation', 'quorum', 'défaut', 'nouvelle', 'convocation'],
  },
  {
    terme: 'Émargement',
    definition:
      'Signature de présence à l\'entrée de la salle. Dans l\'application, l\'émargement se fait par scan du QR code personnel. L\'émargement fait foi de la présence physique du membre.',
    keywords: ['émargement', 'signature', 'présence', 'QR', 'entrée', 'feuille'],
  },
  {
    terme: 'Procès-verbal (PV)',
    definition:
      'Compte-rendu officiel de la séance. Le PV contient les présences, l\'ordre du jour, les discussions, les résultats de vote et les formules légales. Il est signé par le président et le secrétaire de séance, puis soumis à approbation en début de séance suivante.',
    reference: 'CGCT L2121-15',
    keywords: ['procès-verbal', 'PV', 'compte-rendu', 'officiel', 'signature'],
  },
  {
    terme: 'Ordre du jour (ODJ)',
    definition:
      'Liste des points à traiter pendant la séance. L\'ordre du jour est fixé par le président (ou le bureau) et joint à la convocation. Il comprend généralement l\'approbation du PV précédent, les délibérations, et les questions diverses.',
    keywords: ['ordre', 'jour', 'ODJ', 'points', 'traiter', 'convocation'],
  },
  {
    terme: 'Convocation',
    definition:
      'Document officiel invitant les membres à une séance. La convocation doit être envoyée au moins 5 jours francs avant la date de la séance (3 jours en cas d\'urgence). Elle contient la date, l\'heure, le lieu et l\'ordre du jour.',
    reference: 'CGCT L2121-10 à L2121-12',
    keywords: ['convocation', 'invitation', 'délai', 'jours', 'francs'],
  },
  {
    terme: 'Récusation',
    definition:
      'Obligation pour un élu de se retirer d\'un vote s\'il a un intérêt personnel dans le sujet (conflit d\'intérêt). Le membre récusé ne participe ni au débat ni au vote. Le quorum est recalculé en conséquence.',
    reference: 'CGCT L2131-11',
    keywords: ['récusation', 'conflit', 'intérêt', 'retirer', 'personnel'],
  },
  {
    terme: 'Vote à bulletin secret',
    definition:
      'Mode de scrutin où le choix de chaque votant est anonyme. Obligatoire pour les élections de personnes (ex : élection des adjoints). Le système sépare la participation (qui a voté) du choix (pour qui).',
    reference: 'CGCT L2121-21',
    keywords: ['bulletin', 'secret', 'anonyme', 'élection', 'scrutin'],
  },
  {
    terme: 'Unanimité',
    definition:
      'Tous les votants (hors abstentions) se sont prononcés dans le même sens. L\'unanimité est détectée automatiquement par le système et génère une formule PV spécifique.',
    keywords: ['unanimité', 'tous', 'même', 'sens', 'accord'],
  },
  {
    terme: 'Instance',
    definition:
      'Assemblée délibérante ou organe de décision (exemples : Conseil municipal, Commission des finances, CAO). Chaque instance a ses propres membres, son bureau (président, secrétaire) et ses règles de fonctionnement.',
    keywords: ['instance', 'assemblée', 'conseil', 'commission', 'organe'],
  },
  {
    terme: 'Bureau',
    definition:
      'Composition de l\'équipe dirigeante d\'une instance : président, vice-président(s), secrétaire. Le bureau est désigné lors de l\'installation de l\'instance et hérité automatiquement pour chaque séance.',
    keywords: ['bureau', 'président', 'secrétaire', 'vice', 'dirigeant'],
  },
  {
    terme: 'Questions diverses',
    definition:
      'Points soulevés par les membres en fin de séance, qui ne figuraient pas à l\'ordre du jour initial. Les questions diverses ne peuvent pas donner lieu à une délibération (pas de vote possible).',
    keywords: ['questions', 'diverses', 'fin', 'séance', 'ordre', 'jour'],
  },
]

export function Glossaire() {
  const [search, setSearch] = useState('')
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return GLOSSAIRE_ENTRIES
    const q = search
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
    return GLOSSAIRE_ENTRIES.filter((entry) => {
      const searchable = [entry.terme, entry.definition, ...entry.keywords]
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
      return searchable.includes(q)
    })
  }, [search])

  return (
    <div className="space-y-4" id="glossaire">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Glossaire</h2>
        <span className="text-xs text-muted-foreground">
          {GLOSSAIRE_ENTRIES.length} termes
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        Les termes juridiques et métier utilisés dans l&apos;application, expliqués simplement.
      </p>

      {/* Search */}
      <div className="relative max-w-md print:hidden">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher un terme..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-xl border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          aria-label="Rechercher dans le glossaire"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
            title="Effacer la recherche"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Results count */}
      {search && filtered.length !== GLOSSAIRE_ENTRIES.length && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} pour « {search} »
        </p>
      )}

      {/* Entries */}
      <div className="space-y-2">
        {filtered.map((entry) => {
          const globalIndex = GLOSSAIRE_ENTRIES.indexOf(entry)
          const isExpanded = expandedIndex === globalIndex
          return (
            <div
              key={entry.terme}
              className="rounded-xl border bg-card overflow-hidden transition-all"
            >
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : globalIndex)}
                className="flex items-center justify-between w-full px-5 py-3.5 text-left min-h-[52px] hover:bg-muted/30 transition-colors"
                aria-expanded={isExpanded}
                title={isExpanded ? 'Fermer la définition' : 'Voir la définition'}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {entry.terme}
                  </span>
                  {entry.reference && (
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {entry.reference}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
              {isExpanded && (
                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-dashed mx-3 pt-3">
                  {entry.definition}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && search && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-1">
            Aucun terme ne correspond à « {search} ».
          </p>
          <p className="text-xs text-muted-foreground">
            Essayez un autre mot ou parcourez la liste complète.
          </p>
        </div>
      )}
    </div>
  )
}
