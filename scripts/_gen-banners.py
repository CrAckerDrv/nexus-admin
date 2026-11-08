#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成横幅模板用到的 3D 插画素材（一次性脚本，产物已入库，无需重复运行）

用法：
    python scripts/_gen-banners.py            # 生成全部
    python scripts/_gen-banners.py donut      # 只生成指定项

产物：apps/admin/src/assets/banners/<name>.png
- 请求 transparent 背景，得到 RGBA
- 按 alpha 通道裁掉四周空白，再居中补成正方形并缩到 512px
- 单张控制在 300 KB 以内，避免把演示素材塞进首屏包
"""

from __future__ import annotations

import base64
import concurrent.futures
import io
import json
import os
import pathlib
import sys
import urllib.request

from PIL import Image

# 凭据从环境变量读取，不要写进仓库：
#   BANNER_API_URL / BANNER_API_KEY / BANNER_API_MODEL
API = os.environ.get("BANNER_API_URL", "http://127.0.0.1:11001/v1/images/generations")
KEY = os.environ.get("BANNER_API_KEY", "")
MODEL = os.environ.get("BANNER_API_MODEL", "gpt-image-2")

if not KEY:
    sys.exit("缺少 BANNER_API_KEY 环境变量，请先设置图片生成服务的密钥")

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "apps" / "admin" / "src" / "assets" / "banners"

STYLE = (
    "high-end 3D clay render, soft matte plastic texture, gentle studio lighting, "
    "soft ambient occlusion, rounded friendly geometry, pastel palette, "
    "single centered object, generous empty margin around the object, "
    "isolated on a fully transparent background, no text, no letters, no watermark, "
    "no ground shadow, ultra clean, centered composition"
)

ITEMS: list[tuple[str, str]] = [
    (
        "welcome-dashboard",
        "a miniature floating dashboard made of clay: a rounded white screen panel showing a small "
        "rising line chart and three tiny bar columns, a small shield badge floating above it, "
        "a stack of three golden coins at the lower left",
    ),
    (
        "donut",
        "a single pink frosted donut with colorful sprinkles and a creamy yellow glaze edge, "
        "tilted slightly in three-quarter view",
    ),
    (
        "toolbox",
        "an open mint-blue toolbox with a raised lid, colorful modular blocks and small tools "
        "(wrench, gear, screwdriver) arranged neatly inside, one gear floating just above it",
    ),
    (
        "gift",
        "a soft coral gift box with a cream satin ribbon bow, slightly open lid, "
        "two tiny white stars floating above it",
    ),
    (
        "rocket",
        "a friendly toy rocket with a cream body, coral fins and a round sky-blue window, "
        "a small orange flame at the tail, flying diagonally upward",
    ),
    (
        "drone",
        "a cute delivery drone made of clay with four propellers, carrying a small blue parcel box "
        "underneath, hovering",
    ),
    (
        "sandwich",
        "a rounded clay sandwich with cream bread, yellow cheese, green lettuce and a coral tomato "
        "slice, seen from a slight top angle",
    ),
    (
        "keyboard",
        "a miniature clay mechanical keyboard in light grey with white keycaps, seen from a "
        "three-quarter angle",
    ),
    (
        "chart-report",
        "a clay chart report prop: a rounded white card with a small purple bar chart and a floating "
        "document sheet with a checklist, a tiny blue magnifier beside it",
    ),
    (
        "lock-shield",
        "a friendly blue shield with a golden padlock in the center, floating slightly, "
        "soft rounded clay shapes, small sparkle next to it",
    ),
    (
        "server-error",
        "a rounded clay server rack tower in slate grey with two small lights, one panel tilted open "
        "with a tiny orange warning triangle floating beside it, no text",
    ),
    (
        "empty-box",
        "an open kraft cardboard box made of clay, empty inside, a few soft purple sparkles and small "
        "floating cubes above it",
    ),
]

SIZE = 512
PAD_RATIO = 0.02


def request_image(prompt: str) -> bytes:
    body = json.dumps(
        {
            "model": MODEL,
            "prompt": f"{prompt}. {STYLE}",
            "n": 1,
            "size": "1024x1024",
            "background": "transparent",
            "output_format": "png",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        API,
        data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=900) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    b64 = payload["data"][0]["b64_json"]
    if not b64:
        raise RuntimeError("empty b64_json")
    return base64.b64decode(b64)


def clamp_alpha(img: Image.Image) -> Image.Image:
    """把半透明边缘的杂讯压成纯透明，避免裁剪时留一圈灰边"""
    alpha = img.getchannel("A").point(lambda value: 0 if value < 12 else value)
    img.putalpha(alpha)
    return img


def process(raw: bytes) -> bytes:
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    img = clamp_alpha(img)

    box = img.getbbox()
    if box:
        img = img.crop(box)

    # 单图裁成正方形：左右/上下补透明，保证各尺寸容器里都居中
    side = max(img.size)
    side = int(side * (1 + PAD_RATIO * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)

    if side > SIZE:
        canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)

    out = io.BytesIO()
    canvas.save(out, format="PNG", optimize=True)
    return out.getvalue()


def build(name: str, prompt: str) -> str:
    try:
        raw = request_image(prompt)
        png = process(raw)
        target = OUT_DIR / f"{name}.png"
        target.write_bytes(png)
        return f"OK   {name:<20} {len(png) / 1024:7.1f} KB"
    except Exception as error:  # noqa: BLE001 - 一次性脚本，打印即可
        return f"FAIL {name:<20} {error}"


def main() -> int:
    wanted = set(sys.argv[1:])
    todo = [item for item in ITEMS if not wanted or item[0] in wanted]
    if not todo:
        print(f"nothing to do, known: {[name for name, _ in ITEMS]}")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(todo)) as pool:
        for line in pool.map(lambda item: build(*item), todo):
            print(line, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
