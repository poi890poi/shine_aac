# Complete gameplay demonstration — 2026-09-06

Type: requested commit and media verification. Demo policy now requires miss, hit,
collision/recovery and complete landing. `record-phone-demo.mjs` records actual
controller events during real playfield touches on the physical phone. It first
misses, then hits, waits for natural descent/collision, and finishes the garden.
`demo-coverage.mjs` rejects missing outcomes and edits that interrupt the landing.
`edit-phone-demo.mjs` trims waiting periods using this evidence, retaining normal
speed, both drop trajectories and collision recovery. No visible labels are added.

Physical Samsung SM-G781B Chrome recording: first miss 3.390 s, first hit 4.659 s,
first collision 40.188 s, landing starts 96.363 s, won 103.436 s. All 12 hits completed
with the four flower heights at zero. New clouds, whole-plant variations, transparent
ammo HUD and collision feathers are present. Evidence is in
`tmp/complete-demo-20260906/{recording.json,phone.mp4,edit.json,demo.mp4}`.
The test display was slept and verified OFF in `finally`.

The final 17.74-second edit retains the miss at 1.49 s, first hit at 2.76 s,
collision at 4.86 s, landing from 9.16 s and won at 16.24 s. Extracted output
frames were reviewed for the miss trajectory, hit splash, falling feathers and
grounded bird. The published HTTPS MP4 was downloaded again; its SHA-256 matches
the local artifact: `fc406eff3414d6b57ca91c2ac717ffe50ebba1efe7884611ebf71fd856a2a3bb`.

Acceptance: 60 Node tests pass; rule consistency passes without claiming artwork
approval. The packaged build succeeds. This is browser demo acceptance, not Android
release/device-test acceptance. No release tag or remote app deployment is requested.
