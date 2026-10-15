#!/usr/bin/env python3
"""
Build the bundled USDA food list (src/logic/data/usda-foods.json) from USDA FoodData Central downloads.

Sources (public domain, https://fdc.nal.usda.gov/download-datasets/):
  - FNDDS / Survey foods (JSON), e.g. FoodData_Central_survey_food_json_2024-10-31.zip
    Foods as people eat them, with household portions ("1 slice", "1 cup").
  - SR Legacy (JSON), FoodData_Central_sr_legacy_food_json_2018-04.zip
    Ingredients and generic foods. Baby foods are left out.

Usage:
  python3 scripts/build-usda-foods.py <surveyDownload.json> <sr_legacy.json> [out.json]

Output: {"v": <version>, "foods": [record, ...]} where each record is a compact array:
  [id, name, src, kcal, protein, carbs, fat, fiber, sugar, tags, portions, micros]
    id       "u<fdcId>"
    src      0 = FNDDS, 1 = SR Legacy
    nutrients per 100 g
    tags     bitmask, same order as FOOD_TAGS in src/logic/nutrition.ts
    portions [[label, grams], ...]; the first is the default serving
    micros   [sodium mg, added sugar g, potassium mg, calcium mg, iron mg, magnesium mg, vitamin C mg,
              vitamin D µg, vitamin B12 µg] per 100 g, null where USDA doesn't list it
Food-group tags (meat, dairy, ...) are inferred from USDA categories, ingredient lists and names,
so diets like vegan or paleo can check foods. They're a best guess, not a guarantee.
"""
import json
import re
import sys

TAGS = ['meat', 'fish', 'dairy', 'egg', 'grain', 'legume', 'sugar', 'alcohol']
BIT = {t: 1 << i for i, t in enumerate(TAGS)}

NUT = {1008: 'kcal', 1003: 'protein', 1005: 'carbs', 1004: 'fat', 1079: 'fiber', 2000: 'sugar'}
# Vitamins, minerals and added sugar, in the order of the record's last field. Same keys and units as
# MICROS in src/logic/micros.ts. Missing values are null (not every food lists every nutrient).
MICRO = [(1093, 'sodium'), (1235, 'addedSugar'), (1092, 'potassium'), (1087, 'calcium'), (1089, 'iron'),
         (1090, 'magnesium'), (1162, 'vitC'), (1114, 'vitD'), (1178, 'b12')]

SR_CATEGORY_TAGS = {
    'Beef Products': {'meat'},
    'Pork Products': {'meat'},
    'Lamb, Veal, and Game Products': {'meat'},
    'Poultry Products': {'meat'},
    'Sausages and Luncheon Meats': {'meat'},
    'Finfish and Shellfish Products': {'fish'},
    'Legumes and Legume Products': {'legume'},
    'Cereal Grains and Pasta': {'grain'},
    'Breakfast Cereals': {'grain'},
    'Baked Products': {'grain'},
    'Sweets': {'sugar'},
}
SR_SKIP_CATEGORIES = {'Baby Foods'}
# Categories where ingredient-like keywords in the name are misleading (e.g. "Oil, soybean").
NO_KEYWORD_CATEGORIES = {'Fats and Oils', 'Spices and Herbs'}


def rx(words):
    return re.compile(r'\b(?:' + '|'.join(words) + r')\b', re.I)


KEYWORDS = {
    'meat': rx([r'beef', r'pork', r'chicken', r'turkey', r'ham', r'hams', r'bacon', r'sausages?', r'lamb', r'veal', r'venison',
                r'bison', r'duck', r'goose', r'pepperoni', r'salami', r'bologna', r'hot dogs?', r'frankfurters?', r'meatballs?',
                r'meat', r'meats', r'jerky', r'chorizo', r'prosciutto', r'pastrami', r'brisket', r'steak', r'ribs', r'gyro',
                r'liverwurst', r'liver', r'goat', r'rabbit', r'elk', r'quail', r'pheasant', r'squab']),
    'fish': rx([r'fish', r'salmon', r'tuna', r'cod', r'tilapia', r'shrimp', r'crab', r'lobster', r'clams?', r'oysters?',
                r'scallops?', r'sardines?', r'anchov\w*', r'trout', r'catfish', r'halibut', r'mackerel', r'seafood', r'squid',
                r'octopus', r'mussels?', r'crayfish', r'herring', r'flounder', r'haddock', r'pollock', r'swordfish', r'sushi',
                r'calamari', r'roe', r'caviar', r'surimi', r'whitefish', r'perch', r'snapper', r'mahimahi', r'bass', r'pike']),
    'dairy': rx([r'milk', r'cheese', r'cheeses', r'yogurt', r'cream', r'butter', r'buttermilk', r'whey', r'casein', r'ghee',
                 r'kefir', r'ice cream', r'custard', r'pudding', r'milkshake', r'latte', r'cappuccino', r'queso', r'alfredo',
                 r'cheesecake', r'mozzarella', r'cheddar', r'parmesan', r'ricotta', r'feta']),
    'egg': rx([r'eggs?', r'omelets?', r'omelettes?', r'quiche', r'frittata', r'mayonnaise', r'custard', r'meringue', r'eggnog']),
    'grain': rx([r'bread', r'breads', r'pasta', r'noodles?', r'rice', r'wheat', r'flour', r'oats?', r'oatmeal', r'barley',
                 r'rye', r'cereal', r'crackers?', r'cookies?', r'cakes?', r'muffins?', r'bagels?', r'biscuits?', r'pizza',
                 r'tortillas?', r'buns?', r'pancakes?', r'waffles?', r'pretzels?', r'granola', r'couscous', r'quinoa',
                 r'sandwich', r'sandwiches', r'burgers?', r'hamburgers?', r'cheeseburgers?', r'spaghetti', r'macaroni',
                 r'lasagna', r'ravioli', r'dumplings?', r'croissants?', r'doughnuts?', r'donuts?', r'pastry', r'pie', r'pies',
                 r'cornbread', r'grits', r'polenta', r'corn chips', r'tortilla chips', r'taco shells?', r'burritos?',
                 r'enchiladas?', r'quesadillas?', r'beer', r'bulgur', r'farro', r'millet', r'sorghum', r'brownies?',
                 r'stuffing', r'breaded', r'batter', r'croutons?', r'wraps?']),
    'legume': rx([r'beans?', r'lentils?', r'chickpeas?', r'garbanzo', r'hummus', r'peanuts?', r'peanut butter', r'soy',
                  r'soybeans?', r'soymilk', r'tofu', r'tempeh', r'edamame', r'miso', r'falafel', r'split peas?',
                  r'black-eyed peas?', r'refried']),
    'sugar': rx([r'candy', r'candies', r'soda', r'soft drink', r'cola', r'syrup', r'sweetened', r'frosting', r'icing',
                 r'chocolate', r'dessert', r'jam', r'jelly', r'jellies', r'marmalade', r'ice cream', r'cookies?', r'cakes?',
                 r'doughnuts?', r'donuts?', r'pastry', r'pie', r'pies', r'brownies?', r'sugar', r'sugars', r'fudge',
                 r'caramel', r'toffee', r'marshmallows?', r'sherbet', r'sorbet', r'popsicle', r'gelatin dessert',
                 r'energy drink', r'sports drink', r'fruit drink', r'lemonade', r'sweet tea']),
    'alcohol': rx([r'beer', r'wine', r'liquor', r'vodka', r'whiskey', r'whisky', r'rum', r'gin', r'tequila', r'cocktail',
                   r'alcoholic', r'margarita', r'martini', r'sake', r'brandy', r'liqueur', r'mimosa', r'sangria', r'mojito',
                   r'daiquiri', r'cordial']),
}

# Phrases that look like a tag but aren't (checked against the lower-cased name).
NOT_TAG = {
    'meat': rx([r'meatless', r'vegetarian', r'vegan', r'meat substitute', r'imitation', r'no meat', r'without meat',
                r'coconut meat', r'nut meat', r'veggie', r'plant-based', r'meat analog']),
    'dairy': rx([r'coconut milk', r'coconut cream', r'almond milk', r'soy milk', r'soymilk', r'rice milk', r'oat milk',
                 r'cashew milk', r'nondairy', r'non-dairy', r'dairy-free', r'peanut butter', r'almond butter',
                 r'nut butter', r'cashew butter', r'sunflower butter', r'apple butter', r'cocoa butter', r'butternut',
                 r'cream of tartar', r'cream soda', r'milk thistle', r'buttered popcorn flavored', r'vegan',
                 r'cream of wheat', r'cream of rice', r'milkfish']),
    'egg': rx([r'eggplant', r'egg-free', r'eggless', r'egg substitute', r'vegan']),
    'grain': rx([r'rice milk', r'grain-free', r'gluten-free', r'buckwheat', r'cauliflower rice', r'rice cake']),
    'legume': rx([r'soy sauce', r'jelly beans?', r'green beans?', r'string beans?', r'snap beans?', r'wax beans?',
                  r'beans?,? (?:snap|string|green|wax|yellow|italian)\w*',
                  r'yellow beans?', r'coffee beans?', r'cocoa beans?', r'vanilla beans?']),
    'sugar': rx([r'unsweetened', r'sugar-free', r'sugar free', r'no sugar', r'sugar substitute', r'sugar snap',
                 r'sugar apple', r'artificially sweetened', r'diet', r'reduced sugar', r'sugar alcohol']),
    'alcohol': rx([r'non-?alcoholic', r'wine vinegar', r'rum extract', r'root beer', r'ginger beer', r'birch beer',
                   r'cooking wine', r'gingerbread', r'ginger', r'wineberr\w*', r'rumaki']),
}


# The whole food is excluded from a tag when its name says so.
DENY = {'alcohol': rx([r'non-?alcoholic', r'alcohol-free'])}


def keyword_tags(name):
    out = set()
    for tag, pattern in KEYWORDS.items():
        if tag in DENY and DENY[tag].search(name):
            continue
        if not pattern.search(name):
            continue
        neg = NOT_TAG.get(tag)
        if neg:
            # Remove the negative phrases, then look again.
            if not pattern.search(neg.sub(' ', name)):
                continue
        out.add(tag)
    return out


def sr_tags(food):
    cat = food['foodCategory']['description']
    name = food['description']
    tags = set(SR_CATEGORY_TAGS.get(cat, set()))
    if cat == 'Dairy and Egg Products':
        tags.add('egg' if re.match(r'egg', name, re.I) and not re.search(r'eggnog', name, re.I) else 'dairy')
        if re.search(r'eggnog', name, re.I):
            tags |= {'dairy', 'egg'}
    if cat == 'Beverages' and re.search(r'alcoholic', name, re.I) and not NOT_TAG['alcohol'].search(name):
        tags.add('alcohol')
    if cat not in NO_KEYWORD_CATEGORIES:
        tags |= keyword_tags(name)
    if cat == 'Fats and Oils' and re.search(r'\bbutter\b', name, re.I) and not NOT_TAG['dairy'].search(name):
        tags.add('dairy')
    # Meat stock, fish oil etc. stay as found; a vegetable-category food named for a dish keeps its keywords.
    return tags


def nutrients(food):
    v = {k: 0.0 for k in NUT.values()}
    seen = set()
    for n in food['foodNutrients']:
        nid = n.get('nutrient', {}).get('id')
        if nid in NUT and n.get('amount') is not None:
            v[NUT[nid]] = float(n['amount'])
            seen.add(nid)
    if 1008 not in seen:
        return None
    return v


def micros(food):
    got = {}
    for n in food['foodNutrients']:
        nid = n.get('nutrient', {}).get('id')
        if n.get('amount') is not None:
            got[nid] = float(n['amount'])
    return [num(got[i], 2) if i in got else None for i, _ in MICRO]


def num(x, d=1):
    r = round(x, d)
    return int(r) if r == int(r) else r


def fmt_amount(a):
    if a is None:
        return '1'
    if a == int(a):
        return str(int(a))
    fr = {0.25: '¼', 0.5: '½', 0.75: '¾', 0.33: '⅓', 0.333: '⅓', 0.67: '⅔', 0.667: '⅔'}
    whole, frac = int(a), round(a - int(a), 3)
    for k, s in fr.items():
        if abs(frac - k) < 0.01:
            return (str(whole) if whole else '') + s
    return str(num(a, 2))


def sr_portions(food):
    out = []
    for p in sorted(food['foodPortions'], key=lambda p: p.get('sequenceNumber') or 0):
        g = p.get('gramWeight') or 0
        if g <= 0:
            continue
        unit = p['measureUnit']['name']
        mod = (p.get('modifier') or '').strip()
        parts = [fmt_amount(p.get('amount'))]
        if unit and unit != 'undetermined':
            parts.append(unit)
        if mod:
            parts.append(mod if not (unit and unit != 'undetermined') else f', {mod}' if not mod.startswith('(') else mod)
        label = ' '.join(parts).replace(' ,', ',')
        out.append([label, num(g)])
    return out


def fndds_portions(food):
    typical = []
    rest = []
    for p in sorted(food['foodPortions'], key=lambda p: p.get('sequenceNumber') or 0):
        g = p.get('gramWeight') or 0
        if g <= 0:
            continue
        d = p['portionDescription'].strip()
        if d.lower() == 'quantity not specified':
            typical.append(['1 serving', num(g)])
        else:
            rest.append([d, num(g)])
    return typical + rest


def dedupe(portions, limit=6):
    seen, out = set(), []
    for label, g in portions:
        if label.lower() in seen:
            continue
        seen.add(label.lower())
        out.append([label, g])
    return out[:limit]


def mask(tags):
    m = 0
    for t in tags:
        m |= BIT[t]
    return m


def main(survey_path, sr_path, out_path):
    sr = json.load(open(sr_path))['SRLegacyFoods']
    survey = json.load(open(survey_path))['SurveyFoods']

    sr_by_ndb = {f['ndbNumber']: f for f in sr}
    sr_tag_cache = {f['ndbNumber']: sr_tags(f) for f in sr}
    fndds_by_code = {int(f['foodCode']): f for f in survey}
    fndds_tag_cache = {}

    def fndds_tags(f, depth=0):
        code = int(f['foodCode'])
        if code in fndds_tag_cache:
            return fndds_tag_cache[code]
        tags = set()
        inputs = [i for i in f.get('inputFoods', []) if (i.get('ingredientWeight') or i.get('amount') or 0) > 0]
        for i in inputs:
            c = i['ingredientCode']
            if c in sr_tag_cache:
                tags |= sr_tag_cache[c]
            elif c in fndds_by_code and depth < 4:
                tags |= fndds_tags(fndds_by_code[c], depth + 1)
            else:
                tags |= keyword_tags(i.get('ingredientDescription') or '')
        if not inputs:
            tags |= keyword_tags(f['description'])
        # Name says it has no meat / is vegetarian: trust the name over a stray ingredient match.
        if NOT_TAG['meat'].search(f['description']) and re.search(r'meatless|vegetarian|vegan|no meat|without meat', f['description'], re.I):
            tags.discard('meat')
            tags.discard('fish')
        for tag, pattern in DENY.items():
            if pattern.search(f['description']):
                tags.discard(tag)
        fndds_tag_cache[code] = tags
        return tags

    records = []
    for f in survey:
        n = nutrients(f)
        if n is None:
            continue
        portions = dedupe(fndds_portions(f))
        records.append(['u%d' % f['fdcId'], f['description'], 0, num(n['kcal'], 0), num(n['protein']), num(n['carbs']),
                        num(n['fat']), num(n['fiber']), num(n['sugar']), mask(fndds_tags(f)), portions, micros(f)])
    for f in sr:
        if f['foodCategory']['description'] in SR_SKIP_CATEGORIES:
            continue
        n = nutrients(f)
        if n is None:
            continue
        portions = dedupe(sr_portions(f))
        records.append(['u%d' % f['fdcId'], f['description'], 1, num(n['kcal'], 0), num(n['protein']), num(n['carbs']),
                        num(n['fat']), num(n['fiber']), num(n['sugar']), mask(sr_tag_cache[f['ndbNumber']]), portions, micros(f)])

    out = {
        'v': 2,
        'source': 'USDA FoodData Central: FNDDS 2021-2023 (published 2024-10-31) and SR Legacy (2018-04). Public domain.',
        'fields': ['id', 'name', 'src', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'tags', 'portions', 'micros'],
        'micros': [k for _, k in MICRO],
        'tags': TAGS,
        'foods': records,
    }
    with open(out_path, 'w') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(records)} foods -> {out_path}')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'src/logic/data/usda-foods.json')
