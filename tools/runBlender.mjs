import { spawnSync } from 'node:child_process'
import path from 'node:path'

const BLENDER = process.env.BLENDER ?? 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe'
const [script, ...args] = process.argv.slice(2)
if (!script) {
  console.error('usage: node tools/runBlender.mjs <script.py> [args...]')
  process.exit(2)
}

const result = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', path.resolve(script), '--', ...args.map((arg) => path.resolve(arg))], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
})
const lines = `${result.stdout}\n${result.stderr}`.split('\n').filter((line) => line.startsWith('[geonodes]') || line.includes('Error'))
console.log(lines.join('\n'))
process.exit(result.status ?? 1)
