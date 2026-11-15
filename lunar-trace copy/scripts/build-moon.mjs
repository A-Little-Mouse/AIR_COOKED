// Builds the realistic Moon (./moon-explorer) and mounts it at /moon/ inside this app's dist (run after `vite build`, by `npm run build`).
// The Moon streams its terrain and imagery from a public data mirror at run time (best effort, needs internet); override with MOON_MIRROR.
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const moon = join(root, 'moon-explorer')
const mirror = process.env.MOON_MIRROR ?? 'https://storage.googleapis.com/skylumi-moon-serve-b7f804/moon/'
const env = {
  ...process.env,
  VITE_MOON_TILES: `${mirror}tiles/`, VITE_MOON_PATCH: `${mirror}patch/`, VITE_MOON_MID_PATCH: `${mirror}mid-patch/`,
  VITE_MOON_TC: `${mirror}tc/v3/`, VITE_MOON_HORIZONS: `${mirror}horizons/baked-a/`,
}
const run = spawnSync('npm', ['run', 'build'], { cwd: moon, env, stdio: 'inherit' })
if (run.status !== 0) process.exit(run.status ?? 1)
if (!existsSync(join(root, 'dist'))) { console.error('build-moon: run `vite build` first (no dist/)'); process.exit(1) }
rmSync(join(root, 'dist', 'moon'), { recursive: true, force: true })
cpSync(join(moon, 'dist'), join(root, 'dist', 'moon'), { recursive: true })
console.log('Moon mounted at dist/moon (served at /moon/)')
