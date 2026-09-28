import math
from formula import mix, feed_grams
from run_validate import SKUS
n = mix(SKUS['닭 (v4.0)']); diet_ed_per_kcal = ((n['EPA'] or 0)+(n['DHA'] or 0))/n['kcal']  # g per kcal
JOINT, SKIN = 350, 250   # mg EPA+DHA per cube (5kg 용량)
print('체중 | 큐브/일 | 밥 EPA+DHA | 관절만 | 관절+피부 | NRC 상한 | 관절+피부 / 상한')
for W in [2,3,4,5,7,10,15,20,30,40]:
    cubes = math.ceil(W/5)
    kcal = 70*W**0.75*1.4
    diet = diet_ed_per_kcal*kcal*1000
    sul = 370*W**0.75
    j = diet + JOINT*cubes; b = j + SKIN*cubes
    print(f'{W:>3}kg | {cubes} | {diet:5.0f} mg | {j:5.0f} | {b:5.0f} | {sul:5.0f} | {b/sul*100:4.0f}% {"⚠상한 근접/초과" if b/sul>0.9 else ""}')
