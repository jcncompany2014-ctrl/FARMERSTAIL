from formula import report, mix, feed_grams
from run_lowfat import solve_eggshell

V = {
 'D 고단백형 (명태30 닭가슴20 황태4 · 현미10 흰쌀6 감자5)': dict(
    pollock=0.30, chicken_breast=0.20, dried_pollock=0.04, chicken_liver=0.06, chicken_heart=0.03,
    rice_brown_cooked=0.10, rice_white_cooked=0.06, potato=0.05, pumpkin=0.04, carrot=0.03, spinach=0.03,
    sunflower_oil_hl=0.007, turmeric=0.001, cabbage=0.015, apple=0.01, premix=0.02),
 'E 균형형 (명태24 닭가슴14 황태3 · 흰쌀14 현미7 감자8)': dict(
    pollock=0.24, chicken_breast=0.14, dried_pollock=0.03, chicken_liver=0.06, chicken_heart=0.03,
    rice_white_cooked=0.14, rice_brown_cooked=0.07, potato=0.08, pumpkin=0.05, carrot=0.04, spinach=0.03,
    sunflower_oil_hl=0.008, turmeric=0.001, cabbage=0.015, apple=0.01, premix=0.02),
 'F 균형형+ (명태22 닭가슴12 황태3 · 흰쌀18 현미8 감자6)': dict(
    pollock=0.22, chicken_breast=0.12, dried_pollock=0.03, chicken_liver=0.06, chicken_heart=0.03,
    rice_white_cooked=0.18, rice_brown_cooked=0.08, potato=0.06, pumpkin=0.05, carrot=0.04, spinach=0.03,
    sunflower_oil_hl=0.009, turmeric=0.001, cabbage=0.015, apple=0.01, premix=0.02),
}
for name, base in V.items():
    es = solve_eggshell(base)
    r = dict(base, eggshell=es)
    n, p = report(f'{name} · 난각 {es*100:.2f}%', r)
    print(f"  합계 {sum(r.values())*100:.1f}% · 5kg 급여 {feed_grams(n['kcal'],5):.0f} g/일 (닭 252g) · 10kg {feed_grams(n['kcal'],10):.0f} g · 메인단백 합 {(base.get('pollock',0)+base.get('chicken_breast',0)+base.get('dried_pollock',0))*100:.0f}%")
    print()
