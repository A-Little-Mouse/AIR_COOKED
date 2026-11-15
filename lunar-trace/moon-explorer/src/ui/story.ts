/**
 * Lunar Trace: the Apollo 17 story, "Last of its kind". A short autoplay film inside the Moon page: each scene moves the camera (a flight,
 * the ground view, a panorama, the whole Moon), shows a caption and speaks it. Narration plays `story/a17-<n>.mp3` when that file exists
 * (record your own voice and drop the files in public/story/); otherwise the browser's speech synthesis reads the caption.
 */
import type { NavAction } from '../viewpointList'

export interface StoryHost {
  run(a: NavAction): void
  onGround(): boolean
  home(): void
}

interface Scene {
  title: string
  text: string
  /** What the camera does. */
  go: NavAction | 'home'
  /** The scene waits for the ground view to open before it speaks. */
  needsGround?: boolean
  /** The least time on screen, ms. */
  minMs: number
}

export const APOLLO17_STORY: readonly Scene[] = [
  { title: 'December 1972', text: 'December 1972. The Apollo programme is about to end, and the Earth is a long way behind.', go: { kind: 'moment', id: 'earthrise' }, minMs: 6000 },
  { title: 'Taurus-Littrow', text: 'Apollo 17 lands in the Taurus-Littrow valley, a quiet corner of the Moon between tall mountains.', go: { kind: 'moment', id: 'apollo17' }, minMs: 7000 },
  { title: 'Challenger', text: 'This is Challenger, the lunar module. It is still standing here, exactly where it was left.', go: { kind: 'ground', id: 'eye' }, needsGround: true, minMs: 7000 },
  { title: 'The instruments', text: 'The crew set up science instruments and left them running. Everything you see was left on purpose.', go: { kind: 'panorama', id: 'alsep' }, needsGround: true, minMs: 8000 },
  { title: 'The valley', text: 'Three moonwalks over three days. They gathered rocks to bring home, and left their tools behind.', go: { kind: 'panorama', id: 'station6' }, needsGround: true, minMs: 8000 },
  { title: 'Last of its kind', text: 'Apollo 17 was the last time people walked on the Moon. The hardware they left is still there, waiting.', go: 'home', minMs: 9000 },
]

const BASE = ((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL) ?? '/'

export function mountStory(parent: HTMLElement, host: StoryHost): { start(): void; stop(): void } {
  const root = document.createElement('div')
  root.id = 'lt-story'
  root.hidden = true
  root.setAttribute('role', 'region')
  root.setAttribute('aria-label', 'Apollo 17 story')
  root.innerHTML = '<div class="lt-story-step"></div><h2 class="lt-story-title"></h2><p class="lt-story-text" aria-live="polite"></p><div class="lt-story-row"><button type="button" data-a="pause">Pause</button><button type="button" data-a="skip">Skip</button><button type="button" data-a="close">Close</button></div>'
  parent.append(root)
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!
  const pauseB = q<HTMLButtonElement>('[data-a=pause]')

  let token = 0
  let paused = false
  let skip: (() => void) | null = null
  let audio: HTMLAudioElement | null = null

  const wait = (ms: number, t: number) => new Promise<void>((res) => {
    let left = ms
    const tick = window.setInterval(() => {
      if (t !== token) { clearInterval(tick); res(); return }
      if (!paused) left -= 100
      if (left <= 0) { clearInterval(tick); res() }
    }, 100)
    skip = () => { clearInterval(tick); res() }
  })
  /** Speaks the scene; resolves when the voice has finished, or at once if there is none. */
  const speak = (n: number, text: string, t: number): Promise<void> => new Promise<void>((res) => {
    const done = () => res()
    const viaSynth = () => {
      if (t !== token || !('speechSynthesis' in window)) { done(); return }
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 0.95
      u.onend = done
      u.onerror = done
      window.speechSynthesis.speak(u)
      skip = () => { window.speechSynthesis.cancel(); done() }
    }
    audio = new Audio(`${BASE}story/a17-${n}.mp3`)
    audio.onended = done
    audio.onerror = () => { audio = null; viaSynth() }
    audio.play().then(() => { const a = audio; skip = () => { a?.pause(); done() } }).catch(() => { audio = null; viaSynth() })
  })

  async function play(): Promise<void> {
    const t = ++token
    paused = false
    pauseB.textContent = 'Pause'
    root.hidden = false
    for (let i = 0; i < APOLLO17_STORY.length; i++) {
      if (t !== token) return
      const s = APOLLO17_STORY[i]
      q('.lt-story-step').textContent = `${i + 1} / ${APOLLO17_STORY.length}`
      q('.lt-story-title').textContent = s.title
      q('.lt-story-text').textContent = s.text
      if (s.go === 'home') host.home(); else host.run(s.go)
      if (s.needsGround) {
        // The ground view downloads its terrain first: the scene starts when it is open (or after a long wait).
        for (let w = 0; w < 400 && t === token && !host.onGround(); w++) await wait(100, t)
      }
      if (t !== token) return
      await Promise.all([wait(s.minMs, t), speak(i + 1, s.text, t)])
    }
    if (t === token) stop()
  }
  function stop(): void {
    token++
    window.speechSynthesis?.cancel()
    audio?.pause()
    audio = null
    root.hidden = true
  }
  root.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a
    if (a === 'close') stop()
    else if (a === 'skip') skip?.()
    else if (a === 'pause') {
      paused = !paused
      pauseB.textContent = paused ? 'Resume' : 'Pause'
      if (paused) { window.speechSynthesis?.pause(); audio?.pause() } else { window.speechSynthesis?.resume(); void audio?.play() }
    }
  })
  return { start: () => { stop(); void play() }, stop }
}
