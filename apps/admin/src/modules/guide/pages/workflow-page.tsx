import { useState } from 'react'
import { ArrowRight, CheckCircle2, GitBranch, Rocket, TestTube2, Wrench } from 'lucide-react'
import {
  Badge,
  Button,
  CodeBlock,
  Descriptions,
  SectionCard,
  SegmentedControl,
  Steps,
} from '@nexus/ui'
import { useAppNavigate } from '@/components/app-link'
import { GuideNext, GuideNote, GuidePage, GuideSection, Level } from '../components'

/**
 * 协作流程
 *
 * 这一页讲「改代码前后怎么验证」，不是团队制度：
 * 每个命令、每个脚本都对应仓库里真实存在的文件，
 * 新人照着跑一遍就知道自己有没有改坏东西。
 */

const TOC = [
  { id: 'commands', label: '0. 命令速查' },
  { id: 'loop', label: '1. 一次改动的闭环' },
  { id: 'checks', label: '2. 自动化检查' },
  { id: 'scripts', label: '3. 验收脚本' },
  { id: 'commit', label: '4. 提交与变更记录' },
  { id: 'release', label: '5. 发布前' },
]

const COMMANDS = `# 开发
pnpm dev            # 后台 http://127.0.0.1:5173
pnpm dev:docs       # 文档站 http://127.0.0.1:5174

# 质量门禁（提交前必跑）
pnpm typecheck      # 全 workspace 的 tsc
pnpm lint           # ESLint（要求 0 error）
pnpm test           # 所有包的单元测试
pnpm verify         # = typecheck + lint + test

# 构建
pnpm build          # 类型检查 + 生产构建
pnpm preview        # 预览构建产物（4173）
pnpm build:docs     # 文档站构建

# 截图与验收脚本
node scripts/screenshot.mjs              # 遍历全部路由（含 7 页开发指南）+ 深色态
node scripts/verify-gallery-guide.mjs    # 组件橱窗与开发指南的 30 项断言
node scripts/verify-i18n-smoke.mjs       # 英文模式无缺词条
node scripts/verify-assistant.mjs        # AI 助手全链路
node scripts/check-theme.mjs             # 深浅色切换后图表 canvas 仍在
node scripts/check-layout.mjs            # 侧栏折叠后图标居中（0px 偏移）
node scripts/check-transition.mjs        # 主题扩散动画真实播放`

const LOOP = `① 明确改动范围
   └─ 新增页面？改模块清单。改组件？动 packages/ui。改数据？动 services/queries。

② 起开发服务器，改到「肉眼正确」
   └─ pnpm dev → 手点一遍交互（hover / 键盘 / 深浅色）

③ pnpm typecheck
   └─ 类型不过 = 一定有问题；别用 as any 掩盖

④ pnpm lint
   └─ 要求 0 error；warning 看是否新增（React Compiler 渐进规则除外）

⑤ pnpm test
   └─ 改了 lib/ 或 core/ 时尤其必要

⑥ 截图脚本兜底
   └─ node scripts/screenshot.mjs：控制台报错在批量遍历里最容易暴露

⑦ 更新文档与变更记录
   └─ apps/docs/**/*.md 与 CHANGELOG.md`

const CHECK_GATES: Array<[string, string, string]> = [
  ['typecheck', 'tsc --noEmit', '任何 TS 错误都算失败；本仓库 strict + noUncheckedIndexedAccess。'],
  ['lint', 'eslint .', '0 error 才允许合并；warning 数量不应新增。'],
  ['test', 'vitest run', 'UI 组件行为、内核逻辑、HTTP 生命周期、AI SDK 纯函数。'],
  ['build', 'tsc + vite build', '生产构建必须成功；页面全是懒加载 chunk。'],
  ['screenshot', 'playwright-core', '遍历 35 个路由，任何 console.error 都会让脚本失败。'],
]

const SCRIPT_SPEC = `// 验收脚本的通用结构（scripts/*.mjs）
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))

// 1) 登录（演示账号一键填充）
await page.goto(base + '/login', { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: /超级管理员/ }).first().click()
await page.getByRole('button', { name: '登录', exact: true }).click()
await page.waitForURL('**/dashboard/overview')

// 2) 断言（用可访问性选择器，别绑 class）
expect(await page.locator('[data-gallery-key]').count()).toBeGreaterThan(40)

// 3) 失败即非 0 退出
if (failed.length || errors.length) process.exitCode = 1`

const COMMIT = `# 提交信息：约定式提交（Conventional Commits）
feat(guide): 新增 AI 助手 SDK 教程页
fix(http): DEFAULT_BASE_URL 真正读取 VITE_API_BASE
refactor(gallery): 组件橱窗拆成按领域的分类文件
docs(readme): 补充应用内开发指南入口

# CHANGELOG.md 的结构（Unreleased 段按「新增 / 重做 / 修复 / 验收」分组）
## [Unreleased]
### 新增
### 重做
### 修复
### 验收`

const RELEASE = `# 发布前清单
□ pnpm verify 通过
□ pnpm build 通过，dist 体积无异常增长
□ node scripts/screenshot.mjs 0 控制台错误
□ CHANGELOG.md 已更新（含验收结论）
□ README 的入口表与截图索引已同步
□ 生产构建未包含 mock（不设 VITE_ENABLE_MOCK）
□ .env.local 不进版本库（.gitignore 已排除）`

export default function GuideWorkflowPage() {
  const navigate = useAppNavigate()
  const [step, setStep] = useState(2)

  return (
    <GuidePage
      title="协作流程"
      subtitle="改完之后怎么确认「没改坏」：命令、自动化门禁、验收脚本与变更记录。这一页不讲团队制度，只讲仓库里真实存在的检查手段。"
      toc={TOC}
      actions={
        <Badge tone="success" variant="outline" size="sm">
          {CHECK_GATES.length} 道门禁
        </Badge>
      }
    >
      <GuideSection
        id="commands"
        eyebrow="Commands"
        title={
          <span className="flex flex-wrap items-center gap-2">
            0. 命令速查 <Level value="必读" />
          </span>
        }
        description="全部命令都在根目录 package.json 或 scripts/ 下，没有隐藏的构建步骤。"
      >
        <CodeBlock language="bash" filename="常用命令" code={COMMANDS} maxHeight={420} />
        <GuideNote tone="tip" title="Windows 上的一条注意事项">
          <code className="font-mono">pnpm build</code> 会先清空{' '}
          <code className="font-mono">dist/assets</code>；如果本机的批量删除保护拦住了它， 用{' '}
          <code className="font-mono">pnpm exec vite build --emptyOutDir=false</code>{' '}
          验证产物即可——这个差异只影响本机，不影响 CI。
        </GuideNote>
      </GuideSection>

      <GuideSection
        id="loop"
        eyebrow="Loop"
        title="1. 一次改动的闭环"
        description="七步；前三步解决「对不对」，后四步解决「有没有波及别处」。"
      >
        <CodeBlock language="bash" filename="一次改动的闭环" code={LOOP} maxHeight={400} />

        <SectionCard
          title="你现在在第几步？"
          description="点一下圆圈看对应动作"
          bodyClassName="p-4"
        >
          <Steps
            current={step}
            onChange={setStep}
            items={[
              { title: '定范围', description: '模块 / 组件 / 数据层' },
              { title: '改代码', description: 'pnpm dev 肉眼验证' },
              { title: 'typecheck', description: '类型必须过' },
              { title: 'lint', description: '0 error' },
              { title: 'test', description: '改了核心逻辑才必须' },
              { title: '截图兜底', description: '控制台零报错' },
              { title: '写文档', description: 'md + CHANGELOG' },
            ]}
          />
          <div className="mt-3 rounded-md border border-line bg-surface-2/40 px-3 py-2 text-xs leading-5 text-fg-2">
            <span className="font-medium text-fg">第 {step + 1} 步：</span>{' '}
            {[
              '先判断这次改动属于「模块 / 组件 / 数据层」哪一类，决定要改哪几个文件。',
              '改到肉眼正确为止：交互、键盘、深浅色、窄屏都要点一遍。',
              '跑 pnpm typecheck：类型不通过一定有问题，别用 as any 掩盖。',
              '跑 pnpm lint：要求 0 error；新增 warning 要能解释。',
              '跑 pnpm test：改了 lib/ 或 core/ 时必须。',
              '跑 node scripts/screenshot.mjs：批量遍历最容易暴露运行时错误。',
              '更新 apps/docs 与 CHANGELOG，并把验收结论写进去。',
            ][step] ?? ''}
          </div>
        </SectionCard>
      </GuideSection>

      <GuideSection
        id="checks"
        eyebrow="Gates"
        title="2. 自动化检查"
        description="五道门禁，按执行成本从低到高排列；本地全跑一遍通常在 1 分钟内。"
      >
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="n-table w-full text-left">
            <thead>
              <tr>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">门禁</th>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">实际命令</th>
                <th className="h-9 px-4 text-2xs font-medium text-fg-3">判定标准</th>
              </tr>
            </thead>
            <tbody>
              {CHECK_GATES.map(([name, cmd, rule]) => (
                <tr key={name} className="border-t border-line-subtle align-top">
                  <td className="px-4 py-2 text-xs font-medium whitespace-nowrap text-fg">
                    {name}
                  </td>
                  <td className="px-4 py-2 font-mono text-2xs whitespace-nowrap text-primary">
                    {cmd}
                  </td>
                  <td className="px-4 py-2 text-xs leading-5 text-fg-3">{rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              icon: <TestTube2 className="size-4" />,
              title: '单测',
              desc: '纯逻辑与组件行为，vitest + jsdom',
            },
            {
              icon: <GitBranch className="size-4" />,
              title: '类型',
              desc: 'strict + noUncheckedIndexedAccess',
            },
            {
              icon: <Wrench className="size-4" />,
              title: '脚本',
              desc: 'Playwright 真实浏览器断言',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-line bg-surface px-3 py-2.5">
              <span className="text-primary">{item.icon}</span>
              <p className="mt-1.5 text-xs font-medium text-fg">{item.title}</p>
              <p className="mt-0.5 text-2xs leading-5 text-fg-3">{item.desc}</p>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection
        id="scripts"
        eyebrow="Scripts"
        title="3. 验收脚本怎么写"
        description="scripts/ 下的脚本都是「真人会用浏览器做什么」的自动化版本：只用可访问性选择器，不绑 class。"
      >
        <CodeBlock
          language="js"
          filename="scripts/verify-*.mjs"
          code={SCRIPT_SPEC}
          maxHeight={420}
        />

        <SectionCard
          title="已有脚本"
          description="新增功能时优先扩展它们，而不是另起一个"
          bodyClassName="px-0"
        >
          <Descriptions
            className="p-4"
            columns={2}
            size="sm"
            items={[
              { label: 'screenshot.mjs', value: '全部路由（含 7 页指南）+ 深色态，控制台零错误' },
              {
                label: 'verify-gallery-guide.mjs',
                value: '组件橱窗 / 搜索 / 详情弹窗 / 指南 7 页 / 11 分类',
              },
              { label: 'verify-i18n-smoke.mjs', value: '英文模式下无缺词条' },
              { label: 'verify-assistant.mjs', value: 'AI 助手 8 步全链路 + 截图' },
              { label: 'check-theme.mjs', value: '深浅色切换后图表 canvas 仍正常' },
              { label: 'check-layout.mjs', value: '侧栏折叠后图标水平偏移 0px' },
              { label: 'check-transition.mjs', value: '主题扩散动画逐帧采样' },
              { label: 'verify-topbar.mjs', value: '8 档宽度下顶栏无横向溢出' },
            ]}
          />
        </SectionCard>
      </GuideSection>

      <GuideSection
        id="commit"
        eyebrow="Commit"
        title="4. 提交与变更记录"
        description="提交信息用约定式格式；CHANGELOG 按「新增 / 重做 / 修复 / 验收」分组，验收结论要写进去。"
      >
        <CodeBlock language="bash" filename="提交与变更记录" code={COMMIT} maxHeight={280} />
        <GuideNote tone="tip" title="为什么验收结论要进 CHANGELOG">
          三个月后回看「这次改了组件橱窗」，最想知道的是「当时怎么验证的、有没有已知取舍」，
          而不是「改了哪些文件」。把结论写进去，未来的自己少翻十次提交记录。
        </GuideNote>
      </GuideSection>

      <GuideSection
        id="release"
        eyebrow="Release"
        title="5. 发布前清单"
        description="生产构建与演示构建的唯一区别是 Mock 开关；其余完全一致。"
      >
        <CodeBlock language="bash" filename="发布前" code={RELEASE} maxHeight={260} />

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            rightIcon={<Rocket className="size-3.5" />}
            onClick={() => navigate('/guide/backend')}
          >
            接入后端教程
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/guide/contract')}>
            接口契约
          </Button>
          <Button
            size="sm"
            variant="ghost"
            rightIcon={<CheckCircle2 className="size-3.5" />}
            onClick={() => navigate('/guide/overview')}
          >
            回到总览
          </Button>
        </div>
      </GuideSection>

      <GuideNext to="/guide/overview" label="回到指南总览" desc="从调用链重新看一遍" />
    </GuidePage>
  )
}

/* 保留 SegmentedControl 的导入占位：本页未用到筛选，但保持与其他指南页一致的组件风格 */
void SegmentedControl
void ArrowRight
