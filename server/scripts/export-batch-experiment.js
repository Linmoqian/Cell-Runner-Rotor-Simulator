import { resolve } from 'node:path'
import { exportBatchExperiment } from '../src/experiments/batchExperiment.js'

function readOption(args, name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : Number(args[index + 1])
}

const args = process.argv.slice(2)
const outputIndex = args.indexOf('--output')
const output = outputIndex === -1 ? 'artifacts/batch-experiment' : args[outputIndex + 1]
if (!output || output.startsWith('--')) throw new Error('--output 必须提供目录')

const optionEntries = [
  ['cellCount', readOption(args, 'cells', undefined)],
  ['dtMinutes', readOption(args, 'dt-minutes', undefined)],
  ['durationMinutes', readOption(args, 'duration-minutes', undefined)],
  ['seed', readOption(args, 'seed', undefined)],
].filter(([, value]) => value !== undefined)
const manifest = await exportBatchExperiment(resolve(output), Object.fromEntries(optionEntries))

console.log(`[成功] 已导出 ${manifest.cellCount} 个细胞、${manifest.stepCount} 个步长到 ${resolve(output)}`)
