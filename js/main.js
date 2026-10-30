/* ======================
   ISES · Central de Escritos
   Interfaz: tema, navegación y animaciones.
   ====================== */

/* --- Iconos --- */
function isesRenderIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

/* ---------------------- Tema claro / oscuro ---------------------- */
(function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  const COLORS = { light: '#f2f7f3', dark: '#07180f' };

  function paint() {
    const dark = root.dataset.theme === 'dark';
    if (btn) btn.innerHTML = '<i data-lucide="' + (dark ? 'sun' : 'moon') + '"></i>';
    if (meta) meta.setAttribute('content', dark ? COLORS.dark : COLORS.light);
    isesRenderIcons();
  }

  if (btn) {
    btn.addEventListener('click', () => {
      const dark = root.dataset.theme === 'dark';
      root.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('ises-theme', root.dataset.theme); } catch (e) {}
      paint();
    });
  }
  paint();
})();

/* ---------------------- Navegación ---------------------- */
(function initNav() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const panel = document.getElementById('navPanel');

  if (nav) {
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (toggle && panel) {
    const setOpen = (open) => {
      panel.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.innerHTML = '<i data-lucide="' + (open ? 'x' : 'menu') + '"></i>';
      isesRenderIcons();
    };
    toggle.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
    panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('click', (e) => {
      if (panel.classList.contains('is-open') && !nav.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false);
    });
  }
})();

/* ---------------------- Revelado bidireccional al desplazar ----------------------
   Los elementos entran desde abajo al bajar y desde arriba al subir.
   Al salir de la vista se "reorganizan" para poder volver a animarse. */
(function initReveal() {
  const items = Array.from(document.querySelectorAll('[data-reveal]'));
  if (!items.length) return;

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  let direccion = 'down';
  let ultimoY = window.scrollY || 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY || 0;
    if (y > ultimoY + 2) direccion = 'down';
    else if (y < ultimoY - 2) direccion = 'up';
    ultimoY = y;
  }, { passive: true });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      const root = entry.rootBounds;

      if (entry.isIntersecting) {
        /* Entra desde abajo si bajamos, desde arriba si subimos. */
        el.dataset.dir = direccion;
        el.classList.add('is-in');
      } else {
        /* Deja el elemento preparado para reaparecer por el lado correcto. */
        const salioArriba = root
          ? entry.boundingClientRect.bottom < root.top
          : entry.boundingClientRect.top < 0;
        el.dataset.dir = salioArriba ? 'up' : 'down';
        el.classList.remove('is-in');
      }
    });
  }, { rootMargin: '-10% 0px -10% 0px', threshold: 0 });

  items.forEach((el) => io.observe(el));
})();
