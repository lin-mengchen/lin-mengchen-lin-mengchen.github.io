import {
  Box,
  CircleHelp,
  Eye,
  FileSpreadsheet,
  Focus,
  Layers3,
  MousePointer2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import sampleWorkbookUrl from '../深秋织锦.xlsx?url'
import { stageAtProgress } from './animation/progress'
import { Timeline } from './components/Timeline'
import { UploadPanel } from './components/UploadPanel'
import { ValidationPanel } from './components/ValidationPanel'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { usePlayback } from './hooks/usePlayback'
import { hasBlockingIssues, parseWorkbookBuffer } from './services/excel'
import { PoetryScene } from './scene/PoetryScene'
import type {
  GenerationStyle,
  PoetryGrid,
  ValidationIssue,
  WorkbookParseResult,
} from './types/poetry'

const MAX_FILE_BYTES = 20 * 1024 * 1024

const STAGE_COPY = {
  matrix: { eyebrow: '第一幕', title: '平面字阵', detail: '保留原始行列与空白' },
  curl: { eyebrow: '第二幕', title: '字阵卷曲', detail: '经纬进入三维空间' },
  weave: { eyebrow: '第三幕', title: '折叠成衣', detail: '圆领、袍袖与长摆渐成' },
  reveal: { eyebrow: '第四幕', title: '诗衣成型', detail: '完成后可自由环看' },
} as const

const GENERATION_STYLES = {
  roundCollarRobe: {
    label: '明制圆领袍',
    shortLabel: '圆领袍',
    kicker: '全身成衣 · 礼服轮廓',
    description: '以圆领、袍袖、腰带与长摆组织完整的明制成衣。',
    features: [
      { marker: '领', text: '圆领合襟' },
      { marker: '袖', text: '袍袖垂展' },
      { marker: '带', text: '腰带束身' },
      { marker: '摆', text: '长袍垂褶' },
    ],
  },
  humanUpperBody: {
    label: '人形上身',
    shortLabel: '人形上身',
    kicker: '人物姿态 · 上身构图',
    description: '以线稿中的头肩、双臂、圆领与腰线组织人形上身效果。',
    features: [
      { marker: '首', text: '头肩定形' },
      { marker: '姿', text: '双臂姿态' },
      { marker: '襟', text: '圆领上衣' },
      { marker: '腰', text: '束带收束' },
    ],
  },
} as const

const GENERATION_STYLE_ORDER: GenerationStyle[] = ['roundCollarRobe', 'humanUpperBody']

function readFailure(message: string): ValidationIssue[] {
  return [{ code: 'READ_ERROR', severity: 'error', message }]
}

function EmptyScene() {
  return (
    <div className="empty-scene">
      <div className="empty-orbit" aria-hidden="true">
        <span className="empty-glyph glyph-one">诗</span>
        <span className="empty-glyph glyph-two">衣</span>
        <span className="empty-glyph glyph-three">锦</span>
      </div>
      <p className="empty-kicker">等待一方字阵</p>
      <h2>让诗句沿经纬起身</h2>
      <p>导入 Excel 后，每个有效单元格都会成为衣上独立的一枚字。</p>
    </div>
  )
}

export default function App() {
  const playback = usePlayback()
  const [grid, setGrid] = useState<PoetryGrid | null>(null)
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [workbookBuffer, setWorkbookBuffer] = useState<ArrayBuffer | null>(null)
  const [workbookName, setWorkbookName] = useState('')
  const [resetSignal, setResetSignal] = useState(0)
  const [sceneError, setSceneError] = useState('')
  const [generationStyle, setGenerationStyle] = useState<GenerationStyle>('roundCollarRobe')
  const loadRequestRef = useRef(0)

  const applyParseResult = useCallback((result: WorkbookParseResult) => {
    setIssues(result.issues)
    setSceneError('')
    playback.reset()
    setResetSignal((value) => value + 1)

    if (hasBlockingIssues(result) || !result.grid) {
      setGrid(null)
      return
    }

    setGrid(result.grid)
  }, [playback.reset])

  const loadBuffer = useCallback(async (
    buffer: ArrayBuffer,
    fileName: string,
    sheetName?: string,
    requestId = ++loadRequestRef.current,
  ) => {
    setLoading(true)
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    if (requestId !== loadRequestRef.current) return
    const result = parseWorkbookBuffer(buffer, fileName, sheetName)
    if (requestId !== loadRequestRef.current) return
    setWorkbookBuffer(buffer)
    setWorkbookName(fileName)
    applyParseResult(result)
    setLoading(false)
  }, [applyParseResult])

  const loadSample = useCallback(async () => {
    const requestId = ++loadRequestRef.current
    setLoading(true)
    try {
      const response = await fetch(sampleWorkbookUrl)
      if (!response.ok) throw new Error(`示例文件请求失败（${response.status}）`)
      const buffer = await response.arrayBuffer()
      if (requestId !== loadRequestRef.current) return
      await loadBuffer(buffer, '深秋织锦.xlsx', undefined, requestId)
    } catch (error) {
      if (requestId !== loadRequestRef.current) return
      const message = error instanceof Error ? error.message : '无法加载示例工作簿。'
      setGrid(null)
      setIssues(readFailure(message))
      setLoading(false)
    }
  }, [loadBuffer])

  useEffect(() => {
    void loadSample()
  }, [loadSample])

  const handleFile = useCallback((file: File) => {
    const requestId = ++loadRequestRef.current
    if (file.size > MAX_FILE_BYTES) {
      setGrid(null)
      setIssues(readFailure('文件超过 20 MB。请精简工作簿后重试。'))
      setLoading(false)
      return
    }

    void file.arrayBuffer()
      .then((buffer) => {
        if (requestId !== loadRequestRef.current) return
        return loadBuffer(buffer, file.name, undefined, requestId)
      })
      .catch(() => {
        if (requestId !== loadRequestRef.current) return
        setGrid(null)
        setIssues(readFailure('浏览器无法读取该文件。'))
        setLoading(false)
      })
  }, [loadBuffer])

  const handleSheetChange = (sheetName: string) => {
    if (workbookBuffer) {
      const requestId = ++loadRequestRef.current
      void loadBuffer(workbookBuffer, workbookName, sheetName, requestId)
    }
  }

  const handleSceneError = useCallback((message: string) => {
    setSceneError(message)
  }, [])

  const handleGenerationStyleChange = (style: GenerationStyle) => {
    if (style === generationStyle) return
    setGenerationStyle(style)
    setSceneError('')
    playback.reset()
    setResetSignal((value) => value + 1)
  }

  const handlePrimaryAction = () => {
    if (!grid) return
    if (playback.status === 'playing') {
      playback.pause()
      return
    }
    if (playback.status === 'paused') {
      playback.resume()
      return
    }
    setResetSignal((value) => value + 1)
    playback.playFromStart()
  }

  const handleReplay = () => {
    if (!grid) return
    setResetSignal((value) => value + 1)
    playback.replay()
  }

  const handleSeek = (value: number) => {
    if (!grid) return
    if (value < 0.999) setResetSignal((signal) => signal + 1)
    playback.seek(value)
  }

  const stageName = stageAtProgress(playback.progress)
  const stage = generationStyle === 'humanUpperBody'
    ? {
      ...STAGE_COPY[stageName],
      detail: stageName === 'weave'
        ? '人首、双臂与圆领渐成'
        : stageName === 'reveal'
          ? '人物姿态可自由环看'
          : STAGE_COPY[stageName].detail,
      title: stageName === 'reveal' ? '人形成型' : STAGE_COPY[stageName].title,
    }
    : STAGE_COPY[stageName]
  const activeGenerationStyle = GENERATION_STYLES[generationStyle]
  const uniqueGlyphs = useMemo(
    () => new Set(grid?.characters.map((character) => character.char) ?? []).size,
    [grid],
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="brand-block">
          <div className="brand-seal" aria-hidden="true">衣</div>
          <div>
            <p className="brand-overline">诗词织锦</p>
            <h1>诗衣</h1>
            <p className="brand-latin">POETRY GARMENT</p>
          </div>
        </header>

        <UploadPanel loading={loading} onFile={handleFile} onLoadSample={loadSample} />

        <section className="panel-section source-section" aria-labelledby="source-heading">
          <div className="section-heading-row">
            <span className="section-kicker">贰 · 察形</span>
            <Layers3 size={16} aria-hidden="true" />
          </div>
          <h2 id="source-heading">字阵结构</h2>

          {grid ? (
            <>
              <div className="source-file-row">
                <FileSpreadsheet size={17} aria-hidden="true" />
                <div>
                  <strong title={grid.fileName}>{grid.fileName}</strong>
                  <span>{grid.sheetName} · {grid.colCount} 列 × {grid.rowCount} 行</span>
                </div>
              </div>

              {grid.sheetNames.length > 1 && (
                <label className="sheet-select-label">
                  工作表
                  <select value={grid.sheetName} onChange={(event) => handleSheetChange(event.target.value)}>
                    {grid.sheetNames.map((name) => <option key={name}>{name}</option>)}
                  </select>
                </label>
              )}

              <dl className="metric-grid">
                <div><dt>入衣字符</dt><dd>{grid.characters.length.toLocaleString('zh-CN')}</dd></div>
                <div><dt>唯一字形</dt><dd>{uniqueGlyphs.toLocaleString('zh-CN')}</dd></div>
                <div><dt>空白槽位</dt><dd>{grid.emptyCellCount.toLocaleString('zh-CN')}</dd></div>
                <div><dt>字符守恒</dt><dd className="metric-safe">一一对应</dd></div>
              </dl>
              <ValidationPanel issues={issues} sceneError={sceneError} />
            </>
          ) : (
            <div className="source-placeholder">
              <CircleHelp size={18} aria-hidden="true" />
              <p>{loading ? '正在读取行列、字素与空白…' : '导入后将在这里核对字阵。'}</p>
              <ValidationPanel issues={issues} sceneError={sceneError} />
            </div>
          )}
        </section>

        <section className="panel-section craft-section" aria-labelledby="craft-heading">
          <div className="section-heading-row">
            <span className="section-kicker">叁 · 成衣</span>
            <Box size={16} aria-hidden="true" />
          </div>
          <h2 id="craft-heading">生成样式</h2>
          <div className="generation-style-switch" role="radiogroup" aria-labelledby="craft-heading">
            {GENERATION_STYLE_ORDER.map((style) => {
              const option = GENERATION_STYLES[style]
              const isActive = generationStyle === style

              return (
                <button
                  key={style}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`generation-style-option${isActive ? ' is-active' : ''}`}
                  onClick={() => handleGenerationStyleChange(style)}
                >
                  <span>{option.shortLabel}</span>
                </button>
              )
            })}
          </div>
          <div className="generation-style-summary" aria-live="polite">
            <p>{activeGenerationStyle.kicker}</p>
            <h3>{activeGenerationStyle.label}</h3>
            <span>{activeGenerationStyle.description}</span>
          </div>
          <ul className="feature-list">
            {activeGenerationStyle.features.map((feature) => (
              <li key={feature.marker}>
                <span>{feature.marker}</span>
                {feature.text}
              </li>
            ))}
          </ul>
        </section>

        <div className="privacy-note">
          <ShieldCheck size={15} aria-hidden="true" />
          Excel 全程在浏览器本地处理
        </div>
      </aside>

      <main className="main-stage">
        <header className="stage-header">
          <div className="stage-title-group">
            <p>{stage.eyebrow} · {stage.detail}</p>
            <h2>{stage.title}</h2>
          </div>
          <div className="stage-actions">
            <span className={`status-chip status-${playback.status}`}>
              <span className="status-dot" />
              {playback.status === 'playing'
                ? '织造中'
                : playback.status === 'paused'
                  ? '已暂停'
                  : playback.status === 'complete'
                    ? '可自由环看'
                    : '二维原阵'}
            </span>
            <button
              type="button"
              className="icon-button reset-camera-button"
              onClick={() => setResetSignal((value) => value + 1)}
              disabled={!grid}
              aria-label="重置三维视角"
              title="重置视角"
            >
              <Focus size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <section
          className="canvas-stage"
          aria-label="诗衣三维画布"
          data-generation-style={generationStyle}
        >
          <div className="corner-mark corner-mark-top" aria-hidden="true" />
          <div className="corner-mark corner-mark-bottom" aria-hidden="true" />
          {grid ? (
            <SceneErrorBoundary
              key={`${grid.fileName}-${grid.sheetName}-${grid.characters.length}-${generationStyle}`}
              onError={handleSceneError}
            >
              <PoetryScene
                grid={grid}
                style={generationStyle}
                progressRef={playback.progressRef}
                resetSignal={resetSignal}
                onSceneError={handleSceneError}
              />
            </SceneErrorBoundary>
          ) : <EmptyScene />}

          {grid && (
            <div className="canvas-caption">
              <Sparkles size={14} aria-hidden="true" />
              <span>{grid.characters.length.toLocaleString('zh-CN')} 字 · 坐标守恒 · GPU 图集实例</span>
            </div>
          )}

          <div className={`interaction-hint ${playback.status === 'complete' ? 'is-active' : ''}`}>
            <MousePointer2 size={15} aria-hidden="true" />
            <span>左键旋转 · 滚轮缩放 · 右键平移</span>
            <Eye size={15} aria-hidden="true" />
          </div>
        </section>

        <Timeline
          progress={playback.progress}
          status={playback.status}
          disabled={!grid || loading}
          onPrimaryAction={handlePrimaryAction}
          onReplay={handleReplay}
          onSeek={handleSeek}
        />
      </main>
    </div>
  )
}
