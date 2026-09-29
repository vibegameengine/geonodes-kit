import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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

const previous = JSON.parse(readFileSync(CASES_FILE, 'utf8'))
let cases = previous.filter((entry) => !entry.spec)
const fromSpecs = new Set()
for (const file of specFiles(SPEC_ROOT)) {
  for (const match of readFileSync(file, 'utf8').matchAll(JSON_BLOCK)) {
    const parsed = JSON.parse(match[1])
    for (const entry of Array.isArray(parsed) ? parsed : [parsed]) {
      if (!entry.id || !entry.tree) continue
      if (fromSpecs.has(entry.id)) throw new Error(`duplicate case id ${entry.id} in ${file}`)
      cases = cases.filter((existing) => existing.id !== entry.id)
      cases.push({ ...entry, spec: path.relative(path.resolve('.'), file).split(path.sep).join('/') })
      fromSpecs.add(entry.id)
    }
  }
}
const known = new Set(cases.map((entry) => entry.id))
const removed = previous.filter((entry) => !known.has(entry.id))
for (const entry of removed) rmSync(path.join(path.dirname(CASES_FILE), `${entry.id}.json`), { force: true })
writeFileSync(CASES_FILE, `${JSON.stringify(cases, null, 2)}
`)
console.log(`${cases.length} cases, ${removed.length} removed: ${removed.map((entry) => entry.id).join(', ')}`)
