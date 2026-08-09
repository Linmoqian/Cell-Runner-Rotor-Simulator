import { Download } from 'lucide-react'
import { useState } from 'react'
import type { BatchExportOptions, BatchExportResult } from '../types'
import styles from './ObservationStage.module.css'

interface BatchExportControlsProps {
  available: boolean
  exporting: boolean
  onExport: (options: BatchExportOptions) => void
  result: BatchExportResult | null
}

interface BatchField {
  key: keyof BatchExportOptions
  label: string
  max: number
  min: number
  step: number
}

const batchFields: BatchField[] = [
  { key: 'seed', label: '随机种子', max: 4294967295, min: 0, step: 1 },
  { key: 'cellCount', label: '细胞数', max: 500, min: 1, step: 1 },
  { key: 'durationMinutes', label: '时长 (min)', max: 10000, min: 0.1, step: 0.1 },
  { key: 'dtMinutes', label: '时间步 (min)', max: 10, min: 0.001, step: 0.001 },
]

export function BatchExportControls({ available, exporting, onExport, result }: BatchExportControlsProps) {
  const [options, setOptions] = useState<BatchExportOptions>({
    cellCount: 32,
    dtMinutes: 0.1,
    durationMinutes: 240,
    seed: 20260810,
  })

  return (
    <section className={styles.batchExport} aria-label="可重复科学批处理">
      <div className={styles.batchExportHeading}>
        <span>REPRODUCIBLE EXPORT</span>
        <span>WEB</span>
      </div>
      <div className={styles.batchInputs}>
        {batchFields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <input
              aria-label={field.label}
              max={field.max}
              min={field.min}
              step={field.step}
              type="number"
              value={options[field.key]}
              onChange={(event) =>
                setOptions((current) => ({ ...current, [field.key]: Number(event.target.value) }))
              }
            />
          </label>
        ))}
      </div>
      <button
        className={styles.batchExportButton}
        disabled={!available || exporting}
        type="button"
        onClick={() => onExport(options)}
      >
        <Download aria-hidden="true" />
        {exporting ? '导出中' : '导出原始统计'}
      </button>
      {available ? null : <p>桌面运行时暂未提供批处理导出。</p>}
      {result ? (
        <div className={styles.batchDownloads} aria-live="polite">
          <span>{result.manifest.stepCount} steps · 下载数据</span>
          {result.files.map((file) => (
            <a href={file.url} key={file.filename}>
              {file.filename}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  )
}
