import { Pause, Play, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { ChangeEvent } from 'react'
import type { CellParams, RunnerRotorCell } from '../model/runnerRotor'
import type { BatchExportOptions, BatchExportResult } from '../types'
import { BatchExportControls } from './BatchExportControls'
import styles from './ObservationStage.module.css'

interface ModelControlsProps {
  addingCell: boolean
  cellCount: number
  onAddCell: () => void
  onChange: (params: CellParams) => void
  onClearLocalData: () => void
  onExport: (options: BatchExportOptions) => void
  onReset: () => void
  onTogglePause: () => void
  params: CellParams
  paused: boolean
  snapshot: RunnerRotorCell
  batchExportAvailable: boolean
  batchExporting: boolean
  batchExportResult: BatchExportResult | null
  localDataAvailable: boolean
}

type ScientificParamKey = 'drRun' | 'drTurn' | 'omegaTurn' | 'tauRun' | 'tauTurn'

interface ControlDefinition {
  key: ScientificParamKey
  label: string
  max: number
  min: number
  step: number
  symbol: string
  unit: string
}

const controls: ControlDefinition[] = [
  {
    key: 'omegaTurn',
    label: '转向角速度',
    max: 0.3,
    min: 0.01,
    step: 0.001,
    symbol: 'Ωturn',
    unit: 'rad/min',
  },
  { key: 'drRun', label: 'Run 角扩散', max: 0.1, min: 0, step: 0.001, symbol: 'Dr,run', unit: 'min⁻¹' },
  { key: 'drTurn', label: 'Turn 角扩散', max: 0.1, min: 0, step: 0.001, symbol: 'Dr,turn', unit: 'min⁻¹' },
  { key: 'tauRun', label: 'Run 平均时长', max: 100, min: 5, step: 0.1, symbol: 'τrun', unit: 'min' },
  { key: 'tauTurn', label: 'Turn 平均时长', max: 40, min: 2, step: 0.1, symbol: 'τturn', unit: 'min' },
]

const formatValue = (key: ScientificParamKey, value: number) =>
  key.startsWith('tau') ? value.toFixed(1) : value.toFixed(3)

export function ModelControls({
  addingCell,
  cellCount,
  onAddCell,
  onChange,
  onClearLocalData,
  onExport,
  onReset,
  onTogglePause,
  params,
  paused,
  snapshot,
  batchExportAvailable,
  batchExporting,
  batchExportResult,
  localDataAvailable,
}: ModelControlsProps) {
  const handleChange = (control: ControlDefinition) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...params, [control.key]: Number(event.target.value) })
  }
  const direction = snapshot.chirality === 1 ? 'CCW ↺' : 'CW ↻'

  return (
    <aside className={styles.modelPanel} aria-label="Runner-Rotor 模型参数">
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.label}>SCIENTIFIC MODEL</p>
          <h2>MCF-10A / collagen</h2>
        </div>
        <span className={styles.paperPreset}>TABLE I</span>
      </div>

      <div className={styles.liveReadout} aria-live="polite">
        <span className={`${styles.statePill} ${snapshot.state === 'turn' ? styles.turnState : ''}`}>
          {snapshot.state.toUpperCase()}
        </span>
        <span>{snapshot.state === 'turn' ? direction : 'POLARIZED →'}</span>
        <span>{cellCount} cells</span>
      </div>

      <div className={styles.controls}>
        {controls.map((control) => (
          <label className={styles.control} key={control.key}>
            <span className={styles.controlHeader}>
              <span>
                <b>{control.symbol}</b>
                {control.label}
              </span>
              <output htmlFor={`control-${control.key}`}>
                {formatValue(control.key, params[control.key])} {control.unit}
              </output>
            </span>
            <input
              id={`control-${control.key}`}
              aria-label={control.label}
              max={control.max}
              min={control.min}
              step={control.step}
              type="range"
              value={params[control.key]}
              onChange={handleChange(control)}
            />
          </label>
        ))}
      </div>

      <div className={styles.modelActions}>
        <button type="button" disabled={addingCell} onClick={onAddCell}>
          <Plus aria-hidden="true" />
          {addingCell ? '添加中' : '添加细胞'}
        </button>
        <button type="button" onClick={onTogglePause}>
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          {paused ? '继续' : '暂停'}
        </button>
        <button type="button" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          清空尾迹
        </button>
        {localDataAvailable ? (
          <button type="button" onClick={onClearLocalData}>
            <Trash2 aria-hidden="true" />
            清除本地数据
          </button>
        ) : null}
      </div>

      <BatchExportControls
        available={batchExportAvailable}
        exporting={batchExporting}
        onExport={onExport}
        result={batchExportResult}
      />

      <ol className={styles.layerFlow} aria-label="科学状态到图形模型的映射">
        <li>virtual cell center</li>
        <li>cell polarity</li>
        <li>deformable skeleton</li>
        <li>cell membrane</li>
      </ol>
    </aside>
  )
}
