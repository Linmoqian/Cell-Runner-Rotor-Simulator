import { useEffect, useMemo, useState } from 'react'
import { useAppSelector } from '../../../store/hooks'
import { addCell, exportBatchExperiment, updateObservatory } from '../services/simulationClient'
import type { BatchExportOptions, BatchExportResult, BootstrapData } from '../types'
import {
  createRunnerRotorCell,
  MCF10A_COLLAGEN,
  type CellParams,
  type RunnerRotorCell,
} from '../model/runnerRotor'
import { ModelControls } from './ModelControls'
import { ObservationViewport } from './ObservationViewport'
import styles from './ObservationStage.module.css'

interface ObservationStageProps {
  bootstrap: BootstrapData
}

const getParams = (observatory: BootstrapData['observatories'][number]): CellParams =>
  observatory.params ?? {
    drRun: observatory.drRun ?? MCF10A_COLLAGEN.drRun,
    drTurn: observatory.drTurn ?? MCF10A_COLLAGEN.drTurn,
    omegaTurn: observatory.omegaTurn ?? MCF10A_COLLAGEN.omegaTurn,
    tauRun: observatory.tauRun ?? MCF10A_COLLAGEN.tauRun,
    tauTurn: observatory.tauTurn ?? MCF10A_COLLAGEN.tauTurn,
    vRun: observatory.vRun ?? MCF10A_COLLAGEN.vRun,
    vTurn: observatory.vTurn ?? MCF10A_COLLAGEN.vTurn,
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
  const [batchExporting, setBatchExporting] = useState(false)
  const [batchExportResult, setBatchExportResult] = useState<BatchExportResult | null>(null)
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

  const handleBatchExport = async (options: BatchExportOptions) => {
    setBatchExporting(true)
    setServiceError(null)
    try {
      setBatchExportResult(await exportBatchExperiment(options))
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : '批量导出失败')
    } finally {
      setBatchExporting(false)
    }
  }

  return (
    <section className={styles.layout} aria-label="Runner-Rotor 细胞群体观察台">
      <ModelControls
        addingCell={addingCell}
        cellCount={cellCount}
        onAddCell={() => void handleAddCell()}
        onChange={handleParamsChange}
        onExport={(options) => void handleBatchExport(options)}
        onReset={() => setResetCount((count) => count + 1)}
        onTogglePause={handleTogglePause}
        params={params}
        paused={paused}
        snapshot={snapshot}
        batchExportAvailable={!window.__TAURI__}
        batchExporting={batchExporting}
        batchExportResult={batchExportResult}
      />
      {serviceError ? (
        <p className={styles.serviceError} role="alert">
          {serviceError}
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
    </section>
  )
}
