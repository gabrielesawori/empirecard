/* Empire Card — first-party motion engine.
   No build step, no dependencies. Provides the choreography the game layout
   needs (reveal, tilt, magnet, ripple, count-up, parallax, scroll progress)
   and honours prefers-reduced-motion for every effect. */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Shared rAF loop so dozens of effects cost one frame callback. */
const tickers = new Set();
let rafId = 0;
function loop(time) {
  rafId = 0;
  for (const fn of tickers) fn(time);
  if (tickers.size) rafId = requestAnimationFrame(loop);
}
function addTicker(fn) {
  tickers.add(fn);
  if (!rafId) rafId = requestAnimationFrame(loop);
  return () => tickers.delete(fn);
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const lerp = (a, b, t) => a + (b - a) * t;

/* Observe elements once and reveal them with a staggered delay. */
function reveal(root = document) {
  const targets = root.querySelectorAll('[data-reveal]:not(.is-revealed)');
  if (!targets.length) return;
  if (reduced()) {
    targets.forEach(el => el.classList.add('is-revealed'));
    return;
  }
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.style.transitionDelay = `${Number(el.dataset.revealDelay || 0)}ms`;
      el.classList.add('is-revealed');
      obs.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  targets.forEach(el => observer.observe(el));
}

/* Pointer-tracked 3D tilt with a spring return. */
function tilt(root = document) {
  if (reduced()) return;
  root.querySelectorAll('[data-tilt]:not(.is-tilted)').forEach(card => {
    card.classList.add('is-tilted');
    const strength = Number(card.dataset.tilt) || 9;
    let current = { x: 0, y: 0 }, target = { x: 0, y: 0 }, stop = null;

    const frame = () => {
      current.x = lerp(current.x, target.x, 0.16);
      current.y = lerp(current.y, target.y, 0.16);
      card.style.setProperty('--tilt-x', `${current.x.toFixed(3)}deg`);
      card.style.setProperty('--tilt-y', `${current.y.toFixed(3)}deg`);
      card.style.setProperty('--glare-x', `${(50 - current.y * 3).toFixed(1)}%`);
      card.style.setProperty('--glare-y', `${(50 + current.x * 3).toFixed(1)}%`);
      if (Math.abs(current.x - target.x) < 0.01 && Math.abs(current.y - target.y) < 0.01) {
        card.style.removeProperty('--tilt-x');
        card.style.removeProperty('--tilt-y');
        stop?.();
        stop = null;
      }
    };

    const move = event => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      target = { x: -py * strength, y: px * strength };
      if (!stop) stop = addTicker(frame);
    };
    const leave = () => {
      target = { x: 0, y: 0 };
      if (!stop) stop = addTicker(frame);
    };

    card.addEventListener('pointermove', move);
    card.addEventListener('pointerleave', leave);
    card.addEventListener('blur', leave);
  });
}

/* Magnetic pull for primary call-to-action buttons. */
function magnet(root = document) {
  if (reduced() || matchMedia('(pointer: coarse)').matches) return;
  root.querySelectorAll('[data-magnet]:not(.is-magnet)').forEach(el => {
    el.classList.add('is-magnet');
    const pull = Number(el.dataset.magnet) || 0.28;
    let stop = null, cur = { x: 0, y: 0 }, goal = { x: 0, y: 0 };

    const frame = () => {
      cur.x = lerp(cur.x, goal.x, 0.2);
      cur.y = lerp(cur.y, goal.y, 0.2);
      el.style.setProperty('--magnet-x', `${cur.x.toFixed(2)}px`);
      el.style.setProperty('--magnet-y', `${cur.y.toFixed(2)}px`);
      if (Math.abs(cur.x - goal.x) < 0.05 && Math.abs(cur.y - goal.y) < 0.05) {
        el.style.removeProperty('--magnet-x');
        el.style.removeProperty('--magnet-y');
        stop?.();
        stop = null;
      }
    };

    el.addEventListener('pointermove', event => {
      const rect = el.getBoundingClientRect();
      goal = {
        x: (event.clientX - (rect.left + rect.width / 2)) * pull,
        y: (event.clientY - (rect.top + rect.height / 2)) * pull,
      };
      if (!stop) stop = addTicker(frame);
    });
    el.addEventListener('pointerleave', () => {
      goal = { x: 0, y: 0 };
      if (!stop) stop = addTicker(frame);
    });
  });
}

/* Pointer-origin click ripple. */
function ripple(root = document) {
  if (reduced()) return;
  root.querySelectorAll('[data-ripple]:not(.is-rippled)').forEach(el => {
    el.classList.add('is-rippled');
    el.addEventListener('pointerdown', event => {
      const rect = el.getBoundingClientRect();
      const span = document.createElement('span');
      span.className = 'motion-ripple';
      span.style.left = `${event.clientX - rect.left}px`;
      span.style.top = `${event.clientY - rect.top}px`;
      span.style.setProperty('--ripple-size', `${Math.max(rect.width, rect.height) * 1.6}px`);
      el.appendChild(span);
      span.addEventListener('animationend', () => span.remove(), { once: true });
    });
  });
}

/* Animated number roll for HUD values. */
function countUp(root = document) {
  root.querySelectorAll('[data-count-to]:not(.is-counted)').forEach(el => {
    el.classList.add('is-counted');
    const to = Number(el.dataset.countTo) || 0;
    const from = Number(el.dataset.countFrom) || 0;
    if (reduced() || to === from) { el.textContent = String(to); return; }
    const duration = Number(el.dataset.countDuration) || 900;
    const start = performance.now();
    const step = now => {
      const t = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(lerp(from, to, eased)));
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = String(to);
    };
    requestAnimationFrame(step);
  });
}


/* Scroll-linked parallax for background layers. */
function parallax(root = document) {
  const layers = root.querySelectorAll('[data-parallax]');
  if (!layers.length || reduced()) return;
  const update = () => {
    const y = window.scrollY;
    layers.forEach(layer => {
      const speed = Number(layer.dataset.parallax) || 0.12;
      layer.style.setProperty('--parallax-y', `${(y * speed).toFixed(1)}px`);
    });
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/* Top scroll-progress indicator + shared scroll state. */
function scrollProgress(root = document) {
  const bar = root.querySelector('[data-scroll-progress]');
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    if (bar) bar.style.transform = `scaleX(${ratio.toFixed(4)})`;
    document.documentElement.style.setProperty('--scroll-ratio', ratio.toFixed(4));
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

/* Mirror notification dots onto the bottom dock. */
function syncDockBadges(root = document) {
  root.querySelectorAll('[data-dock]').forEach(dock => {
    const source = root.querySelector(`[data-page="${dock.dataset.dock}"] .notification-dot`);
    const count = source ? Number(source.textContent) || 0 : 0;
    dock.classList.toggle('has-badge', count > 0);
    const badge = dock.querySelector('.dock-badge');
    if (badge) badge.textContent = count > 9 ? '9+' : String(count);
  });
}

// The animation belongs to these rendered card nodes, not an ancestor class.
// Replacing the view cancels its effects instead of replaying them on new nodes.
let disposeCast = () => {};
export function clearCast() { disposeCast(); disposeCast = () => {}; }

export function castImpact(root = document) {
  clearCast();
  if (reduced()) return;
  const slots = [...root.querySelectorAll('.battle-slot.revealed')];
  const timers = new Set(), sparks = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  };
  disposeCast = () => {
    timers.forEach(clearTimeout);
    sparks.forEach(spark => spark.remove());
    slots.forEach(slot => slot.classList.remove('is-casting'));
  };
  const compact = matchMedia('(max-width: 700px)').matches;
  slots.forEach(slot => {
    slot.classList.add('is-casting');
    // Only a successful cast gets an impact burst. Particles stay in its local
    // scene so scrolling or leaving the battle cannot strand them on the page.
    if (slot.classList.contains('countered-card')) return;
    const stage = slot.querySelector('.placed-card');
    later(() => {
      if (!stage?.isConnected || reduced()) return;
      const count = compact ? 6 : 10;
      for (let i = 0; i < count; i++) {
        const spark = document.createElement('span');
        spark.className = 'cast-spark';
        const angle = Math.PI * 2 * i / count;
        const distance = compact ? 22 : 48;
        spark.style.setProperty('--spark-x', `${Math.cos(angle) * distance}px`);
        spark.style.setProperty('--spark-y', `${Math.sin(angle) * distance}px`);
        stage.appendChild(spark); sparks.add(spark);
      }
    }, compact ? 580 : 720);
  });
  later(clearCast, 1700);
}

/* Re-run every effect against freshly rendered markup. */
export function hydrate(root = document) {
  reveal(root);
  tilt(root);
  magnet(root);
  ripple(root);
  countUp(root);
  syncDockBadges(root);
}

/* One-time global setup. */
export function boot(root = document) {
  parallax(root);
  scrollProgress(root);
  document.documentElement.classList.add('motion-ready');
}

