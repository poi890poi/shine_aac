# Grass and 8-bit presentation change

Type: intentional visual design change requested on 2026-09-05.

The flat dark ground with evenly spaced dashes read as a runway. The renderer now
draws a green meadow with uneven blade tips and scattered tufts through its depth.
The full 240 × 340 playfield is mapped to one 16-color palette, including the
existing bird, flower expressions, and rotated sprite edges. The surrounding
controls use dark arcade framing, bright labels, square edges, and stepped button
shading. Existing artwork and character proportions remain authoritative.

Scope: standalone renderer and presentation only. No game physics, input, timing,
flower collision geometry, persistence, Android packaging, or AAC integration
changes. The palette lookup is computed once; frame processing is bounded to
81,600 pixels. Main risks are lost sprite detail and phone rendering overhead.

Verification: palette and raster-ground regressions plus the existing gameplay
suite, production build, and a fresh phone-browser demonstration. Browser phone
evidence does not establish Android release acceptance.

Results: all 16 tests and the character-rule validator passed; production build
completed. On Samsung SM-G781B / RFCR91GWXLX, Chrome portrait layout, touch, Space,
host activation, pause/resume, and helper exit passed. A fresh physical screen
recording shows 12 hits, all four flowers cleared, and automatic completion at
28.3 seconds. The recording is a silent 36-second direct H.264 MP4. The screenshot
was visually inspected for grassy ground, legible expressions, and pixel edges.
Evidence is retained in `tmp/phone-retro-grass-20260905/`; earlier evidence was
preserved. No Android integration or release acceptance is claimed.
