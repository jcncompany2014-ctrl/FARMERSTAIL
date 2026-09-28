import math
from run_sauce_safety import diet_ed_per_kcal, JOINT, SKIN
print('체중 | 기본 큐브 | 관절 큐브 | 피부 큐브(관절과 같이) | 합계 EPA+DHA | 상한 대비 | 관절 mg/kg')
for W in [2,3,4,5,7,10,15,20,30,40]:
    base = max(1, round(W/5))  # 반올림(최소 1)
    kcal = 70*W**0.75*1.4; diet = diet_ed_per_kcal*kcal*1000; sul = 370*W**0.75
    budget = 0.8*sul - diet
    j = min(base, int(budget//JOINT))
    s = min(base, int((budget - j*JOINT)//SKIN))
    tot = diet + j*JOINT + s*SKIN
    print(f'{W:>3}kg | {base} | {j} | {s} | {tot:5.0f} mg | {tot/sul*100:3.0f}% | {j*JOINT/W:4.0f}')
