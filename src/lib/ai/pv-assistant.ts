import Anthropic from '@anthropic-ai/sdk'

// ─── Anonymization ──────────────────────────────────────────────────────────

export interface AnonymizationMap {
  names: Map<string, string> // "Jean Dupont" -> "Elu A"
  institution: string // Original institution name
}

/**
 * Anonymise un texte en remplacant les noms des membres et de l'institution.
 * Les noms sont tries par longueur decroissante pour eviter les remplacements partiels.
 */
export function anonymize(
  text: string,
  memberNames: string[],
  institutionName: string
): { text: string; map: AnonymizationMap } {
  const map: AnonymizationMap = {
    names: new Map<string, string>(),
    institution: institutionName,
  }

  // Deduplicate and sort by length descending to avoid partial replacements
  const uniqueNames = Array.from(new Set(memberNames)).filter((n) => n.trim().length > 0)
  uniqueNames.sort((a, b) => b.length - a.length)

  let anonymized = text

  // Assign aliases: Elu A, Elu B, ...
  let aliasIndex = 0
  for (const name of uniqueNames) {
    const letter = String.fromCharCode(65 + aliasIndex) // A, B, C...
    const alias = `Elu ${letter}`
    map.names.set(name, alias)
    aliasIndex++

    // Replace all occurrences (case-sensitive)
    anonymized = anonymized.split(name).join(alias)
  }

  // Replace institution name
  if (institutionName.trim().length > 0) {
    anonymized = anonymized.split(institutionName).join("l'Institution")
  }

  return { text: anonymized, map }
}

/**
 * Restaure les noms reels dans un texte anonymise.
 */
export function deanonymize(text: string, map: AnonymizationMap): string {
  let result = text

  // Restore institution name first
  result = result.split("l'Institution").join(map.institution)

  // Restore member names — sort aliases by length descending to avoid partial matches
  const entries = Array.from(map.names.entries())
  entries.sort((a, b) => b[1].length - a[1].length)

  for (const [realName, alias] of entries) {
    result = result.split(alias).join(realName)
  }

  return result
}

// ─── AI Generation: Vu / Considerant / Articles ─────────────────────────────

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  commune: 'commune',
  syndicat: 'syndicat intercommunal',
  cc: 'communaute de communes',
  departement: 'conseil departemental',
  asso: 'association loi 1901',
}

export interface GenerateVCAParams {
  pointTitle: string
  pointDescription: string | null
  projetDeliberation: string | null
  voteResultat: string | null
  institutionType: string
  memberNames: string[]
  institutionName: string
}

export interface GenerateVCAResult {
  vu: string
  considerant: string
  articles: string[]
}

/**
 * Genere les sections Vu, Considerant et Articles pour un point d'ODJ
 * en utilisant l'API Anthropic Claude.
 */
export async function generateVuConsiderantArticles(
  params: GenerateVCAParams
): Promise<GenerateVCAResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY non configuree')
  }

  const client = new Anthropic({ apiKey })

  const typeLabel = INSTITUTION_TYPE_LABELS[params.institutionType] || params.institutionType

  // Anonymize all input texts
  const allTexts = [
    params.pointTitle,
    params.pointDescription || '',
    params.projetDeliberation || '',
    params.voteResultat || '',
  ].join('\n---\n')

  const { text: anonymizedTexts, map } = anonymize(
    allTexts,
    params.memberNames,
    params.institutionName
  )

  const [anonTitle, anonDescription, anonProjet, anonResultat] = anonymizedTexts.split('\n---\n')

  const systemPrompt = `Tu es un redacteur juridique specialise dans les proces-verbaux d'assemblees deliberantes francaises.
Tu rediges dans un style juridique formel en francais.
Tu travailles pour une ${typeLabel}.

Ton role est de generer trois sections pour un point de l'ordre du jour :

1. **Vu** : references aux textes juridiques applicables (lois, codes, decrets, statuts, reglement interieur). Chaque reference commence par "Vu" suivi du texte de reference. Les references sont separees par des points-virgules.

2. **Considerant** : contexte, justification, raisons de la deliberation. Chaque consideration commence par "Considerant que". Les considerations sont separees par des points-virgules.

3. **Articles** : decisions concretes prises. Chaque article est numerote "Article 1 :", "Article 2 :", etc.

Reponds UNIQUEMENT avec un objet JSON valide au format suivant, sans aucun texte avant ou apres :
{
  "vu": "Vu le Code General des Collectivites Territoriales, notamment ses articles L.xxxx-x et suivants ; Vu ...",
  "considerant": "Considerant que ... ; Considerant que ...",
  "articles": ["Article 1 : ...", "Article 2 : ..."]
}

Regles :
- Utilise des references juridiques plausibles et pertinentes pour le sujet
- Les articles doivent etre des decisions concretes et actionables
- Adapte le vocabulaire au type d'institution (${typeLabel})
- Ne mentionne aucun nom de personne dans les Vu ou Considerant
- Le JSON doit etre valide et parsable`

  const userPrompt = `Genere les sections Vu, Considerant et Articles pour le point suivant :

Titre du point : ${anonTitle}
${anonDescription ? `Description : ${anonDescription}` : ''}
${anonProjet ? `Projet de deliberation : ${anonProjet}` : ''}
${anonResultat ? `Resultat du vote : ${anonResultat}` : ''}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  // Extract text content from the response
  const textContent = response.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error("L'IA n'a pas retourne de reponse textuelle")
  }

  // Parse JSON from the response — handle possible markdown code blocks
  let rawJson = textContent.text.trim()
  // Strip markdown code fences if present
  if (rawJson.startsWith('```')) {
    rawJson = rawJson.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  let parsed: { vu: string; considerant: string; articles: string[] }
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error("Impossible de parser la reponse de l'IA. Veuillez reessayer.")
  }

  // Validate structure
  if (
    typeof parsed.vu !== 'string' ||
    typeof parsed.considerant !== 'string' ||
    !Array.isArray(parsed.articles)
  ) {
    throw new Error("La reponse de l'IA n'a pas le format attendu. Veuillez reessayer.")
  }

  // Deanonymize all outputs
  return {
    vu: deanonymize(parsed.vu, map),
    considerant: deanonymize(parsed.considerant, map),
    articles: parsed.articles.map((a) => deanonymize(a, map)),
  }
}

// ─── Section Improvement ────────────────────────────────────────────────────

export interface ImproveSectionParams {
  sectionType: 'vu' | 'considerant' | 'discussion' | 'article'
  currentText: string
  context: string // point title + description for context
  memberNames: string[]
  institutionName: string
}

const SECTION_TYPE_LABELS: Record<string, string> = {
  vu: 'Vu (references juridiques)',
  considerant: 'Considerant (justifications)',
  discussion: 'Discussion (debats)',
  article: 'Article (decision)',
}

/**
 * Ameliore une section de PV existante en conservant le sens.
 */
export async function improveSection(
  params: ImproveSectionParams
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY non configuree')
  }

  const client = new Anthropic({ apiKey })

  // Anonymize
  const combinedText = `${params.currentText}\n---CONTEXT---\n${params.context}`
  const { text: anonymizedCombined, map } = anonymize(
    combinedText,
    params.memberNames,
    params.institutionName
  )
  const [anonText, anonContext] = anonymizedCombined.split('\n---CONTEXT---\n')

  const sectionLabel = SECTION_TYPE_LABELS[params.sectionType] || params.sectionType

  const systemPrompt = `Tu es un redacteur juridique specialise dans les proces-verbaux d'assemblees deliberantes francaises.
Tu ameliores des textes existants en conservant strictement le meme sens et les memes informations.
Tu corriges la grammaire, ameliores le style juridique formel, et rends le texte plus precis et professionnel.
Tu ne dois PAS ajouter d'informations inventees ni modifier le fond du texte.
Reponds UNIQUEMENT avec le texte ameliore, sans commentaire ni explication.`

  const userPrompt = `Ameliore ce texte de type "${sectionLabel}" pour un proces-verbal d'assemblee deliberante.

Contexte du point : ${anonContext}

Texte a ameliorer :
${anonText}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textContent = response.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error("L'IA n'a pas retourne de reponse textuelle")
  }

  // Deanonymize and return
  return deanonymize(textContent.text.trim(), map)
}
