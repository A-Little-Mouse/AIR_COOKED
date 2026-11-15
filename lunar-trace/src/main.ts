import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

/** "Explore Moon" opens the realistic Moon (./moon-explorer), mounted at /moon/ on this same site, on its full-Moon view. */
const MOON_URL = '/moon/';

/** The title slide: the headline and the buttons, over the realistic Moon (an iframe, see startMoonBackground). */
function renderShell() {
  app.innerHTML = `
    <iframe id="moon-bg" class="moon-bg" title="The Moon" tabindex="-1" aria-hidden="true" src="/moon/?bg=1&moment=earthrise-bg"></iframe>
    <div class="moon-still" aria-hidden="true"></div>
    <div class="moon-scrim" aria-hidden="true"></div>
    <div class="page-shell">
      <main id="top">
        <section class="hero" aria-labelledby="hero-title">
          <div class="hero-copy">
            <h1 id="hero-title">What we <em>leave</em> behind.</h1>
            <p class="hero-lede">Our legacy in space, the remnant echoes of our expedition still lingers. Discover the inactive equipment and technologies from Mars and Moon alike, long after its final transmission</p>
            <div class="hero-actions">
              <a class="primary-button expedition-button" data-explore-moon href="${MOON_URL}">Explore Moon <span class="arrow">↗</span></a>
              <a class="ghost-button world-button" href="/mars/">View Mars <span class="arrow">↗</span></a>
              <a class="ghost-button gallery-button" href="/gallery.html">Spacecraft <span class="arrow">↗</span></a>
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
 * "Explore Mars" works the same way, one step on: once the Moon has settled, the Mars page is loaded behind it (an invisible iframe) and the Mars models are fetched,
 * so the click only fades: the Moon and the headline go, Mars from Deimos comes in. "View Moon" on the Mars page fades back.
 */
const MARS_MODELS = ['mars', 'phobos', 'deimos', 'viking-lander', 'craft/landers-rovers/sojourner-rover', 'craft/landers-rovers/spirit-opportunity-rover', 'craft/landers-rovers/insight-lander', 'craft/landers-rovers/ingenuity-helicopter'];
function startMarsPreload(afterMs: number) {
  let marsFrame: HTMLIFrameElement | null = null, marsReady = false;
  const load = () => {
    if (marsFrame) return;
    marsFrame = document.createElement('iframe');
    marsFrame.className = 'mars-frame'; marsFrame.title = 'Mars'; marsFrame.tabIndex = -1; marsFrame.src = '/mars/?embed=1';
    document.body.appendChild(marsFrame);
    for (const m of MARS_MODELS) void fetch(`/models/${m}.glb`).catch(() => undefined); // warm the cache for the Mars explorer
  };
  window.setTimeout(load, afterMs);
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== marsFrame?.contentWindow) return;
    const t = (e.data as { type?: string } | null)?.type;
    if (t === 'lt-mars-ready') marsReady = true;
    else if (t === 'lt-back') { document.body.classList.remove('mars-live'); marsFrame?.classList.remove('on'); }
  });
  document.querySelector('.world-button')?.addEventListener('click', (e) => {
    if (!marsReady || !marsFrame) return; // not loaded yet: the link just opens /mars/
    e.preventDefault();
    document.body.classList.add('mars-live');
    marsFrame.classList.add('on');
  });
}

renderShell();
startMoonBackground();
startMarsPreload(4000);
