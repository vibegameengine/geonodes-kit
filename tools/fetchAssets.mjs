import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ASSETS = [
  {
    file: 'hong-kong-building.blend',
    url: 'https://github.com/achrefelouafi/BuildingGeneratorThreeJS/raw/HEAD/procedural-hong-kong-building/source/procedural_building.blend',
  },
]

const CACHE = path.resolve('reference/cache')
await mkdir(CACHE, { recursive: true })
for (const asset of ASSETS) {
  const target = path.join(CACHE, asset.file)
  if (existsSync(target)) {
    console.log(`have ${asset.file}`)
    continue
  }
  const response = await fetch(asset.url)
  if (!response.ok) throw new Error(`${asset.file}: HTTP ${response.status}`)
  await writeFile(target, Buffer.from(await response.arrayBuffer()))
  console.log(`fetched ${asset.file}`)
}
