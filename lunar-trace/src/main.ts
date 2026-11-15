import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

// Where the realistic Moon lives on this site.
const MOON_URL = '/moon/';

// Draws the home page: the headline and buttons over the Moon, plus the Mars slide.
function renderShell() {
  app.innerHTML = `
    <iframe id="moon-bg" class="moon-bg" title="The Moon" tabindex="-1" aria-hidden="true"></iframe>
    <div class="moon-still" aria-hidden="true"></div>
    <div class="moon-scrim" aria-hidden="true"></div>
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



// Returns true for weak devices (no WebGL2, data saver, slow network, little memory) that should skip the live Moon and Mars.
function lowEndDevice(): boolean {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
    if (!document.createElement('canvas').getContext('webgl2')) return true;
    if (nav.connection?.saveData || /^(slow-2g|2g|3g)$/.test(nav.connection?.effectiveType ?? '')) return true;
    if ((nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2) return true;
  } catch { /* an unreadable capability counts as capable */ }
  return false;
}
const LOW_END = lowEndDevice() || new URLSearchParams(location.search).has('lite');
const FALLBACK_MS = 60_000, SETTLE_MS = 300, RETURN_HEADLINE_MS = 1_100;
// Starts the live Moon behind the home page, and handles Explore Moon and going back.
function startMoonBackground(): Promise<void> {
  const frame = document.getElementById('moon-bg') as HTMLIFrameElement;
  if (LOW_END) { frame.remove(); return Promise.resolve(); } // weak devices keep the still picture
  frame.src = '/moon/?bg=1&moment=earthrise-bg'; // set here so weak devices never download it
  let settle!: () => void;
  const settled = new Promise<void>((res) => { settle = res; });
  const send = (m: object) => frame.contentWindow?.postMessage(m, location.origin);
  let ready = false;
  // Hands the Moon to the visitor: headline fades, controls appear.
  const goLive = () => {
    document.body.classList.add('moon-live');
    frame.classList.add('ready');
    send({ type: 'lt-bg', on: false });
    send({ type: 'lt-home' }); // pull the camera back to show the whole Moon
  };
  // Goes back to the home page: controls hide and the headline returns.
  const goHome = () => {
    send({ type: 'lt-bg', on: true });
    send({ type: 'lt-moment', id: 'earthrise-bg' });
    window.setTimeout(() => document.body.classList.remove('moon-live'), RETURN_HEADLINE_MS);
  };
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
    const t = (e.data as { type?: string } | null)?.type;
    if (t === 'lt-ready' && !ready) {
      // Wait for the Moon to settle on Earthrise so there is no flash of the full Moon.
      ready = true;
      window.setTimeout(() => {
        frame.classList.add('ready'); document.body.classList.add('moon-bg-on'); settle();
      }, SETTLE_MS);
    }
    else if (t === 'lt-back') goHome();
  });
  document.querySelector('[data-explore-moon]')?.addEventListener('click', (e) => { if (!ready) return; e.preventDefault(); goLive(); });
  window.setTimeout(() => { if (!ready) { frame.remove(); document.querySelector('.moon-scrim')?.remove(); console.warn('The realistic Moon did not report in.'); settle(); } }, FALLBACK_MS);
  return settled;
}


const MARS_MODELS = ['mars', 'phobos', 'deimos', 'craft/landers-rovers/viking-lander', 'craft/landers-rovers/sojourner-rover', 'craft/landers-rovers/spirit-opportunity-rover', 'craft/landers-rovers/insight-lander', 'craft/landers-rovers/ingenuity-helicopter'];
const MARS_FRAME_URL = '/explorer.html?world=mars&bg=1#/mars';
// Starts the Mars system behind the home page, and handles View Mars, View Moon and Explore Mars.
function startMars(afterMs: number) {
  const body = document.body;
  let frame: HTMLIFrameElement | null = null, frameReady = false, onMars = false, busy = false;
  const marsPage = document.querySelector('.mars-page') as HTMLElement;
  // Loads the Mars page frame and warms up the model files.
  const load = () => {
    if (frame) return;
    frame = document.createElement('iframe');
    frame.className = 'mars-frame'; frame.title = 'Mars'; frame.tabIndex = -1; frame.src = MARS_FRAME_URL;
    document.body.appendChild(frame);
    for (const m of MARS_MODELS) void fetch(`/models/${m}.glb`).catch(() => undefined); // download early so they're cached
  };
  // Sends a message to the Mars frame.
  const send = (m: object) => frame?.contentWindow?.postMessage(m, location.origin);
  // Shows the Mars frame once it is ready and the Mars slide is open.
  const syncFrame = () => frame?.classList.toggle('ready', frameReady && onMars);
  // Switches between the Moon slide and the Mars slide.
  const showMars = (on: boolean) => {
    onMars = on;
    body.classList.toggle('on-mars', on);
    body.classList.toggle('mars-mode', on);
    marsPage.setAttribute('aria-hidden', String(!on));
    if (on) load();
    syncFrame();
  };
  if (Number.isFinite(afterMs)) window.setTimeout(load, afterMs);
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== frame?.contentWindow) return;
    const t = (e.data as { type?: string } | null)?.type;
    if (t === 'lt-ready') { frameReady = true; syncFrame(); }
    else if (t === 'lt-back') { // Home was pressed in Mars: return to this slide
      body.classList.remove('mars-live');
      frame?.classList.remove('on');
      send({ type: 'lt-bg', on: true });
      busy = false;
    }
  });
  document.getElementById('view-mars')!.addEventListener('click', (e) => { e.preventDefault(); showMars(true); });
  document.getElementById('view-moon')!.addEventListener('click', (e) => { e.preventDefault(); showMars(false); });
  document.getElementById('explore-mars')!.addEventListener('click', (e) => {
    if (!frameReady || busy) return; // not ready yet: the link opens the explorer page instead
    e.preventDefault();
    busy = true;
    body.classList.add('mars-live'); // fade out the text
    frame!.classList.add('on'); // bring in the controls
    send({ type: 'lt-bg', on: false }); // fly the camera to the sunlit side of Mars
  });
  if (new URLSearchParams(location.search).has('mars')) showMars(true);
}

renderShell();
// Mars is big, so it loads after the Moon (or only on View Mars for weak devices).
void startMoonBackground().then(() => startMars(LOW_END ? Number.POSITIVE_INFINITY : 3000));
