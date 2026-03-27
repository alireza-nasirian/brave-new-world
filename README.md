# Brave New World

*A generative art piece about human relationships, built with p5.js.*

---

## Concept

In a world where connection is effortless and everyone seems to have found their pair, one particle drifts alone.

**Brave New World** is an interactive generative artwork that uses particles as metaphors for people. Most particles exist in constantly shifting couples, orbiting each other, warm and close, changing partners over time the way modern relationships sometimes do. One particle is different: the red one. It is alone. And it is you.

The piece is a game, a visual poem, and a meditation on what it feels like to reach out and be left behind, again and again, in a world that was supposed to make love easier.

---

## How to Run

Open `index.html` in any modern browser. No build step, no server required.

```
brave-new-world/
├── index.html       ← open this
├── sketch.js        ← all art logic
└── assets/
    └── README.txt   ← drop your background.mp3 here
```

To add background music, place any `.mp3` file named `background.mp3` in the `assets/` folder. Sound effects (bond forming, bond breaking) are synthesized in-code and require no audio files.

---

## The Game

The experience is structured as a 5-act narrative. A story panel guides you through each stage, appearing at the start and after every breakup.

### Controls

| Input | Action |
|---|---|
| **Click** or **Space** | Dismiss a story panel / send the solo particle toward a connection |

### Game Loop

```
Story panel appears
    ↓
Player reads, clicks or presses Space to dismiss
    ↓
Red particle wanders among the blue couples
    ↓
Player clicks or presses Space → red particle seeks the nearest particle
    ↓
Bond forms (curved line appears, chime plays)
    ↓
~6.5 seconds later: bond breaks (shockwave, descending tone)
    ↓
New story panel appears
    ↓  (repeat for 5 rounds)
Epilogue screen → click to restart from the beginning
```

### The Injury System

Every breakup leaves a visible mark on the red particle:

- A **scar ring** appears and grows with each wound
- The particle **dims** — saturation and brightness fall toward grey
- Movement **slows** — at full injury, top speed drops to 30% of healthy
- At high injury, **trembling** sets in — the particle shakes as it wanders
- Injury **heals very slowly** on its own, representing resilience

The particle never fully disappears. It always keeps moving. It can always reach out again.

---

## The Story

### Prologue — *Alone in a Crowded World*

The red particle is introduced. The player sees the blue particles orbiting each other happily and is invited to make the first connection. "You won't know until you reach out."

### Act I — *Gone.*

The first relationship ends almost immediately. The wound is visible — a ring, a dimming. The player is told this is the nature of connection now: fast, frictionless, forgettable. But the others are still out there. Try again.

### Act II — *Again.*

A second breakup. The pattern is forming. The particle moves slower now. Its light is dimmer. "Giving up means an orbit alone, forever."

### Act III — *Still Here.*

Three scars. Three permanent rings. A question forms: maybe the act of reaching matters more than whether someone stays. The player is still here. Still red. Still themselves.

### Act IV — *Why Do We Keep Trying?*

The most philosophical act. The blue particles keep swapping partners effortlessly — nobody seems to notice who gets left behind. The red particle is barely glowing. And still it moves toward them. "That is not naivety. That is something rarer."

### Epilogue — *A Brave New World.*

The closing meditation. Five attempts. Five losses. The particle carries its wounds and keeps reaching anyway. "That is not weakness. That is the bravest thing in the world." The player is offered the chance to begin again.

---

## Visual Design

| Element | Description |
|---|---|
| **Background** | Near-black, semi-transparent overlay creates motion trails |
| **Regular particles** | Cool blue–violet hues (195°–255°), orbiting in pairs |
| **Bonds between couples** | Soft Bezier curves, gently pulsing |
| **Solo particle** | Pure red (0°), larger, with a pulsing halo when healthy |
| **Solo bond** | Brighter curved line when in a relationship |
| **Breakup shockwave** | Three expanding rings — white flash, red ring, dark contraction |
| **Injury scar** | Persistent dark ring around the solo that grows with damage |

---

## Technical Notes

- Built with [p5.js](https://p5js.org/) 1.9.4 and p5.sound, loaded from CDN
- All sound effects are synthesized using p5.sound oscillators — no audio files needed
- The story layer is pure HTML/CSS/JS overlaid on the canvas; `sketch.js` fires callbacks (`window.onSoloBond`, `window.onSoloBreakup`) that the story manager listens to
- The piece runs at full window size and adapts to window resizing

---

## Background Music

The piece supports optional background music. Drop any `.mp3` file named `background.mp3` into the `assets/` folder. It will begin looping on the first interaction (required by browser audio policy). See `assets/README.txt` for details.

A slow, ambient, or melancholic track fits the mood best.

---

*Part of an algorithmic art series exploring generative systems as emotional metaphors.*
