BRAVE NEW WORLD — Audio Assets
──────────────────────────────

Drop your chosen audio files into this folder:

  background.mp3   →  Background ambient / atmospheric music.
                       The sketch loads this automatically on startup.
                       Any MP3 works; something slow and melancholic fits
                       the mood of the piece.

Sound effects for bond-forming and bond-breaking are synthesized directly
in sketch.js using p5.sound oscillators — no additional files needed for those.

If you also want custom sound files for the effects, rename them:
  bond.mp3         →  Sound played when the solo particle forms a bond.
  break.mp3        →  Sound played when the bond breaks.

Then update sketch.js: in playBondSound() / playBreakSound() replace the
oscillator logic with:
  bondSfx.play();   /   breakSfx.play();

and add to preload():
  bondSfx  = loadSound('assets/bond.mp3');
  breakSfx = loadSound('assets/break.mp3');
