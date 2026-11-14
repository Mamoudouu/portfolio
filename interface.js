// Animations d'interface : apparitions au défilement, titres qui se
// « décodent », rail de navigation, bande défilante et anneau de curseur.
// Tout est facultatif : sans ce script, la page reste complète et lisible.
const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sourisFine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const racine = document.documentElement;

/* ---------- Apparitions au défilement ---------- */
if (!calme && 'IntersectionObserver' in window) {
  racine.classList.add('anime');
  // dans chaque projet, le titre, la ligne d'infos, le résumé et le lien arrivent l'un après l'autre
  document.querySelectorAll('.projet').forEach((p) => {
    [...p.children].forEach((el, i) => { el.classList.add('rv'); el.style.setProperty('--delai', `${i * 90}ms`); });
  });
  const vus = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('vu');
      if (e.target.matches('.projet h3')) decoder(e.target);
      vus.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
  document.querySelectorAll('.rv').forEach((el) => vus.observe(el));
}

/* ---------- Titre qui se décode, lettre par lettre ---------- */
function decoder(el) {
  const texte = el.textContent, lettres = 'abcdefghijklmnopqrstuvwxyz';
  el.setAttribute('aria-label', texte);
  const debut = performance.now(), duree = 650 + texte.length * 18;
  (function pas(t) {
    const avance = Math.min(1, (t - debut) / duree), acquis = Math.floor(avance * texte.length);
    let sortie = texte.slice(0, acquis);
    for (let i = acquis; i < texte.length; i++) {
      const c = texte[i];
      sortie += /[\s'’.,?!-]/.test(c) ? c : lettres[(Math.random() * 26) | 0];
    }
    el.textContent = avance < 1 ? sortie : texte;
    if (avance < 1) requestAnimationFrame(pas);
  })(debut);
}

/* ---------- Rail de navigation (écrans larges) ---------- */
const stations = [...document.querySelectorAll('.station')];
const rail = document.createElement('nav');
rail.className = 'rail';
rail.setAttribute('aria-label', 'Sections de la page');
const boutons = stations.map((s) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `<span>${s.dataset.nom}</span><i></i>`;
  b.addEventListener('click', () => s.scrollIntoView({ block: 'center', behavior: calme ? 'auto' : 'smooth' }));
  rail.append(b);
  return b;
});
document.body.append(rail);

function situer() {
  const milieu = innerHeight / 2;
  let proche = 0, ecart = Infinity;
  stations.forEach((s, i) => {
    const r = s.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - milieu);
    if (d < ecart) { ecart = d; proche = i; }
  });
  boutons.forEach((b, i) => {
    b.classList.toggle('ici', i === proche);
    if (i === proche) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
  const max = racine.scrollHeight - innerHeight;
  racine.style.setProperty('--avance', max > 0 ? (scrollY / max).toFixed(4) : 0);
}
addEventListener('scroll', situer, { passive: true });
addEventListener('resize', situer);
situer();

/* ---------- Bande défilante : accélère avec le défilement ---------- */
const piste = document.querySelector('.bande-piste');
if (piste && !calme) {
  let x = 0, dernierY = scrollY, elan = 0, avant = performance.now();
  (function tourner(t) {
    const dt = Math.min(0.1, (t - avant) / 1000); avant = t;
    elan += (scrollY - dernierY) * 0.9; dernierY = scrollY;
    elan *= Math.pow(0.02, dt);
    const moitie = piste.scrollWidth / 2;
    x = (x + (60 + Math.abs(elan)) * dt * (elan < -5 ? -1 : 1)) % moitie;
    if (x < 0) x += moitie;
    piste.style.transform = `translate3d(${-x}px,0,0)`;
    requestAnimationFrame(tourner);
  })(avant);
}

/* ---------- Anneau qui suit le curseur ---------- */
if (sourisFine && !calme) {
  const anneau = document.createElement('div');
  anneau.className = 'anneau';
  anneau.setAttribute('aria-hidden', 'true');
  document.body.append(anneau);
  let cx = innerWidth / 2, cy = innerHeight / 2, ax = cx, ay = cy;
  addEventListener('pointermove', (e) => {
    cx = e.clientX; cy = e.clientY;
    anneau.classList.add('actif');
    anneau.classList.toggle('sur', !!e.target.closest('a, button'));
  });
  addEventListener('pointerdown', () => anneau.classList.add('clic'));
  addEventListener('pointerup', () => anneau.classList.remove('clic'));
  document.addEventListener('pointerleave', () => anneau.classList.remove('actif'));
  (function suivre() {
    ax += (cx - ax) * 0.18; ay += (cy - ay) * 0.18;
    // propriété « translate » séparée : le changement de taille (scale) ne déplace plus l'anneau
    anneau.style.translate = `${ax}px ${ay}px`;
    requestAnimationFrame(suivre);
  })();
}
