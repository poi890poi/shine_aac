# Second bird POC: 黃山雀

Type: new species choice. The user selected 黃山雀 and requested better readability
than the earlier small-bird preview. Default remains the accepted magpie. Two
picture-only buttons select a species between rounds; the host can pass species,
call setBirdSpecies between rounds, or read getBirdSpecies. Replay retains it.

Artwork: four poses derived with built-in image generation from the existing
Yellow Tit anchor, the proportion construction aid and accepted magpie style.
The full prompt is saved beside the candidate image. Three flight poses align
an eye landmark relative to the body origin; the fourth is a feet-down settled
pose. Source cells/pivots are in rules/yellow-tit-sprite.json. Fixed uniform 0.18
scale sizes the torso/head for phone readability, instead of sizing by total
bill-to-tail width. No per-pose resizing. Generated RGB contains a checkerboard;
the existing exterior matte removes it while retaining enclosed cheek/eye whites.
Do not claim genuine alpha in the generated source.

Scope: species artwork and text-free pre-round choice. Scenery, flowers, stems,
leaves, ammo rules, trajectory, score, AAC count and save data remain unchanged.
Landing placement uses a declared sprite contact point without changing physics.
Ten cosmetic frame changes per second and olive/cream feathers reuse the engine.

Validation: compare original magpie pixels against commit b5b2de7; inspect four
poses at native scale and on the phone; verify choice lifecycle, invalid IDs,
package assets and unchanged scenery. Numeric checks establish mechanics, not
artistic approval. Yellow-tit poses remain a candidate for user review.
