from formula import report, mix, feed_grams
from run_lowfat import solve_eggshell

NAMES = {'pollock':'명태 (필렛)','chicken_breast':'닭가슴살','dried_pollock':'황태','chicken_liver':'닭간','chicken_heart':'닭염통',
 'rice_white_cooked':'흰쌀밥 (익힘)','rice_brown_cooked':'현미밥 (익힘)','potato':'감자','pumpkin':'단호박','carrot':'당근','spinach':'시금치',
 'sunflower_oil_hl':'해바라기유 (고리놀레산)','turmeric':'강황','cabbage':'양배추 (hero)','apple':'사과 (support)','premix':'프리믹스 v1.4','eggshell':'난각분말'}
FIXED = {'premix':0.02,'turmeric':0.001}

def finalize(base, fixed=FIXED):
    # 난각은 Ca:P 1.2 로 풀고, 프리믹스·강황은 정확히 고정, 나머지를 비례 조정해 합계 100%
    es = solve_eggshell(base)
    free = {k:v for k,v in base.items() if k not in fixed}
    target_free = 1 - sum(fixed.values()) - es
    s = target_free/sum(free.values())
    r = {k: v*s for k,v in free.items()}; r.update(fixed); r['eggshell'] = es
    es2 = solve_eggshell({k:v for k,v in r.items() if k!='eggshell'})  # 재확인
    return r, es2

E = dict(pollock=0.24, chicken_breast=0.14, dried_pollock=0.03, chicken_liver=0.06, chicken_heart=0.03,
    rice_white_cooked=0.14, rice_brown_cooked=0.07, potato=0.08, pumpkin=0.05, carrot=0.04, spinach=0.03,
    sunflower_oil_hl=0.008, turmeric=0.001, cabbage=0.015, apple=0.01, premix=0.02)
E_noHT = dict(E, dried_pollock=0.0, chicken_breast=0.17)

for label, base in (('Light E (황태 3%)', E), ('Light E′ (황태 없이, 닭가슴 +3)', E_noHT)):
    r, es2 = finalize(base)
    print(f'### {label} — 합계 {sum(r.values())*100:.2f}% · 난각 재확인 {es2*100:.2f}%')
    for k,v in sorted(r.items(), key=lambda x:-x[1]):
        if v>0: print(f'   {NAMES[k]:22s} {v*100:6.2f}%   (메인 400g 배치 → {v/ (r["pollock"] if r["pollock"] else 1)*400:7.1f} g)')
    n,p = report(label, r)
    print(f"  5kg {feed_grams(n['kcal'],5):.0f} g/일 · 10kg {feed_grams(n['kcal'],10):.0f} g/일 · 3kg {feed_grams(n['kcal'],3):.0f} g/일")
    print()
