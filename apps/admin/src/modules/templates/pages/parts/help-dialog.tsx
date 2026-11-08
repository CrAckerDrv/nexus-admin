import { Badge, Button, Dialog, cn } from '@nexus/ui'

/**
 * 快捷键与交互说明
 *
 * 放在弹窗里而不是侧栏常驻：画布类工具的操作密度高，
 * 常驻说明会长期占据画布空间；但完全不给又会让新手卡住。
 */

const GROUPS: Array<{ title: string; rows: Array<[string, string]> }> = [
  {
    title: '视图',
    rows: [
      ['滚轮 / 双指滑动', '平移画布'],
      ['Ctrl / ⌘ + 滚轮、双指捏合', '以光标为中心缩放'],
      ['空格 + 拖动、中键拖动', '平移画布'],
      ['+ / −', '按档位缩放'],
      ['0', '重置为 100%'],
      ['Shift + 1', '适配全部内容'],
      ['Shift + 2', '适配选中内容'],
      ['双击空白', '取消编辑/收起 AI 输入区（新建请用左侧素材库或右键菜单）'],
      ['拖动右下角小地图', '连续移动视口（不会连带框选画布）'],
      ['左侧素材库 / 右键菜单', '新建节点（双击空白不再新建，避免误触）'],
    ],
  },
  {
    title: '选择与编辑',
    rows: [
      ['单击', '选中节点（开启 AI 跟随时同时打开 AI 对话框）'],
      ['Shift / Ctrl + 单击', '加选或取消选中'],
      ['空白拖动', '框选（Shift 加选）'],
      ['Ctrl / ⌘ + A', '全选'],
      ['底部工具条「编组」', '生成分组框；分组可整体拖动，点标题整组选中'],
      ['拖动节点', '移动（自动对齐吸附，显示参考线）'],
      ['拖四角把手', '缩放节点尺寸'],
      ['双击文本卡片', '就地编辑正文（Esc 取消）；底部 AI 输入区会自动收起'],
      ['悬停 / 选中节点', '顶部菜单：AI、复制、锁定、编组、删除'],
      ['单击节点', '卡片底部展开 AI 输入区（可在工具栏关闭）'],
      ['方向微调', '见下方「对齐与分布」工具条'],
    ],
  },
  {
    title: '连线与文档',
    rows: [
      ['从节点边上的圆点拖出', '建立连线，松开在目标节点上'],
      ['双击连线', '删除该连线'],
      ['Delete / Backspace', '删除选中节点及其连线'],
      ['Ctrl / ⌘ + D', '创建副本'],
      ['Ctrl / ⌘ + G', '把选中节点编组'],
      ['Ctrl / ⌘ + Z', '撤销'],
      ['Ctrl / ⌘ + Shift + Z', '重做'],
      ['A', '打开选中节点的 AI 对话框'],
      ['?', '打开本说明'],
    ],
  },
]

export function CanvasHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="无限画布 · 操作说明"
      description="画布是自研实现：相机、剔除、连线、吸附全部在 @nexus/ui 内，无第三方画布依赖"
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          知道了
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 flex items-center gap-1.5 text-[0.75rem] font-semibold text-fg">
              {group.title}
              <Badge size="sm">{group.rows.length}</Badge>
            </h3>
            <dl className="space-y-1.5">
              {group.rows.map(([keys, action]) => (
                <div key={keys} className="flex flex-col gap-0.5">
                  <dt>
                    <kbd
                      className={cn(
                        'inline-flex rounded-[0.25rem] border border-line bg-surface-2 px-1.5 py-0.5',
                        'font-sans text-[0.625rem] font-medium text-fg-2',
                      )}
                    >
                      {keys}
                    </kbd>
                  </dt>
                  <dd className="text-[0.6875rem] leading-4 text-fg-3">{action}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-4 rounded-md border border-line-subtle bg-surface-2/60 px-3 py-2 text-[0.6875rem] leading-5 text-fg-3">
        画布操作遵循「手势期间不渲染」的原则：平移缩放与拖动节点只改 CSS transform，
        松手后才提交数据。因此即使有上千个节点，交互仍然跟手。
        右下角状态条的「已挂载」就是剔除后真正渲染的节点数。
      </p>
    </Dialog>
  )
}
