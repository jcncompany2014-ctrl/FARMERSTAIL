"""움직이는 섹션 합성 — render.mjs 가 찍은 바탕(사진 자리 빈 PNG) 위에 원본 GIF 프레임을 얹는다.

원본 GIF(사장님이 올린 옛 상세페이지 캡처)는 sources/ 에 있다. 프레임 길이는 원본 그대로.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = {'GN': 'sources/recommend.gif', 'GP1': 'sources/point1-sousvide.gif', 'GE': 'sources/easy-feeding.gif'}

def frames(key):
    im = Image.open(os.path.join(HERE, SRC[key]))
    out = []
    for fr in ImageSequence.Iterator(im):
        out.append((fr.convert('RGB'), fr.info.get('duration', 50) or 50))
    return out

def mask(w, h, circle, radius):
    m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    if circle: d.ellipse((0, 0, w - 1, h - 1), fill=255)
    else: d.rounded_rectangle((0, 0, w - 1, h - 1), radius=int(radius), fill=255)
    return m

for job in json.load(open(sys.argv[1])):
    base = Image.open(job['base']).convert('RGB')
    srcs = {s['src']: frames(s['src']) for s in job['slots']}
    n = max(len(v) for v in srcs.values())
    lead = max(srcs.values(), key=len)
    raw = []
    for i in range(n):
        f = base.copy()
        for s in job['slots']:
            fr = srcs[s['src']][i % len(srcs[s['src']])][0]
            x, y, w, h = s['crop']
            tile = fr.crop((x, y, x + w, y + h)).resize((s['w'], s['h']), Image.LANCZOS)
            f.paste(tile, (s['x'], s['y']), mask(s['w'], s['h'], s['circle'], s['radius']))
        raw.append(f)
    # 한 팔레트 — 바탕 + 몇 프레임을 이어 붙인 판에서 뽑는다. 프레임마다 팔레트가 다르면 바탕 픽셀까지
    # 매번 바뀐 것으로 쳐서 GIF 가 커진다(실측 10MB). 같은 팔레트면 움직이는 사진 칸만 담긴다.
    sample = Image.new('RGB', (base.width, base.height * 4))
    for k, idx in enumerate([0, n // 3, 2 * n // 3, n - 1]): sample.paste(raw[idx], (0, base.height * k))
    pal = sample.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    out = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in raw]
    durs = [lead[i % len(lead)][1] for i in range(n)]
    out[0].save(job['out'], save_all=True, append_images=out[1:], duration=durs, loop=0, optimize=True)
    os.remove(job['base'])
    print(os.path.basename(job['out']), n, 'frames', os.path.getsize(job['out']) // 1024, 'KB')
os.remove(sys.argv[1])
