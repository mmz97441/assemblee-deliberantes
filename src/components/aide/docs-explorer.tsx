'use client'

import { useState, useMemo } from 'react'
import NextLink from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ARTICLES,
  filterArticlesByRole,
  searchArticles,
  groupByCategory,
  type DocArticle,
  type DocBlock,
} from '@/lib/docs/articles'
import { ROLE_LABELS } from '@/lib/auth/helpers'
import type { UserRole } from '@/lib/supabase/types'
import {
  Search,
  X,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Scale,
  BookOpen,
  // Icônes utilisées dans les articles (mapping nom string → composant)
  Sparkles,
  KeyRound,
  LogIn,
  Shield,
  Mail,
  FileText,
  Send,
  RefreshCw,
  Plus,
  Archive,
  Hand,
  Lock,
  UserPlus,
  UserX,
  PenLine,
  FileSearch,
  CheckCircle2 as CheckCircle2Icon,
  Settings,
  Calculator,
  History,
  HelpCircle,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles, KeyRound, LogIn, Shield, Mail, FileText, Send, RefreshCw,
  Plus, Archive, Hand, Lock, UserPlus, UserX, PenLine, FileSearch,
  CheckCircle2: CheckCircle2Icon, Settings, Calculator, History,
  BookOpen, HelpCircle,
}

interface DocsExplorerProps {
  /** Rôle de l'utilisateur connecté (pour filtrer) */
  userRole: UserRole | null
}

export function DocsExplorer({ userRole }: DocsExplorerProps) {
  const [query, setQuery] = useState('')
  const [showAllRoles, setShowAllRoles] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Articles filtrés par rôle (ou tous si toggle activé)
  const articlesForRole = useMemo(() => {
    if (showAllRoles || !userRole) return ARTICLES
    return filterArticlesByRole(ARTICLES, userRole)
  }, [userRole, showAllRoles])

  // Recherche textuelle
  const visibleArticles = useMemo(() => {
    if (!query.trim()) return articlesForRole
    return searchArticles(articlesForRole, query)
  }, [articlesForRole, query])

  // Groupement par catégorie pour la sidebar
  const grouped = useMemo(() => groupByCategory(visibleArticles), [visibleArticles])

  // Article sélectionné (par défaut le premier visible)
  const selectedArticle = useMemo(() => {
    if (selectedId) {
      const found = visibleArticles.find(a => a.id === selectedId)
      if (found) return found
    }
    return visibleArticles[0] || null
  }, [selectedId, visibleArticles])

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">

      {/* Sidebar gauche : recherche + sommaire */}
      <aside className="space-y-4 md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto">

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par mot-clé…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Toggle voir tous les rôles */}
        {userRole && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Vue&nbsp;: {showAllRoles ? 'tous les rôles' : ROLE_LABELS[userRole] || userRole}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setShowAllRoles(v => !v)}
            >
              {showAllRoles ? 'Filtrer' : 'Tout voir'}
            </Button>
          </div>
        )}

        {/* Sommaire par catégorie */}
        <nav className="space-y-4">
          {grouped.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Aucun résultat pour cette recherche.
            </p>
          )}
          {grouped.map(group => (
            <div key={group.category}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-2">
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {group.articles.map(article => {
                  const Icon = article.icon ? ICON_MAP[article.icon] : null
                  const isSelected = selectedArticle?.id === article.id
                  return (
                    <li key={article.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(article.id)}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-start gap-2 ${
                          isSelected
                            ? 'bg-primary/10 text-foreground font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {Icon && <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isSelected ? 'text-primary' : ''}`} />}
                        <span className="leading-snug">{article.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Article sélectionné */}
      <article className="min-w-0">
        {selectedArticle ? (
          <ArticleView
            article={selectedArticle}
            userRole={userRole}
            highlight={query}
            allArticles={articlesForRole}
            onSelectArticle={setSelectedId}
          />
        ) : (
          <div className="rounded-xl border border-dashed bg-card/50 p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">
              Sélectionnez un article dans le sommaire à gauche.
            </p>
          </div>
        )}
      </article>
    </div>
  )
}

// ─── Vue d'un article ───────────────────────────────────────────────────────

function ArticleView({
  article,
  userRole,
  highlight,
  allArticles,
  onSelectArticle,
}: {
  article: DocArticle
  userRole: UserRole | null
  highlight?: string
  allArticles: DocArticle[]
  onSelectArticle: (id: string) => void
}) {
  const Icon = article.icon ? ICON_MAP[article.icon] : null

  return (
    <div className="rounded-xl border bg-card p-6 sm:p-8 max-w-3xl">
      {/* En-tête */}
      <header className="mb-6 pb-4 border-b">
        <div className="flex items-start gap-3 mb-2">
          {Icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              <Highlight text={article.title} term={highlight} />
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              <Highlight text={article.summary} term={highlight} />
            </p>
          </div>
        </div>

        {/* Badges rôles concernés (si l'utilisateur voit tous les rôles) */}
        {!userRole || article.roles.length < 8 ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {article.roles.length === 0 ? (
              <Badge variant="outline" className="text-[10px]">Public</Badge>
            ) : (
              article.roles.map(r => (
                <Badge
                  key={r}
                  variant="outline"
                  className={`text-[10px] ${r === userRole ? 'bg-primary/10 border-primary/30 text-primary' : ''}`}
                >
                  {ROLE_LABELS[r] || r}
                </Badge>
              ))
            )}
          </div>
        ) : null}
      </header>

      {/* Contenu */}
      <div className="space-y-4 text-sm leading-relaxed">
        {article.blocks.map((block, i) => (
          <BlockView
            key={i}
            block={block}
            highlight={highlight}
            allArticles={allArticles}
            onSelectArticle={onSelectArticle}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Rendu d'un bloc de contenu ─────────────────────────────────────────────

function BlockView({
  block,
  highlight,
  allArticles,
  onSelectArticle,
}: {
  block: DocBlock
  highlight?: string
  allArticles: DocArticle[]
  onSelectArticle: (id: string) => void
}) {
  // Helper local pour ne pas répéter les props
  const Rich = ({ text }: { text: string }) => (
    <RichText text={text} highlight={highlight} onSelectArticle={onSelectArticle} />
  )

  switch (block.type) {
    case 'paragraph':
      return <p className="text-foreground/80"><Rich text={block.text} /></p>

    case 'heading':
      return block.level === 2 ? (
        <h2 className="text-lg font-semibold text-foreground mt-6 first:mt-0"><Rich text={block.text} /></h2>
      ) : (
        <h3 className="text-base font-semibold text-foreground mt-4"><Rich text={block.text} /></h3>
      )

    case 'list':
      return (
        <ul className={`space-y-1.5 ml-5 ${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-muted-foreground/60`}>
          {block.items.map((it, i) => (
            <li key={i} className="text-foreground/80"><Rich text={it} /></li>
          ))}
        </ul>
      )

    case 'steps':
      return (
        <ol className="space-y-3">
          {block.items.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {i + 1}
              </span>
              <div className="flex-1 pt-0.5">
                <p className="font-medium text-foreground"><Rich text={step.title} /></p>
                {step.details && (
                  <p className="text-sm text-muted-foreground mt-0.5"><Rich text={step.details} /></p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )

    case 'tip':
      return (
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 flex items-start gap-2.5">
          <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
          <p className="text-sm text-blue-900"><Rich text={block.text} /></p>
        </div>
      )

    case 'warning':
      return (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900"><Rich text={block.text} /></p>
        </div>
      )

    case 'success':
      return (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-900"><Rich text={block.text} /></p>
        </div>
      )

    case 'legal':
      return (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-start gap-2.5">
          <Scale className="h-4 w-4 mt-0.5 shrink-0 text-slate-600" />
          <div className="flex-1">
            <p className="text-sm text-slate-800"><Rich text={block.text} /></p>
            {block.reference && (
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mt-1 font-mono">
                {block.reference}
              </p>
            )}
          </div>
        </div>
      )

    case 'definition':
      return (
        <div className="rounded-lg border bg-muted/30 p-3">
          <dt className="font-semibold text-foreground inline">
            <Highlight text={block.term} term={highlight} />
          </dt>
          <dd className="text-sm text-muted-foreground inline ml-2">
            — <Rich text={block.definition} />
          </dd>
        </div>
      )

    case 'related': {
      // Ne montrer que les articles qui existent ET sont visibles à l'utilisateur
      const links = block.articleIds
        .map(id => allArticles.find(a => a.id === id))
        .filter((a): a is DocArticle => !!a)
      if (links.length === 0) return null
      return (
        <div className="rounded-lg border bg-muted/30 p-4 mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            À lire aussi
          </h3>
          <ul className="space-y-2">
            {links.map(a => {
              const Icon = a.icon ? ICON_MAP[a.icon] : ChevronRight
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onSelectArticle(a.id)}
                    className="w-full text-left flex items-start gap-2.5 p-2 rounded-md hover:bg-card transition-colors group"
                  >
                    <Icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {a.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{a.summary}</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )
    }

    default:
      return null
  }
}

// ─── RichText : parse les liens markdown + highlight matches ────────────────
//
// Syntaxe :
//   [Texte](article:id-article)  → lien interne vers un autre article
//   [Texte](/path/in/app)        → lien Next.js vers une page de l'app
//   [Texte](https://...)         → lien externe (nouvel onglet)

function RichText({
  text,
  highlight,
  onSelectArticle,
}: {
  text: string
  highlight?: string
  onSelectArticle: (id: string) => void
}) {
  // Regex non-greedy : capte chaque [texte](cible)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = linkRegex.exec(text)) !== null) {
    // Texte avant le lien (avec highlight des matches de recherche)
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      parts.push(<Highlight key={`t-${key++}`} text={before} term={highlight} />)
    }

    const [, linkText, target] = match

    if (target.startsWith('article:')) {
      // Lien interne vers un autre article
      const articleId = target.slice('article:'.length)
      parts.push(
        <button
          key={`l-${key++}`}
          type="button"
          onClick={() => onSelectArticle(articleId)}
          className="text-primary underline-offset-2 hover:underline font-medium"
        >
          <Highlight text={linkText} term={highlight} />
        </button>
      )
    } else if (target.startsWith('/')) {
      // Lien interne vers une page de l'app (navigation Next.js)
      parts.push(
        <NextLink
          key={`l-${key++}`}
          href={target}
          className="text-primary underline underline-offset-2 hover:no-underline font-medium"
        >
          <Highlight text={linkText} term={highlight} />
        </NextLink>
      )
    } else if (target.startsWith('http://') || target.startsWith('https://')) {
      // Lien externe (nouvel onglet, sécurité noopener)
      parts.push(
        <a
          key={`l-${key++}`}
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:no-underline font-medium inline-flex items-center gap-0.5"
        >
          <Highlight text={linkText} term={highlight} />
          <ExternalLink className="h-3 w-3 inline" />
        </a>
      )
    } else {
      // Cible non reconnue → on rend en texte simple (fail-safe)
      parts.push(<Highlight key={`l-${key++}`} text={linkText} term={highlight} />)
    }

    lastIndex = linkRegex.lastIndex
  }

  // Texte restant après le dernier lien
  if (lastIndex < text.length) {
    parts.push(<Highlight key={`t-${key++}`} text={text.slice(lastIndex)} term={highlight} />)
  }

  return <>{parts.length > 0 ? parts : <Highlight text={text} term={highlight} />}</>
}

// ─── Surlignage des matches de recherche ────────────────────────────────────

function Highlight({ text, term }: { text: string; term?: string }) {
  if (!term || !term.trim()) return <>{text}</>
  const t = term.trim()
  // Échappe les caractères spéciaux regex pour traiter le terme comme literal
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) => (
        part.toLowerCase() === t.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      ))}
    </>
  )
}
