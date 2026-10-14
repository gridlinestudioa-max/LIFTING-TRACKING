import type { Food } from './nutrition';

/**
 * Starter food list so the log works before the full database exists.
 * Typical values per serving, rounded, based on USDA FoodData Central generic foods.
 * The full food database replaces/extends this; keep ids stable since log entries reference them.
 */
export const STARTER_FOODS: Food[] = [
  // Protein
  { id: 'egg', name: 'Egg, large', serving: '1 egg (50 g)', n: { kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8, sugar: 0.2 }, tags: ['egg'] },
  { id: 'eggwhite', name: 'Egg white, large', serving: '1 white (33 g)', n: { kcal: 17, protein: 3.6, carbs: 0.2, fat: 0.1, sugar: 0.2 }, tags: ['egg'] },
  { id: 'chicken', name: 'Chicken breast, cooked', serving: '4 oz (112 g)', n: { kcal: 185, protein: 34.6, carbs: 0, fat: 4 }, tags: ['meat'] },
  { id: 'beef9010', name: 'Ground beef 90/10, cooked', serving: '4 oz (112 g)', n: { kcal: 243, protein: 29.2, carbs: 0, fat: 13.1 }, tags: ['meat'] },
  { id: 'bacon', name: 'Bacon, cooked', serving: '3 slices (26 g)', n: { kcal: 129, protein: 9, carbs: 0.4, fat: 10 }, tags: ['meat'] },
  { id: 'salmon', name: 'Salmon, cooked', serving: '4 oz (112 g)', n: { kcal: 231, protein: 24.7, carbs: 0, fat: 13.9 }, tags: ['fish'] },
  { id: 'tuna', name: 'Tuna, canned in water', serving: '3 oz drained (85 g)', n: { kcal: 73, protein: 16.5, carbs: 0, fat: 0.8 }, tags: ['fish'] },
  { id: 'shrimp', name: 'Shrimp, cooked', serving: '3 oz (85 g)', n: { kcal: 84, protein: 20.4, carbs: 0.2, fat: 0.2 }, tags: ['fish'] },
  { id: 'tofu', name: 'Tofu, firm', serving: '3 oz (85 g)', n: { kcal: 122, protein: 14.7, carbs: 2.4, fat: 7.4, fiber: 2 }, tags: ['legume'] },
  { id: 'whey', name: 'Whey protein powder', serving: '1 scoop (30 g)', n: { kcal: 120, protein: 24, carbs: 3, fat: 1.5, sugar: 1 }, tags: ['dairy'] },

  // Dairy
  { id: 'greekyog', name: 'Greek yogurt, plain nonfat', serving: '1 container (170 g)', n: { kcal: 100, protein: 17.3, carbs: 6.1, fat: 0.7, sugar: 5.5 }, tags: ['dairy'] },
  { id: 'milk2', name: 'Milk, 2%', serving: '1 cup (244 g)', n: { kcal: 122, protein: 8.1, carbs: 11.7, fat: 4.8, sugar: 11.7 }, tags: ['dairy'] },
  { id: 'cheddar', name: 'Cheddar cheese', serving: '1 oz (28 g)', n: { kcal: 115, protein: 6.5, carbs: 0.4, fat: 9.5, sugar: 0.1 }, tags: ['dairy'] },
  { id: 'butter', name: 'Butter', serving: '1 tbsp (14 g)', n: { kcal: 102, protein: 0.1, carbs: 0, fat: 11.5 }, tags: ['dairy'] },

  // Grains and starches
  { id: 'oats', name: 'Oats, rolled, dry', serving: '½ cup (40 g)', n: { kcal: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, sugar: 1 }, tags: ['grain'] },
  { id: 'rice', name: 'White rice, cooked', serving: '1 cup (158 g)', n: { kcal: 205, protein: 4.3, carbs: 44.5, fat: 0.4, fiber: 0.6 }, tags: ['grain'] },
  { id: 'brownrice', name: 'Brown rice, cooked', serving: '1 cup (195 g)', n: { kcal: 218, protein: 4.5, carbs: 45.8, fat: 1.6, fiber: 3.5 }, tags: ['grain'] },
  { id: 'pasta', name: 'Pasta, cooked', serving: '1 cup (140 g)', n: { kcal: 220, protein: 8.1, carbs: 43, fat: 1.3, fiber: 2.5, sugar: 0.8 }, tags: ['grain'] },
  { id: 'wwbread', name: 'Whole wheat bread', serving: '1 slice (32 g)', n: { kcal: 80, protein: 4, carbs: 14, fat: 1, fiber: 2, sugar: 1.5 }, tags: ['grain'] },
  { id: 'potato', name: 'Potato, baked', serving: '1 medium (173 g)', n: { kcal: 161, protein: 4.3, carbs: 36.6, fat: 0.2, fiber: 3.8, sugar: 2 }, tags: [] },
  { id: 'sweetpotato', name: 'Sweet potato, baked', serving: '1 medium (114 g)', n: { kcal: 103, protein: 2.3, carbs: 23.6, fat: 0.2, fiber: 3.8, sugar: 7.4 }, tags: [] },
  { id: 'blackbeans', name: 'Black beans, cooked', serving: '½ cup (86 g)', n: { kcal: 114, protein: 7.6, carbs: 20.4, fat: 0.5, fiber: 7.5, sugar: 0.3 }, tags: ['legume'] },
  { id: 'hummus', name: 'Hummus', serving: '2 tbsp (30 g)', n: { kcal: 70, protein: 2, carbs: 4, fat: 5, fiber: 1 }, tags: ['legume'] },
  { id: 'pizza', name: 'Pizza, cheese', serving: '1 slice (107 g)', n: { kcal: 285, protein: 12.2, carbs: 35.7, fat: 10.4, fiber: 2.5, sugar: 3.8 }, tags: ['grain', 'dairy'] },

  // Fruit and vegetables
  { id: 'banana', name: 'Banana', serving: '1 medium (118 g)', n: { kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, sugar: 14.4 }, tags: [] },
  { id: 'apple', name: 'Apple', serving: '1 medium (182 g)', n: { kcal: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4, sugar: 18.9 }, tags: [] },
  { id: 'blueberries', name: 'Blueberries', serving: '1 cup (148 g)', n: { kcal: 84, protein: 1.1, carbs: 21.4, fat: 0.5, fiber: 3.6, sugar: 14.7 }, tags: [] },
  { id: 'broccoli', name: 'Broccoli, cooked', serving: '1 cup (156 g)', n: { kcal: 55, protein: 3.7, carbs: 11.2, fat: 0.6, fiber: 5.1, sugar: 2.2 }, tags: [] },
  { id: 'spinach', name: 'Spinach, raw', serving: '1 cup (30 g)', n: { kcal: 7, protein: 0.9, carbs: 1.1, fat: 0.1, fiber: 0.7 }, tags: [] },
  { id: 'avocado', name: 'Avocado', serving: '½ fruit (68 g)', n: { kcal: 109, protein: 1.4, carbs: 5.8, fat: 10, fiber: 4.6, sugar: 0.5 }, tags: [] },

  // Fats, nuts
  { id: 'almonds', name: 'Almonds', serving: '1 oz (28 g)', n: { kcal: 164, protein: 6, carbs: 6.1, fat: 14.2, fiber: 3.5, sugar: 1.2 }, tags: [] },
  { id: 'pb', name: 'Peanut butter', serving: '2 tbsp (32 g)', n: { kcal: 190, protein: 7, carbs: 8, fat: 16, fiber: 2, sugar: 3 }, tags: ['legume'] },
  { id: 'oliveoil', name: 'Olive oil', serving: '1 tbsp (14 g)', n: { kcal: 119, protein: 0, carbs: 0, fat: 13.5 }, tags: [] },

  // Drinks
  { id: 'oj', name: 'Orange juice', serving: '1 cup (248 g)', n: { kcal: 112, protein: 1.7, carbs: 25.8, fat: 0.5, fiber: 0.5, sugar: 20.8 }, tags: [] },
  { id: 'cola', name: 'Cola', serving: '12 fl oz can', n: { kcal: 140, protein: 0, carbs: 39, fat: 0, sugar: 39 }, tags: ['sugar'] },
  { id: 'beer', name: 'Beer, regular', serving: '12 fl oz', n: { kcal: 153, protein: 1.6, carbs: 12.6, fat: 0 }, tags: ['alcohol', 'grain'] },
  { id: 'coffee', name: 'Coffee, black', serving: '1 cup (8 fl oz)', n: { kcal: 2, protein: 0.3, carbs: 0, fat: 0 }, tags: [] },
];
