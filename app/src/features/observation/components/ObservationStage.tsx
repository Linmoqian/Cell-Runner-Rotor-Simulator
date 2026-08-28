import { useEffect, useMemo, useState } from 'react'
import { useAppSelector } from '../../../store/hooks'
import {
  addCell,
  clearLocalSimulationData,
  exportBatchExperiment,
  updateObservatory,
} from '../services/simulationClient'
import type { BatchExportOptions, BatchExportResult, BootstrapData } from '../types'
import {
  createRunnerRotorCell,
  MCF10A_COLLAGEN,
  type CellParams,
  type RunnerRotorCell,
} from '../model/runnerRotor'
import { ModelControls } from './ModelControls'
import { ObservationViewport } from './ObservationViewport'
import { NeedleBox } from '../../needle-box/components/NeedleBox'
import styles from './ObservationStage.module.css'

interface ObservationStageProps {
  bootstrap: BootstrapData
}

const getParams = (observatory: BootstrapData['observatories'][number]): CellParams =>
  observatory.params ?? MCF10A_COLLAGEN

function useBatchExport() {
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<BatchExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const exportBatch = async (options: BatchExportOptions) => {
    setExporting(true)
    setError(null)
    try {
      const nextResult = await exportBatchExperiment(options)
      setResult(nextResult)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '批量导出失败')
    } finally {
      setExporting(false)
    }
  }
  useEffect(
    () => () => {
      for (const file of result?.files ?? []) URL.revokeObjectURL(file.url)
    },
    [result],
  )
  return { error, exportBatch, exporting, result }
}

export function ObservationStage({ bootstrap }: ObservationStageProps) {
  const { activeStageId, stages } = useAppSelector((state) => state.stages)
  const observatory =
    bootstrap.observatories.find((candidate) => candidate.id === activeStageId) ?? bootstrap.observatories[0]
  const initialCells = useMemo(
    () => bootstrap.cells.filter((cell) => cell.observatoryId === observatory.id),
    [bootstrap.cells, observatory.id],
  )
  const [addingCell, setAddingCell] = useState(false)
  const [serviceError, setServiceError] = useState<string | null>(null)
  const [cellCount, setCellCount] = useState(initialCells.length)
  const [params, setParams] = useState(() => getParams(observatory))
  const [paused, setPaused] = useState(observatory.paused)
  const [resetCount, setResetCount] = useState(0)
  const batchExport = useBatchExport()
  const [snapshot, setSnapshot] = useState<RunnerRotorCell>(() => createRunnerRotorCell(initialCells[0]))
  const activeStageNumber = Math.max(1, stages.findIndex((stage) => stage.id === observatory.id) + 1)

  useEffect(() => {
    setParams(getParams(observatory))
    setPaused(observatory.paused)
    setCellCount(initialCells.length)
    setSnapshot(createRunnerRotorCell(initialCells[0]))
  }, [initialCells, observatory])

  const handleParamsChange = (nextParams: CellParams) => {
    setParams(nextParams)
    void updateObservatory(observatory.id, { params: nextParams }).catch((error: Error) => {
      setServiceError(error.message)
    })
  }

  const handleTogglePause = () => {
    const nextPaused = !paused
    setPaused(nextPaused)
    void updateObservatory(observatory.id, { paused: nextPaused }).catch((error: Error) => {
      setServiceError(error.message)
    })
  }

  const handleAddCell = async () => {
    setAddingCell(true)
    setServiceError(null)
    try {
      await addCell(observatory.id)
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : '添加细胞失败')
    } finally {
      setAddingCell(false)
    }
  }

  const handleClearLocalData = async () => {
    const confirmed = window.confirm(
      '将删除此浏览器中 Cell Runner 的观察台、参数、随机种子和科学检查点。不会影响其他网站或桌面数据。确定继续吗？',
    )
    if (!confirmed) return
    try {
      await clearLocalSimulationData()
      window.location.reload()
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : '清除本地实验数据失败')
    }
  }

  return (
    <section className={styles.layout} aria-label="Runner-Rotor 细胞群体观察台">
      <ModelControls
        addingCell={addingCell}
        cellCount={cellCount}
        onAddCell={() => void handleAddCell()}
        onChange={handleParamsChange}
        onClearLocalData={() => void handleClearLocalData()}
        onExport={(options) => void batchExport.exportBatch(options)}
        onReset={() => setResetCount((count) => count + 1)}
        onTogglePause={handleTogglePause}
        params={params}
        paused={paused}
        snapshot={snapshot}
        batchExportAvailable={!window.__TAURI__}
        batchExporting={batchExport.exporting}
        batchExportResult={batchExport.result}
        localDataAvailable={!window.__TAURI__}
      />
      {serviceError || batchExport.error ? (
        <p className={styles.serviceError} role="alert">
          {serviceError ?? batchExport.error}
        </p>
      ) : null}
      <div className={styles.stageStack} data-observation-stage-id={observatory.id}>
        <ObservationViewport
          activeStageNumber={activeStageNumber}
          initialCells={initialCells}
          observatoryId={observatory.id}
          onSnapshot={(nextSnapshot, nextCellCount) => {
            setSnapshot(nextSnapshot)
            setCellCount(nextCellCount)
          }}
          resetKey={`${observatory.id}-${resetCount}`}
        />
      </div>
      <NeedleBox />
    </section>
  )
}
