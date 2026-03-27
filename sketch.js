// ─────────────────────────────────────────────────────────────────────────────
//  Brave New World  ·  p5.js generative art
//  Human relationships as particles: couples drift together, swap partners,
//  and one lonely soul — the Solo — tries to connect, only to be hurt again.
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ────────────────────────────────────────────────────────────────
const NUM_PAIRS        = 18;   // regular coupled particles (×2)
const COUPLE_ORBIT_R   = 28;   // base orbit radius around shared center
const CENTER_DRIFT_SPD = 0.45; // how fast couple centers wander
const RESHUFFLE_MIN    = 7000; // ms between reshuffles (min)
const RESHUFFLE_MAX    = 13000;
const BOND_DURATION    = 6500; // ms solo stays bonded before breakup
const INJURY_PER_BREAK = 0.18; // how much injury each breakup adds
const INJURY_RECOVERY  = 0.00008; // per-frame injury recovery
const TREMOR_THRESHOLD = 0.45; // injury level at which trembling starts

// Regular particles stay within this hue band (cool blue-violet).
// The solo is warm amber (42°) — visually opposite, instantly distinct.
const REG_HUE_MIN = 195;
const REG_HUE_MAX = 255;

// ── Globals ───────────────────────────────────────────────────────────────────
let regularParticles = [];
let solo;
let bgMusic;
let bondOsc, bondEnv;
let breakOsc, breakEnv;
let audioStarted = false;

// Particle uid counter
let _uid = 0;

// ── p5.js preload ─────────────────────────────────────────────────────────────
function preload() {
  // loadSound is async — use error callback so a missing file is gracefully skipped
  bgMusic = loadSound(
    'assets/background.mp3',
    () => {},           // success: do nothing special, play on first gesture
    () => { bgMusic = null; }  // error: no file present — run without music
  );
}

// ── p5.js setup ───────────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  angleMode(RADIANS);

  initSounds();
  spawnParticles();
  scheduleNextReshuffle();
}

// Exposed for the story game manager to call on restart
window.restartSketch = function () {
  _uid = 0;
  spawnParticles();
  scheduleNextReshuffle();
};

// ── p5.js draw ────────────────────────────────────────────────────────────────
function draw() {
  // Semi-transparent dark overlay → motion trails
  noStroke();
  fill(240, 15, 5, 22);
  rect(0, 0, width, height);

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
//  BASE PARTICLE CLASS
// ─────────────────────────────────────────────────────────────────────────────
class Particle {
  constructor(pos) {
    this.id  = _uid++;
    this.pos = pos.copy();
    this.vel = createVector(0, 0);
    this.hue = random(360);
    this.r   = 5;
  }

  update() {}

  display() {
    noStroke();
    fill(this.hue, 50, 88, 80);
    ellipse(this.pos.x, this.pos.y, this.r * 2, this.r * 2);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  REGULAR PARTICLE  (always tries to be in a couple)
// ─────────────────────────────────────────────────────────────────────────────
class RegularParticle extends Particle {
  constructor(center, angle, hue) {
    super(center);
    this.hue     = hue;
    this.center  = center.copy();
    this.angle   = angle;
    this.orbitR  = COUPLE_ORBIT_R + random(-8, 8);
    this.orbitSpd = random(0.006, 0.014) * (random(1) < 0.5 ? 1 : -1);
    this.partner = null;
    this.centerVel = p5.Vector.random2D().mult(CENTER_DRIFT_SPD * random(0.5, 1.5));
    this.r = 4 + random(2);
    this.noiseOff = random(1000);
  }

  // Called during reshuffle to smoothly switch partners
  reassign(newPartner, newCenter, sharedHue) {
    this.partner   = newPartner;
    this.center    = newCenter.copy();
    this.centerVel = p5.Vector.random2D().mult(CENTER_DRIFT_SPD);
    this.hue       = sharedHue;
  }

  update() {
    // Drift center with Perlin noise
    this.noiseOff += 0.002;
    let nx = noise(this.noiseOff, 0)       * 2 - 1;
    let ny = noise(0, this.noiseOff + 500) * 2 - 1;
    this.centerVel.add(createVector(nx, ny).mult(0.06));

    // Soft attraction toward partner's center — keeps couple spatially coherent
    if (this.partner) {
      let pull = p5.Vector.sub(this.partner.center, this.center);
      let pullDist = pull.mag();
      if (pullDist > 15) {
        pull.setMag(min(pullDist * 0.012, 0.18));
        this.centerVel.add(pull);
      }
    }

    this.centerVel.limit(CENTER_DRIFT_SPD);
    this.center.add(this.centerVel);

    // Soft-bounce at canvas edges
    let m = 60;
    if (this.center.x < m || this.center.x > width  - m) this.centerVel.x *= -1;
    if (this.center.y < m || this.center.y > height - m) this.centerVel.y *= -1;
    this.center.x = constrain(this.center.x, m, width  - m);
    this.center.y = constrain(this.center.y, m, height - m);

    // Orbit around center
    this.angle += this.orbitSpd;
    this.pos.x = this.center.x + cos(this.angle) * this.orbitR;
    this.pos.y = this.center.y + sin(this.angle) * this.orbitR;
  }

  display() {
    let a = this.partner ? 80 : 50;
    noStroke();

    // Soft outer glow
    fill(this.hue, 45, 90, a * 0.25);
    ellipse(this.pos.x, this.pos.y, this.r * 4.5, this.r * 4.5);

    // Core
    fill(this.hue, 50, 92, a);
    ellipse(this.pos.x, this.pos.y, this.r * 2, this.r * 2);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SOLO PARTICLE  (the protagonist)
// ─────────────────────────────────────────────────────────────────────────────
class SoloParticle extends Particle {
  constructor(pos) {
    super(pos);
    this.r           = 7;
    this.hue         = 0;    // red — starkly distinct from the cool-blue crowd
    this.injuryLevel = 0;    // 0 = healthy, 1 = completely faded
    this.bonded      = false;
    this.partner     = null;
    this.bondAlpha   = 0;
    this.bondHue     = 0;
    this.bondTimer   = null;

    // Noise-based wandering
    this.noiseOff    = random(10000);
    this.vel         = p5.Vector.random2D().mult(1.2);

    // Seek state: when triggered, gradually moves toward target
    this.seeking     = false;
    this.seekTarget  = null;

    // For breakup animation
    this.breaking    = false;
    this.breakFrames = 0;

    // Pulse phase for the halo
    this.pulsePhase  = random(TWO_PI);
  }

  enterRelationship(target) {
    if (this.bonded) return;
    this.bonded     = true;
    this.seeking    = true;
    this.seekTarget = target;
    this.partner    = target;
    this.bondHue    = target.hue;
    this.bondAlpha  = 0;

    playBondSound();
    if (typeof window.onSoloBond === 'function') window.onSoloBond();

    // Schedule the breakup
    this.bondTimer = setTimeout(() => this.breakup(), BOND_DURATION);
  }

  breakup() {
    if (!this.bonded) return;

    playBreakSound();
    if (typeof window.onSoloBreakup === 'function') window.onSoloBreakup();

    // Free the ex-partner so they wander alone (reshuffle will re-pair them)
    if (this.partner) {
      this.partner.partner = null;
    }

    this.bonded    = false;
    this.seeking   = false;
    this.partner   = null;
    this.breaking  = true;
    this.breakFrames = 0;

    // Accumulate injury
    this.injuryLevel = min(1, this.injuryLevel + INJURY_PER_BREAK);

    if (this.bondTimer) { clearTimeout(this.bondTimer); this.bondTimer = null; }
  }

  update() {
    this.pulsePhase += 0.04;

    // Speed cap shrinks as injury accumulates: fully injured → max speed is 30% of healthy
    let health      = 1 - this.injuryLevel;
    let speedScale  = lerp(0.30, 1.0, health);

    if (this.seeking && this.seekTarget) {
      let desired = p5.Vector.sub(this.seekTarget.pos, this.pos);
      let d = desired.mag();
      if (d > 35) {
        desired.setMag(3.2 * speedScale);
        this.vel.lerp(desired, 0.08);
        this.vel.limit(3.5 * speedScale);
        this.pos.add(this.vel);
      } else {
        this.seeking = false;
      }
      this.bondAlpha = min(55, this.bondAlpha + 2.5);
    } else if (this.bonded && this.partner) {
      let mid     = p5.Vector.lerp(this.pos, this.partner.pos, 0.5);
      let desired = p5.Vector.sub(mid, this.pos).mult(-1).rotate(HALF_PI);
      desired.setMag(1.0 * speedScale);
      this.vel.lerp(desired, 0.05);
      this.vel.limit(1.5 * speedScale);
      this.pos.add(this.vel);
      this.bondAlpha = min(65, this.bondAlpha + 1.5);
    } else {
      // Lonely wandering — noise steps slow down with injury
      this.noiseOff += 0.007 * speedScale;
      let angle  = noise(this.noiseOff) * TWO_PI * 2;
      let target = p5.Vector.fromAngle(angle).mult(1.5 * speedScale);
      this.vel.lerp(target, 0.04);

      // Trembling grows with injury level (but tremor magnitude is also slowed)
      if (this.injuryLevel > TREMOR_THRESHOLD) {
        let t = (this.injuryLevel - TREMOR_THRESHOLD) / (1 - TREMOR_THRESHOLD);
        this.vel.add(p5.Vector.random2D().mult(t * 1.8 * speedScale));
      }
      this.vel.limit(2.2 * speedScale);
      this.pos.add(this.vel);
      this.bondAlpha = max(0, this.bondAlpha - 4);

      let m = 40;
      this.pos.x = constrain(this.pos.x, m, width  - m);
      this.pos.y = constrain(this.pos.y, m, height - m);
    }

    if (this.breaking) {
      this.breakFrames++;
      if (this.breakFrames > 55) this.breaking = false;
    }
  }

  display() {
    let inj    = this.injuryLevel;
    let health = 1 - inj;

    // Color: vivid red when healthy → dark desaturated crimson when wounded
    let displayHue = this.hue;                      // always 0 (red)
    let displaySat = lerp(15, 85, health);           // near-grey → saturated red
    let displayBri = lerp(22, 96, health);           // very dim → bright

    // Pulse glow — completely smothered by heavy injury
    let pulse      = sin(this.pulsePhase) * 0.5 + 0.5;
    let glowRadius = lerp(10, 34, pulse) * health * health; // quadratic = collapses fast
    let glowAlpha  = lerp(0, 42, pulse)  * health * health;

    // ── Persistent wound scar ring (visible whenever injured) ─────────────
    if (inj > 0.05) {
      let scarR = this.r * lerp(1.8, 3.5, inj);
      let scarA = lerp(0, 50, inj);
      noFill();
      stroke(displayHue, 70, 55, scarA);
      strokeWeight(lerp(0.5, 2.0, inj));
      ellipse(this.pos.x, this.pos.y, scarR * 2, scarR * 2);
      noStroke();
    }

    // ── Breakup shockwave: three expanding rings, strong and red ──────────
    if (this.breaking) {
      let t = this.breakFrames / 55;

      // Ring 1 — fast white flash
      let r1 = t * 75;
      let a1 = (1 - t) * 85;
      noFill();
      stroke(0, 0, 100, a1);
      strokeWeight(1.5);
      ellipse(this.pos.x, this.pos.y, r1 * 2, r1 * 2);

      // Ring 2 — slower red ring
      let r2 = t * 48;
      let a2 = (1 - t) * 65;
      stroke(displayHue, 80, 90, a2);
      strokeWeight(2.0);
      ellipse(this.pos.x, this.pos.y, r2 * 2, r2 * 2);

      // Ring 3 — tight dark contraction ring
      let r3 = (1 - t * 0.6) * 20;
      let a3 = (1 - t) * 45;
      stroke(displayHue, 40, 50, a3);
      strokeWeight(3.0);
      ellipse(this.pos.x, this.pos.y, r3 * 2, r3 * 2);

      noStroke();
    }

    // ── Outer glow halo ───────────────────────────────────────────────────
    if (glowRadius > 2) {
      noStroke();
      fill(displayHue, displaySat * 0.6, displayBri, glowAlpha);
      ellipse(this.pos.x, this.pos.y, glowRadius * 2, glowRadius * 2);
    }

    // ── Mid halo ──────────────────────────────────────────────────────────
    let midA = lerp(0, 22, health) + pulse * 10 * health;
    noStroke();
    fill(displayHue, displaySat, displayBri, midA);
    ellipse(this.pos.x, this.pos.y, (this.r + 5) * 2, (this.r + 5) * 2);

    // ── Core body ─────────────────────────────────────────────────────────
    // Radius also shrinks slightly with injury — the particle "deflates"
    let displayR  = lerp(this.r * 0.55, this.r, health);
    let coreAlpha = lerp(28, 95, health);
    fill(displayHue, displaySat, displayBri, coreAlpha);
    ellipse(this.pos.x, this.pos.y, displayR * 2, displayR * 2);

    // ── Bright inner dot when bonded ──────────────────────────────────────
    if (this.bonded) {
      fill(displayHue, 15, 100, 92 * health);
      ellipse(this.pos.x, this.pos.y, displayR * 0.55, displayR * 0.55);
    }

    // ── Loneliness ring when single and relatively healthy ────────────────
    if (!this.bonded && inj < 0.6) {
      let ringA = lerp(0, 28, 1 - inj / 0.6) * (sin(this.pulsePhase * 0.5) * 0.5 + 0.5);
      stroke(displayHue, 55, 90, ringA);
      strokeWeight(0.9);
      noFill();
      ellipse(this.pos.x, this.pos.y, this.r * 5.5, this.r * 5.5);
      noStroke();
    }
  }
}
