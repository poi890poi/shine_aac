# Taiwan endemic bird flight-pose brief

Purpose: prevent the bird sprites from collapsing into the same generic “one wing raised” silhouette. This is an art-direction brief for a C64-like mini-game, not a claim that every species normally makes long, level flights.

## Shared sprite rules

- Use a side view facing right, but vary the wing phase by species.
- Make the body axis nearly horizontal in transit; reserve upright bodies and extended feet for braking or landing.
- Feet are tucked during transit and extend only in the landing frame.
- Preserve the diagnostic silhouette before feather detail: body mass, bill, wing shape, and tail length must still read at 1× scale.
- Use three animation frames when possible: power stroke, wings folded/transition, and recovery stroke. Add a fourth landing frame only when the game needs it.
- Do not show both wings as a symmetric emblem. In side view the far wing should be smaller, partly hidden, or absent.
- Do not use a soaring pose for small forest passerines or pheasants.

## Per-species direction

| Bird | Body and color anchors | Flight/action pose | Evidence confidence |
|---|---|---|---|
| 臺灣藍鵲 | Corvid-sized horizontal body; black head; red bill and feet; very long blue tail with white/black tips | Broad rounded wing on a shallow downstroke; far wing partly visible; legs tucked; 2–3 long tail feathers stream almost straight with a slight fan. Avoid shortening the tail to ordinary-magpie proportions. | High: multiple flight photographs and TFRI documentary footage |
| 五色鳥 | Chunky, short-necked green body; heavy dark bill; very short tail; blue/red/yellow face retained as a compact mask | Fast direct transit or tree approach; broad rounded wings, not long pointed wings; show a pale gray-buff underside against darker flight feathers. Landing variant may point feet toward a trunk. | High: in-flight photographs and nest-approach footage |
| 臺灣紫嘯鶇 | Large, heavy thrush shape; deep indigo-purple body; blue spangles on wing coverts; medium tail | Strong rounded wings and a weighty body, not a tiny songbird. Use low level crossing or braking near a rock: wings broad, tail modestly fanned, legs only extended in the landing frame. | Medium-high: multiple field videos; exact wing phase partly inferred from thrush anatomy |
| 黃山雀 | Small tit with a large round head, short bill, black crest, yellow body, dark wings with pale bars | Bounding flight: compact mid-flap frame with wings partly folded, then a quick rounded downstroke. Tail narrow and short; no dramatic full-span eagle pose. | Medium: species photos/video plus well-established tit flight mechanics |
| 火冠戴菊鳥 | The smallest sprite; tiny round body; very short fine bill; olive/yellow; black-and-white face; orange/yellow crown line | Weak, whirring, very rapid flutter. Wings should be short, blurred/compact arcs; alternate a tight upstroke and shallow downstroke. Optional hover/glean frame by a flower. | High for behavior, medium for exact silhouette: official descriptions plus a documented in-flight photograph |
| 白耳畫眉 | Slender gray body; black cap; large white ear patch; warm chestnut belly; long black tail with white tip | Smooth short canopy crossing; rounded wing with moderate span; tail trails straight and acts as the main rudder. More elongated than the yuhina/liocichla sprites. | Medium: field video and photos; transit pose inferred from sibia proportions |
| 冠羽畫眉 | Tiny pale bird with pointed chestnut crest; short bill; compact body; short-to-medium tail | Busy flock movement: tight flutter or short bounding hop, not a wide heroic wing. Crest remains readable; wings form small rounded fans; landing feet may be briefly visible. | Medium: canopy-foraging recordings and photos; exact flight phase inferred from yuhina behavior/proportions |
| 黃胸藪眉 | Plump olive-brown babbler; yellow throat/chest; gray face; yellow-green wing panel; medium tail | Short low dash between cover: body slightly nose-down, broad rounded wings, tail only a little spread. Keep it chunky and close to vegetation rather than depicting sustained open-sky flight. | Medium-low: extensive perched/foraging media; flight pose inferred from liocichla morphology and understory behavior |
| 栗背林鴝 | Very small robin; rounded head; male slate/black face, orange collar/breast and chestnut back; short tail | Low perch-to-ground or ground-to-perch burst. Compact rounded wing, body slightly pitched up when braking, feet extending only in the final landing frame. | Medium: videos/photos and measured morphology; exact open-wing imagery is scarce |
| 紋翼畫眉 | Medium babbler with longish tail; warm brown body; unmistakable black-and-buff barring across wings and tail | Branch takeoff: powerful rounded downstroke; body horizontal; tail streams and may fan slightly. The barring must follow feather direction rather than form a checkerboard patch. | High-medium: slow-motion takeoff footage and field video |
| 臺灣朱雀 | Finch proportions: thick conical bill, round chest, medium-short notched tail; male raspberry red with darker wings | Typical finch bounding flight: one frame with wings folded close to the body and one quick pointed-down stroke. Do not make it a long-winged red parrot. | Medium: species video plus finch morphology; open-wing stills are limited |
| 小彎嘴 | Long decurved black bill is the primary silhouette; dark cap/mask; white eyebrow and throat; chestnut neck/flanks; fairly long tail | Short, low vegetation-to-vegetation flight: broad rounded wing and slightly drooped tail. Keep the bill projecting clearly forward; use an extended-foot frame only for a branch landing. | Medium: official camera/video records; exact transit pose inferred from scimitar-babbler anatomy |
| 黑長尾雉（帝雉） | Large chicken/pheasant body; tiny head; red face/legs; blue-black male plumage; extremely long black-and-white barred tail | Explosive escape burst, never a relaxed passerine or soaring pose. First frame crouch/launch; second broad rounded wings in forceful downstroke; third short glide with body nearly horizontal, legs trailing/tucking, tail streaming straight. | High: direct species/video context plus galliform flight documentation |
| 藍腹鷴 | Heavy chicken-like body; red face/legs; glossy blue-black; chestnut shoulder; white nape/back patch and long white tail | Same burst-flight mechanics as a forest pheasant, but give it a broader body and a shorter, fuller white tail than the Mikado. Strong rounded wing; no hovering or sustained level-flight loop. | High-medium: species documentary and a large Macaulay video set; exact wild flight stills are uncommon |
| 臺灣白喉噪眉 | Medium, sturdy laughingthrush; rufous crown, dark mask, clean white throat, brown body; rounded tail | Short flock dash through foliage: rounded wings, body horizontal, tail moderately spread. It should look heavier and longer-tailed than the yuhina, not like a small raptor. | Medium-low: species media mostly show movement within cover; pose inferred from laughingthrush proportions |
| 白頭鶇 | True thrush proportions; male white head/throat, dark upperparts, orange-rufous belly; medium straight tail | Direct thrush flight: triangular/rounded wing on a strong downstroke, body horizontal, tail closed in transit. Landing frame may fan tail and lower feet. | Medium-high: species field video/photos plus well-established Turdus flight shape |

## Production recommendation

Do not regenerate all 16 as one unconstrained illustration. Make four mechanism pilots first:

1. 臺灣藍鵲 — long-tailed corvid transit.
2. 火冠戴菊鳥 — tiny rapid flutter/hover.
3. 紋翼畫眉 — ordinary rounded-wing branch takeoff.
4. 黑長尾雉 — explosive chicken-like burst.

For each pilot, create a three-frame strip at the final in-game pixel dimensions. Approve silhouette and motion at 1× scale before recoloring the remaining species in the same mechanism family. This reduces the risk of getting 16 attractive but anatomically interchangeable birds.

## Single-sheet v5 evidence map

The v5 reference sheet deliberately avoids fully folded bounding-flight frames. Those frames are valid in an animation sequence but visually ambiguous in a single still. Every v5 bird therefore uses an open-wing phase, has no physical support, and has its feet tucked or occluded.

| Bird | Flight-pose basis used for v5 | Basis type |
|---|---|---|
| 臺灣藍鵲 | Taiwan Blue-Magpie flight photographs: broad rounded corvid wing, shallow power stroke, exceptionally long tail streaming behind | Direct species |
| 五色鳥 | Taiwan Barbet flight/approach photographs: compact body, heavy bill, broad short wing and very short tail | Direct species |
| 臺灣紫嘯鶇 | Taiwan Whistling-Thrush field video, checked against the broad rounded flight wing of other large muscicapid thrushes | Direct species plus family morphology |
| 黃山雀 | Great Tit flight photograph: a clearly open fan-shaped Paridae downstroke; Yellow Tit plumage and proportions retained | Same family (Paridae) |
| 火冠戴菊鳥 | Goldcrest flight photograph and quantified Goldcrest hovering study: short rapid wings and a slightly nose-up hover body | Same genus (*Regulus*) |
| 白耳畫眉 | White-eared Sibia field video: elongated canopy-crossing body, rounded wing and long straight rudder tail | Direct species |
| 冠羽畫眉 | Taiwan Yuhina species media for proportions; Japanese White-eye flight photographs for an open-wing Zosteropidae flutter phase | Direct proportions plus same family (Zosteropidae) |
| 黃胸藪眉 | Taiwan Liocichla media for proportions; airborne laughingthrush photographs for a broad-winged short dash | Direct proportions plus same family (Leiothrichidae) |
| 栗背林鴝 | Collared Bush-Robin flying-away video; Red-flanked Bluetail airborne photograph for a visible open-wing *Tarsiger* phase | Direct behavior plus same genus (*Tarsiger*) |
| 紋翼畫眉 | Taiwan Barwing takeoff photograph and slow-motion takeoff footage: broad rounded upstroke and barred feather geometry | Direct species |
| 臺灣朱雀 | Taiwan Rosefinch video for form; Common Rosefinch/other *Carpodacus* flight for the open finch power stroke | Direct proportions plus same genus (*Carpodacus*) |
| 小彎嘴 | Taiwan Scimitar-Babbler flying-away video; White-browed Scimitar-Babbler for short-flight morphology | Direct behavior plus same genus (*Pomatorhinus*) |
| 黑長尾雉（帝雉） | Wild Mikado Pheasant video and documented phasianid explosive-escape flight: heavy body, very broad forceful wing, long tail | Direct species plus family mechanics |
| 藍腹鷴 | Official Swinhoe's Pheasant documentary; Silver Pheasant flight photograph for an open-wing *Lophura* phase | Direct behavior plus same genus (*Lophura*) |
| 臺灣白喉噪眉 | Rufous-crowned Laughingthrush media for proportions; Black-throated Laughingthrush airborne photograph for a broad rounded *Pterorhinus* wing | Direct proportions plus same genus (*Pterorhinus*) |
| 白頭鶇 | Taiwan Thrush field video; other *Turdus* flight photographs for the triangular-rounded strong downstroke | Direct behavior plus same genus (*Turdus*) |

V5 single-frame validation rules:

- At least one wing is visibly separated from the body on every bird.
- Feet are tucked against the belly, swept rearward, or fully occluded; no vertical dangling legs or grasping toes.
- No branch, ground plane, cast shadow, or other visual support appears beneath a bird.
- Bounding-flight species are shown in their open power/recovery phase, not the folded ballistic phase.
- The source species supplies plumage and body proportions even when a relative supplies the clearer wing-phase reference.

## Sources consulted

- [2026 Taiwan bird checklist, Taiwan Wild Bird Federation](https://www.bird.org.tw/basicpage/87) — current names and endemic status.
- [Taiwan endemic bird watercolor reference, Taiwan Forestry Research Institute](https://ws.tfri.gov.tw/001/Upload/OldFile/files/%E8%87%BA%E7%81%A3%E7%89%B9%E6%9C%89%E7%A8%AE%E9%B3%A5%E9%A1%9E%E6%B0%B4%E5%BD%A9%E7%95%AB%E9%9B%86.pdf) — species proportions, plumage, habitat, and behavior descriptions.
- [A family of Formosan blue magpies, TFRI](https://www.tfri.gov.tw/en/News_Video_Content.aspx?n=7595&s=16565&sms=12386) and [flight-photo reference](https://alder-birds.blogspot.com/2014/04/flying-formosan-blue-magpie.html).
- [Taiwan Barbet in flight](https://www.flickr.com/photos/fuyi/51537788337).
- [Taiwan Barbet flight photograph, iNaturalist](https://www.inaturalist.org/taxa/367544-Psilopogon-nuchalis).
- [Taiwan Whistling-Thrush field video](https://www.youtube.com/watch?v=llf9k5LcMCk).
- [Flamecrest flight photograph](https://www.flickr.com/photos/tinyfishy2/40610104043/) and [Taiwan Wild Bird Federation Flamecrest profile](https://www.bird.org.tw/sites/default/files/field/file/download/246%E6%9C%9F-201103.pdf).
- [Goldcrest flight photograph](https://www.naturegallery.de/wintergoldhaehnchen.html) and [Goldcrest hovering-flight biomechanics study](https://onlinelibrary.wiley.com/doi/abs/10.1002/ece3.8205).
- [White-eared Sibia field video, Macaulay Library](https://macaulaylibrary.org/video/201008491).
- [Japanese White-eye flight photograph](https://photohito.com/photo/8713849/).
- [Great Tit flight photograph](https://siberia.russia.birding.day/m/v2photo.php?l=ru&n=1&s=099800011&si=sib).
- [Red-flanked Bluetail flight photograph](https://blog.livedoor.jp/aoirotoridori/archives/50733387.html) and [genus/family record, U.S. Fish and Wildlife Service](https://www.fws.gov/species/red-flanked-bluetail-tarsiger-cyanurus).
- [Taiwan Barwing field video](https://www.youtube.com/watch?v=7rFA8z4UXDs) and [slow-motion takeoff listing](https://depositphotos.com/video/taiwan-barwing-taking-flight-branch-707894200.html).
- [Taiwan Barwing takeoff photograph](https://kstku.org.tw/albums_view.php?new_csn=3641).
- [Taiwan Rosefinch video catalog, Macaulay Library](https://search.macaulaylibrary.org/catalog?mediaType=video&taxonCode=vinros3&view=grid).
- [Common Rosefinch taxonomy and morphology, British Trust for Ornithology](https://www.bto.org/learn/about-birds/birdfacts/common-rosefinch).
- [Taiwan Scimitar-Babbler field video, Macaulay Library](https://macaulaylibrary.org/video/201008681) and [TFRI camera record](https://iesn.tfri.gov.tw/Camera_Video_Content.aspx?ms=18304&n=7799&s=33020).
- [White-browed Scimitar-Babbler morphology and short-flight index](https://www.oiseaux.net/en/white-browed.scimitar.babbler.html).
- [Mikado Pheasant flight behavior and wild video](https://www.theguardian.com/science/punctuated-equilibrium/2011/oct/23/7).
- [Swinhoe’s Pheasant documentary, Yushan National Park](https://www.ysnp.gov.tw/Video/C005100?ID=5baebbd9-93f1-4aa4-a150-4d724f227d41&PageIndex=2&PageType=1) and [Cornell Birds of the World media count](https://birdsoftheworld.org/bow/species/swiphe1/cur/multimedia?media=audio).
- [Silver Pheasant in flight, same-genus *Lophura* analogue](https://news.cnr.cn/native/city/20210320/t20210320_525441624.shtml).
- [Black-throated Laughingthrush in flight, *Pterorhinus* analogue](https://dp.pconline.com.cn/dphoto/list_2151291.html).
- [Taiwan Thrush field video, Macaulay Library](https://macaulaylibrary.org/video/719493) and [recent field video](https://www.youtube.com/watch?v=L0y4nZh22f0).
