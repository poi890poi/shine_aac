Use case: precise-object-edit
Asset type: proportion-locked bird-character flight pose

Input image: the approved {{ZH_TW}} character anchor. It is the identity and
component-geometry source of truth.

Change only the pose to {{PHASE}} using rig {{RIG}}:
- body pitch: {{BODY_PITCH}} degrees
- near-wing angle: {{NEAR_WING_ANGLE}} degrees
- near-wing spread: {{NEAR_WING_SPREAD}}
- far-wing angle: {{FAR_WING_ANGLE}} degrees
- far-wing scale relative to near wing: {{FAR_WING_SCALE}}
- tail fan: {{TAIL_FAN}} degrees
- tail centerline: {{TAIL_CURVE_MODEL}}
- visible downward bend begins at {{TAIL_BEND_START}} of preserved feather arc length
- tail-tip downward displacement: {{TAIL_TIP_DROP}} of preserved feather arc length
- tail-tip tangent: {{TAIL_TIP_TANGENT}} degrees downward from the rearward body axis
- tail-feather bundle coherence: {{TAIL_BUNDLE_COHERENCE}}
- feet: tucked against the belly or completely occluded

Preserve exactly:
- {{ZH_TW}} identity and all plumage anchors
- head, torso, bill, wing and tail dimensions from the input anchor
- wing-root, tail-root and eye positions
- shared cartoon exaggeration, palette, outline and three-band shading
- right-facing side-view readability

The wings may rotate, articulate, overlap and foreshorten naturally, but they may
not grow, shrink, detach, duplicate or change feather class. The body may rotate
but may not stretch or become thinner. Measure tail length along the curved
centerline, not the straight root-to-tip chord. Long feathers must flex smoothly
downward under aerodynamic load after the declared bend point; they must not be
rigid rods or curl like ribbons. Keep the subject clearly airborne with no
branch, ground, support, text, shadow, scenery or watermark. Solid white review
background.
