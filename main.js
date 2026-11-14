// Moteur de particules du portfolio.
// Un seul nuage de points, animé par shaders : il commence en relief de
// données, puis se reforme en un objet par projet au fil du défilement.
import * as THREE from './vendor/three/three.module.js';

const canvas = document.getElementById('scene');
const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = innerWidth < 760 ? 18000 : 36000;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  canvas.remove(); // sans WebGL, la page reste lisible sans décor
}

/* ---------- Échantillonnage : N points sur la surface d'un objet ---------- */
function semer(objet) {
  objet.updateMatrixWorld(true);
  const tris = []; // [ax,ay,az, bx,by,bz, cx,cy,cz, aire cumulée]
  let total = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  objet.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const p = geo.attributes.position, poids = o.userData.poids || 1;
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(p, i + 1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(p, i + 2).applyMatrix4(o.matrixWorld);
      const aire = b.clone().sub(a).cross(c.clone().sub(a)).length() * 0.5 * poids;
      if (aire <= 0) continue;
      total += aire;
      tris.push([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, total]);
    }
  });
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = Math.random() * total;
    let lo = 0, hi = tris.length - 1;
    while (lo < hi) { const mi = (lo + hi) >> 1; if (tris[mi][9] < r) lo = mi + 1; else hi = mi; }
    const t = tris[lo];
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    out[i * 3] = t[0] * w + t[3] * u + t[6] * v;
    out[i * 3 + 1] = t[1] * w + t[4] * u + t[7] * v;
    out[i * 3 + 2] = t[2] * w + t[5] * u + t[8] * v;
  }
  return out;
}

/* ---------- Les formes ---------- */
const M = new THREE.MeshBasicMaterial();
const m = (geo, x = 0, y = 0, z = 0, poids = 1) => {
  const mesh = new THREE.Mesh(geo, M);
  mesh.position.set(x, y, z);
  mesh.userData.poids = poids;
  return mesh;
};

function relief() { // nappe de données, en grille régulière
  const out = new Float32Array(N * 3);
  const cols = Math.ceil(Math.sqrt(N * 2.1)), rangs = Math.ceil(N / cols);
  for (let i = 0; i < N; i++) {
    out[i * 3] = ((i % cols) / (cols - 1) - 0.5) * 26;
    out[i * 3 + 1] = 0;
    out[i * 3 + 2] = (Math.floor(i / cols) / (rangs - 1)) * 13 - 9.5;
  }
  // mélange, pour que chaque point parte vers un endroit imprévisible
  for (let i = N - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    for (let k = 0; k < 3; k++) { const t = out[i * 3 + k]; out[i * 3 + k] = out[j * 3 + k]; out[j * 3 + k] = t; }
  }
  return out;
}

function alliance() { // deux anneaux enlacés
  const g = new THREE.Group();
  const a = m(new THREE.TorusGeometry(0.95, 0.2, 20, 64), -0.55);
  const b = m(new THREE.TorusGeometry(0.95, 0.2, 20, 64), 0.55);
  b.rotation.x = Math.PI / 2;
  g.add(a, b);
  return g;
}

function engrenage() {
  const dents = 12, rIn = 1.12, rOut = 1.45, pas = (Math.PI * 2) / dents;
  const s = new THREE.Shape();
  for (let i = 0; i < dents; i++) {
    [[rIn, 0], [rOut, 0.16], [rOut, 0.5], [rIn, 0.66]].forEach(([r, f], j) => {
      const x = Math.cos(i * pas + f * pas) * r, y = Math.sin(i * pas + f * pas) * r;
      if (i === 0 && j === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  s.closePath();
  const trou = new THREE.Path();
  trou.absarc(0, 0, 0.5, 0, Math.PI * 2, true);
  s.holes.push(trou);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false, curveSegments: 32 });
  geo.center();
  const g = new THREE.Group();
  g.add(m(geo), m(new THREE.TorusGeometry(0.8, 0.03, 8, 48), 0, 0, 0.26, 6));
  return g;
}

function maison() {
  const g = new THREE.Group();
  g.add(m(new THREE.BoxGeometry(2, 1.35, 1.7), 0, -0.45, 0));
  const toit = m(new THREE.ConeGeometry(1.65, 1.1, 4, 1, true), 0, 0.78, 0, 1.3);
  toit.rotation.y = Math.PI / 4;
  g.add(toit);
  g.add(m(new THREE.BoxGeometry(0.3, 0.7, 0.3), 0.62, 0.95, -0.25));
  g.add(m(new THREE.PlaneGeometry(0.42, 0.75), -0.4, -0.75, 0.86, 5));
  g.add(m(new THREE.PlaneGeometry(0.45, 0.45), 0.45, -0.3, 0.86, 5));
  return g;
}

function barres() { // rapport Power BI : histogramme et courbe de tendance
  const g = new THREE.Group();
  const h = [0.7, 1.25, 0.95, 1.75, 2.35], sommets = [];
  h.forEach((v, i) => {
    const x = (i - 2) * 0.62;
    g.add(m(new THREE.BoxGeometry(0.4, v, 0.4), x, -1.25 + v / 2, 0));
    sommets.push(new THREE.Vector3(x, -1.25 + v + 0.45, 0.1));
  });
  g.add(m(new THREE.BoxGeometry(3.5, 0.05, 0.6), 0, -1.28, 0, 2));
  for (let i = 0; i < sommets.length - 1; i++) {
    const A = sommets[i], B = sommets[i + 1];
    const trait = m(new THREE.CylinderGeometry(0.03, 0.03, A.distanceTo(B), 8, 1, true), 0, 0, 0, 9);
    trait.position.copy(A).lerp(B, 0.5);
    trait.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.add(trait);
  }
  sommets.forEach((p) => g.add(m(new THREE.SphereGeometry(0.09, 12, 8), p.x, p.y, p.z, 9)));
  g.scale.setScalar(0.9);
  return g;
}

function gantt() { // pilotage : étapes échelonnées, ligne du jour, jalon final
  const g = new THREE.Group();
  [[-1.6, 1.3], [-0.9, 1.5], [0.0, 1.1], [0.55, 1.2]].forEach(([x, l], i) => {
    g.add(m(new THREE.BoxGeometry(l, 0.32, 0.2), x + l / 2 - 0.2, 0.95 - i * 0.62, 0));
  });
  g.add(m(new THREE.BoxGeometry(0.04, 2.9, 0.04), 0.1, 0, 0.15, 10));
  g.add(m(new THREE.OctahedronGeometry(0.26), 1.85, -0.91, 0, 4));
  g.add(m(new THREE.BoxGeometry(4.0, 0.03, 0.03), 0, -1.4, 0, 6));
  g.scale.setScalar(0.8);
  return g;
}

function reseau() { // IA : un petit réseau de neurones, couche par couche
  const g = new THREE.Group(), couches = [3, 4, 4, 2], noeuds = [];
  couches.forEach((n, c) => {
    const rang = [];
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((c - 1.5) * 1.05, (i - (n - 1) / 2) * 0.78, (c % 2 ? 0.25 : -0.25));
      rang.push(v);
      g.add(m(new THREE.SphereGeometry(0.19, 20, 14), v.x, v.y, v.z, 2.2));
    }
    noeuds.push(rang);
  });
  for (let c = 0; c < noeuds.length - 1; c++) {
    for (const A of noeuds[c]) for (const B of noeuds[c + 1]) {
      const lien = m(new THREE.CylinderGeometry(0.012, 0.012, A.distanceTo(B), 6, 1, true), 0, 0, 0, 3);
      lien.position.copy(A).lerp(B, 0.5);
      lien.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
      g.add(lien);
    }
  }
  return g;
}

function formulaire() { // une feuille de papier devenue formulaire validé
  const g = new THREE.Group();
  g.add(m(new THREE.BoxGeometry(1.9, 2.5, 0.06), -0.2, 0.14, -0.3, 0.35)); // la pile derrière
  g.add(m(new THREE.BoxGeometry(1.9, 2.5, 0.06), 0, 0, 0, 0.7));
  [0.8, 0.4, 0.0].forEach((y, i) => g.add(m(new THREE.BoxGeometry(i === 2 ? 0.8 : 1.3, 0.09, 0.05), i === 2 ? -0.4 : -0.15, y, 0.08, 6)));
  const petit = m(new THREE.BoxGeometry(0.4, 0.11, 0.06), 0.12, -0.78, 0.08, 9);
  petit.rotation.z = -Math.PI / 4;
  const grand = m(new THREE.BoxGeometry(0.85, 0.11, 0.06), 0.5, -0.62, 0.08, 9);
  grand.rotation.z = Math.PI / 3.6;
  g.add(petit, grand);
  return g;
}

function flux() { // nœuds reliés, comme un flux n8n
  const g = new THREE.Group();
  const pts = [[-1.5, 0.5, 0], [0, -0.3, 0.3], [1.45, 0.75, -0.2], [1.3, -1.0, 0.3], [-1.2, -1.0, -0.3]];
  [[0, 1], [1, 2], [1, 3], [4, 1]].forEach(([i, j]) => {
    const A = new THREE.Vector3(...pts[i]), B = new THREE.Vector3(...pts[j]);
    const tige = m(new THREE.CylinderGeometry(0.035, 0.035, A.distanceTo(B), 8, 1, true), 0, 0, 0, 3);
    tige.position.copy(A).lerp(B, 0.5);
    tige.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.add(tige);
  });
  pts.forEach((p, i) => g.add(m(new THREE.SphereGeometry(i === 1 ? 0.5 : 0.32, 24, 16), ...p)));
  return g;
}

function globe() { // contact : un arc relie Chicoutimi à Conakry
  const g = new THREE.Group(), R = 1.3;
  const lieu = (lat, lon) => {
    const a = THREE.MathUtils.degToRad(lat), o = THREE.MathUtils.degToRad(lon);
    return new THREE.Vector3(Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o));
  };
  const chicoutimi = lieu(48.43, -71.07), conakry = lieu(9.54, -13.68);
  g.add(m(new THREE.SphereGeometry(R, 48, 32), 0, 0, 0, 0.55));
  const points = [];
  for (let i = 0; i <= 40; i++) {
    const f = i / 40;
    points.push(chicoutimi.clone().lerp(conakry, f).normalize().multiplyScalar(R * (1 + 0.32 * Math.sin(Math.PI * f))));
  }
  g.add(m(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, 0.022, 6), 0, 0, 0, 22));
  g.add(m(new THREE.TorusGeometry(1.75, 0.01, 6, 96), 0, 0, 0, 8)).children.at(-1).rotation.x = Math.PI / 2;
  return g;
}

/* ---------- Démarrage ---------- */
function demarrer() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.z = 10;

  // place: 'sol' (nappe sous l'horizon) ou 'cote' (objet à droite du texte)
  const formes = [
    { pts: relief(), place: 'sol', vague: 1, eclat: 0.95, tourne: () => 0 },
    { pts: semer(barres()), place: 'cote', vague: 0, eclat: 1, tourne: (t) => -0.3 + Math.sin(t * 0.35) * 0.55 },
    { pts: semer(formulaire()), place: 'cote', vague: 0, eclat: 1, tourne: (t) => -0.35 + Math.sin(t * 0.35) * 0.5 },
    { pts: semer(flux()), place: 'cote', vague: 0, eclat: 1, tourne: (t) => Math.sin(t * 0.3) * 0.6 },
    { pts: semer(gantt()), place: 'cote', vague: 0, eclat: 1, tourne: (t) => -0.25 + Math.sin(t * 0.3) * 0.45 },
    { pts: semer(reseau()), place: 'cote', vague: 0, eclat: 1, tourne: (t) => -0.2 + Math.sin(t * 0.32) * 0.5 },
    { pts: semer(alliance()), place: 'cote', vague: 0, eclat: 1, tourne: (t) => 0.5 + Math.sin(t * 0.4) * 0.7 },
    { pts: semer(engrenage()), place: 'cote', vague: 0, eclat: 1, tourne: (t) => Math.sin(t * 0.35) * 0.8 },
    { pts: semer(maison()), place: 'cote', vague: 0, eclat: 1, tourne: (t) => -0.5 + Math.sin(t * 0.35) * 0.6 },
    { pts: semer(globe()), place: 'cote', vague: 0, eclat: 0.9, tourne: (t) => 0.73 + Math.sin(t * 0.3) * 0.4 },
  ];
  formes.forEach((f) => { f.attr = new THREE.BufferAttribute(f.pts, 3); });

  const hasard = new Float32Array(N * 4);
  for (let i = 0; i < hasard.length; i++) hasard[i] = Math.random();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', formes[0].attr); // requis par three, non utilisé
  geo.setAttribute('aDe', formes[0].attr);
  geo.setAttribute('aVers', formes[1].attr);
  geo.setAttribute('aHasard', new THREE.BufferAttribute(hasard, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

  const U = {
    uMix: { value: 0 }, uTemps: { value: 0 }, uIntro: { value: calme ? 1 : 0 }, uTaille: { value: 1 },
    uPosA: { value: new THREE.Vector3() }, uPosB: { value: new THREE.Vector3() },
    uRotA: { value: 0 }, uRotB: { value: 0 },
    uVagueA: { value: 1 }, uVagueB: { value: 0 },
    uEchA: { value: 1 }, uEchB: { value: 1 },
    uEclatA: { value: 0.5 }, uEclatB: { value: 1 },
    uSouris: { value: new THREE.Vector3(99, 99, 0) },
    uOnde: { value: new THREE.Vector3(0, 0, 99) }, uVitesse: { value: 0 },
    uAccent: { value: new THREE.Color(0xc8ff3e) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aDe; attribute vec3 aVers; attribute vec4 aHasard;
      uniform float uMix, uTemps, uIntro, uTaille;
      uniform vec3 uPosA, uPosB, uSouris, uOnde;
      uniform float uVitesse;
      uniform float uRotA, uRotB, uVagueA, uVagueB, uEchA, uEchB, uEclatA, uEclatB;
      varying float vAlpha; varying float vAccent;

      vec3 poser(vec3 p, float rot, float vague, vec3 pos, float ech) {
        // nappe : houle lente, comme des séries de données qui respirent
        p.y += vague * (sin(p.x * 0.55 + uTemps * 0.55) * 0.34
                      + cos(p.z * 0.75 + uTemps * 0.4) * 0.3
                      + sin((p.x + p.z) * 0.32 + uTemps * 0.28) * 0.26);
        float c = cos(rot), s = sin(rot);
        p.xz = mat2(c, -s, s, c) * p.xz;
        float inclinaison = (1.0 - vague) * 0.28;
        float ci = cos(inclinaison), si = sin(inclinaison);
        p.yz = mat2(ci, -si, si, ci) * p.yz;
        return p * ech + pos;
      }

      void main() {
        // chaque point part à son propre moment
        float k = clamp(uMix * 1.7 - aHasard.x * 0.7, 0.0, 1.0);
        k = k * k * (3.0 - 2.0 * k);
        vec3 A = poser(aDe, uRotA, uVagueA, uPosA, uEchA);
        vec3 B = poser(aVers, uRotB, uVagueB, uPosB, uEchB);
        vec3 p = mix(A, B, k);

        vec3 dir = normalize(aHasard.yzw - 0.5);
        p += dir * sin(k * 3.14159) * (0.9 + aHasard.y * 1.3);   // dispersion en vol
        p += dir * (1.0 - uIntro) * (1.0 - uIntro) * 9.0;        // rassemblement d'entrée
        p += dir * 0.02 * sin(uTemps * 1.4 + aHasard.x * 40.0);  // frémissement

        // la souris écarte les points
        vec2 d = p.xy - uSouris.xy;
        float f = exp(-dot(d, d) * 1.6);
        p.xy += normalize(d + 0.0001) * f * 0.42;
        p.z += f * 0.5;

        // un clic lance une onde de choc qui traverse le nuage
        vec2 d2 = p.xy - uOnde.xy;
        float front = length(d2) - uOnde.z * 7.0;
        float onde = exp(-front * front * 2.5) * exp(-uOnde.z * 1.3);
        p.xy += normalize(d2 + 0.0001) * onde * 0.55;
        p.z += onde * 0.9;

        // un défilement rapide étire le nuage
        p += dir * uVitesse * (0.15 + aHasard.y * 0.55);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uTaille * (0.55 + aHasard.z * 0.9) / -mv.z;

        vAccent = step(0.88, aHasard.w);
        float loin = smoothstep(22.0, 9.0, -mv.z);
        float scintille = 0.82 + 0.3 * sin(uTemps * 2.6 + aHasard.w * 60.0);
        vAlpha = mix(uEclatA, uEclatB, k) * loin * scintille * (0.42 + f * 1.2 + onde * 1.6 + vAccent * 0.4);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uAccent;
      varying float vAlpha; varying float vAccent;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        vec3 couleur = mix(vec3(0.86, 0.9, 1.0), uAccent, vAccent);
        gl_FragColor = vec4(couleur, a * a * vAlpha);
      }`,
  });
  scene.add(new THREE.Points(geo, mat));

  /* ----- Mise en page ----- */
  let vueL = 1, vueH = 1, etroit = false;
  function redimensionner() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    vueH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    vueL = vueH * camera.aspect;
    etroit = innerWidth < 1000;
    U.uTaille.value = innerHeight * renderer.getPixelRatio() * (etroit ? 0.04 : 0.033);
    mesurer();
  }
  function placer(f, pos) {
    if (f.place === 'sol') { pos.set(0, etroit ? -2.5 : -2.2, 0); return 1; }
    if (etroit) { pos.set(0, vueH * 0.2, 0); return Math.min(0.62, vueL / 4.6); }
    pos.set(vueL * 0.24, 0, 0);
    return Math.min(1.0, vueL / 10);
  }

  /* ----- Défilement : entre quelles formes sommes-nous ? ----- */
  const stations = [...document.querySelectorAll('.station')];
  let centres = [];
  function mesurer() {
    centres = stations.map((el) => {
      const r = el.getBoundingClientRect();
      return r.top + scrollY + r.height / 2;
    });
  }
  let segment = -1, cibleMix = 0;
  function suivre() {
    const y = scrollY + innerHeight / 2;
    let s = 0;
    while (s < centres.length - 2 && y > centres[s + 1]) s++;
    const f = THREE.MathUtils.clamp((y - centres[s]) / (centres[s + 1] - centres[s]), 0, 1);
    // on garde la forme le temps de lire, puis on la défait
    const debut = s === 0 ? 0.55 : 0.3, duree = s === 0 ? 0.35 : 0.4;
    cibleMix = THREE.MathUtils.clamp((f - debut) / duree, 0, 1);
    if (s !== segment) {
      segment = s;
      geo.setAttribute('aDe', formes[s].attr);
      geo.setAttribute('aVers', formes[s + 1].attr);
      U.uMix.value = cibleMix; // pas de rattrapage à travers un changement de paire
    }
  }
  addEventListener('scroll', suivre, { passive: true });
  addEventListener('resize', redimensionner);
  redimensionner();
  suivre();
  document.fonts?.ready.then(() => { mesurer(); suivre(); });

  const t0 = performance.now();
  const horloge = { elapsedTime: 0, getDelta() { const n = (performance.now() - t0) / 1000, d = n - this.elapsedTime; this.elapsedTime = n; return d; } };

  /* ----- Souris ----- */
  const souris = new THREE.Vector3(99, 99, 0), regard = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const x = (e.clientX / innerWidth) * 2 - 1, y = -((e.clientY / innerHeight) * 2 - 1);
    souris.set(x * vueL * 0.5, y * vueH * 0.5, 0);
    regard.x = x; regard.y = y;
  });
  document.addEventListener('pointerleave', () => souris.set(99, 99, 0));
  let debutOnde = -99;
  addEventListener('pointerdown', (e) => {
    if (calme) return;
    const x = (e.clientX / innerWidth) * 2 - 1, y = -((e.clientY / innerHeight) * 2 - 1);
    U.uOnde.value.set(x * vueL * 0.5, y * vueH * 0.5, 0);
    debutOnde = horloge.elapsedTime;
  });
  let dernierY = scrollY;

  /* ----- Boucle ----- */
  function image() {
    const dt = Math.min(horloge.getDelta(), 1), t = horloge.elapsedTime;
    const A = formes[segment], B = formes[segment + 1];
    U.uTemps.value = calme ? 0 : t;
    if (!calme) U.uIntro.value = Math.min(1, t / 2.2); // au temps réel, même si l'onglet est ralenti
    U.uMix.value += (cibleMix - U.uMix.value) * (calme ? 1 : 1 - Math.pow(0.0015, dt));
    U.uEchA.value = placer(A, U.uPosA.value);
    U.uEchB.value = placer(B, U.uPosB.value);
    U.uRotA.value = calme ? 0.4 : A.tourne(t);
    U.uRotB.value = calme ? 0.4 : B.tourne(t);
    U.uVagueA.value = A.vague; U.uVagueB.value = B.vague;
    U.uEclatA.value = A.eclat; U.uEclatB.value = B.eclat;
    U.uSouris.value.lerp(souris, 0.15);
    U.uOnde.value.z = t - debutOnde;
    const vit = calme ? 0 : Math.min(1, Math.abs(scrollY - dernierY) / Math.max(dt, 0.001) / 3500);
    dernierY = scrollY;
    U.uVitesse.value += (vit - U.uVitesse.value) * 0.12;
    if (!calme) {
      camera.position.x += (regard.x * 0.35 - camera.position.x) * 0.04;
      camera.position.y += (regard.y * 0.2 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(image);
  }
  image();
}

if (renderer) demarrer();
