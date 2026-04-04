// ─────────────────────────────────────────────────────────────────────────────
//  Brave New World  ·  p5.js generative art
//  Human relationships as particles: couples drift together, swap partners,
//  and one lonely soul — the Solo — tries to connect, only to be hurt again.
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ────────────────────────────────────────────────────────────────
const NUM_PAIRS        = 200;   // regular coupled particles (×2)
const COUPLE_ORBIT_R   = 28;   // base orbit radius around shared center
const CENTER_DRIFT_SPD = 0.45; // how fast couple centers wander
const RESHUFFLE_MIN    = 7000; // ms between reshuffles (min)
const RESHUFFLE_MAX    = 13000;
const BOND_DURATION    = 8400; // ms solo stays bonded before breakup
const INJURY_PER_BREAK = 0.18; // how much injury each breakup adds
const INJURY_RECOVERY  = 0.00008; // per-frame injury recovery
const TREMOR_THRESHOLD = 0.45; // injury level at which trembling starts
const FLOCK_INTERVAL   = 9000; // ms between activations of the flock
const FLOCK_DURATION   = 21000; // ms that lasts the flock
// Regular particles stay within this hue band (cool blue-violet).
// The solo is warm amber (42°) — visually opposite, instantly distinct.
const REG_HUE_MIN = 195;
const REG_HUE_MAX = 255;
// WE ARE HERE!
// ── Globals ───────────────────────────────────────────────────────────────────
let regularParticles = [];
let solo;
let bgMusic;
let bondOsc, bondEnv;
let breakOsc, breakEnv;
let audioStarted = false;

let flockMode = false; // it says whether we are in flock mode or not
let flockTimeout = null; // save the timer that turns off the flock
let flockCycleTimeout = null; // save the timer that restarts the next cycle
// ----- connect the audio to the flock
let amplitudeAnalyzer;
let fftAnalyzer;
// smoothed values to avoid abrupt changes
let musicLevel = 0;
let bassEnergy = 0;
let trebleEnergy = 0;

// Particle uid counter
let _uid = 0;
// WE ARE... HERE!
// ── p5.js preload ─────────────────────────────────────────────────────────────
function preload() {
  // loadSound is async — use error callback so a missing file is gracefully skipped
  bgMusic = loadSound(
    'assets/background.mp3',
    () => {},           // success: do nothing special, play on first gesture
    () => { bgMusic = null; }  // error: no file present — run without music
  );
}
// WE ... ARE... HERE!
// ── p5.js setup ───────────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  angleMode(RADIANS);

  initSounds();

  amplitudeAnalyzer = new p5.Amplitude();
  fftAnalyzer = new p5.FFT(0.85, 1024);

  spawnParticles();
  scheduleNextReshuffle();
  scheduleFlockMode();
}

// Exposed for the story game manager to call on restart
window.restartSketch = function () {
  _uid = 0;
  spawnParticles();
  scheduleNextReshuffle();
  scheduleFlockMode();
};
// BANANA MOUSQUETAIRES!
// ── p5.js draw ────────────────────────────────────────────────────────────────
function draw() {
  // Semi-transparent dark overlay → motion trails
  noStroke();
  fill(240, 15, 5, 22);
  rect(0, 0, width, height);

  updateAudioReactiveValues();

  // Update & draw regular particles + their bonds
  for (let p of regularParticles) p.update();
  drawRegularBonds();
  for (let p of regularParticles) p.display();

  // Solo particle (drawn on top)
  solo.update();
  drawSoloBond();
  solo.display();

  // Slowly heal solo's injuries
  if (solo.injuryLevel > 0) {
    solo.injuryLevel = max(0, solo.injuryLevel - INJURY_RECOVERY);
  }
  drawAudioDebug();
}

// ── Window resize ─────────────────────────────────────────────────────────────
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ── Interaction ───────────────────────────────────────────────────────────────
function mouseClicked() {
  triggerSoloSeek();
}

function keyPressed() {
  if (key === ' ') triggerSoloSeek();
}

// ── Audio bootstrap (Web Audio requires a user gesture) ───────────────────────
function startAudioIfNeeded() {
  if (audioStarted) return;
  audioStarted = true;
  if (typeof getAudioContext !== 'undefined') {
    getAudioContext().resume();
  }
  if (bgMusic && !bgMusic.isPlaying()) {
    bgMusic.loop();
    bgMusic.setVolume(0.4);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PARTICLE SPAWNING
// ─────────────────────────────────────────────────────────────────────────────
function spawnParticles() {
  regularParticles = [];

  for (let i = 0; i < NUM_PAIRS; i++) {
    let cx = random(80, width  - 80);
    let cy = random(80, height - 80);
    let center = createVector(cx, cy);

    let angle = random(TWO_PI);
    let hue = random(REG_HUE_MIN, REG_HUE_MAX);
    let p1 = new RegularParticle(center, angle, hue);
    let p2 = new RegularParticle(center, angle + PI, hue);
    p1.partner = p2;
    p2.partner = p1;

    regularParticles.push(p1, p2);
  }

  solo = new SoloParticle(createVector(width / 2, height / 2));
}

// ─────────────────────────────────────────────────────────────────────────────
//  RESHUFFLE (couples swap partners periodically)
// ─────────────────────────────────────────────────────────────────────────────
function scheduleNextReshuffle() {
  setTimeout(reshuffleCouples, random(RESHUFFLE_MIN, RESHUFFLE_MAX));
}

function reshuffleCouples() {
  // First: try to re-pair any lonely regular particles (abandoned when solo
  // stole their partner). Pair them with each other or with a random single.
  let lonely = regularParticles.filter(p => !p.partner);
  while (lonely.length >= 2) {
    // Pop two and pair them
    let a = lonely.pop();
    let b = lonely.pop();
    let hue = random(REG_HUE_MIN, REG_HUE_MAX);
    let newCenter = p5.Vector.lerp(a.pos, b.pos, 0.5);
    a.reassign(b, newCenter, hue);
    b.reassign(a, newCenter, hue);
  }

  // Then do the usual cross-couple swap for variety
  let coupled = regularParticles.filter(p => p.partner);
  if (coupled.length < 4) { scheduleNextReshuffle(); return; }

  // Collect pair representatives (one per pair, avoid duplicates)
  let seen = new Set();
  let pairs = [];
  for (let p of coupled) {
    if (!seen.has(p.id) && !seen.has(p.partner.id)) {
      seen.add(p.id);
      seen.add(p.partner.id);
      pairs.push([p, p.partner]);
    }
  }

  if (pairs.length < 2) { scheduleNextReshuffle(); return; }

  // Shuffle and take first 2
  for (let i = pairs.length - 1; i > 0; i--) {
    let j = floor(random(i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }

  let [a1, a2] = pairs[0];
  let [b1, b2] = pairs[1];

  // Cross-pair: a1↔b1 and a2↔b2
  // New hues stay within the cool band so regular particles always look similar
  let hue1 = random(REG_HUE_MIN, REG_HUE_MAX);
  let hue2 = random(REG_HUE_MIN, REG_HUE_MAX);
  let newCenter1 = p5.Vector.lerp(a1.pos, b1.pos, 0.5);
  let newCenter2 = p5.Vector.lerp(a2.pos, b2.pos, 0.5);

  a1.reassign(b1, newCenter1, hue1);
  b1.reassign(a1, newCenter1, hue1);
  a2.reassign(b2, newCenter2, hue2);
  b2.reassign(a2, newCenter2, hue2);

  scheduleNextReshuffle();
}

// ─────────────────────────────────────────────────────────────────────────────
//  BOND DRAWING
// ─────────────────────────────────────────────────────────────────────────────
function drawRegularBonds() {
  for (let p of regularParticles) {
    // Draw each bond once (lower id draws it)
    if (!p.partner || p.id > p.partner.id) continue;
    let alpha = 28 + 18 * sin(frameCount * 0.015 + p.id);
    drawBond(p.pos, p.partner.pos, p.hue, alpha, 1.0);
  }
}

function drawSoloBond() {
  if (!solo.partner || !solo.bondAlpha) return;
  let alpha = solo.bondAlpha * (1 - solo.injuryLevel * 0.5);
  drawBond(solo.pos, solo.partner.pos, solo.bondHue, alpha, 1.8);

  // Tiny glowing nodes at each end to emphasise the connection
  let glowA = alpha * 0.6;
  noStroke();
  fill(solo.bondHue, 60, 100, glowA);
  ellipse(solo.pos.x, solo.pos.y, 6, 6);
  ellipse(solo.partner.pos.x, solo.partner.pos.y, 6, 6);
}

function drawBond(posA, posB, hue, alpha, sw) {
  let d = dist(posA.x, posA.y, posB.x, posB.y);
  if (d < 1) return; // guard against coincident points
  let mx = (posA.x + posB.x) / 2;
  let my = (posA.y + posB.y) / 2;
  // Control point perpendicular to the midpoint (scales with distance)
  let nx = -(posB.y - posA.y) * 0.18;
  let ny =  (posB.x - posA.x) * 0.18;

  stroke(hue, 55, 95, alpha);
  strokeWeight(sw);
  noFill();
  beginShape();
  vertex(posA.x, posA.y);
  quadraticVertex(mx + nx, my + ny, posB.x, posB.y);
  endShape();
}

// ─────────────────────────────────────────────────────────────────────────────
//  SOLO INTERACTION TRIGGER
// ─────────────────────────────────────────────────────────────────────────────
function triggerSoloSeek() {
  if (window.storyInteractionBlocked) return; // story overlay is active
  startAudioIfNeeded();
  if (solo.bonded) return; // already in a relationship

  // Find nearest regular particle (regardless of their couple status)
  let nearest = null;
  let nearDist = Infinity;
  for (let p of regularParticles) {
    let d = dist(solo.pos.x, solo.pos.y, p.pos.x, p.pos.y);
    if (d < nearDist) {
      nearDist = d;
      nearest = p;
    }
  }
  if (!nearest) return;

  // Strict 2-particle bond: release nearest's current partner first so no
  // triangle forms. The abandoned particle wanders alone until reshuffled.
  if (nearest.partner) {
    nearest.partner.partner = null; // abandoned — now single
    nearest.partner = null;
  }

  solo.enterRelationship(nearest);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SOUND SETUP
// ─────────────────────────────────────────────────────────────────────────────
function initSounds() {
  try {
    // Bond-forming sound: two rising notes
    bondOsc = new p5.Oscillator('sine');
    bondEnv = new p5.Envelope();
    bondEnv.setADSR(0.02, 0.15, 0.3, 0.6);
    bondEnv.setRange(0.45, 0);
    bondOsc.amp(bondEnv);
    bondOsc.start();
    bondOsc.amp(0);

    // Bond-breaking sound: descending sawtooth
    breakOsc = new p5.Oscillator('sawtooth');
    breakEnv = new p5.Envelope();
    breakEnv.setADSR(0.01, 0.05, 0.1, 0.7);
    breakEnv.setRange(0.35, 0);
    breakOsc.amp(breakEnv);
    breakOsc.start();
    breakOsc.amp(0);
  } catch (e) {
    // p5.sound not available — silence is fine
    bondOsc = null;
    breakOsc = null;
  }
}

function playBondSound() {
  if (!bondOsc) return;
  try {
    bondOsc.freq(523.25); // C5
    bondEnv.play(bondOsc);
    setTimeout(() => {
      bondOsc.freq(659.25); // E5
      bondEnv.play(bondOsc);
    }, 180);
  } catch (e) {}
}

function playBreakSound() {
  if (!breakOsc) return;
  try {
    breakOsc.freq(220); // A3
    breakEnv.play(breakOsc);
    setTimeout(() => {
      breakOsc.freq(174.61); // F3 — melancholic drop
      breakEnv.play(breakOsc);
    }, 160);
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
//  FUNCTIONS OF THE FLOCKING CYCLE
// ─────────────────────────────────────────────────────────────────────────────
function scheduleFlockMode() {
  // limpia timers previos por si reinicias el sketch
  if (flockTimeout) clearTimeout(flockTimeout);
  if (flockCycleTimeout) clearTimeout(flockCycleTimeout);

  flockMode = false;

  flockCycleTimeout = setTimeout(() => {
    startFlockMode();
  }, FLOCK_INTERVAL);
}

function startFlockMode() {
  flockMode = true;

  flockTimeout = setTimeout(() => {
    stopFlockMode();
  }, FLOCK_DURATION);
}

function stopFlockMode() {
  flockMode = false;

  flockCycleTimeout = setTimeout(() => {
    startFlockMode();
  }, FLOCK_INTERVAL);
}

// ─────────────────────────────────────────────────────────────────────────────
//  FUNCTIONs FOR MUSIC
// ─────────────────────────────────────────────────────────────────────────────
function updateAudioReactiveValues() {
  // amplitud general
  let rawLevel = amplitudeAnalyzer ? amplitudeAnalyzer.getLevel() : 0;

  // espectro FFT
  if (fftAnalyzer) {
    fftAnalyzer.analyze();
  }

  let rawBass = fftAnalyzer ? fftAnalyzer.getEnergy("bass") / 255 : 0;
  let rawTreble = fftAnalyzer ? fftAnalyzer.getEnergy("treble") / 255 : 0;

  // suavizado para evitar jitter
  musicLevel = lerp(musicLevel, rawLevel, 0.12);
  bassEnergy = lerp(bassEnergy, rawBass, 0.12);
  trebleEnergy = lerp(trebleEnergy, rawTreble, 0.12);
}

function drawAudioDebug() {
  let panelX = 20;
  let panelY = 20;
  let panelW = 220;
  let lineH = 26;
  let barW = 110;
  let barH = 10;

  push();

  // fondo del panel
  noStroke();
  fill(0, 0, 0, 55);
  rect(panelX - 10, panelY - 10, panelW, 110, 8);

  fill(0, 0, 100, 90);
  textSize(14);
  textAlign(LEFT, CENTER);

  // musicLevel
  text(`musicLevel: ${nf(musicLevel, 1, 3)}`, panelX, panelY);
  fill(200, 80, 100, 85);
  rect(panelX + 95, panelY - 5, barW * constrain(musicLevel * 4, 0, 1), barH, 3);

  // bassEnergy
  fill(0, 0, 100, 90);
  text(`bassEnergy: ${nf(bassEnergy, 1, 3)}`, panelX, panelY + lineH);
  fill(35, 80, 100, 85);
  rect(panelX + 95, panelY + lineH - 5, barW * constrain(bassEnergy, 0, 1), barH, 3);

  // trebleEnergy
  fill(0, 0, 100, 90);
  text(`trebleEnergy: ${nf(trebleEnergy, 1, 3)}`, panelX, panelY + lineH * 2);
  fill(320, 60, 100, 85);
  rect(panelX + 95, panelY + lineH * 2 - 5, barW * constrain(trebleEnergy, 0, 1), barH, 3);

  // estado flock
  fill(0, 0, 100, 90);
  text(`flockMode: ${flockMode ? "ON" : "OFF"}`, panelX, panelY + lineH * 3);

  pop();
}