import { describe, it, expect } from 'vitest'
import { determineVoteResult, generateFormulePV } from '../vote-result'

// ─── determineVoteResult ─────────────────────────────────────────────────────

describe('determineVoteResult', () => {
  // ── Unanimité ──────────────────────────────────────────────────────────────

  it('returns ADOPTE_UNANIMITE when 0 contre and 0 abstention', () => {
    expect(determineVoteResult(20, 0, 0, 20, 'SIMPLE', false)).toBe('ADOPTE_UNANIMITE')
  })

  it('returns ADOPTE_UNANIMITE even with 1 votant', () => {
    expect(determineVoteResult(1, 0, 0, 1, 'SIMPLE', false)).toBe('ADOPTE_UNANIMITE')
  })

  // ── Majorité simple (suffrages exprimés) ───────────────────────────────────

  it('adopts with simple majority', () => {
    // 20 exprimés, threshold = floor(20/2)+1 = 11, pour=11 >= 11 → ADOPTE
    expect(determineVoteResult(11, 9, 0, 20, 'SIMPLE', false)).toBe('ADOPTE')
  })

  it('rejects when contre > pour with simple majority', () => {
    expect(determineVoteResult(9, 11, 0, 20, 'SIMPLE', false)).toBe('REJETE')
  })

  it('handles simple majority with abstentions (abstentions not counted in threshold)', () => {
    // 10 pour, 5 contre, 5 abstentions → suffrages exprimés = 15
    // threshold = floor(15/2)+1 = 8
    // 10 >= 8 → ADOPTE
    expect(determineVoteResult(10, 5, 5, 20, 'SIMPLE', false)).toBe('ADOPTE')
  })

  // ── Majorité absolue (tous les votants) ────────────────────────────────────

  it('adopts with absolute majority', () => {
    // 20 votants, threshold = floor(20/2)+1 = 11
    expect(determineVoteResult(11, 5, 4, 20, 'ABSOLUE', false)).toBe('ADOPTE')
  })

  it('rejects when pour < absolute majority', () => {
    // 20 votants, threshold = 11, pour = 10
    expect(determineVoteResult(10, 5, 5, 20, 'ABSOLUE', false)).toBe('REJETE')
  })

  // ── Majorité qualifiée (2/3) ───────────────────────────────────────────────

  it('adopts with qualified majority (2/3)', () => {
    // 21 votants, threshold = ceil(21*2/3) = ceil(14) = 14
    expect(determineVoteResult(14, 5, 2, 21, 'QUALIFIEE', false)).toBe('ADOPTE')
  })

  it('rejects when pour < qualified majority', () => {
    // 21 votants, threshold = 14, pour = 13
    expect(determineVoteResult(13, 5, 3, 21, 'QUALIFIEE', false)).toBe('REJETE')
  })

  // ── Voix prépondérante ─────────────────────────────────────────────────────

  it('adopts with voix preponderante on tie', () => {
    expect(determineVoteResult(10, 10, 0, 20, 'SIMPLE', true)).toBe('ADOPTE_VOIX_PREPONDERANTE')
  })

  it('rejects on tie without voix preponderante', () => {
    expect(determineVoteResult(10, 10, 0, 20, 'SIMPLE', false)).toBe('REJETE')
  })

  // ── Vote nul ───────────────────────────────────────────────────────────────

  it('returns NUL when all abstentions', () => {
    expect(determineVoteResult(0, 0, 20, 20, 'SIMPLE', false)).toBe('NUL')
  })

  // ── Cas limites ────────────────────────────────────────────────────────────

  it('handles 0 votants gracefully (returns NUL)', () => {
    // 0 votants: abstention(0) === totalVotants(0) → NUL
    const result = determineVoteResult(0, 0, 0, 0, 'SIMPLE', false)
    expect(result).toBe('NUL')
  })

  // ── Nombres impairs (bug classique du Math.floor) ──────────────────────────

  it('correct threshold for odd numbers with ABSOLUE', () => {
    // 33 votants: threshold = floor(33/2)+1 = 16+1 = 17
    // 17 pour → ADOPTE
    expect(determineVoteResult(17, 10, 6, 33, 'ABSOLUE', false)).toBe('ADOPTE')
  })

  it('rejects at threshold-1 for odd numbers', () => {
    // 33 votants: threshold = 17, pour = 16 → REJETE
    expect(determineVoteResult(16, 10, 7, 33, 'ABSOLUE', false)).toBe('REJETE')
  })

  // ── Majorité unanime requise ───────────────────────────────────────────────

  it('adopts when unanimity is required and all vote pour', () => {
    expect(determineVoteResult(15, 0, 0, 15, 'UNANIMITE', false)).toBe('ADOPTE_UNANIMITE')
  })

  it('rejects when unanimity is required but not reached', () => {
    // 1 abstention breaks unanimity, falls through to threshold check
    // threshold = totalVotants = 15, pour = 14 → REJETE
    expect(determineVoteResult(14, 0, 1, 15, 'UNANIMITE', false)).toBe('REJETE')
  })

  // ── Majorité qualifiée cas limites ─────────────────────────────────────────

  it('qualified majority with exact 2/3 boundary', () => {
    // 30 votants: threshold = ceil(30*2/3) = ceil(20) = 20
    expect(determineVoteResult(20, 5, 5, 30, 'QUALIFIEE', false)).toBe('ADOPTE')
    expect(determineVoteResult(19, 6, 5, 30, 'QUALIFIEE', false)).toBe('REJETE')
  })

  it('qualified majority with non-divisible count', () => {
    // 10 votants: threshold = ceil(10*2/3) = ceil(6.666) = 7
    expect(determineVoteResult(7, 2, 1, 10, 'QUALIFIEE', false)).toBe('ADOPTE')
    expect(determineVoteResult(6, 3, 1, 10, 'QUALIFIEE', false)).toBe('REJETE')
  })
})

// ─── generateFormulePV ───────────────────────────────────────────────────────

describe('generateFormulePV', () => {
  it('generates unanimity formula', () => {
    const formula = generateFormulePV({
      pour: 20, contre: 0, abstention: 0, totalVotants: 20,
      resultat: 'ADOPTE_UNANIMITE',
      nomsContre: [], nomsAbstention: [],
      titrePoint: 'Budget 2026',
    })
    expect(formula).toContain('unanimité')
    expect(formula).toContain('20 votants')
    expect(formula).toContain('Budget 2026')
  })

  it('generates unanimity minus abstentions formula', () => {
    const formula = generateFormulePV({
      pour: 18, contre: 0, abstention: 2, totalVotants: 20,
      resultat: 'ADOPTE',
      nomsContre: [], nomsAbstention: ['Jean Dupont', 'Marie Martin'],
      titrePoint: 'Budget 2026',
    })
    expect(formula).toContain('unanimité des suffrages exprimés')
    expect(formula).toContain('2 membres')
    expect(formula).toContain('Jean Dupont, Marie Martin')
  })

  it('generates pour/contre formula without abstentions', () => {
    const formula = generateFormulePV({
      pour: 15, contre: 5, abstention: 0, totalVotants: 20,
      resultat: 'ADOPTE',
      nomsContre: ['Pierre Bernard', 'Sophie Petit'], nomsAbstention: [],
      titrePoint: 'Budget 2026',
    })
    expect(formula).toContain('15 voix pour')
    expect(formula).toContain('5 voix contre')
    expect(formula).toContain('ADOPTE')
  })

  it('generates pour/contre/abstentions formula', () => {
    const formula = generateFormulePV({
      pour: 12, contre: 5, abstention: 3, totalVotants: 20,
      resultat: 'ADOPTE',
      nomsContre: ['A'], nomsAbstention: ['B', 'C', 'D'],
      titrePoint: 'Budget 2026',
    })
    expect(formula).toContain('12 voix pour')
    expect(formula).toContain('5 voix contre')
    expect(formula).toContain('3 abstentions')
    expect(formula).toContain('ADOPTE')
  })

  it('generates rejection formula', () => {
    const formula = generateFormulePV({
      pour: 5, contre: 15, abstention: 0, totalVotants: 20,
      resultat: 'REJETE',
      nomsContre: [], nomsAbstention: [],
      titrePoint: 'Budget 2026',
    })
    expect(formula).toContain('REJETTE')
    expect(formula).toContain('15 voix contre')
  })

  it('generates voix preponderante formula', () => {
    const formula = generateFormulePV({
      pour: 10, contre: 10, abstention: 0, totalVotants: 20,
      resultat: 'ADOPTE_VOIX_PREPONDERANTE',
      nomsContre: [], nomsAbstention: [],
      titrePoint: 'Budget 2026',
    })
    expect(formula).toContain('voix du Président')
    expect(formula).toContain('prépondérante')
  })

  it('generates null vote formula', () => {
    const formula = generateFormulePV({
      pour: 0, contre: 0, abstention: 20, totalVotants: 20,
      resultat: 'NUL',
      nomsContre: [], nomsAbstention: [],
      titrePoint: 'Budget 2026',
    })
    expect(formula).toContain('nul')
    expect(formula).toContain('abstenu')
  })

  it('includes recusation text when provided', () => {
    const formula = generateFormulePV({
      pour: 18, contre: 0, abstention: 0, totalVotants: 18,
      resultat: 'ADOPTE_UNANIMITE',
      nomsContre: [], nomsAbstention: [],
      titrePoint: 'Budget 2026',
      recuses: ['Pierre Bernard'],
    })
    expect(formula).toContain('Pierre Bernard')
    expect(formula).toContain('intérêt personnel')
  })

  it('handles singular correctly (1 abstention)', () => {
    const formula = generateFormulePV({
      pour: 19, contre: 0, abstention: 1, totalVotants: 20,
      resultat: 'ADOPTE',
      nomsContre: [], nomsAbstention: ['Jean'],
      titrePoint: 'Test',
    })
    expect(formula).toContain('1 membre')
    expect(formula).not.toContain('1 membres')
  })

  it('handles plural correctly (3 abstentions)', () => {
    const formula = generateFormulePV({
      pour: 17, contre: 0, abstention: 3, totalVotants: 20,
      resultat: 'ADOPTE',
      nomsContre: [], nomsAbstention: ['A', 'B', 'C'],
      titrePoint: 'Test',
    })
    expect(formula).toContain('3 membres')
  })

  it('handles singular votant in unanimity', () => {
    const formula = generateFormulePV({
      pour: 1, contre: 0, abstention: 0, totalVotants: 1,
      resultat: 'ADOPTE_UNANIMITE',
      nomsContre: [], nomsAbstention: [],
      titrePoint: 'Test',
    })
    // "1 votant" not "1 votants"
    expect(formula).toContain('1 votant')
    expect(formula).not.toContain('1 votants')
  })

  it('uses default title when titrePoint is empty', () => {
    const formula = generateFormulePV({
      pour: 20, contre: 0, abstention: 0, totalVotants: 20,
      resultat: 'ADOPTE_UNANIMITE',
      nomsContre: [], nomsAbstention: [],
      titrePoint: '',
    })
    expect(formula).toContain('la délibération')
  })

  it('includes noms contre in parentheses', () => {
    const formula = generateFormulePV({
      pour: 15, contre: 5, abstention: 0, totalVotants: 20,
      resultat: 'ADOPTE',
      nomsContre: ['Dupont', 'Martin'], nomsAbstention: [],
      titrePoint: 'Test',
    })
    expect(formula).toContain('(Dupont, Martin)')
  })

  it('includes multiple recuses', () => {
    const formula = generateFormulePV({
      pour: 16, contre: 0, abstention: 0, totalVotants: 16,
      resultat: 'ADOPTE_UNANIMITE',
      nomsContre: [], nomsAbstention: [],
      titrePoint: 'Test',
      recuses: ['Alice', 'Bob'],
    })
    expect(formula).toContain('Alice')
    expect(formula).toContain('Bob')
    // Each recused person gets their own sentence
    const count = (formula.match(/intérêt personnel/g) || []).length
    expect(count).toBe(2)
  })
})
