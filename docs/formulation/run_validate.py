from formula import report

COMMON = {'olive_oil': None, 'salmon_oil': 0.003, 'turmeric': 0.001, 'premix': 0.02, 'eggshell': 0.0053}

SKUS = {
    '닭 (v4.0)': dict(chicken_breast=0.54, chicken_liver=0.05, chicken_heart=0.08, carrot=0.043, pumpkin=0.043,
                     spinach=0.043, rice_brown_cooked=0.06, sweet_potato=0.06, olive_oil=0.032, salmon_oil=0.003,
                     turmeric=0.001, broccoli=0.015, blueberry=0.01, premix=0.02, eggshell=0.0053),
    '오리 (v4.0, 심장=닭염통 대용)': dict(duck_meat=0.50, duck_liver=0.07, chicken_heart=0.06, carrot=0.0513, pumpkin=0.0513,
                     spinach=0.0513, rice_brown_cooked=0.06, sweet_potato=0.06, olive_oil=0.047, salmon_oil=0.003,
                     turmeric=0.001, zucchini=0.015, apple=0.01, premix=0.02, eggshell=0.0053),
    '돼지 (v4.0)': dict(pork_tenderloin=0.53, pork_liver=0.07, pork_heart=0.08, carrot=0.0382, pumpkin=0.0477,
                     spinach=0.0382, rice_brown_cooked=0.06, sweet_potato=0.05, olive_oil=0.037, salmon_oil=0.003,
                     turmeric=0.001, radish=0.015, cabbage=0.01, premix=0.02, eggshell=0.0053),
    '소 (v4.0)': dict(beef_chuck=0.49, beef_liver=0.08, beef_heart=0.07, carrot=0.051, pumpkin=0.051,
                     spinach=0.051, rice_brown_cooked=0.07, sweet_potato=0.07, olive_oil=0.023, salmon_oil=0.003,
                     turmeric=0.001, beets=0.015, blueberry=0.01, premix=0.02, eggshell=0.0053),
}
V4 = {'닭 (v4.0)': (70.73, 15.8, 5.0, 130), '오리 (v4.0, 심장=닭염통 대용)': (72.64, 13.73, 5.35, 125),
      '돼지 (v4.0)': (72.07, 15.66, 4.76, 125), '소 (v4.0)': (69.31, 14.47, 6.29, 145)}

if __name__ == '__main__':
    for name, r in SKUS.items():
        n, p = report(name, r)
        w, pr, fa, kc = V4[name]
        print(f"  ↔ v4.0 목표: 수분 {w} · 조단백 {pr} · 조지방 {fa} · {kc} kcal   (계산 차이: 단백 {n['protein']-pr:+.2f} · 지방 {n['fat']-fa:+.2f} · kcal {n['kcal']-kc:+.0f})")
        print()
