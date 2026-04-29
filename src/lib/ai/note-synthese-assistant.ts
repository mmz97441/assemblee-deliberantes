import Anthropic from '@anthropic-ai/sdk'
import { anonymize, deanonymize } from '@/lib/ai/pv-assistant'

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  commune: 'commune',
  syndicat: 'syndicat intercommunal',
  cc: 'communauté de communes',
  departement: 'conseil départemental',
  asso: 'association loi 1901',
}

export interface GenerateNoteSyntheseParams {
  pointTitle: string
  pointDescription: string | null
  projetDeliberation: string | null
  institutionType: string
  institutionName: string
  memberNames: string[]
}

/**
 * Génère une note explicative de synthèse pour un point d'ODJ
 * (CGCT L2121-12). Format ~200-400 mots, langage clair pour les élus.
 */
export async function generateNoteSynthese(
  params: GenerateNoteSyntheseParams
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY non configurée')
  }

  const client = new Anthropic({ apiKey })
  const typeLabel = INSTITUTION_TYPE_LABELS[params.institutionType] || params.institutionType

  // Anonymisation préventive (au cas où des noms apparaissent dans les textes)
  const allTexts = [
    params.pointTitle,
    params.pointDescription || '',
    params.projetDeliberation || '',
  ].join('\n---\n')

  const { text: anonymizedTexts, map } = anonymize(
    allTexts,
    params.memberNames,
    params.institutionName
  )
  const [anonTitle, anonDescription, anonProjet] = anonymizedTexts.split('\n---\n')

  const systemPrompt = `Tu es un rédacteur administratif spécialisé dans les notes explicatives de synthèse pour les assemblées délibérantes françaises (CGCT L2121-12).

Ton rôle est de rédiger une note explicative de synthèse claire, pédagogique et factuelle, destinée à informer les élus AVANT la séance pour qu'ils puissent délibérer en connaissance de cause.

Contexte : tu rédiges pour une ${typeLabel}.

Règles strictes :
- Format : 200 à 400 mots maximum
- Style : phrases courtes, vocabulaire accessible (pas de jargon juridique inutile)
- Structure suggérée : Contexte → Enjeu → Proposition → Conséquences (financières, organisationnelles, juridiques)
- Reste factuel : pas d'opinion, pas d'orientation politique
- Ne mentionne aucun nom de personne
- Si l'information disponible est insuffisante, indique-le explicitement à la fin (ex : "Des éléments complémentaires sont à fournir avant la séance.")
- Réponds UNIQUEMENT avec le texte de la note, sans titre ni en-tête, sans markdown`

  const userPrompt = `Rédige la note explicative de synthèse pour ce point soumis à délibération :

Titre : ${anonTitle}
${anonDescription ? `Description : ${anonDescription}` : ''}
${anonProjet ? `Projet de délibération : ${anonProjet}` : ''}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textContent = response.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error("L'IA n'a pas retourné de réponse textuelle")
  }

  return deanonymize(textContent.text.trim(), map)
}
