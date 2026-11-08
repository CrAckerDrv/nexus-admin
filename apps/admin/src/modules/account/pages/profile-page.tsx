import {
  Building,
  CircleCheck,
  Clock,
  KeyRound,
  Laptop,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Smartphone,
  UserRound,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Descriptions,
  PageContainer,
  PageHeader,
  SectionCard,
  Switch,
  Timeline,
  Tooltip,
  cn,
  formatDateTime,
  toast,
} from '@nexus/ui'
import { useAuthStore } from '@/core/auth-store'
import { useI18n } from '@/i18n'

/**
 * 演示用的「基准时刻」
 *
 * 放在模块作用域而不是 render 里：渲染期调用 `Date.now()` 会让组件变成非纯函数
 * （React Compiler 的 purity 规则也会报错），而这里只需要一个稳定的时间锚点。
 */
const BASE_NOW = Date.now()

const SESSIONS = [
  {
    device: 'MacBook Pro · Edge 141',
    location: '杭州 · 中国',
    ip: '10.126.228.160',
    minutesAgo: 4,
    current: true,
  },
  {
    device: 'iPhone 17 Pro · Safari 19',
    location: '杭州 · 中国',
    ip: '10.126.228.161',
    minutesAgo: 3 * 60,
    current: false,
  },
  {
    device: 'Windows 11 · Chrome 140',
    location: '上海 · 中国',
    ip: '10.168.191.151',
    minutesAgo: 26 * 60,
    current: false,
  },
]

const LOGIN_HISTORY = [
  { title: '成功登录', description: 'Edge 141 · macOS 15 · 杭州', tone: 'success', minutesAgo: 4 },
  { title: '修改密码', description: 'IP 10.126.228.160', tone: 'primary', minutesAgo: 32 * 1440 },
  { title: '绑定两步验证', description: 'TOTP 验证器', tone: 'success', minutesAgo: 96 * 1440 },
  { title: '创建账号', description: '系统管理员邀请加入', tone: 'default', minutesAgo: 620 * 1440 },
] as const

/** 把「多少分钟前」换算成具体时间（依赖模块级基准时刻，保持纯函数） */
function ago(minutes: number) {
  return new Date(BASE_NOW - minutes * 60 * 1000)
}

/**
 * 个人资料页
 *
 * 从「侧边栏底部的两行小字」升级为一个真正的页面：
 * - 左侧身份卡：头像、角色、部门、账号状态 + 账号安全
 * - 右侧三块：基本信息（可复制）/ 登录设备 / 登录历史（时间线）
 *
 * 演示环境不接真实接口，所有写操作以 toast 反馈；接入后端时替换 mutate 即可。
 */
export default function ProfilePage() {
  const user = useAuthStore((state) => state.user)
  const { t } = useI18n()

  return (
    <PageContainer size="md">
      <PageHeader
        title={user?.name ?? 'Ryan Chen'}
        description={user?.email ?? 'admin@nexus.dev'}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ---------------- 左栏：身份卡 + 账号安全 ---------------- */}
        <div className="space-y-3">
          <SectionCard title={t('topbar.profile')} bodyClassName="p-4">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar name={user?.name ?? 'Ryan Chen'} size={72} />
                <Tooltip content={t('common.edit')}>
                  <button
                    type="button"
                    onClick={() => toast.info('演示环境：更换头像')}
                    className="absolute right-0 -bottom-0.5 grid size-6 place-items-center rounded-full bg-surface text-fg-3 shadow-sm ring-2 ring-surface transition-colors hover:text-primary"
                    aria-label="更换头像"
                  >
                    <UserRound className="size-3" />
                  </button>
                </Tooltip>
              </div>
              <p className="mt-3 text-sm font-semibold text-fg">{user?.name ?? 'Ryan Chen'}</p>
              <p className="mt-0.5 text-xs text-fg-3">{user?.roleName ?? '超级管理员'}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                <Badge tone="success" dot>
                  {t('status.online')}
                </Badge>
                <Badge tone="primary">{user?.department ?? '平台技术部'}</Badge>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
              {[
                { icon: <Mail className="size-3.5" />, value: user?.email ?? 'admin@nexus.dev' },
                { icon: <Phone className="size-3.5" />, value: '138 **** 6621' },
                { icon: <MapPin className="size-3.5" />, value: '中国 · 杭州' },
                {
                  icon: <Building className="size-3.5" />,
                  value: user?.department ?? '平台技术部',
                },
                { icon: <Clock className="size-3.5" />, value: '加入于 2024-03-18' },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-fg-2">
                  <span className="text-fg-4">{item.icon}</span>
                  <span className="truncate">{item.value}</span>
                </div>
              ))}
            </div>

            <Button
              className="mt-3"
              variant="secondary"
              block
              onClick={() => toast.info('演示环境：编辑资料')}
            >
              {t('common.edit')}
            </Button>
          </SectionCard>

          <SectionCard title="账号安全" bodyClassName="space-y-3 p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-fg-3">
                <KeyRound className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-fg">登录密码</p>
                <p className="text-2xs text-fg-3">上次修改 32 天前</p>
              </div>
              <Button size="xs" variant="ghost" onClick={() => toast.info('演示环境：修改密码')}>
                修改
              </Button>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-fg-3">
                <ShieldCheck className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-fg">两步验证</p>
                <p className="text-2xs text-fg-3">使用 TOTP 验证器</p>
              </div>
              <Switch size="sm" defaultChecked />
            </div>
          </SectionCard>
        </div>

        {/* ---------------- 右栏 ---------------- */}
        <div className="space-y-3">
          <SectionCard title="基本信息" description="用于团队协作与通知" bodyClassName="p-4">
            <Descriptions
              columns={2}
              items={[
                { label: '用户 ID', value: user?.id ?? 'u_1001', copyable: true },
                { label: '角色', value: user?.roleName ?? '超级管理员' },
                { label: '部门', value: user?.department ?? '平台技术部' },
                { label: '职位', value: '前端架构师' },
                { label: '邮箱', value: user?.email ?? 'admin@nexus.dev', copyable: true },
                { label: '手机', value: '138 **** 6621' },
                { label: '办公地点', value: '杭州 · 西溪园区 A3' },
                { label: '工号', value: 'NX-1001' },
              ]}
            />
          </SectionCard>

          <SectionCard
            title="登录设备"
            description={`${SESSIONS.length} 台设备`}
            extra={
              <Button
                size="xs"
                variant="ghost"
                onClick={() => toast.success('已登出其他设备（演示）')}
              >
                登出其他设备
              </Button>
            }
            bodyClassName="p-3"
          >
            <div className="space-y-2">
              {SESSIONS.map((session) => (
                <div
                  key={session.ip}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md border px-2.5 py-2',
                    session.current ? 'border-primary/30 bg-primary-weak/40' : 'border-line',
                  )}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface text-fg-3">
                    {session.device.includes('iPhone') ? (
                      <Smartphone className="size-3.5" />
                    ) : (
                      <Laptop className="size-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-fg">{session.device}</p>
                    <p className="truncate text-2xs text-fg-3">
                      {session.location} · {session.ip}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {session.current ? (
                      <Badge tone="success" size="sm">
                        当前设备
                      </Badge>
                    ) : (
                      <span className="text-2xs text-fg-4">
                        {formatDateTime(ago(session.minutesAgo))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="登录历史" bodyClassName="p-4">
            <Timeline
              items={LOGIN_HISTORY.map((item, index) => ({
                key: String(index + 1),
                title:
                  index === 0 ? (
                    <span className="flex items-center gap-1.5">
                      {item.title}
                      <Badge tone="success" size="sm">
                        <CircleCheck className="size-2.5" />
                        {t('status.success')}
                      </Badge>
                    </span>
                  ) : (
                    item.title
                  ),
                description: item.description,
                time: formatDateTime(ago(item.minutesAgo)),
                tone: item.tone,
              }))}
            />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  )
}
