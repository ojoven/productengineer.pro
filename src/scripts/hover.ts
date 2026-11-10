// Map and index highlight each other: pointing at a row lights its tiles, pointing at tiles
// lights the row. Works for anything carrying a data-id, on static pages and in the explorer.

function mark(id: string | undefined, on: boolean) {
  if (!id) return;
  document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach((el) => el.classList.toggle('is-hover', on));
}

export function linkHover() {
  let current: string | undefined;
  const set = (id: string | undefined) => {
    if (id === current) return;
    mark(current, false);
    current = id;
    mark(current, true);
  };
  const idOf = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.<HTMLElement | SVGElement>('.index [data-id], .pm [data-id]');
    return el?.dataset.id;
  };
  document.addEventListener('pointerover', (e) => set(idOf(e.target)));
  document.addEventListener('pointerleave', () => set(undefined));
  document.addEventListener('focusin', (e) => set(idOf(e.target)));
}
