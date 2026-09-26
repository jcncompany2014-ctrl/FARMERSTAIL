"""
Pretendard 부분 글꼴 만들기 (2026-09-26 출시 전 점검 8차).

전체 가변 글꼴(app/fonts/PretendardVariable.woff2, 2.06MB)에서
  · KS X 1001 한글 2,350자(EUC-KR 2바이트로 쓰이는 음절)
  · 라틴·문장부호·통화·화살표·수학·원문자·도형·기호·CJK 기호·한글 자모·전각
  · scripts/pretendard-subset-extras.json 의 추가 음절(우리 문구에 쓰는 KS X 1001 밖 글자)
만 남겨 app/fonts/PretendardVariable-ksx.woff2(약 524KB)를 만든다. 가변 축(굵기)은 그대로.

실행: python scripts/pretendard-subset.py   (fontTools·brotli 필요: pip install fonttools brotli)
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'app', 'fonts', 'PretendardVariable.woff2')
OUT = os.path.join(ROOT, 'app', 'fonts', 'PretendardVariable-ksx.woff2')
EXTRAS = os.path.join(ROOT, 'scripts', 'pretendard-subset-extras.json')

RANGES = [
    (0x20, 0x7E), (0xA0, 0xFF), (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2100, 0x214F),
    (0x2190, 0x21FF), (0x2200, 0x22FF), (0x2460, 0x24FF), (0x25A0, 0x25FF), (0x2600, 0x26FF),
    (0x2700, 0x27BF), (0x3000, 0x303F), (0x3130, 0x318F), (0xFF00, 0xFFEF),
]


def main() -> int:
    cps = set()
    for c in range(0xAC00, 0xD7A4):
        try:
            if len(chr(c).encode('euc-kr')) == 2:
                cps.add(c)
        except UnicodeEncodeError:
            pass
    for a, b in RANGES:
        cps.update(range(a, b + 1))
    extras = json.load(open(EXTRAS, encoding='utf-8'))['extras']
    for ch in extras:
        cps.add(ord(ch))
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False) as t:
        t.write(','.join('U+%04X' % c for c in sorted(cps)))
        uni = t.name
    r = subprocess.run([
        sys.executable, '-m', 'fontTools.subset', SRC,
        f'--unicodes-file={uni}', '--flavor=woff2', '--layout-features=*', f'--output-file={OUT}',
    ])
    os.unlink(uni)
    if r.returncode == 0:
        print(f'{OUT} — {os.path.getsize(OUT):,} bytes, {len(cps)} codepoints')
    return r.returncode


if __name__ == '__main__':
    sys.exit(main())
