/** Keep the tool's original time controls reachable without duplicated state. */
export function mountTimelineDock(controls) {
  if (!controls) throw new Error('Die Zeitsteuerung fehlt.');
  const origin = document.createComment('Position der Zeitsteuerung');
  controls.before(origin);
  const dock = document.createElement('section');
  dock.className = 'timeline-dock';
  dock.setAttribute('aria-label', 'Zeitsteuerung der Simulation');
  dock.hidden = true;
  document.body.append(dock);
  let active = false;

  function reserveSpace() {
    const height = active ? Math.ceil(dock.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--timeline-dock-height', `${height}px`);
  }
  const observer = new ResizeObserver(reserveSpace);
  observer.observe(dock);

  return {
    setActive(value) {
      value = Boolean(value);
      if (value === active) return;
      active = value;
      if (active) dock.append(controls);
      else origin.after(controls);
      dock.hidden = !active;
      document.body.classList.toggle('has-timeline-dock', active);
      reserveSpace();
    }
  };
}
