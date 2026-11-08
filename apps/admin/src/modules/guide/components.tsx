import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, FileCode2, Lightbulb, TriangleAlert } from 'lucide-react'
import { Alert, Badge, CodeBlock, PageContainer, Tabs, cn } from '@nexus/ui'
import { AppLink, useCurrentPath } from '@/components/app-link'

/**
 * 教程页的通用外壳
 *
 * 布局沿用「文档站」的三段式：左侧目录常驻、右侧正文、正文内用分节卡片切开。
 * 这样在后台里读文档的体验和读 VitePress 一致，不必在两个站点之间来回跳。
 */

export interface GuideTocItem {
  /** 锚点 id */
  id: string
  label: string
}

export function GuidePage({
  title,
  subtitle,
  toc,
  children,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  toc?: GuideTocItem[]
  children: ReactNode
  actions?: ReactNode
}) {
  const path = useCurrentPath()
  const [active, setActive] = useState(toc?.[0]?.id ?? '')

  useEffect(() => {
    if (!toc || toc.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        const id = hit?.target.getAttribute('data-toc')
        if (id) setActive(id)
      },
      { rootMargin: '-90px 0px -60% 0px' },
    )
    toc.forEach((item) => {
      const node = document.getElementById(item.id)
      if (node) observer.observe(node)
    })
    return () => observer.disconnect()
  }, [toc, path])

  return (
    <PageContainer size="lg">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_11.875rem]">
        <div className="min-w-0">
          <header className="mb-6 border-b border-line pb-5">
            <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium tracking-[0.08em] text-primary uppercase">
              <FileCode2 className="size-3.5" />
              Developer guide
            </p>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-fg">{title}</h1>
            {subtitle && (
              <p className="mt-2 max-w-[45rem] text-[0.8125rem] leading-6 text-fg-3">{subtitle}</p>
            )}
            {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
          </header>
          <div className="space-y-8">{children}</div>
        </div>

        {toc && toc.length > 0 && (
          <aside className="hidden lg:block">
            <div className="sticky top-0">
              <p className="mb-2 text-2xs font-medium tracking-[0.08em] text-fg-4 uppercase">
                本页目录
              </p>
              <nav className="space-y-px border-l border-line">
                {toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={(event) => {
                      event.preventDefault()
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className={cn(
                      '-ml-px block border-l py-1.5 pl-3 text-xs transition-colors',
                      active === item.id
                        ? 'border-primary font-medium text-primary'
                        : 'border-transparent text-fg-3 hover:border-line-strong hover:text-fg-2',
                    )}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}
      </div>
    </PageContainer>
  )
}

/** 正文分节：标题 + 锚点 + 说明 */
export function GuideSection({
  id,
  title,
  eyebrow,
  description,
  children,
  extra,
}: {
  id: string
  title: ReactNode
  eyebrow?: string
  description?: ReactNode
  children: ReactNode
  extra?: ReactNode
}) {
  return (
    <section id={id} data-toc={id} className="scroll-mt-[4.5rem]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 font-mono text-2xs text-fg-4">{eyebrow}</p>}
          <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
          {description && (
            <p className="mt-1 max-w-[42.5rem] text-xs leading-6 text-fg-3">{description}</p>
          )}
        </div>
        {extra && <div className="flex shrink-0 items-center gap-2">{extra}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

/** 带编号的步骤卡：教程的主干 */
export function GuideStep({
  index,
  title,
  description,
  children,
}: {
  index: number
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="relative rounded-lg border border-line bg-surface">
      <div className="flex items-start gap-3 border-b border-line-subtle px-4 py-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-2xs font-semibold text-primary-fg tabular-nums">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.8125rem] font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-5 text-fg-3">{description}</p>}
        </div>
      </div>
      {children && <div className="space-y-3 p-4">{children}</div>}
    </div>
  )
}

/** 文件路径徽标（正文里指路用） */
export function FileRef({ path, note }: { path: string; note?: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <code className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-fg-2">
        {path}
      </code>
      {note && <span className="text-2xs text-fg-4">{note}</span>}
    </span>
  )
}

/** 提示块：把「为什么这样做」和「常见坑」区分开 */
export function GuideNote({
  tone = 'tip',
  title,
  children,
}: {
  tone?: 'tip' | 'warn' | 'danger'
  title?: ReactNode
  children: ReactNode
}) {
  const icon =
    tone === 'tip' ? <Lightbulb className="size-4" /> : <TriangleAlert className="size-4" />
  const alertTone = tone === 'tip' ? 'info' : tone === 'warn' ? 'warning' : 'danger'
  return (
    <Alert tone={alertTone} title={title} icon={icon} compact>
      {children}
    </Alert>
  )
}

/** 多语言 / 多框架的代码切换 */
export function CodeTabs({
  tabs,
  filename,
  maxHeight = 380,
}: {
  tabs: Array<{ key: string; label: string; language?: string; code: string }>
  filename?: string
  maxHeight?: number
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? '')
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0]
  return (
    <div className="space-y-2">
      <Tabs
        variant="pill"
        size="sm"
        value={active}
        onChange={setActive}
        items={tabs.map((tab) => ({ key: tab.key, label: tab.label }))}
      />
      {current && (
        <CodeBlock
          code={current.code}
          language={current.language ?? 'tsx'}
          filename={filename}
          maxHeight={maxHeight}
        />
      )}
    </div>
  )
}

/** 页面底部的「下一步」导航 */
export function GuideNext({ to, label, desc }: { to: string; label: string; desc?: string }) {
  return (
    <AppLink
      to={to}
      className="group flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary-weak/20"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-2xs text-fg-4">下一步</span>
        <span className="block truncate text-[0.8125rem] font-medium text-fg group-hover:text-primary">
          {label}
        </span>
        {desc && <span className="block truncate text-2xs text-fg-3">{desc}</span>}
      </span>
      <ArrowRight className="size-4 shrink-0 text-fg-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </AppLink>
  )
}

/** 小徽章：标注「必读 / 进阶 / 可选」 */
export function Level({ value }: { value: '必读' | '进阶' | '可选' }) {
  const tone = value === '必读' ? 'danger' : value === '进阶' ? 'primary' : 'neutral'
  return (
    <Badge tone={tone} variant="outline" size="sm">
      {value}
    </Badge>
  )
}
