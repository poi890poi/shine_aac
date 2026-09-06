# Scenery artwork review — 2026-09-06

## Latest user decision (supersedes mountain proposal below)

### Viewpoint and regional architecture correction

Latest mountain selection targets supplied by the user:
- 北大武山 from 屏東 plains
- 玉山 from 嘉義 lowlands
- 南湖大山 from 宜蘭 lowlands
- 奇萊 from 花蓮 lowlands

Dongli candidate is also superseded: correct field-level viewpoint alone is
insufficient; use recognizable high-mountain profiles from these named views.
Do not label an unidentified local ridge with one of these mountain names.

The Hehuanshan aerial-looking valley candidate and generic cottage candidates are
rejected/superseded. Mountains must rise above a low, field-level horizon, with no
downward view onto nearby slopes or valley floors. Evaluate viewpoint in the whole
scene before accepting the source photograph; license suitability alone is not
visual suitability. Cottages must be flat front elevations of modest older rural
Taiwanese homes: long low brick/limewashed facades, shallow traditional clay-tile
roofs, simple wooden doors and small windows. No European cottage proportions.
This is a static art-direction revision, confined to candidates/review tooling;
runtime behavior, collisions and active artwork remain unchanged. Inspect each
candidate and its composition before presenting it. Native-grid/palette and final
user acceptance remain separate gates for any later app integration.

The user accepted the cloud designs, requested more flower leaves in varied sizes,
and explicitly dropped mountain shape parameters. Mountains will instead use a
static public-domain photograph, pixelated with reduced color depth. Do not build
the proposed parametric mountain catalog. Further assets remain in review scope.
The leaf revision composes existing approved leaf crops at four/five stem levels,
with individual uniform sizes; it does not redraw petals, expressions or stems.
Short-stem previews use three separated clusters to avoid foliage crowding.

Additional user direction: include cozy cottages between mountains and flowers.
Prepare an isolated static cottage candidate and a layer-order composition review.
No additional game controls or collision geometry are part of this scenery.

Current static-photo source: Hannah Kao, Dongli fields and mountains, Hualien,
published February 18, 2024, CC0 1.0:
https://wordpress.org/photos/photo/18665d24a3/
The downloaded source was visually inspected: field-side viewpoint, mountains
rising above farmland. The generated pixel-art adaptation removes foreground
infrastructure and clouds; it is a stylized interpretation of the photograph,
not a pixel-exact topographic trace or an exact eight-color quantization.
The mountains are not identified as any of the five sacred/three sharp peaks.

Architecture reference: Taipei Department of Information and Tourism,
Brick by Brick: The Spirit of Minnan Architecture in Taipei (2022):
https://www.travel.taipei/en/pictorial/article/33535
Reference is contextual only; no reference photograph copied into the houses.
Built-in image generation produced three modest flat farmhouse elevations with
clay tiles, brick/limewashed walls, lattice windows, paired wooden doors and jars.

Validation: isolated assets and the 480 x 640 combined review were visually
inspected. Headless review renderer completed; no game mounted or physical display
used. House perspective and source-photo viewpoint now match the direction.
Generated detail density still needs a shared native-grid/palette pass before
integration; the render does not certify consistent native sprite resolution.

Superseded static-photo source: PS Liu, Cloud shadows in Hehuanshan (2015), CC0 1.0.
https://commons.wikimedia.org/wiki/File:Cloud_shadows_in_Hehuanshan.jpg
https://www.flickr.com/photos/46781241@N03/16403468154/
This is Hehuanshan scenery, not a claim to depict any of the five sacred mountains
or three sharp peaks. Public-domain Yushan/Dabajian source searches did not produce
a suitable accessible photograph in this review; common examples are CC BY-SA.

Type: artwork research and review tooling. User requested flower, cloud and mountain
images BEFORE further app implementation. Only candidate assets, review scripts and
this record are in scope. Runtime source, active rules and packaged app are unchanged
by this review. Physical testing is unnecessary for these static candidates.

## Why the latest clouds flattened

The rounded-cloud renderer in `src/pixel-art.js` assigns white wherever a translated
sample stays inside the union silhouette, and cloudLight only at the underside.
Its cloudShadow color is used for the outline. This replaced the general shading
calculation for cloud interiors with a two-color boundary test. Consequently it has
no representation of puff depth or interior overlap and cannot shade those forms.
The existing silhouette/layer tests do not evaluate that missing visual volume.

## Existing approaches reviewed

- Nathan Lovato / GDQuest, How to Draw Clouds in Pixel Art:
  https://www.gdquest.com/tutorial/art/pixel-art/chapter/4_how_to_draw_clouds_in_pixel_art/
- Pedro Medeiros / Saint11, original pixel art tutorial collection:
  https://saint11.art/blog/pixel-art-tutorials/
- Creator's procedural pixel-cloud writeup, Part 2: normals plus small authored
  repeating cloud-surface textures, rather than only an outer silhouette:
  https://www.reddit.com/r/godot/comments/15iwkge/
  Search-indexed author description was readable; direct page retrieval failed.
- Jean Timex, procedural WebGPU volumetric-cloud implementation:
  https://github.com/jeantimex/procedural-clouds
  Density and light marching expose useful independent shape/lighting controls.
  This renderer is not installed or run as part of this review.

Assessment: seeded procedural puff/normal shading can produce repeatable variants,
but needs art-directed shadow clusters and reviewed outputs. A high-quality authored
cloud atlas provides a stronger shape baseline; deterministic selection, mirroring,
uniform sizing and palette changes can vary it without regenerating silhouettes.
Photographic downsampling/quantization alone does not guarantee intentional pixels,
readable shadow masses or clean edges. No downloaded reference artwork is copied.

## Candidates and proposed parameter ownership

- Flowers: actual existing `paintFlower` output, including approved head/leaf source,
  four current palettes and full parameterized stems. No regenerated character.
- Clouds: six generated art-direction candidates A–F with substantial interior
  midtone/shadow masses. Candidate sheet is not a verified three-color native atlas.
  Proposed parameters: fixed silhouette/shadow masks, seed, preset, uniform scale,
  light/shadow ramp, shadow coverage, and separate far/near layer drift and altitude.
  Randomization must select reviewed forms or bounded variations; no per-frame shape
  regeneration. Internal puffs need shading, not just a narrow bottom stripe.
- Mountains: eight generated stylized concept silhouettes, NOT terrain measurements
  or a verified geographical panorama. Freeze summit/shoulder/saddle landmarks and
  ridge paths after review; placement, uniform scale and haze vary separately.
  No random perturbation of a named summit, no mirroring of a geographic profile.

Official identity/shape references:
- 五岳三尖 list: https://www.taiwan.nps.gov.tw/home/zh-tw/quarterly/7944/7161.html
- 大霸 barrel-like summit: https://www.taiwan.nps.gov.tw/home/zh-tw/topic/32399.html
- 中央尖 pyramid: https://www.taroko.gov.tw/ch/trailsAttractions/trail-list/49
- 玉山、秀姑巒、達芬尖 descriptions: https://www.ysnp.gov.tw/StaticPage/Mountain
- 雪山 cirque: https://www.spnp.gov.tw/jp/titlelist/about-shei-pa/2862
- 北大武: https://recreation.forest.gov.tw/Trail/RT?tr_id=119&typ=1

## Review gate

User review is pending. Generation prompts are intent, not verification of palette,
native grid, summit accuracy, transparency or shape acceptance. These files must not
be copied into runtime manifests or the build until the user selects the artwork.
Before promotion, compare actual native-size output beside approved flowers, verify
shadow areas remain visible, and preserve accepted masks with output regressions.
