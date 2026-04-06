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
    // square outer halo
    let pulse      = sin(this.pulsePhase) * 0.5 + 0.5;
    let glowSize = lerp(this.size * 1.2, this.size * 2.8, pulse) * health * health;
    let glowAlpha  = lerp(0, 42, pulse)  * health * health;

    if (glowSize > 2) {
      push();
      translate(this.pos.x, this.pos.y);
      rotate(this.angle);
      rectMode(CENTER);
      noStroke();
      fill(displayHue, displaySat * 0.6, displayBri, glowAlpha);
      rect(0, 0, glowSize, glowSize, 3);
      pop();
    }

    // ── Persistent wound scar ring (visible whenever injured) ─────────────
    if (inj > 0.05) {
      push();
      translate(this.pos.x, this.pos.y);
      rotate(this.angle);
      rectMode(CENTER);
      noFill();
      stroke(displayHue, 70, 55, lerp(0, 50, inj));
      strokeWeight(lerp(0.5, 2.0, inj));
      rect(0, 0, this.size * lerp(1.8, 3.5, inj), this.size * lerp(1.8, 3.5, inj), 2);
      pop();
    }

    // ── Breakup shockwave: three expanding rings, strong and red ──────────
    if (this.breaking) {
      let t = this.breakFrames / 55;
      push();
      translate(this.pos.x, this.pos.y);
      rotate(this.angle);
      rectMode(CENTER);
      noFill();

      stroke(0, 0, 100, (1 - t) * 85);
      strokeWeight(1.5);
      rect(0, 0, t * 75, t * 75, 2);

      stroke(displayHue, 80, 90, (1 - t) * 65);
      strokeWeight(2.0);
      rect(0, 0, t * 48, t * 48, 2);

      stroke(displayHue, 40, 50, (1 - t) * 45);
      strokeWeight(3.0);
      let r3 = (1 - t * 0.6) * 20;
      rect(0, 0, r3, r3, 2);

      pop();

    }
    // main red cube
    let scale = lerp(0.75, 1.0, health);
    this.drawCube(displayHue, displaySat, displayBri, lerp(28, 95, health), scale);


    // ── Bright inner dot when bonded ──────────────────────────────────────
    if (this.bonded) {
      push();
      translate(this.pos.x, this.pos.y);
      rotate(this.angle);
      rectMode(CENTER);
      noStroke();
      fill(displayHue, 15, 100, 92 * health);
      rect(0, 0, this.size * 0.35, this.size * 0.35, 2);
      pop();
    }

    // ── Loneliness ring when single and relatively healthy ────────────────
    if (!this.bonded && inj < 0.6) {
      let ringA = lerp(0, 28, 1 - inj / 0.6) * (sin(this.pulsePhase * 0.5) * 0.5 + 0.5);
      push();
      translate(this.pos.x, this.pos.y);
      rotate(this.angle);
      rectMode(CENTER);
      noFill();
      stroke(displayHue, 55, 90, ringA);
      strokeWeight(0.9);
      rect(0, 0, this.size * 3.5, this.size * 3.5, 2);
      pop();
    }
  }
}
