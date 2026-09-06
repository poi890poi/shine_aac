"""Offline deterministic artwork candidates. No runtime or source-asset mutation."""
import argparse
from collections import deque
import hashlib
import json
from pathlib import Path
import platform
import time

import numpy as np
import PIL
from PIL import Image, ImageDraw, ImageFont
from vendor.k_centroid import kCentroid

ROOT = Path(__file__).resolve().parents[1]
METHODS = ("nearest", "box", "k-centroid")
PROTECTED_HASHES = {
    "48db177258d11dd1bc14cc56f438ccc440f0f58fc4b0d712afc9e468a739397f",
    "00fcbff03661c7cb5bf0a512d788c259cb986347ded99eeb8d309105a4cf60ec",
    "eb81a9d378efe119b87d908bb18981ada7a3e77d10074c0f50f490dbdb53af3c",
}


def guard_source(recipe):
    if recipe.get("sha256") in PROTECTED_HASHES or recipe.get("subset") in ("flower", "cloud"):
        raise ValueError("Flowers and clouds are protected: reuse the previous renderer, never convert or redraw them")


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def rgb(value):
    return tuple(bytes.fromhex(value.lstrip("#")))


def validate_profile(profile):
    if profile["dither"] or profile["outlineExpansion"]:
        raise ValueError("This conversion contract forbids dithering and outline expansion")
    colors = list(profile["palette"].values())
    if len(colors) > 255 or len(set(colors)) != len(colors):
        raise ValueError("Shared palette must contain 1..255 unique opaque colors")
    for names in profile["subsets"].values():
        if not names or any(n not in profile["palette"] for n in names):
            raise ValueError("Unknown or empty material palette")
    if not isinstance(profile["previewScale"], int) or profile["previewScale"] < 1:
        raise ValueError("Preview must use positive integer enlargement")
    scene = profile["scene"]
    if scene["riceTop"] != scene["cottageBaseY"] or scene["riceBottom"] != scene["grassTop"]:
        raise ValueError("Cottage, rice and grass ground boundaries must meet")
    xs = sorted(scene["cottageX"])
    if len(xs) != 2 or any(b-a-scene["cottageWidth"] < scene["minCottageGap"] for a,b in zip(xs,xs[1:])):
        raise ValueError("Keep two sparse cottages with the configured clear gap")
    for recipe in profile["recipes"]:
        guard_source(recipe)


def prepare(recipe):
    guard_source(recipe)
    path = (ROOT / recipe["source"]).resolve()
    if not path.is_relative_to(ROOT) or digest(path) != recipe["sha256"]:
        raise ValueError("Source path/hash does not match frozen recipe")
    image = Image.open(path).convert("RGBA")
    x, y, w, h = recipe["crop"]
    if min(x, y) < 0 or min(w, h) <= 0 or x+w > image.width or y+h > image.height:
        raise ValueError("Crop outside source image")
    image = image.crop((x, y, x+w, y+h))
    width = recipe["width"]
    if not isinstance(width, int) or width <= 0 or width > w:
        raise ValueError("Set an integer native width no larger than source crop")
    mode = recipe["matte"]
    if mode == "opaque":
        image.putalpha(255)
    elif mode != "alpha":
        data = np.array(image)
        colors = data[:, :, :3].astype(np.int16)
        if mode == "blue-sky":
            # Explicit source-specific chroma matte: the cloud's blue shadows
            # have B-G separation; neutral whites have little G-R separation.
            r, g, b = colors[:, :, 0], colors[:, :, 1], colors[:, :, 2]
            eligible = ((b-g) <= recipe["skyMaxBlueMinusGreen"]) & ((g-r) >= recipe["skyMinGreenMinusRed"])
        elif mode == "corner":
            eligible = np.linalg.norm(colors-colors[0, 0], axis=2) < recipe["matteTolerance"]
        elif mode == "exterior-neutral":
            # Same exterior predicate used by the approved source renderer.
            eligible = (colors.min(2) > 165) & (colors.max(2)-colors.min(2) < 45)
        else:
            raise ValueError("Unknown explicit matte method")
        queue = deque((px, py) for px in range(w) for py in (0, h-1))
        queue.extend((px, py) for py in range(h) for px in (0, w-1))
        seen = np.zeros((h, w), bool)
        while queue:
            px, py = queue.popleft()
            if not (0 <= px < w and 0 <= py < h) or seen[py, px]:
                continue
            seen[py, px] = True
            if eligible[py, px]:
                data[py, px, 3] = 0
                queue.extend(((px-1, py), (px+1, py), (px, py-1), (px, py+1)))
        image = Image.fromarray(data)
    scale = recipe.get("scale", width/w)
    if not isinstance(scale, (int, float)) or not (0 < scale <= 1):
        raise ValueError("Uniform source scale must be in (0, 1]")
    size = (max(1, round(w*scale)), max(1, round(h*scale)))
    return image, size


def index_image(color_image, alpha, profile, subset):
    # Pillow does final fixed-palette mapping; no palette is learned per image.
    names = profile["subsets"][subset]
    values = [rgb(profile["palette"][name]) for name in names]
    pal = Image.new("P", (1, 1))
    pal.putpalette([c for color in values+[values[0]]*(256-len(values)) for c in color])
    mapped = color_image.quantize(palette=pal, dither=Image.Dither.NONE).convert("RGB")
    colors = list(profile["palette"].values())
    data = np.array(mapped)
    indices = np.zeros(data.shape[:2], np.uint8)
    opaque = np.array(alpha) >= profile["alphaThreshold"]
    for index, value in enumerate(colors, 1):
        indices[(data == rgb(value)).all(2) & opaque] = index
    output = Image.fromarray(indices).convert("P")
    palette = [(0, 0, 0)]+[rgb(c) for c in colors]
    output.putpalette([c for color in palette+[(0, 0, 0)]*(256-len(palette)) for c in color])
    output.info["transparency"] = 0
    return output


def convert(image, size, method, profile, subset):
    if method not in METHODS:
        raise ValueError("Unknown sampling method")
    # Coverage is frozen independently of the color sampler and palette.
    alpha = image.getchannel("A").resize(size, Image.Resampling.BOX)
    backdrop = Image.new("RGBA", image.size, profile["palette"]["sky"])
    source = Image.alpha_composite(backdrop, image).convert("RGB")
    start = time.perf_counter()
    if method == "k-centroid":
        sampled = kCentroid(source, *size, 2)
    else:
        sampled = source.resize(size, Image.Resampling.NEAREST if method == "nearest" else Image.Resampling.BOX)
    output = index_image(sampled, alpha, profile, subset)
    elapsed = time.perf_counter()-start
    validate_image(output, size, profile, subset)
    return output, elapsed


def validate_image(image, size, profile, subset):
    if image.size != size:
        raise ValueError("Native image dimensions differ")
    data = np.array(image.convert("RGBA"))
    if not set(np.unique(data[:, :, 3])).issubset({0, 255}):
        raise ValueError("Fractional alpha is forbidden")
    allowed = {rgb(profile["palette"][n]) for n in profile["subsets"][subset]}
    actual = {tuple(c) for c in data[data[:, :, 3] == 255, :3]}
    if not actual.issubset(allowed):
        raise ValueError("Output uses colors outside its shared material palette")


def opaque_colors(image):
    data = np.array(image.convert("RGBA"))
    return len({tuple(c) for c in data[data[:, :, 3] == 255, :3]})


def font(size):
    return ImageFont.truetype("C:/Windows/Fonts/arial.ttf", size)


def paste_rgba(canvas, image, xy):
    image = image.convert("RGBA")
    canvas.paste(image, xy, image)


def review_sheet(prepared, outputs, out):
    ids = [key for key in prepared if key != "photo-fixture"]
    sheet = Image.new("RGB", (1512, 116+len(ids)*282), "#eff6ed")
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 18), "Conversion study | identical size, mask and shared palette", font=font(26), fill="#284847")
    for j, title in enumerate(("Source crop", "Nearest baseline", "BOX area sampling", "k-centroid (2)")):
        draw.text((24+j*372, 64), title, font=font(21), fill="#284847")
    for row, key in enumerate(ids):
        image, size = prepared[key]
        top = 108+row*282
        draw.text((24, top), key, font=font(18), fill="#284847")
        for col in range(4):
            left = 24+col*372
            draw.rectangle((left, top+30, left+351, top+251), fill="#91d5db")
            if col == 0:
                preview = image.resize((size[0]*4, size[1]*4), Image.Resampling.LANCZOS)
            else:
                native = outputs[(key, METHODS[col-1])]
                preview = native.resize((size[0]*4, size[1]*4), Image.Resampling.NEAREST)
            paste_rgba(sheet, preview, (left, top+30))
            if col:
                paste_rgba(sheet, native, (left+260, top+218))
                draw.text((left, top+254), f"{size[0]} x {size[1]} | {opaque_colors(native)} colors | inset 1x", font=font(15), fill="#284847")
    sheet.save(out / "conversion-comparison.png")


def photo_sheet(prepared, outputs, out):
    image, size = prepared["photo-fixture"]
    sheet = Image.new("RGB", (1328, 1250), "#eff6ed")
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 15), "Photo conversion holdout | Dongli CC0 crop | NOT the game mountain", font=font(23), fill="#284847")
    for row, method in enumerate(("source",)+METHODS):
        y = 55+row*295
        draw.text((24, y), method, font=font(20), fill="#284847")
        candidate = image if method == "source" else outputs[("photo-fixture", method)]
        preview = candidate.resize((size[0]*4, size[1]*4), Image.Resampling.LANCZOS if method == "source" else Image.Resampling.NEAREST)
        paste_rgba(sheet, preview, (24, y+27))
    sheet.save(out / "photo-conversion-comparison.png")


def ground_scene(cottage, profile):
    spec = profile["scene"]
    if cottage.size != (spec["cottageWidth"], spec["cottageHeight"]):
        raise ValueError("Cottage must match the single fixed native size")
    scene = Image.new("RGB", tuple(profile["nativeScene"]), profile["palette"]["sky"])
    draw = ImageDraw.Draw(scene)
    p = profile["palette"]
    # Mature rice forms continuous masses, with sparse grain strokes rather than
    # a repeated seedling lattice. Seeded positions make edits reproducible.
    rng = np.random.default_rng(spec["seed"])
    draw.rectangle((0, spec["riceTop"], scene.width-1, spec["grassTop"]-1), fill=spec["riceColors"][0])
    for band, y in enumerate(range(spec["riceTop"]+3, spec["riceBottom"], spec["rowStep"])):
        for x in range(-2, scene.width, spec["plantStep"]):
            px = x+int(rng.integers(0, 4))
            py = y+int(rng.integers(-1, 2))
            tone = spec["riceColors"][1+(band+int(rng.integers(0, 2)))%2]
            draw.line((px, py, px+2, py-2), fill=tone)
            if (x+band)%3 == 0: draw.point((px+3, py-2), fill=spec["riceColors"][3])
    for y in spec["bankY"]:
        draw.rectangle((0, y, scene.width-1, y+spec["bankWidth"]-1), fill=p["bank"])
        draw.line((0, y, scene.width-1, y), fill=p["greenShadow"])
    draw.line([tuple(point) for point in spec["pathPoints"]], fill=p["bank"], width=spec["pathWidth"])
    for x in spec["cottageX"]:
        draw.rectangle((x-4, spec["cottageBaseY"], x+cottage.width+4, spec["cottageBaseY"]+5), fill=p["creamShade"])
    draw.rectangle((0, spec["grassTop"], scene.width-1, scene.height-1), fill=p["green"])
    draw.line((0, spec["grassTop"], scene.width-1, spec["grassTop"]), fill=p["greenShadow"], width=2)
    for x in spec["cottageX"]:
        paste_rgba(scene, cottage, (x, spec["cottageBaseY"]-cottage.height))
    return scene


def daylight_cottage(image, profile):
    # Palette substitution only: native indices, edges, and transparency stay fixed.
    result = image.copy()
    palette = result.getpalette()
    names = list(profile["palette"])
    for name, color in profile["daylightPalette"].items():
        offset = (names.index(name)+1)*3
        palette[offset:offset+3] = rgb(color)
    result.putpalette(palette)
    return result


def run(profile_path, output_dir, methods=("box",), review=False):
    profile_path, output_dir = Path(profile_path), Path(output_dir)
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    validate_profile(profile)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "profile.json").write_text(json.dumps(profile, indent=2)+"\n", encoding="utf-8")
    prepared, outputs, records = {}, {}, []
    for recipe in profile["recipes"]:
        image, size = prepare(recipe)
        key = recipe["id"]
        prepared[key] = image, size
        image.save(output_dir / f"{key}-prepared.png")
        alpha_hash = None
        for method in methods:
            result, seconds = convert(image, size, method, profile, recipe["subset"])
            path = output_dir / f"{key}-{method}.png"
            result.save(path, transparency=0)
            zoom = profile["previewScale"]
            result.resize((size[0]*zoom, size[1]*zoom), Image.Resampling.NEAREST).save(output_dir / f"{key}-{method}-{zoom}x.png", transparency=0)
            # Verify the file after encoding, not only the in-memory result.
            validate_image(Image.open(path), size, profile, recipe["subset"])
            mask_hash = hashlib.sha256(result.convert("RGBA").getchannel("A").tobytes()).hexdigest()
            if alpha_hash and alpha_hash != mask_hash:
                raise ValueError("Color sampler changed the frozen mask")
            alpha_hash = mask_hash
            outputs[(key, method)] = result
            records.append({"id":key,"method":method,"split":recipe["split"],"file":path.name,"sha256":digest(path),"size":size,"opaqueColors":opaque_colors(result),"alphaSha256":mask_hash,"conversionSeconds":round(seconds,4),"sourceSha256":recipe["sha256"]})
    if review:
        review_sheet(prepared, outputs, output_dir)
        if "photo-fixture" in prepared:
            photo_sheet(prepared, outputs, output_dir)
    if ("cottage", "box") in outputs:
        sunny = daylight_cottage(outputs[("cottage", "box")], profile)
        sunny.save(output_dir / "cottage-sunny.png", transparency=0)
        ground_scene(sunny, profile).save(output_dir / "rural-ground-native.png")
    report = {"status":"candidate; visual review separate from technical checks","python":platform.python_version(),"pillow":PIL.__version__,"numpy":np.__version__,"profileSha256":digest(profile_path),"scriptSha256":digest(__file__),"vendorSha256":digest(Path(__file__).parent / "vendor/k_centroid.py"),"records":records,"artifacts":{p.name:digest(p) for p in sorted(output_dir.glob("*.png"))}}
    (output_dir / "conversion-manifest.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"outputs":len(records),"directory":str(output_dir),"technicalChecks":"dimensions, palette, binary alpha, same mask across samplers"}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", type=Path, default=ROOT / "rules/scenery-conversion.json")
    parser.add_argument("--out", type=Path, default=ROOT / "assets/candidates/rural-review-20260906")
    parser.add_argument("--method", choices=METHODS, default="box")
    parser.add_argument("--review", action="store_true", help="Run all three samplers and render the scenery-only comparison")
    args = parser.parse_args()
    run(args.profile, args.out, METHODS if args.review else (args.method,), args.review)
