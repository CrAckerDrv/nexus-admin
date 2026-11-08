#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 _gen-banners.py 产出的 512px PNG 转成体积更小的 WebP（一次性脚本）

- 384px 见方，WebP q=86：插画在页面里最大只显示到 ~200px，2x 屏也够用
- 保留 alpha：横幅插画需要压在渐变背景上
- 转完删除原 PNG，避免同一张插画在仓库里存两份

用法：python scripts/_optimize-banners.py
"""

from __future__ import annotations

import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "apps" / "admin" / "src" / "assets" / "banners"
SIZE = 384


def main() -> int:
    sources = sorted(ASSETS.glob("*.png"))
    if not sources:
        print("no PNG found")
        return 1

    total_before = 0
    total_after = 0
    for source in sources:
        before = source.stat().st_size
        total_before += before
        image = Image.open(source).convert("RGBA")
        if image.width != SIZE:
            image = image.resize((SIZE, SIZE), Image.LANCZOS)
        target = source.with_suffix(".webp")
        image.save(target, format="WEBP", quality=86, method=6)
        after = target.stat().st_size
        total_after += after
        source.unlink()
        print(f"{source.stem:<20} {before / 1024:7.1f} KB -> {after / 1024:6.1f} KB  {target.name}")

    print(f"\ntotal {total_before / 1024:.0f} KB -> {total_after / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
