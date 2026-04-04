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

    this.vel = p5.Vector.random2D().mult(random(1.2, 2.0));
    this.acc = createVector(0, 0);
    this.maxSpeed = 3.0; // 2.2
    this.maxForce = 0.08;
  }

  // Called during reshuffle to smoothly switch partners
  reassign(newPartner, newCenter, sharedHue) {
    this.partner   = newPartner;
    this.center    = newCenter.copy();
    this.centerVel = p5.Vector.random2D().mult(CENTER_DRIFT_SPD);
    this.hue       = sharedHue;
  }

  update() {
    if (flockMode) {
      this.flock(regularParticles);
      // music-reactive parameters
      let audioSpeedBoost = map(musicLevel, 0, 0.08, 1.0, 2.8, true); //2.8
      let audioSeparationBoost = map(bassEnergy, 0, 0.8, 1.0, 2.2, true); //map(bassEnergy, 0, 0.650, 1.0, 2.0, true); //let audioSeparationBoost = map(bassEnergy, 0, 1, 1.0, 2.2, true);
      let audioDriftBoost = map(trebleEnergy, 0, 0.25, 0.03, 0.16, true);//map(trebleEnergy, 0, 0.25, 0.8, 0.18, true); //let audioDriftBoost = map(trebleEnergy, 0, 1, 0.03, 0.16, true);

      // flock influenced by music
      this.flock(regularParticles, audioSeparationBoost);

      // small extra organic drift, reinforced by highs
      this.noiseOff += 0.01 + trebleEnergy * 0.02;
      let nAngle = noise(this.noiseOff, this.id * 0.01) * TWO_PI * 2;
      let drift = p5.Vector.fromAngle(nAngle).mult(audioDriftBoost);
      this.applyForce(drift);

      this.vel.add(this.acc);
      this.vel.limit(this.maxSpeed * audioSpeedBoost);
      this.pos.add(this.vel);
      this.acc.mult(0);

      this.wrapEdges();

      // update center
      this.center.lerp(this.pos, 0.08);

      // optional visual rotation
      this.angle += this.rotationSpeed + this.vel.heading() * 0.02;

      return;
    }
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

    // rotación visual
    this.angle += this.rotationSpeed + this.vel.heading() * 0.01;
  }

  display() {
    let a = this.partner ? 80 : 50;
    noStroke();

    // square external glow
    noStroke();
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    rectMode(CENTER);
    fill(this.hue, 45, 90, a * 0.18);
    rect(0, 0, this.size * 2.6, this.size * 2.6, 2);
    pop();

    // cubo principal
    this.drawCube(this.hue, 50, 92, a, 1);
  }

  applyForce(force) {
    this.acc.add(force);
  }

  flock(particles, separationBoost = 1) {
    let separation = this.separate(particles, separationBoost).mult(1.4);
    let alignment  = this.align(particles).mult(0.9);
    let cohesion   = this.cohere(particles).mult(0.75);

    this.applyForce(separation);
    this.applyForce(alignment);
    this.applyForce(cohesion);
  }

  separate(particles, separationBoost = 1) {
    let desiredSeparation = 26 * separationBoost;
    let steer = createVector(0, 0);
    let count = 0;

    for (let other of particles) {
      if (other === this) continue;
      let d = p5.Vector.dist(this.pos, other.pos);
      if (d > 0 && d < desiredSeparation) {
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.normalize();
        diff.div(d);
        steer.add(diff);
        count++;
      }
    }

    if (count > 0) steer.div(count);

    if (steer.mag() > 0) {
      steer.setMag(this.maxSpeed);
      steer.sub(this.vel);
      steer.limit(this.maxForce);
    }

    return steer;
  }

  align(particles) {
    let neighborDist = 70;
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of particles) {
      if (other === this) continue;
      let d = p5.Vector.dist(this.pos, other.pos);
      if (d > 0 && d < neighborDist) {
        sum.add(other.vel);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      sum.setMag(this.maxSpeed);
      let steer = p5.Vector.sub(sum, this.vel);
      steer.limit(this.maxForce);
      return steer;
    }

    return createVector(0, 0);
  }

  cohere(particles) {
    let neighborDist = 80;
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of particles) {
      if (other === this) continue;
      let d = p5.Vector.dist(this.pos, other.pos);
      if (d > 0 && d < neighborDist) {
        sum.add(other.pos);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      return this.seek(sum);
    }

    return createVector(0, 0);
  }

  seek(target) {
    let desired = p5.Vector.sub(target, this.pos);
    desired.setMag(this.maxSpeed);
    let steer = p5.Vector.sub(desired, this.vel);
    steer.limit(this.maxForce);
    return steer;
  }

  wrapEdges() {
    let m = 40;
    if (this.pos.x < -m) this.pos.x = width + m;
    if (this.pos.x > width + m) this.pos.x = -m;
    if (this.pos.y < -m) this.pos.y = height + m;
    if (this.pos.y > height + m) this.pos.y = -m;
  }
}