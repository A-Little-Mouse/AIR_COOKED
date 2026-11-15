import './style.css';
import { createMarsHero } from './mars/hero.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;

/** "Explore Moon" opens the realistic Moon (./moon-explorer), mounted at /moon/ on this same site, on its full-Moon view. */
const MOON_URL = '/moon/';

/** The title slide: the headline and the buttons, over the realistic Moon (an iframe, see startMoonBackground). */
function renderShell() {
  app.innerHTML = `
    <iframe id="moon-bg" class="moon-bg" title="The Moon" tabindex="-1" aria-hidden="true" src="/moon/?bg=1&moment=earthrise-bg"></iframe>
    <div class="moon-still" aria-hidden="true"></div>
    <div class="moon-scrim" aria-hidden="true"></div>
    <canvas id="mars-bg" class="mars-bg" aria-hidden="true"></canvas>
    <div class="mars-scrim" aria-hidden="true"></div>
    <div class="page-shell moon-page">
      <main id="top">
        <section class="hero" aria-labelledby="hero-title">
          <div class="hero-copy">
            <h1 id="hero-title">What we <em>leave</em> behind.</h1>
            <p class="hero-lede">Discover the inactive equipment and technologies from Mars and Moon alike, long after its final transmission</p>
            <div class="hero-actions">
              <a class="primary-button expedition-button" data-explore-moon href="${MOON_URL}">Explore Moon <span class="arrow">↗</span></a>
              <a class="ghost-button world-button" id="view-mars" href="/?mars">View Mars <span class="arrow">↗</span></a>
              <a class="ghost-button gallery-button" href="/gallery.html">Spacecraft <span class="arrow">↗</span></a>
            </div>
          </div>
        </section>
      </main>
    </div>
    <div class="page-shell mars-page" aria-hidden="true">
      <main>
        <section class="hero" aria-labelledby="mars-title">
          <div class="hero-copy">
            <h1 id="mars-title">What we <em>leave</em> behind.</h1>
            <p class="hero-lede">Discover the inactive equipment and technologies from Mars and Moon alike, long after its final transmission</p>
            <div class="hero-actions">
              <a class="primary-button" id="explore-mars" href="/explorer.html?world=mars#/mars">Explore Mars <span class="arrow">↗</span></a>
              <a class="ghost-button" id="view-moon" href="/">View Moon <span class="arrow">↗</span></a>
              <a class="ghost-button" href="/gallery.html">Spacecraft <span class="arrow">↗</span></a>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}

/**
 * The background is the realistic Moon itself (./moon-explorer, in an iframe, driven by messages), held on Earthrise. "Explore Moon" does not load another page: it
 * hands the same running Moon to the visitor (the headline fades, the controls come in, and the camera pulls back to show the whole Moon). "← Relict"
 * inside the Moon sends it back here. If the Moon has not reported in after FALLBACK_MS (no WebGL, no network), the page stays on its gradient.
 */
const FALLBACK_MS = 60_000, SETTLE_MS = 300, RETURN_HEADLINE_MS = 1_100;
function startMoonBackground() {
  const frame = document.getElementById('moon-bg') as HTMLIFrameElement;
  const send = (m: object) => frame.contentWindow?.postMessage(m, location.origin);
  let ready = false;
  const goLive = () => {
    document.body.classList.add('moon-live');
    frame.classList.add('ready');
    send({ type: 'lt-bg', on: false });
    send({ type: 'lt-home' }); // the camera pulls back from Earthrise to the whole Moon while the headline fades out
  };
  // Back is the same motion in reverse: the controls go, the camera flies back in to Earthrise, and the headline returns as it arrives.
  const goHome = () => {
    send({ type: 'lt-bg', on: true });
    send({ type: 'lt-moment', id: 'earthrise-bg' });
    window.setTimeout(() => document.body.classList.remove('moon-live'), RETURN_HEADLINE_MS);
  };
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
    const t = (e.data as { type?: string } | null)?.type;
    if (t === 'lt-ready' && !ready) {
      // The Moon's first frame is its home view and it dissolves to Earthrise over a second or two: show it only once that has settled, so there is no flash of the full Moon.
      ready = true;
      window.setTimeout(() => {
        frame.classList.add('ready'); document.body.classList.add('moon-bg-on');
      }, SETTLE_MS);
    }
    else if (t === 'lt-back') goHome();
  });
  document.querySelector('[data-explore-moon]')?.addEventListener('click', (e) => { if (!ready) return; e.preventDefault(); goLive(); });
  window.setTimeout(() => { if (!ready) { frame.remove(); document.querySelector('.moon-scrim')?.remove(); console.warn('The realistic Moon did not report in.'); } }, FALLBACK_MS);
}

/**
 * Mars is held the same way. Once the Moon has settled, everything for Mars is loaded behind it: the Deimos-surface scene and the whole Mars system (the explorer,
 * in an invisible iframe, driven by messages). "View Mars" and "View Moon" then only cross-fade between the two slides; "Explore Mars" pulls the camera back from
 * Deimos and fades the live Mars system in; its Home button fades back to this slide.
 */
const MARS_MODELS = ['mars', 'phobos', 'deimos', 'viking-lander', 'craft/landers-rovers/sojourner-rover', 'craft/landers-rovers/spirit-opportunity-rover', 'craft/landers-rovers/insight-lander', 'craft/landers-rovers/ingenuity-helicopter'];
const MARS_FRAME_URL = '/explorer.html?world=mars&bg=1#/mars';
function startMars(afterMs: number) {
  const body = document.body;
  const canvas = document.getElementById('mars-bg') as HTMLCanvasElement;
  let hero: ReturnType<typeof createMarsHero> | null = null, frame: HTMLIFrameElement | null = null;
  let heroReady = false, frameReady = false, onMars = false, busy = false;
  const marsPage = document.querySelector('.mars-page') as HTMLElement;
  const load = () => {
    if (hero) return;
    try { hero = createMarsHero(canvas); } catch (e) { console.error('Mars slide needs WebGL', e); return; }
    void hero.ready.then(() => { heroReady = true; if (onMars) { hero!.show(); canvas.classList.add('ready'); } }).catch((e) => console.error('Mars failed to load', e));
    frame = document.createElement('iframe');
    frame.className = 'mars-frame'; frame.title = 'Mars'; frame.tabIndex = -1; frame.src = MARS_FRAME_URL;
    document.body.appendChild(frame);
    for (const m of MARS_MODELS) void fetch(`/models/${m}.glb`).catch(() => undefined); // warm the cache
  };
  const send = (m: object) => frame?.contentWindow?.postMessage(m, location.origin);
  const showMars = (on: boolean) => {
    onMars = on;
    body.classList.toggle('on-mars', on);
    body.classList.toggle('mars-mode', on);
    marsPage.setAttribute('aria-hidden', String(!on));
    if (on) { load(); if (heroReady) { hero!.show(); canvas.classList.add('ready'); } }
    else window.setTimeout(() => { if (!onMars) hero?.hide(); }, 900);
  };
  window.setTimeout(load, afterMs);
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== frame?.contentWindow) return;
    const t = (e.data as { type?: string } | null)?.type;
    if (t === 'lt-ready') frameReady = true;
    else if (t === 'lt-back') { // Home in the Mars system: back to this slide
      hero?.reset();
      body.classList.remove('mars-live');
      frame?.classList.remove('on');
      window.setTimeout(() => { send({ type: 'lt-bg', on: true }); busy = false; }, 1000); // once it has faded out: held again, on the fixed whole-Mars view
    }
  });
  document.getElementById('view-mars')!.addEventListener('click', (e) => { e.preventDefault(); showMars(true); });
  document.getElementById('view-moon')!.addEventListener('click', (e) => { e.preventDefault(); showMars(false); });
  document.getElementById('explore-mars')!.addEventListener('click', (e) => {
    if (!heroReady || !frameReady || busy) return; // not loaded yet: the link just opens the explorer page
    e.preventDefault();
    busy = true;
    body.classList.add('mars-live'); // the text fades while the camera pulls back from Deimos...
    void hero!.pullBack(1500).then(() => {
      send({ type: 'lt-bg', on: false }); // ...then the live Mars system fades in with its controls
      frame!.classList.add('on');
    });
  });
  if (new URLSearchParams(location.search).has('mars')) showMars(true);
}

renderShell();
startMoonBackground();
startMars(4000);
