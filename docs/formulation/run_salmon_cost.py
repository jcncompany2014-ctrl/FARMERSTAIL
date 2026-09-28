from formula import mix, feed_grams
from run_validate import SKUS
from run_lowfat2 import V
from run_lowfat import solve_eggshell

print('## 연어유 0.3% 유무 — EPA+DHA (g/1000kcal) · n6:n3 · 5kg 하루 EPA+DHA(mg)')
for name, r in SKUS.items():
    for label, rr in (('있음', r), ('뺌', dict(r, salmon_oil=0.0))):
        n = mix(rr)
        ed = (n['EPA'] or 0) + (n['DHA'] or 0)
        n3 = ed + (n['ALA'] or 0)
        g = feed_grams(n['kcal'], 5)
        print(f"  {name:28s} 연어유 {label}: EPA+DHA {ed/(n['kcal']/1000):.2f} g/1000kcal · n6:n3 {n['LA']/n3:.1f} · 5kg 하루 {ed*g/100*1000:.0f} mg · 지방 {n['fat']:.2f}%")

PRICE = {  # 원/kg — v4.0 12번 시트(✓) + ⚠추정
 'chicken_breast':5400,'chicken_liver':3000,'chicken_heart':4900,'carrot':1440,'pumpkin':3340,'spinach':4500,
 'rice_brown_cooked':2900,'sweet_potato':2800,'olive_oil':11000,'salmon_oil':39900,'turmeric':8100,
 'broccoli':4000,'blueberry':11450,'premix':30000,'eggshell':10000,'cabbage':1500,'apple':1790,
 'pollock':9000,      # ⚠추정 — 냉동 명태 필렛
 'dried_pollock':45000,  # ⚠추정 — 황태채
 'rice_white_cooked':1250,  # ⚠추정 — 백미 3,000원/kg ÷ 취반 2.4배
 'potato':2000,       # ⚠추정
 'sunflower_oil_hl':6000,  # ⚠추정 — 고리놀레산 해바라기유
}
print()
print('## 원물비 (원/100g) · 원/kcal · 5kg 하루 원물비')
def cost(r):
    tot = sum(r.values())
    return sum(PRICE[k]*v/tot for k,v in r.items())/10
n = mix(SKUS['닭 (v4.0)']); c = cost(SKUS['닭 (v4.0)'])
print(f"  닭 v4.0: {c:.0f} 원/100g · {c/130:.2f} 원/kcal(확정 130) · 5kg 252g → {c*2.52:.0f} 원/일")
for name, base in V.items():
    r = dict(base, eggshell=solve_eggshell(base)); n = mix(r); c = cost(r); g = feed_grams(n['kcal'],5)
    print(f"  {name[:2]}: {c:.0f} 원/100g · {c/n['kcal']:.2f} 원/kcal · 5kg {g:.0f}g → {c*g/100:.0f} 원/일")
