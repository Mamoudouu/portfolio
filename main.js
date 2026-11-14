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

/* ---------- Formes secrètes ---------- */
function initiales() { // « MC » échantillonné dans un canevas, puis transformé en points
  const c = document.createElement('canvas'), L = 520, H = 220;
  c.width = L; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.font = `800 200px Archivo, "Helvetica Neue", Arial, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('MC', L / 2, H / 2 + 10);
  const px = x.getImageData(0, 0, L, H).data, pleins = [];
  for (let j = 0; j < H; j += 2) for (let i = 0; i < L; i += 2) if (px[(j * L + i) * 4 + 3] > 128) pleins.push(i, j);
  const out = new Float32Array(N * 3), n = pleins.length / 2, e = 4.6 / L;
  for (let k = 0; k < N; k++) {
    const q = ((Math.random() * n) | 0) * 2;
    out[k * 3] = (pleins[q] - L / 2 + Math.random() * 2) * e;
    out[k * 3 + 1] = -(pleins[q + 1] - H / 2 + Math.random() * 2) * e;
    out[k * 3 + 2] = (Math.random() - 0.5) * 0.25;
  }
  return out;
}

function grille() { // une feuille Excel : lignes, colonnes, en-tête et quelques cellules remplies
  const out = new Float32Array(N * 3), col = 7, lig = 9, Lg = 3.9, Ht = 2.8;
  const remplies = [[1, 2], [3, 2], [2, 4], [5, 3], [4, 6], [1, 7], [6, 5]];
  for (let k = 0; k < N; k++) {
    const t = Math.random();
    let x, y;
    if (t < 0.32) { x = (((Math.random() * (col + 1)) | 0) / col - 0.5) * Lg; y = (Math.random() - 0.5) * Ht; }       // colonnes
    else if (t < 0.64) { x = (Math.random() - 0.5) * Lg; y = (((Math.random() * (lig + 1)) | 0) / lig - 0.5) * Ht; } // lignes
    else if (t < 0.82) { x = (Math.random() - 0.5) * Lg; y = Ht / 2 - Math.random() * (Ht / lig); }                    // en-tête
    else { const [c, l] = remplies[(Math.random() * remplies.length) | 0];                                              // cellules
      x = ((c + Math.random()) / col - 0.5) * Lg; y = (0.5 - (l + Math.random()) / lig) * Ht; }
    out[k * 3] = x; out[k * 3 + 1] = y; out[k * 3 + 2] = (Math.random() - 0.5) * 0.08;
  }
  return out;
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

function globe() { // contact : un globe et son anneau
  const g = new THREE.Group(), R = 1.3;
  g.add(m(new THREE.SphereGeometry(R, 48, 32), 0, 0, 0, 0.55));
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
  geo.setAttribute('aSecA', formes[0].attr); // remplacés au moment d'un secret
  geo.setAttribute('aSecB', formes[0].attr);
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
    uSecret: { value: 0 }, uSecK: { value: 0 }, uBrule: { value: 0 }, uSecEch: { value: 1 }, uSecPos: { value: new THREE.Vector3() },
    uSecousse: { value: 0 }, uAurore: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aDe; attribute vec3 aVers; attribute vec4 aHasard;
      uniform float uMix, uTemps, uIntro, uTaille;
      uniform vec3 uPosA, uPosB, uSouris, uOnde;
      uniform float uVitesse, uSecret, uSecK, uBrule, uSecEch, uSecousse;
      uniform vec3 uSecPos;
      attribute vec3 aSecA; attribute vec3 aSecB;
      uniform float uRotA, uRotB, uVagueA, uVagueB, uEchA, uEchB, uEclatA, uEclatB;
      varying float vAlpha; varying float vAccent; varying vec3 vAur;

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

        // secrets : les points quittent la forme du projet pour une forme cachée
        float ks = clamp(uSecK * 1.6 - aHasard.x * 0.6, 0.0, 1.0); ks = ks * ks * (3.0 - 2.0 * ks);
        vec3 S = mix(aSecA, aSecB, ks);
        S += dir * sin(ks * 3.14159) * 1.1;
        S.y += uBrule * (0.4 + aHasard.y * 2.8);                 // la grille « brûle » : les points s'envolent
        S.x += uBrule * (aHasard.z - 0.5) * 1.6;
        S = S * uSecEch + uSecPos;
        float kx = clamp(uSecret * 1.5 - aHasard.x * 0.5, 0.0, 1.0); kx = kx * kx * (3.0 - 2.0 * kx);
        p = mix(p, S, kx) + dir * sin(kx * 3.14159) * 0.8;
        p += dir * uSecousse * (1.5 + aHasard.y * 3.5);          // secousse du téléphone

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
        vAlpha = mix(mix(uEclatA, uEclatB, k), 1.0, kx) * loin * scintille * (0.42 + f * 1.2 + onde * 1.6 + vAccent * 0.4);

        // aurore boréale : des voiles vert, turquoise et violet qui ondulent
        float h = fract(p.y * 0.16 + p.x * 0.07 + sin(p.x * 0.5 + uTemps * 0.6) * 0.12 + uTemps * 0.05 + aHasard.w * 0.25);
        vec3 vert = vec3(0.22, 1.0, 0.6), turquoise = vec3(0.15, 0.85, 1.0), violet = vec3(0.6, 0.35, 1.0), rose = vec3(1.0, 0.42, 0.78);
        vAur = mix(mix(vert, turquoise, smoothstep(0.0, 0.35, h)), mix(violet, rose, smoothstep(0.7, 1.0, h)), smoothstep(0.35, 0.7, h));
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uAccent;
      uniform float uAurore;
      varying float vAlpha; varying float vAccent; varying vec3 vAur;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        vec3 couleur = mix(vec3(0.86, 0.9, 1.0), uAccent, vAccent);
        couleur = mix(couleur, vAur, uAurore);
        gl_FragColor = vec4(couleur, a * a * vAlpha * (1.0 + uAurore * 0.35));
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
    if (etroit) { pos.set(0, vueH * 0.24, 0); return Math.min(0.8, vueL / 4); } // formes plus grandes sur écran étroit
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

  /* ----- Doigt : les points s'écartent sous le doigt ----- */
  // On suit le doigt sans jamais bloquer le défilement : la page défile normalement
  // et les points réagissent en même temps sous le doigt.
  const versScene = (cx, cy) => souris.set(((cx / innerWidth) * 2 - 1) * vueL * 0.5, -((cy / innerHeight) * 2 - 1) * vueH * 0.5, 0);
  const suivreDoigt = (e) => {
    if (calme || e.touches.length !== 1) return;
    versScene(e.touches[0].clientX, e.touches[0].clientY);
  };
  addEventListener('touchstart', suivreDoigt, { passive: true });
  addEventListener('touchmove', suivreDoigt, { passive: true });
  const lacher = () => souris.set(99, 99, 0);
  addEventListener('touchend', lacher, { passive: true });
  addEventListener('touchcancel', lacher, { passive: true });

  /* ----- Inclinaison du téléphone : la scène pivote ----- */
  let ampleur = 1, neutre = null;
  function incliner(e) {
    if (e.beta == null || e.gamma == null) return;
    if (!neutre) neutre = { b: e.beta, g: e.gamma }; // la position de départ sert de référence
    const borne = (v) => Math.max(-1, Math.min(1, v));
    regard.x = borne((e.gamma - neutre.g) / 25);
    regard.y = borne(-(e.beta - neutre.b) / 25);
    ampleur = 3.2; // plus marqué qu'avec la souris : c'est tout le téléphone qui bouge
  }
  const tactile = matchMedia('(pointer: coarse)').matches;
  // les capteurs de mouvement n'existent que sur une connexion sécurisée (https)
  if (tactile && !calme && window.isSecureContext && 'DeviceOrientationEvent' in window) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iPhone : Apple exige un geste du visiteur pour autoriser le mouvement
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mouvement';
      b.textContent = 'Activer le mouvement 3D';
      b.addEventListener('click', async () => {
        // deux autorisations séparées : un refus de l'une ne bloque pas l'autre
        try { if (await DeviceOrientationEvent.requestPermission() === 'granted') addEventListener('deviceorientation', incliner); } catch (err) { /* refusée */ }
        try {
          if (typeof DeviceMotionEvent?.requestPermission !== 'function') addEventListener('devicemotion', secouer);
          else if (await DeviceMotionEvent.requestPermission() === 'granted') addEventListener('devicemotion', secouer);
        } catch (err) { /* refusée */ }
        b.remove();
      });
      document.body.append(b);
    } else {
      addEventListener('deviceorientation', incliner);
      addEventListener('devicemotion', secouer);
    }
  }
  let debutOnde = -99;
  addEventListener('pointerdown', (e) => {
    if (calme) return;
    const x = (e.clientX / innerWidth) * 2 - 1, y = -((e.clientY / innerHeight) * 2 - 1);
    U.uOnde.value.set(x * vueL * 0.5, y * vueH * 0.5, 0);
    debutOnde = horloge.elapsedTime;
    aurore(0.9, 0);
  });
  let dernierY = scrollY;

  /* ----- Aurore boréale : déclenchée par chaque action ----- */
  let auroreTenue = 0;
  function aurore(force, tenue) {
    if (calme) return;
    U.uAurore.value = Math.max(U.uAurore.value, force);
    auroreTenue = Math.max(auroreTenue, tenue);
  }

  /* ----- Petits secrets pour les curieux ----- */
  // Une file d'étapes : chaque étape amène des uniformes vers une valeur en un temps donné.
  let etapes = [], enCours = null;
  function jouer(liste) { etapes = liste.slice(); enCours = null; }
  function avancerSecrets(dt) {
    while (dt > 0) {
      if (!enCours) {
        const e = etapes.shift(); if (!e) return;
        if (e.faire) { e.faire(); continue; }
        enCours = { duree: e.duree, t: 0, cibles: e.cibles, depart: Object.fromEntries(Object.keys(e.cibles).map((k) => [k, U[k].value])) };
      }
      const pas = Math.min(dt, enCours.duree - enCours.t); enCours.t += pas; dt -= pas;
      const f = enCours.duree ? enCours.t / enCours.duree : 1, lisse = f * f * (3 - 2 * f);
      for (const k in enCours.cibles) U[k].value = enCours.depart[k] + (enCours.cibles[k] - enCours.depart[k]) * lisse;
      if (f >= 1) enCours = null; else return;
    }
  }
  let formeMC = null, formeGrille = null, formeAppli = null;
  const occupe = () => etapes.length > 0 || enCours;

  // 1. Cinq clics rapides dans le nuage : les initiales
  let clics = [];
  addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('a, button')) return;
    const t = performance.now();
    clics = clics.filter((c) => t - c < 1800); clics.push(t);
    if (clics.length >= 5 && !occupe()) {
      clics = [];
      formeMC ??= new THREE.BufferAttribute(initiales(), 3);
      geo.setAttribute('aSecA', formeMC); geo.setAttribute('aSecB', formeMC);
      U.uSecK.value = 0; U.uBrule.value = 0;
      aurore(1, 4);
      jouer([{ duree: 1.0, cibles: { uSecret: 1 } }, { duree: 2.8, cibles: {} }, { duree: 1.2, cibles: { uSecret: 0 } }]);
      trouve('initiales', 'Mes initiales');
    }
  });

  // 2. Taper « excel » : la grille brûle et renaît en application
  let frappe = '';
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
    frappe = (frappe + e.key.toLowerCase()).slice(-5);
    if (frappe === 'excel' && !occupe()) {
      formeGrille ??= new THREE.BufferAttribute(grille(), 3);
      formeAppli ??= new THREE.BufferAttribute(semer(formulaire()), 3);
      geo.setAttribute('aSecA', formeGrille); geo.setAttribute('aSecB', formeAppli);
      U.uSecK.value = 0; U.uBrule.value = 0;
      jouer([
        { duree: 1.0, cibles: { uSecret: 1 } },
        { duree: 1.4, cibles: {} },
        { faire: () => aurore(1, 2.6) },
        { duree: 1.1, cibles: { uBrule: 1 } },
        { duree: 1.3, cibles: { uBrule: 0, uSecK: 1 } },
        { duree: 2.2, cibles: {} },
        { duree: 1.2, cibles: { uSecret: 0 } },
      ]);
      trouve('excel', 'De la feuille Excel à l\u2019application');
    }
  });

  // 3. Secouer le téléphone : les points s'envolent puis reviennent
  let derniereSecousse = 0;
  function secouer(e) {
    const a = e.acceleration;
    if (!a || a.x == null) return;
    const force = Math.hypot(a.x, a.y, a.z), t = performance.now();
    if (force > 16 && t - derniereSecousse > 1500 && !calme) {
      derniereSecousse = t;
      U.uSecousse.value = 1;
      aurore(1, 1.2);
      trouve('secousse', 'Le nuage secoué');
    }
  }

  // 4. Le message caché pour ceux qui ouvrent les outils de développement
  console.log('%cVous inspectez le code?', 'font: 700 18px Archivo, sans-serif; color: #c8ff3e');
  console.log('Moi aussi, j\u2019aime comprendre comment les choses fonctionnent. Écrivez-moi sur LinkedIn : https://www.linkedin.com/in/mamoudou-camara-62b4322ba\nPetit secret : tapez merci() ici.');
  window.merci = () => {
    aurore(1, 3);
    trouve('console', 'Le message dans la console');
    return 'Merci de votre curiosité! Elle est réciproque.';
  };

  // Compteur discret : « n secrets trouvés sur 4 » (rien n'est enregistré, il repart à zéro à chaque visite)
  const trouves = new Set();
  let annonce = null, minuteur = 0;
  function trouve(cle, nom) {
    const nouveau = !trouves.has(cle);
    trouves.add(cle);
    if (!annonce) {
      annonce = document.createElement('div');
      annonce.className = 'compteur';
      annonce.setAttribute('role', 'status');
      document.body.append(annonce);
    }
    const n = trouves.size;
    annonce.innerHTML = `<strong>${nouveau ? 'Secret trouvé' : 'Déjà trouvé'} : ${nom}</strong><span>${n === 4 ? 'Les 4 secrets sont trouvés. Bravo!' : `${n} sur 4. Il en reste ${4 - n} à découvrir.`}</span>`;
    annonce.classList.add('montre');
    clearTimeout(minuteur);
    minuteur = setTimeout(() => annonce.classList.remove('montre'), 4500);
  }

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
    avancerSecrets(calme ? 99 : dt);
    // même place que les formes des projets : à droite sur grand écran, en haut sur mobile
    U.uSecEch.value = etroit ? Math.min(1.1, vueL / 5.2) : Math.min(1.05, vueL / 10.5);
    U.uSecPos.value.set(etroit ? 0 : vueL * 0.25, etroit ? vueH * 0.24 : 0, 0);
    if (auroreTenue > 0) auroreTenue -= dt; else U.uAurore.value *= Math.exp(-dt / 0.9);
    U.uSecousse.value *= Math.exp(-dt / 0.45);
    const vit = calme ? 0 : Math.min(1, Math.abs(scrollY - dernierY) / Math.max(dt, 0.001) / 3500);
    dernierY = scrollY;
    U.uVitesse.value += (vit - U.uVitesse.value) * 0.12;
    if (!calme) {
      camera.position.x += (regard.x * 0.35 * ampleur - camera.position.x) * 0.05;
      camera.position.y += (regard.y * 0.2 * ampleur - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(image);
  }
  image();
}

if (renderer) demarrer();
