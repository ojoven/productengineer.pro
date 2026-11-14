// Motion for figures, in one place.
//
//   reveal   [data-animate]  plays once when the figure scrolls into view; figures that show an order add a Replay button
//   ambient  [data-ambient]  particles and loops run only while the figure is visible; a Pause button stops them
//   hover    [data-hover-replay]  small illustrations replay when pointed at or focused
//
// Nothing moves under prefers-reduced-motion: the resting style of every element is its final state.

const reduce = matchMedia('(prefers-reduced-motion: reduce)');

function smil(fig: HTMLElement, run: boolean) {
  fig.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => {
    // not every SVG has SMIL children; the calls are harmless when there are none
    if (run) svg.unpauseAnimations?.();
    else svg.pauseAnimations?.();
  });
}

function startAmbient(fig: HTMLElement) {
  if (fig.dataset.started) return;
  fig.dataset.started = '1';
  fig.querySelectorAll<SVGAnimationElement>('[data-ambient-start]').forEach((el) => {
    const offset = Number(el.dataset.ambientStart ?? 0);
    try {
      if (offset > 0) el.beginElementAt(offset);
      else el.beginElement();
    } catch {
      /* an SVG that is display:none cannot start yet; the next sync tries again */
      delete fig.dataset.started;
    }
  });
}

/** Brings the ambient layer in line with: in view, not paused, motion allowed. */
function sync(fig: HTMLElement) {
  if (!('ambient' in fig.dataset)) return;
  const run = 'play' in fig.dataset && !('paused' in fig.dataset) && !('away' in fig.dataset) && !reduce.matches;
  if (run) startAmbient(fig);
  smil(fig, run);
  fig.dataset.motion = run || ('started' in fig.dataset && !reduce.matches) ? 'on' : 'off';
  const btn = fig.querySelector<HTMLButtonElement>('[data-fg-pause]');
  if (btn) {
    const label = 'paused' in fig.dataset ? 'Play animation' : 'Pause animation';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
}

export function replay(fig: HTMLElement) {
  fig.dataset.reset = '';
  delete fig.dataset.play;
  void fig.offsetWidth; // restart CSS animations
  delete fig.dataset.reset;
  fig.dataset.play = '';
  fig.dataset.playedAt = String(Date.now());
}

let observer: IntersectionObserver | undefined;

export function initFigures(root: ParentNode = document) {
  const figs = [...root.querySelectorAll<HTMLElement>('[data-fg]:not([data-fg-ready])')];
  if (!figs.length) return;

  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const fig = e.target as HTMLElement;
        if (e.isIntersecting) {
          delete fig.dataset.away;
          if (!('play' in fig.dataset)) {
            fig.dataset.play = '';
            fig.dataset.playedAt = String(Date.now());
          }
        } else {
          fig.dataset.away = '';
        }
        sync(fig);
      }
    },
    // a figure starts when its top edge is a little inside the viewport
    { rootMargin: '0px 0px -12% 0px', threshold: 0 },
  );

  for (const fig of figs) {
    fig.dataset.fgReady = '';
    observer.observe(fig);

    fig.querySelectorAll<HTMLButtonElement>('.fg-ctl').forEach((b) => (b.hidden = reduce.matches));

    fig.querySelector<HTMLButtonElement>('[data-fg-replay]')?.addEventListener('click', () => replay(fig));
    fig.querySelector<HTMLButtonElement>('[data-fg-pause]')?.addEventListener('click', () => {
      if ('paused' in fig.dataset) delete fig.dataset.paused;
      else fig.dataset.paused = '';
      sync(fig);
    });

    if ('hoverReplay' in fig.dataset) {
      const again = () => {
        const last = Number(fig.dataset.playedAt ?? 0);
        const length = Number(fig.dataset.hoverReplay) || 2400;
        if (!reduce.matches && Date.now() - last > length) replay(fig);
      };
      fig.addEventListener('pointerenter', again);
      fig.addEventListener('focusin', again);
    }

    // a range input that drives a CSS variable on its figure (BeforeAfter)
    fig.querySelectorAll<HTMLInputElement>('input[data-fg-var]').forEach((input) => {
      const apply = () => fig.style.setProperty(input.dataset.fgVar!, input.value + (input.dataset.fgUnit ?? ''));
      input.addEventListener('input', apply);
      apply();
    });
  }
}

reduce.addEventListener('change', () => {
  document.querySelectorAll<HTMLElement>('[data-fg]').forEach((fig) => {
    fig.querySelectorAll<HTMLButtonElement>('.fg-ctl').forEach((b) => (b.hidden = reduce.matches));
    sync(fig);
  });
});
