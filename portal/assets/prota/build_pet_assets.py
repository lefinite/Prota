#!/usr/bin/env python3
"""Build compact, transparent Prota pet assets from approved source strips."""

from pathlib import Path
from collections import deque

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source"
FRAME_SIZE = (256, 224)
STATE_NAMES = (
    "idle",
    "break",
    "paused",
    "waiting",
    "interrupted",
    "succeeded",
    "failed",
    "disconnected",
)


def split_strip(path: Path, count: int) -> list[Image.Image]:
    image = Image.open(path).convert("RGBA")
    frames = []
    for index in range(count):
        left = round(index * image.width / count)
        right = round((index + 1) * image.width / count)
        frames.append(image.crop((left, 0, right, image.height)))
    return frames


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value >= 20 else 0)
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError("frame has no visible pixels")
    return bbox


def keep_primary_component(image: Image.Image) -> Image.Image:
    """Drop tiny neighbor-frame slivers introduced at strip boundaries."""
    alpha = image.getchannel("A")
    width, height = alpha.size
    source = alpha.load()
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []

    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if visited[offset] or source[x, y] < 20:
                continue
            queue = deque(((x, y),))
            visited[offset] = 1
            points = []
            while queue:
                px, py = queue.popleft()
                points.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    neighbor = ny * width + nx
                    if not visited[neighbor] and source[nx, ny] >= 20:
                        visited[neighbor] = 1
                        queue.append((nx, ny))
            components.append(points)

    if not components:
        return image
    primary = max(components, key=len)
    keep = Image.new("L", image.size, 0)
    keep_pixels = keep.load()
    for x, y in primary:
        keep_pixels[x, y] = source[x, y]
    cleaned = image.copy()
    cleaned.putalpha(keep)
    return cleaned


def normalize(frames: list[Image.Image]) -> list[Image.Image]:
    cleaned = [keep_primary_component(frame) for frame in frames]
    crops = [frame.crop(visible_bbox(frame)) for frame in cleaned]
    max_width = max(crop.width for crop in crops)
    max_height = max(crop.height for crop in crops)
    usable_width = FRAME_SIZE[0] - 20
    usable_height = FRAME_SIZE[1] - 16
    scale = min(usable_width / max_width, usable_height / max_height)

    result = []
    for crop in crops:
        size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
        resized = crop.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
        x = (FRAME_SIZE[0] - resized.width) // 2
        y = FRAME_SIZE[1] - resized.height - 8
        canvas.alpha_composite(resized, (x, y))
        result.append(canvas)
    return result


def save_animated_webp(frames: list[Image.Image], path: Path, duration: int | list[int]) -> None:
    frames[0].save(
        path,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        lossless=True,
        method=6,
    )


def save_runtime_frames(name: str, frames: list[Image.Image]) -> None:
    frame_dir = ROOT / "pet" / "frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames):
        output = frame_dir / f"{name}-{index}.webp"
        frame.save(output, format="WEBP", lossless=True, method=6)
        assert_transparent_corners(output)


def checker_preview(frames: list[Image.Image], path: Path) -> None:
    tile_width, tile_height = FRAME_SIZE
    preview = Image.new("RGB", (tile_width * len(frames), tile_height * 2), "white")
    dark = Image.new("RGBA", FRAME_SIZE, "#111831")
    light = Image.new("RGBA", FRAME_SIZE, "#f7f8fc")
    for index, frame in enumerate(frames):
        light_tile = light.copy()
        light_tile.alpha_composite(frame)
        dark_tile = dark.copy()
        dark_tile.alpha_composite(frame)
        preview.paste(light_tile.convert("RGB"), (index * tile_width, 0))
        preview.paste(dark_tile.convert("RGB"), (index * tile_width, tile_height))
    preview.save(path, optimize=True)


def assert_transparent_corners(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    corners = ((0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1))
    if any(image.getpixel(point)[3] != 0 for point in corners):
        raise ValueError(f"opaque corner detected in {path.name}")


def build_app_icon() -> None:
    source = Image.open(SOURCE / "app-icon-source.png").convert("RGB")
    side = min(source.size)
    left = (source.width - side) // 2
    top = (source.height - side) // 2
    source = source.crop((left, top, left + side, top + side))
    for size, filename in ((1024, "app-icon.png"), (512, "app-icon-512.png")):
        icon = source.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
        mask = Image.new("L", (size, size), 0)
        from PIL import ImageDraw
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * 0.205), fill=255)
        icon.putalpha(mask)
        icon.save(ROOT / filename, optimize=True)
        assert_transparent_corners(ROOT / filename)


def main() -> None:
    running = normalize(split_strip(SOURCE / "pet-running-v2-alpha.png", 8))
    idle = normalize(split_strip(SOURCE / "pet-idle-v2-alpha.png", 6))
    paused = normalize(split_strip(SOURCE / "pet-paused-v2-alpha.png", 6))
    interrupted = normalize(split_strip(SOURCE / "pet-interrupted-v2-alpha.png", 6))
    states = normalize(split_strip(SOURCE / "pet-states-alpha.png", len(STATE_NAMES)))

    pet_dir = ROOT / "pet"
    pet_dir.mkdir(exist_ok=True)

    for name, frame in zip(STATE_NAMES, states):
        if name in {"idle", "break", "paused", "waiting", "interrupted"}:
            continue
        output = pet_dir / f"{name}.webp"
        frame.save(output, format="WEBP", lossless=True, method=6)
        assert_transparent_corners(output)

    save_animated_webp(running, pet_dir / "running.webp", duration=[100, 90, 105, 95, 120, 90, 105, 150])
    save_animated_webp(idle, pet_dir / "idle.webp", duration=[420, 170, 320, 420, 280, 520])
    save_animated_webp(idle, pet_dir / "break.webp", duration=[420, 170, 320, 420, 280, 520])
    save_animated_webp(paused, pet_dir / "paused.webp", duration=[260, 220, 420, 190, 380, 520])
    save_animated_webp(paused, pet_dir / "waiting.webp", duration=[260, 220, 420, 190, 380, 520])
    save_animated_webp(interrupted, pet_dir / "interrupted.webp", duration=[150, 130, 260, 360, 420, 680])
    save_runtime_frames("idle", idle)
    save_runtime_frames("break", idle)
    save_runtime_frames("paused", paused)
    save_runtime_frames("waiting", paused)
    save_runtime_frames("interrupted", interrupted)
    save_runtime_frames("running", running)
    running[0].save(pet_dir / "running-static.webp", format="WEBP", lossless=True, method=6)
    assert_transparent_corners(pet_dir / "running-static.webp")
    checker_preview(idle + paused + interrupted + running, pet_dir / "qa-motion-v2-light-dark.png")
    build_app_icon()

    # Animated WebP alpha sanity check (Pillow exposes its first frame here).
    animated = Image.open(pet_dir / "running.webp").convert("RGBA")
    if ImageChops.invert(animated.getchannel("A")).getbbox() is None:
        raise ValueError("running animation has no transparent pixels")

    print(f"Built {len(states)} state poses and {len(running)} running frames in {pet_dir}")


if __name__ == "__main__":
    main()
