import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SPEC_ROOT = path.resolve('docs/spec')
const CASES_FILE = path.resolve('reference/cases/cases.json')
const JSON_BLOCK = /```json\s*\n([\s\S]*?)```/g

function specFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry)
    if (statSync(full).isDirectory()) return specFiles(full)
    return entry.endsWith('.md') ? [full] : []
  })
}

const cases = JSON.parse(readFileSync(CASES_FILE, 'utf8'))
const known = new Set(cases.map((entry) => entry.id))
let added = 0
for (const file of specFiles(SPEC_ROOT)) {
  for (const match of readFileSync(file, 'utf8').matchAll(JSON_BLOCK)) {
    const parsed = JSON.parse(match[1])
    for (const entry of Array.isArray(parsed) ? parsed : [parsed]) {
      if (!entry.id || !entry.tree || known.has(entry.id)) continue
      cases.push({ ...entry, spec: path.relative(path.resolve('.'), file).split(path.sep).join('/') })
      known.add(entry.id)
      added += 1
    }
  }
}
writeFileSync(CASES_FILE, `${JSON.stringify(cases, null, 2)}\n`)
console.log(`${added} cases added from specs, ${cases.length} in total`)
