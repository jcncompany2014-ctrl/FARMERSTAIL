"""스튜디오 파우치 사진(public/store/studio-*.webp) → 배경 따낸 PNG (assets/pouch_*.png).

처음 판(밝기 문턱 + 바깥 채우기)은 '누끼 딴 티'가 났다 — 사장님 지적(2026-10-14).
  · 테두리에 흰 띠(배경색이 묻은 가장자리 픽셀)
  · 계단 같은 가장자리
  · 원래 사진의 바닥 그림자가 사라져 붕 떠 보임
그래서:
  1) 배경을 평평한 한 색이 아니라 2차 곡면으로 맞춘다(스튜디오 조명이 위→아래로 어두워진다).
  2) 파우치 = 맞춘 배경과 다른 곳. 가장자리를 2px 깎고 1px 부드럽게 → 흰 띠 제거.
  3) 가장자리 색은 안쪽 색으로 밀어 채운다(배경색 번짐 제거).
  4) 원래 사진의 그림자(맞춘 배경보다 어두운 만큼)를 반투명 그림자 층으로 살린다 — 진짜 그림자라 자연스럽다.
"""
import sys
import numpy as np
from collections import deque
from PIL import Image, ImageFilter

def shift_min(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out &= np.roll(np.roll(m, dy, 0), dx, 1)
    return out

def cut(src, dst):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.float64)
    H, W, _ = a.shape
    yy, xx = np.mgrid[0:H, 0:W] / max(H, W)

    # 1) 배경 곡면 — 가장자리 40px 띠를 표본으로 2차 다항식 맞춤
    band = np.zeros((H, W), bool); band[:40] = band[-40:] = True; band[:, :40] = band[:, -40:] = True
    lum = a.mean(-1)
    band &= lum > np.percentile(lum[band], 20)        # 띠 안의 그림자·파우치 조각은 뺀다
    X = np.stack([np.ones_like(xx), xx, yy, xx * xx, yy * yy, xx * yy], -1)
    coef, *_ = np.linalg.lstsq(X[band], a[band], rcond=None)
    bg = X @ coef
    d = np.sqrt(((a - bg) ** 2).sum(-1))

    # 2) 바깥(배경+그림자) = 가장자리에서 이어진, 색이 배경과 비슷한(채도 차 작은) 곳
    chroma_d = np.abs((a - a.mean(-1, keepdims=True)) - (bg - bg.mean(-1, keepdims=True))).max(-1)
    darker = (bg.mean(-1) - lum)
    outside_like = (chroma_d < 9) & (darker > -10) & (darker < 70) & (d < 75)
    seen = np.zeros((H, W), bool); q = deque()
    for y in range(H):
        for x in (0, W - 1):
            if outside_like[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for x in range(W):
        for y in (0, H - 1):
            if outside_like[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for yy2, xx2 in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= yy2 < H and 0 <= xx2 < W and not seen[yy2, xx2] and outside_like[yy2, xx2]:
                seen[yy2, xx2] = True; q.append((yy2, xx2))
    obj = ~seen
    # 작은 부스러기 제거 + 가장자리 2px 깎기
    obj = shift_min(obj, 2)
    alpha = Image.fromarray((obj * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))
    alpha = np.asarray(alpha).astype(np.float64) / 255

    # 3) 가장자리 색 정리 — 안쪽(확실한 파우치) 색을 바깥으로 밀어 채운다
    core = shift_min(obj, 2)
    rgb = a.copy(); known = core.copy()
    for _ in range(8):
        acc = np.zeros_like(rgb); cnt = np.zeros((H, W))
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k = np.roll(np.roll(known, dy, 0), dx, 1)
            acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * k[..., None]; cnt += k
        new = (~known) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]; known |= new

    # 4) 원래 그림자 — 배경보다 어두운 비율, 종이 결은 흐림으로 지운다
    s = np.clip(darker / np.maximum(bg.mean(-1), 1), 0, 1) * seen
    s = np.asarray(Image.fromarray((s * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float64) / 255
    sh = np.clip((s - 0.015) * 5.5, 0, 0.8)
    # 파우치 가까이만 — 멀리 떨어진 배경 얼룩은 그림자가 아니다
    near = np.asarray(Image.fromarray((obj * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(22))).astype(np.float64) / 255
    sh *= np.clip(near * 6, 0, 1)

    out = np.zeros((H, W, 4))
    shadow_rgb = np.array([38, 28, 22], float)
    # 그림자 위에 파우치를 얹는다 (straight alpha 합성)
    a_out = alpha + sh * (1 - alpha)
    col = (rgb * alpha[..., None] + shadow_rgb * (sh * (1 - alpha))[..., None]) / np.maximum(a_out, 1e-6)[..., None]
    out[..., :3] = col; out[..., 3] = a_out * 255
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
    bb = Image.fromarray((a_out > 0.02).astype(np.uint8) * 255).getbbox()
    img.crop(bb).save(dst)
    print(dst, img.crop(bb).size)

if __name__ == '__main__':
    import os
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    root = os.path.dirname(os.path.dirname(here))
    for n in ['beef', 'chicken', 'duck', 'pork']:
        cut(os.path.join(root, f'public/store/studio-{n}.webp'), os.path.join(here, f'assets/pouch_{n}.png'))
