"""파머스테일 배합 계산기 — v4.0 마스터레시피 방식(생 기준 배합비·수율≈100%·4/9/4·per 1000kcal 검증).

원료 영양: USDA FoodData Central SR Legacy(fdc_data.json) + 수기 원료(프리믹스·난각·황태·차전자피 등).
목표: v4.0 시트3 채택값(MAX(FEDIAF,AAFCO)×1.15, per 1000kcal) · 상한은 FEDIAF/AAFCO 영양적 상한.
"""
import json, os

HERE = os.path.dirname(__file__)
FDC = json.load(open(os.path.join(HERE, 'fdc_data.json'), encoding='utf-8'))

# 우리 키 → FDC nutrientNumber
NUM = {
    'water': '255', 'protein': '203', 'fat': '204', 'ash': '207', 'fiber': '291', 'carb_diff': '205',
    'Ca': '301', 'P': '305', 'K': '306', 'Na': '307', 'Mg': '304', 'Fe': '303', 'Cu': '312', 'Zn': '309',
    'Mn': '315', 'Se': '317', 'vitA_IU': '318', 'vitD_IU': '324', 'vitE_mg': '323', 'B1': '404', 'B2': '405',
    'B3': '406', 'B5': '410', 'B6': '415', 'B12': '418', 'folate': '417', 'choline': '421',
    'LA': '618', 'ALA': '619', 'EPA': '629', 'DHA': '621',
    'Trp': '501', 'Thr': '502', 'Ile': '503', 'Leu': '504', 'Lys': '505', 'Met': '506', 'Cys': '507',
    'Phe': '508', 'Tyr': '509', 'Val': '510', 'Arg': '511', 'His': '512',
}
# FDC 단위: 광물 mg(Ca,P,K,Na,Mg,Fe,Cu,Zn,Mn) · Se µg · B12 µg · folate µg · choline mg · 지방산·아미노산 g
MINERAL_MG = {'Ca', 'P', 'K', 'Na', 'Mg'}  # g/1000kcal 로 비교할 것들(→ /1000)

KEYS = list(NUM.keys()) + ['taurine', 'I', 'vitE_IU']


def from_fdc(key, overrides=None, scale_protein_from=None):
    f = FDC[key]['nutrients']
    out = {}
    for k, n in NUM.items():
        v = f.get(n, {}).get('value')
        out[k] = float(v) if v is not None else None
    if scale_protein_from:
        # 아미노산 결측 시 같은 계열 원료의 단백질당 아미노산 비율로 채움
        ref = from_fdc(scale_protein_from)
        for aa in ['Trp', 'Thr', 'Ile', 'Leu', 'Lys', 'Met', 'Cys', 'Phe', 'Tyr', 'Val', 'Arg', 'His']:
            if out.get(aa) is None and ref.get(aa) is not None and ref['protein']:
                out[aa] = ref[aa] / ref['protein'] * out['protein']
    if overrides:
        out.update(overrides)
    return out


# ── 수기 원료 ──────────────────────────────────────────────────────────────
# 프리믹스 v1.4 (100g 당). 활성 = 5번 시트 사양, Ca·P 는 2026-07 실측 역산(Ca 9.24% · P 7.97%).
PREMIX = {
    'water': 5, 'protein': 11.0, 'fat': 1.5, 'ash': 45.0, 'fiber': 8.0, 'carb_diff': 37.5,
    'Ca': 9240, 'P': 7970, 'K': 0, 'Na': 0, 'Mg': 121.5, 'Fe': 17.7, 'Cu': 9.0, 'Zn': 120.0, 'Mn': 2.4,
    'Se': 180.0, 'I': 2100.0,  # µg
    'vitD_IU': 542.1, 'vitE_IU': 84.3, 'B1': 1.6, 'taurine': 2742.0,
}
EGGSHELL = {'water': 1, 'protein': 1.0, 'fat': 0.1, 'ash': 95, 'fiber': 0, 'carb_diff': 2.9, 'Ca': 38100, 'P': 120}

# 타우린(mg/100g) — USDA 에 없음. 문헌·v4.0 표기값(불확실, ⚠추정)
TAURINE = {'chicken_breast': 16, 'chicken_liver': 110, 'chicken_heart': 65, 'pollock': 60, 'cod': 60,
           'dried_pollock': 250, 'egg_white': 0}
# 요오드(µg/100g) — SR Legacy 결측. USDA/FDA iodine DB 대략값(⚠추정)
IODINE = {'pollock': 90, 'cod': 99, 'dried_pollock': 380, 'chicken_breast': 7, 'egg_white': 7}


def ingredient(key):
    if key == 'premix':
        return dict(PREMIX)
    if key == 'eggshell':
        return dict(EGGSHELL)
    if key == 'dried_pollock':
        # 황태 ≈ 생태를 수분 15% 로 건조(고형분 비례 농축). 염지 없음 가정 — ⚠나트륨 실측 필요
        raw = ingredient('pollock')
        solids_raw = 100 - raw['water']
        k = (100 - 15) / solids_raw
        out = {n: (v * k if isinstance(v, (int, float)) else v) for n, v in raw.items()}
        out['water'] = 15
        out['taurine'] = TAURINE['dried_pollock']
        out['I'] = IODINE['dried_pollock']
        return out
    if key == 'pollock':
        d = from_fdc('pollock', scale_protein_from='cod')
        # 명태 SR 은 지방산·일부 비타민 결측 → 대구 값으로 보충(같은 대구과 흰살생선)
        cod = from_fdc('cod')
        for k, v in cod.items():
            if d.get(k) is None:
                d[k] = v
    else:
        d = from_fdc(key)
    d.setdefault('taurine', TAURINE.get(key, 0))
    d['taurine'] = TAURINE.get(key, d.get('taurine') or 0)
    d['I'] = IODINE.get(key, 0)
    if d.get('vitE_mg') is not None:
        d['vitE_IU'] = d['vitE_mg'] * 1.49  # 천연 d-α-토코페롤
    return d


TARGET = {  # per 1000 kcal (시트3 채택값) — g 단위: protein·fat·LA·Ca·P·K·Na·Mg·아미노산 / mg: 미량 / µg: Se·B12·folate
    'protein': 51.75, 'fat': 15.81, 'LA': 3.76, 'Ca': 1.44, 'P': 1.15, 'K': 1.73, 'Na': 0.29, 'Mg': 0.20,
    'Fe': 11.5, 'Cu': 2.1, 'Zn': 23.0, 'Mn': 1.67, 'I': 0.29, 'Se': 100.6,
    'vitA_IU': 1742, 'vitD_IU': 158.1, 'vitE_IU': 14.4, 'B1': 0.647, 'B2': 1.73, 'B3': 4.89, 'B5': 4.08,
    'B6': 0.431, 'B12': 9.63, 'folate': 77.6, 'choline': 489, 'taurine': 500,
    'Arg': 2.43, 'His': 0.661, 'Ile': 1.32, 'Leu': 2.36, 'Lys': 1.81, 'Met': 1.15, 'MetCys': 2.19,
    'Phe': 1.55, 'PheTyr': 2.56, 'Thr': 1.5, 'Trp': 0.489, 'Val': 1.7,
}
MAXIMUM = {'Ca': 6.25, 'P': 4.0, 'vitA_IU': 62500, 'vitD_IU': 750, 'Zn': 71.4, 'Cu': 7.1, 'I': 2.75, 'Se': 142}


def mix(recipe):
    """recipe: {원료키: 배합비(생 기준, 합≈1)} → 100g 완성품(수율≈100%) 당 영양."""
    total = sum(recipe.values())
    out = {k: 0.0 for k in KEYS + ['kcal']}
    missing = {}
    for key, frac in recipe.items():
        ing = ingredient(key)
        w = frac / total * 100  # 100g 완성품 중 이 원료 g
        for k in KEYS:
            v = ing.get(k)
            if v is None:
                if w >= 1:
                    missing.setdefault(k, []).append(key)
                continue
            out[k] += v * w / 100
    nfe = 100 - out['water'] - out['protein'] - out['fat'] - out['ash'] - out['fiber']
    out['NFE'] = nfe
    out['kcal'] = 4 * out['protein'] + 9 * out['fat'] + 4 * max(nfe, 0)
    out['MetCys'] = out['Met'] + out['Cys']
    out['PheTyr'] = out['Phe'] + out['Tyr']
    out['_missing'] = missing
    return out


def per1000(n):
    k = n['kcal'] / 1000  # 100g 당 kcal / 1000
    f = lambda v: v / k
    r = {}
    for key in TARGET:
        v = n.get(key, 0) or 0
        if key in MINERAL_MG:
            v = v / 1000  # mg → g
        if key == 'I':
            v = v / 1000  # µg → mg
        r[key] = f(v)
    return r


def report(name, recipe, show=True):
    n = mix(recipe)
    dm = 100 - n['water']
    p = per1000(n)
    lines = []
    lines.append(f"== {name}")
    lines.append(f"  100g: 수분 {n['water']:.1f} · 조단백 {n['protein']:.2f} · 조지방 {n['fat']:.2f} · 조회분 {n['ash']:.2f} · 식이섬유 {n['fiber']:.2f} · NFE {n['NFE']:.1f} · {n['kcal']:.0f} kcal")
    lines.append(f"  건물(DM) {dm:.1f}% → 단백 {n['protein']/dm*100:.1f}%DM · 지방 {n['fat']/dm*100:.1f}%DM · 지방 {n['fat']*9/n['kcal']*100:.1f}% of kcal · {n['fat']/n['kcal']*100:.2f} g/100kcal")
    ca_p = (n['Ca'] / n['P']) if n['P'] else 0
    lines.append(f"  Ca:P {ca_p:.2f} · EPA+DHA {(n['EPA'] or 0)+(n['DHA'] or 0):.3f} g/100g = {((n['EPA'] or 0)+(n['DHA'] or 0))/(n['kcal']/1000):.2f} g/1000kcal · LA {n['LA']:.2f} g/100g · n6:n3 {n['LA']/max((n['ALA'] or 0)+(n['EPA'] or 0)+(n['DHA'] or 0),1e-9):.1f}")
    fails = []
    for key, tgt in TARGET.items():
        v = p[key]
        ratio = v / tgt
        mx = MAXIMUM.get(key)
        flag = '✓' if ratio >= 1 else '✗'
        if mx and v > mx:
            flag = '▲상한초과'
        if flag != '✓':
            fails.append(f"{key} {v:.3g}/{tgt} ({ratio*100:.0f}%) {flag}")
    lines.append('  미달/초과: ' + (' · '.join(fails) if fails else '없음 — 전 항목 충족'))
    lows = sorted(((p[k] / t, k) for k, t in TARGET.items()))[:6]
    lines.append('  마진 낮은 순: ' + ' · '.join(f"{k} {r*100:.0f}%" for r, k in lows))
    if n['_missing']:
        lines.append('  ⚠데이터 결측(1% 이상 원료): ' + '; '.join(f"{k}←{','.join(v)}" for k, v in n['_missing'].items()))
    if show:
        print('\n'.join(lines))
    return n, p


def feed_grams(kcal100, weight_kg, factor=1.4):
    rer = 70 * weight_kg ** 0.75
    return rer * factor / kcal100 * 100
