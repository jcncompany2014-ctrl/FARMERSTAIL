from formula import report, mix, feed_grams


def solve_eggshell(base, target_ratio=1.2):
    """Ca:P 가 target 이 되는 난각분말 비율(생 기준)을 이분법으로."""
    lo, hi = 0.0, 0.02
    for _ in range(40):
        mid = (lo + hi) / 2
        r = dict(base, eggshell=mid)
        n = mix(r)
        if n['Ca'] / n['P'] < target_ratio:
            lo = mid
        else:
            hi = mid
    return round(hi, 4)


VARIANTS = {
    'A 명태34+닭가슴20 · 간6 심3 · 현미8 감자10': dict(
        pollock=0.34, chicken_breast=0.20, chicken_liver=0.06, chicken_heart=0.03,
        rice_brown_cooked=0.08, potato=0.10, pumpkin=0.05, carrot=0.04, spinach=0.03,
        sunflower_oil_hl=0.005, turmeric=0.001, cabbage=0.015, apple=0.01, premix=0.02),
    'B 명태40+닭가슴15 · 간6 심3 · 현미10 감자8': dict(
        pollock=0.40, chicken_breast=0.15, chicken_liver=0.06, chicken_heart=0.03,
        rice_brown_cooked=0.10, potato=0.08, pumpkin=0.045, carrot=0.04, spinach=0.03,
        sunflower_oil_hl=0.005, turmeric=0.001, cabbage=0.015, apple=0.01, premix=0.02),
    'C 명태30+닭가슴20+황태3 · 간6 심3 · 현미9 감자9': dict(
        pollock=0.30, chicken_breast=0.20, dried_pollock=0.03, chicken_liver=0.06, chicken_heart=0.03,
        rice_brown_cooked=0.09, potato=0.09, pumpkin=0.05, carrot=0.04, spinach=0.03,
        sunflower_oil_hl=0.005, turmeric=0.001, cabbage=0.015, apple=0.01, premix=0.02),
}

if __name__ == '__main__':
    for name, base in VARIANTS.items():
        es = solve_eggshell(base)
        r = dict(base, eggshell=es)
        n, p = report(f'{name} · 난각 {es*100:.2f}%', r)
        print(f"  합계 {sum(r.values())*100:.1f}% · 5kg 성견(1.4×RER) 급여 {feed_grams(n['kcal'], 5):.0f} g/일 (닭 SKU 252g) · 10kg {feed_grams(n['kcal'], 10):.0f} g")
        print()
