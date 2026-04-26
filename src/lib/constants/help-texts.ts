// ============================================
// Textes d'aide contextuelle
// Tooltips explicatifs pour les concepts métier
// ============================================

/**
 * Textes d'aide pour les concepts juridiques et métier.
 * Utilisés dans les tooltips à travers toute l'application.
 */
export const HELP_TEXTS = {
  quorum:
    'Le quorum est le nombre minimum de membres présents requis pour que les délibérations soient valables (CGCT L2121-17). Sans quorum, les votes ne sont pas légaux.',
  voix_preponderante:
    'En cas d\'égalité des voix, la voix du président départage le vote (CGCT L2121-22). Cette option doit être activée dans la configuration de l\'instance.',
  majorite_absolue:
    'Plus de la moitié des votants, abstentions comprises. Par exemple, pour 20 votants, il faut au moins 11 voix pour.',
  majorite_qualifiee:
    'Au moins deux tiers des votants. Par exemple, pour 21 votants, il faut au moins 14 voix pour.',
  majorite_simple:
    'Plus de voix pour que de voix contre, sans tenir compte des abstentions. C\'est le mode de scrutin le plus courant.',
  procuration:
    'Un membre absent confie son droit de vote à un membre présent (CGCT L2121-20). Un même élu ne peut détenir qu\'une seule procuration.',
  huis_clos:
    'La séance se poursuit sans public. Les débats sont confidentiels. Le huis clos peut être demandé par le président ou voté par l\'assemblée.',
  unanimite:
    'Tous les votants (hors abstentions) se sont prononcés dans le même sens. L\'unanimité est automatiquement détectée par le système.',
  reconvocation:
    'Si le quorum n\'est pas atteint, une nouvelle séance peut être convoquée à 3 jours d\'intervalle minimum (CGCT L2121-17). Cette séance se tient sans condition de quorum.',
  convocation_urgence:
    'Le délai de convocation peut être réduit en cas d\'urgence (CGCT L2121-11). L\'urgence doit être justifiée et mentionnée dans la convocation.',
  seance_publique:
    'Par défaut, les séances sont publiques. Le public peut assister aux débats depuis la tribune.',
  approbation_pv:
    'Le procès-verbal de la séance précédente doit être soumis à l\'approbation de l\'assemblée en début de séance (CGCT L2121-15).',
  questions_diverses:
    'Points soulevés par les membres qui ne figuraient pas à l\'ordre du jour initial. Ils ne peuvent pas donner lieu à délibération.',
  emargement:
    'Feuille de présence signée par chaque membre à son arrivée. L\'émargement fait foi de la présence physique.',
  vote_secret:
    'Le vote est secret et obligatoire pour les élections (CGCT L2121-21). Les bulletins sont anonymes — le système sépare la participation du choix.',
  deliberation:
    'Acte juridique adopté par l\'assemblée. La délibération est publiée et transmise au contrôle de légalité.',
} as const

export type HelpTextKey = keyof typeof HELP_TEXTS
