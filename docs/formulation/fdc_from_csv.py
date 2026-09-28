import csv, json, os
HERE = os.path.dirname(__file__)
D = os.path.join(HERE, 'usda', 'FoodData_Central_sr_legacy_food_csv_2018-04')

TARGETS = {
    'chicken_breast': 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw',
    'chicken_liver': 'Chicken, liver, all classes, raw',
    'chicken_heart': 'Chicken, heart, all classes, raw',
    'duck_meat': 'Duck, domesticated, meat only, raw',
    'duck_liver': 'Duck, domesticated, liver, raw',
    'pork_tenderloin': 'Pork, fresh, loin, tenderloin, separable lean only, raw',
    'pork_liver': 'Pork, fresh, variety meats and by-products, liver, raw',
    'pork_heart': 'Pork, fresh, variety meats and by-products, heart, raw',
    'beef_chuck': 'Beef, chuck, clod roast, separable lean only, trimmed to 1/4" fat, all grades, raw',
    'beef_liver': 'Beef, variety meats and by-products, liver, raw',
    'beef_heart': 'Beef, variety meats and by-products, heart, raw',
    'pollock': 'Fish, pollock, Alaska, raw',
    'cod': 'Fish, cod, Atlantic, raw',
    'cod_dried': 'Fish, cod, Atlantic, dried and salted',
    'egg_white': 'Egg, white, raw, fresh',
    'potato': 'Potatoes, flesh and skin, raw',
    'rice_white_cooked': 'Rice, white, short-grain, cooked, unenriched',
    'rice_brown_cooked': "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)",
    'pumpkin': 'Pumpkin, raw',
    'sweet_potato': "Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program)",
    'carrot': 'Carrots, raw',
    'spinach': 'Spinach, raw',
    'broccoli': 'Broccoli, raw',
    'cabbage': 'Cabbage, raw',
    'zucchini': 'Squash, summer, zucchini, includes skin, raw',
    'blueberry': 'Blueberries, raw',
    'apple': "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)",
    'olive_oil': 'Oil, olive, salad or cooking',
    'salmon_oil': 'Fish oil, salmon',
    'sunflower_oil_hl': 'Oil, sunflower, linoleic, (approx. 65%)',
    'safflower_oil_hl': 'Oil, safflower, salad or cooking, linoleic, (over 70%)',
    'turmeric': 'Spices, turmeric, ground',
    'beets': 'Beets, raw',
    'radish': 'Radishes, oriental, raw',
    'mussel_blue': 'Mollusks, mussel, blue, raw',
}

nut = {}
with open(os.path.join(D, 'nutrient.csv'), encoding='utf-8') as f:
    for r in csv.DictReader(f):
        nut[r['id']] = (r['nutrient_nbr'], r['name'], r['unit_name'])

desc2id = {}
with open(os.path.join(D, 'food.csv'), encoding='utf-8') as f:
    for r in csv.DictReader(f):
        desc2id[r['description']] = r['fdc_id']

want = {}
for key, desc in TARGETS.items():
    fid = desc2id.get(desc)
    if not fid:
        cands = [d for d in desc2id if d.lower().startswith(desc.lower()[:18])][:8]
        print('NOHIT', key, '|', desc, '| cands:', cands)
        continue
    want[fid] = key

data = {k: {'fdcId': None, 'description': TARGETS[k], 'nutrients': {}} for k in want.values()}
for fid, key in want.items():
    data[key]['fdcId'] = int(fid)
with open(os.path.join(D, 'food_nutrient.csv'), encoding='utf-8') as f:
    for r in csv.DictReader(f):
        key = want.get(r['fdc_id'])
        if not key:
            continue
        nbr, name, unit = nut.get(r['nutrient_id'], (None, None, None))
        if not nbr:
            continue
        nbr = nbr.split('.')[0]
        data[key]['nutrients'][nbr] = {'name': name, 'unit': unit, 'value': float(r['amount'])}

json.dump(data, open(os.path.join(HERE, 'fdc_data.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in data.items():
    print('OK', k, v['fdcId'], len(v['nutrients']))
