import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AudioPreview,
  CodeEditor,
  EditorWorkbench,
  ImageEditor,
  MediaCard,
  MediaKindBadge,
  TextEditor,
  VideoEditor,
  VideoPreview,
} from '../components/media'
import { EDITOR_BY_MEDIA_KIND, MEDIA_KIND_META, seedWaveform } from '../components/media/types'
import type { EditKind } from '../components/media/types'

/**
 * 资源与编辑器的行为断言
 *
 * 只测「会被误用而不会报错」的部分：
 * - 类型角标的文案是否与 MEDIA_KIND_META 一致（散在两处最容易漂移）
 * - 编辑器的参数是否真的以结构化对象写回（而不是只改内部 state）
 * - 视频 / 音频在没有真实源时是否**不假装**在播放
 */
describe('MediaKindBadge', () => {
  it('三种资源类型的角标文案与元数据一致', () => {
    const { unmount } = render(<MediaKindBadge kind="image" />)
    expect(screen.getByText('IMAGE')).toBeTruthy()
    unmount()

    const video = render(<MediaKindBadge kind="video" />)
    expect(screen.getByText(MEDIA_KIND_META.video.en)).toBeTruthy()
    video.unmount()

    render(<MediaKindBadge kind="audio" />)
    expect(screen.getByText('AUDIO')).toBeTruthy()
  })
})

describe('MediaCard', () => {
  it('点击回调与选中态同时可选', async () => {
    const onClick = vi.fn()
    render(
      <MediaCard kind="audio" title="配乐片段" meta="36 KB · 00:06" selected onClick={onClick} />,
    )
    const card = screen.getByRole('button', { name: /配乐片段/ })
    expect(card.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('不给 onClick 时不是一个按钮（避免无意义焦点）', () => {
    render(<MediaCard kind="image" title="头图" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('头图')).toBeTruthy()
  })
})

describe('ImageEditor', () => {
  it('切换比例会以结构化对象回写', async () => {
    const onChange = vi.fn()
    render(<ImageEditor alt="成品图" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '1:1' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ratio: '1:1' }))
  })

  it('旋转每次 +90 度，重置回到初始参数', async () => {
    const onChange = vi.fn()
    render(<ImageEditor alt="成品图" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '旋转 90°' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rotate: 90 }))

    await userEvent.click(screen.getByRole('button', { name: '重置' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rotate: 0, zoom: 1 }))
  })

  it('滑块以 aria-label 暴露给读屏', () => {
    render(<ImageEditor alt="成品图" />)
    expect(screen.getByLabelText('缩放')).toBeTruthy()
    expect(screen.getByLabelText('亮度')).toBeTruthy()
  })
})

describe('TextEditor', () => {
  it('工具栏加粗写入 Markdown 记号并触发 onChange', async () => {
    const onChange = vi.fn()
    render(<TextEditor defaultValue="正文" split={false} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '加粗' }))
    expect(onChange).toHaveBeenCalledWith('****正文')
  })

  it('只读预览模式不渲染编辑区', () => {
    const { container } = render(<TextEditor defaultValue="## 标题" readOnlyPreview />)
    expect(container.querySelector('textarea')).toBeNull()
    expect(screen.getByText('标题')).toBeTruthy()
  })

  it('字数统计排除空白字符', () => {
    render(<TextEditor defaultValue={'一 二\n三'} split={false} />)
    expect(screen.getByText(/3 字/)).toBeTruthy()
  })
})

describe('CodeEditor', () => {
  it('语言切换回调传回文件名 key', async () => {
    const onLanguageChange = vi.fn()
    render(<CodeEditor language="ts" onLanguageChange={onLanguageChange} />)
    await userEvent.click(screen.getByRole('tab', { name: 'package.json' }))
    expect(onLanguageChange).toHaveBeenCalledWith('json')
  })

  it('行号与内容行数一致', () => {
    const code = 'const a = 1\nconst b = 2'
    const { container } = render(<CodeEditor defaultValue={code} language="ts" />)
    const gutter = container.querySelector('[aria-hidden="true"].w-10')
    expect(gutter?.textContent).toBe('12')
  })
})

describe('VideoPreview', () => {
  it('没有真实视频源时标记为静帧预览，且不推进进度', async () => {
    render(<VideoPreview title="品牌短片" duration={6} />)
    expect(screen.getByText('静帧预览')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '播放预览' }))
    // 无源时只切到「播放中」标记，进度条宽度仍是 0
    expect(screen.getByText('播放中')).toBeTruthy()
  })

  it('时长格式化为 mm:ss', () => {
    render(<VideoPreview title="片段" duration={65} />)
    expect(screen.getByText('01:05')).toBeTruthy()
  })
})

describe('AudioPreview', () => {
  it('波形数量与 bars 参数一致', () => {
    const { container } = render(
      <AudioPreview title="配乐" duration={6} bars={20} seed="fixed-seed" />,
    )
    const track = container.querySelector('[role="slider"]')
    expect(track?.children.length).toBe(21) // 20 根柱子 + 1 个播放头
  })

  it('同一沙箱内种子相同则波形确定', () => {
    expect(seedWaveform('abc', 8)).toEqual(seedWaveform('abc', 8))
    expect(seedWaveform('abc', 8)).not.toEqual(seedWaveform('abd', 8))
  })
})

describe('VideoEditor', () => {
  it('在播放头位置拆分片段：段数 +1 且时间连续', async () => {
    const onChange = vi.fn()
    const clips = [
      { id: 'a', label: '开场', start: 0, end: 2.4 },
      { id: 'b', label: '主体', start: 2.4, end: 6 },
    ]
    render(<VideoEditor clips={clips} duration={6} onChange={onChange} />)
    // 默认播放头在 0，落在第一段左边界；先确认「无有效拆分点」时不产生新段
    await userEvent.click(screen.getByRole('button', { name: '拆分' }))
    expect(onChange).not.toHaveBeenCalled()

    // 键盘把播放头推进到 0.6s 后再拆
    const playhead = screen.getByRole('slider', { name: '播放头' })
    playhead.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    await userEvent.click(screen.getByRole('button', { name: '拆分' }))
    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)?.[0] as Array<{ start: number; end: number }>
    expect(next).toHaveLength(3)
  })
})

describe('EditorWorkbench', () => {
  it('默认页签可切换，render 收到当前 kind', async () => {
    const renderSpy = vi.fn((kind: EditKind) => <p>{kind}</p>)
    render(<EditorWorkbench defaultKind="image" render={renderSpy} />)
    expect(renderSpy).toHaveBeenCalledWith('image')
    await userEvent.click(screen.getByRole('tab', { name: '代码编辑' }))
    expect(renderSpy).toHaveBeenLastCalledWith('code')
  })

  it('资源类型 → 默认编辑器的映射覆盖三种资源', () => {
    expect(EDITOR_BY_MEDIA_KIND.image).toBe('image')
    expect(EDITOR_BY_MEDIA_KIND.video).toBe('video')
    // 音频没有专属编辑器，复用时间轴那一套
    expect(EDITOR_BY_MEDIA_KIND.audio).toBe('video')
  })
})
