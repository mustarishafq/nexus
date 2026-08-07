import { accessSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

/** Files that must exist for a production Vite build to resolve. */
const required = [
  'node_modules/.bin/vite',
  'node_modules/vite/package.json',
  'node_modules/lucide-react/dist/esm/lucide-react.js',
  'node_modules/@vitejs/plugin-react/package.json',
]

function missing() {
  return required.filter((path) => {
    try {
      accessSync(path)
      return false
    } catch {
      return true
    }
  })
}

const gaps = missing()
if (gaps.length === 0) {
  process.exit(0)
}

console.warn(
  `[prebuild] Incomplete node_modules (missing: ${gaps.join(', ')}). Running clean npm ci --include=dev…`,
)

const result = spawnSync('npm', ['ci', '--include=dev'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const stillMissing = missing()
if (stillMissing.length > 0) {
  console.error(
    `[prebuild] Still missing after npm ci: ${stillMissing.join(', ')}. Try: rm -rf node_modules && npm ci --include=dev`,
  )
  process.exit(1)
}
