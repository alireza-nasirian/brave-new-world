// ─────────────────────────────────────────────────────────────────────────────
//  BASE PARTICLE CLASS
// ─────────────────────────────────────────────────────────────────────────────
class Particle {
  constructor(pos) {
    this.id  = _uid++;
    this.pos = pos.copy();
    this.vel = createVector(0, 0);
    this.hue = random(360);
    //this.r   = 5;
    this.size = 10;
    this.angle = random(TWO_PI);
    this.rotationSpeed = random(-0.02, 0.02);
    this.depthOffset = random(4, 8);
  }

  update() {}
  drawCube(baseHue, sat, bri, alpha, scale = 1) {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);

    let s = this.size * scale;
    let d = this.depthOffset * scale;

    rectMode(CENTER);
    stroke(baseHue, sat * 0.8, max(0, bri - 25), alpha);
    strokeWeight(1);

    // cara frontal
    fill(baseHue, sat, bri, alpha);
    rect(0, 0, s, s);

    // cara lateral derecha
    fill(baseHue, sat * 0.85, max(0, bri - 18), alpha);
    quad(
      s / 2, -s / 2,
      s / 2 + d, -s / 2 + d * 0.5,
      s / 2 + d,  s / 2 + d * 0.5,
      s / 2,  s / 2
    );

    // cara inferior
    fill(baseHue, sat * 0.7, max(0, bri - 10), alpha);
    quad(
      -s / 2, s / 2,
       s / 2, s / 2,
       s / 2 + d, s / 2 + d * 0.5,
      -s / 2 + d, s / 2 + d * 0.5
    );

    pop();
  }
  
  display() {
    this.drawCube(this.hue, 50, 88, 80, 1);
  }
}