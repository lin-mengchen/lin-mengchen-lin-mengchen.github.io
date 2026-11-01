import { FileSpreadsheet, RotateCcw, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'

interface UploadPanelProps {
  loading: boolean
  onFile: (file: File) => void
  onLoadSample: () => void
}

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls']

function isExcelFile(file: File): boolean {
  const lowerName = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
}

export function UploadPanel({ loading, onFile, onLoadSample }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const acceptFile = (file: File | undefined) => {
    if (file && isExcelFile(file)) onFile(file)
  }

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setDragging(false)
    acceptFile(event.dataTransfer.files?.[0])
  }

  return (
    <section className="panel-section upload-section" aria-labelledby="upload-heading">
      <div className="section-heading-row">
        <span className="section-kicker">壹 · 选字</span>
        <FileSpreadsheet size={16} aria-hidden="true" />
      </div>
      <h2 id="upload-heading">导入诗词字阵</h2>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleInput}
      />
      <button
        type="button"
        className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        disabled={loading}
      >
        <span className="upload-medallion"><Upload size={20} aria-hidden="true" /></span>
        <span className="drop-title">{loading ? '正在展开工作簿…' : '选择或拖入 Excel'}</span>
        <span className="drop-hint">支持 XLSX、XLS · 文件仅在本机解析</span>
      </button>
      <button type="button" className="text-button" onClick={onLoadSample} disabled={loading}>
        <RotateCcw size={14} aria-hidden="true" />
        重新载入《深秋织锦》示例
      </button>
    </section>
  )
}
