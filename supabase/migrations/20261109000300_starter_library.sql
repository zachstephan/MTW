-- Starter library: 10 sample recipes every household can see. household_id is null.
with r as (
  insert into public.recipes (household_id, name, cuisine, protein, meal_type, healthy, servings, notes, created_by)
  values (null, 'Sheet Pan Chicken Fajitas', 'Mexican', 'Chicken', 'Tacos', true, 4, 'Heat oven to 425°F. Toss sliced chicken, peppers and onion with oil, chili powder, cumin, garlic powder and salt. Roast on one sheet pan 20–25 minutes, squeeze lime over, and serve in warm tortillas.', null)
  on conflict do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, position, quantity, unit, item, note, aisle, raw)
select r.id, v.position, v.quantity, v.unit, v.item, v.note, v.aisle, v.raw from r, (values
  (0, 1.5, 'lb', 'chicken breast', 'sliced', 'Meat & seafood', '1 1/2 lb chicken breast, sliced'),
  (1, 3, null, 'bell peppers', 'sliced', 'Produce', '3 bell peppers, sliced'),
  (2, 1, null, 'yellow onion', 'sliced', 'Produce', '1 yellow onion, sliced'),
  (3, 2, 'tbsp', 'olive oil', null, 'Spices & oils', '2 tbsp olive oil'),
  (4, 2, 'tsp', 'chili powder', null, 'Spices & oils', '2 tsp chili powder'),
  (5, 1, 'tsp', 'ground cumin', null, 'Spices & oils', '1 tsp ground cumin'),
  (6, 1, 'tsp', 'garlic powder', null, 'Spices & oils', '1 tsp garlic powder'),
  (7, 1, 'tsp', 'salt', null, 'Spices & oils', '1 tsp salt'),
  (8, 1, null, 'lime', null, 'Produce', '1 lime'),
  (9, 8, null, 'flour tortillas', null, 'Bakery', '8 flour tortillas'),
  (10, 0.5, 'cup', 'sour cream', null, 'Dairy & eggs', '1/2 cup sour cream')
) as v(position, quantity, unit, item, note, aisle, raw);

with r as (
  insert into public.recipes (household_id, name, cuisine, protein, meal_type, healthy, servings, notes, created_by)
  values (null, 'Black Bean Burrito Bowls', 'Mexican', 'Vegetarian', 'Bowl', true, 4, 'Cook the rice with a squeeze of lime and chopped cilantro. Warm the beans with cumin and a pinch of salt, and char the corn in a dry skillet. Build bowls with rice, beans, corn, salsa, avocado and cheese.', null)
  on conflict do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, position, quantity, unit, item, note, aisle, raw)
select r.id, v.position, v.quantity, v.unit, v.item, v.note, v.aisle, v.raw from r, (values
  (0, 1.5, 'cup', 'long-grain rice', null, 'Pantry', '1 1/2 cups long-grain rice'),
  (1, 2, 'can', 'black beans', 'rinsed', 'Canned & jarred', '2 cans black beans, rinsed'),
  (2, 1.5, 'cup', 'frozen corn', null, 'Frozen', '1 1/2 cups frozen corn'),
  (3, 1, 'cup', 'salsa', null, 'Canned & jarred', '1 cup salsa'),
  (4, 2, null, 'avocados', null, 'Produce', '2 avocados'),
  (5, 1, null, 'lime', null, 'Produce', '1 lime'),
  (6, 0.25, 'cup', 'fresh cilantro', null, 'Produce', '1/4 cup fresh cilantro'),
  (7, 1, 'tsp', 'ground cumin', null, 'Spices & oils', '1 tsp ground cumin'),
  (8, 1, 'cup', 'shredded cheddar cheese', null, 'Dairy & eggs', '1 cup shredded cheddar cheese')
) as v(position, quantity, unit, item, note, aisle, raw);

with r as (
  insert into public.recipes (household_id, name, cuisine, protein, meal_type, healthy, servings, notes, created_by)
  values (null, 'Honey Garlic Salmon and Broccoli', 'American', 'Seafood', 'Main', true, 4, 'Heat oven to 400°F. Whisk honey, soy sauce, garlic and lemon juice. Put salmon and broccoli on a sheet pan, brush the salmon with the glaze, drizzle broccoli with oil and salt, and roast 12–15 minutes.', null)
  on conflict do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, position, quantity, unit, item, note, aisle, raw)
select r.id, v.position, v.quantity, v.unit, v.item, v.note, v.aisle, v.raw from r, (values
  (0, 4, null, 'salmon fillets', null, 'Meat & seafood', '4 salmon fillets'),
  (1, 1.5, 'lb', 'broccoli florets', null, 'Produce', '1 1/2 lb broccoli florets'),
  (2, 3, 'tbsp', 'honey', null, 'Pantry', '3 tbsp honey'),
  (3, 2, 'tbsp', 'soy sauce', null, 'Pantry', '2 tbsp soy sauce'),
  (4, 3, 'clove', 'garlic', 'minced', 'Produce', '3 cloves garlic, minced'),
  (5, 1, null, 'lemon', null, 'Produce', '1 lemon'),
  (6, 1, 'tbsp', 'olive oil', null, 'Spices & oils', '1 tbsp olive oil'),
  (7, 0.5, 'tsp', 'salt', null, 'Spices & oils', '1/2 tsp salt')
) as v(position, quantity, unit, item, note, aisle, raw);

with r as (
  insert into public.recipes (household_id, name, cuisine, protein, meal_type, healthy, servings, notes, created_by)
  values (null, 'Shrimp Fried Rice', 'Asian', 'Seafood', 'Bowl', false, 4, 'Use cold, day-old rice if you can. Scramble the eggs and set aside. Sear the shrimp, add peas, carrots and garlic, then the rice. Stir in soy sauce and sesame oil, fold the eggs back in, and finish with green onions.', null)
  on conflict do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, position, quantity, unit, item, note, aisle, raw)
select r.id, v.position, v.quantity, v.unit, v.item, v.note, v.aisle, v.raw from r, (values
  (0, 1, 'lb', 'shrimp', 'peeled', 'Meat & seafood', '1 lb shrimp, peeled'),
  (1, 4, 'cup', 'cooked rice', null, 'Pantry', '4 cups cooked rice'),
  (2, 3, null, 'eggs', null, 'Dairy & eggs', '3 eggs'),
  (3, 1.5, 'cup', 'frozen peas and carrots', null, 'Frozen', '1 1/2 cups frozen peas and carrots'),
  (4, 3, 'clove', 'garlic', 'minced', 'Produce', '3 cloves garlic, minced'),
  (5, 3, 'tbsp', 'soy sauce', null, 'Pantry', '3 tbsp soy sauce'),
  (6, 1, 'tbsp', 'sesame oil', null, 'Spices & oils', '1 tbsp sesame oil'),
  (7, 2, 'tbsp', 'vegetable oil', null, 'Spices & oils', '2 tbsp vegetable oil'),
  (8, 4, null, 'green onions', 'sliced', 'Produce', '4 green onions, sliced')
) as v(position, quantity, unit, item, note, aisle, raw);

with r as (
  insert into public.recipes (household_id, name, cuisine, protein, meal_type, healthy, servings, notes, created_by)
  values (null, 'Greek Chicken Sheet Pan', 'Mediterranean', 'Chicken', 'Main', true, 4, 'Heat oven to 425°F. Toss chicken thighs, potatoes, red onion and tomatoes with olive oil, lemon, oregano, garlic and salt. Roast 30–35 minutes, then top with feta and olives.', null)
  on conflict do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, position, quantity, unit, item, note, aisle, raw)
select r.id, v.position, v.quantity, v.unit, v.item, v.note, v.aisle, v.raw from r, (values
  (0, 2, 'lb', 'chicken thighs', null, 'Meat & seafood', '2 lb chicken thighs'),
  (1, 1.5, 'lb', 'baby potatoes', 'halved', 'Produce', '1 1/2 lb baby potatoes, halved'),
  (2, 1, null, 'red onion', null, 'Produce', '1 red onion'),
  (3, 1, 'pint', 'cherry tomatoes', null, 'Produce', '1 pint cherry tomatoes'),
  (4, 3, 'tbsp', 'olive oil', null, 'Spices & oils', '3 tbsp olive oil'),
  (5, 1, null, 'lemon', null, 'Produce', '1 lemon'),
  (6, 2, 'tsp', 'dried oregano', null, 'Spices & oils', '2 tsp dried oregano'),
  (7, 3, 'clove', 'garlic', 'minced', 'Produce', '3 cloves garlic, minced'),
  (8, 1, 'tsp', 'salt', null, 'Spices & oils', '1 tsp salt'),
  (9, 0.5, 'cup', 'feta cheese', null, 'Dairy & eggs', '1/2 cup feta cheese'),
  (10, 0.3333333333333333, 'cup', 'kalamata olives', null, 'Canned & jarred', '1/3 cup kalamata olives')
) as v(position, quantity, unit, item, note, aisle, raw);

with r as (
  insert into public.recipes (household_id, name, cuisine, protein, meal_type, healthy, servings, notes, created_by)
  values (null, 'White Chicken Chili', 'American', 'Chicken', 'Soup', true, 6, 'Soften onion and garlic in oil. Add broth, beans, green chiles, cumin and oregano, then the chicken whole. Simmer 20 minutes, shred the chicken, and stir in cream cheese until smooth. Top with cilantro and lime.', null)
  on conflict do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, position, quantity, unit, item, note, aisle, raw)
select r.id, v.position, v.quantity, v.unit, v.item, v.note, v.aisle, v.raw from r, (values
  (0, 1.5, 'lb', 'chicken breast', null, 'Meat & seafood', '1 1/2 lb chicken breast'),
  (1, 1, null, 'yellow onion', 'diced', 'Produce', '1 yellow onion, diced'),
  (2, 3, 'clove', 'garlic', 'minced', 'Produce', '3 cloves garlic, minced'),
  (3, 1, 'tbsp', 'olive oil', null, 'Spices & oils', '1 tbsp olive oil'),
  (4, 4, 'cup', 'chicken broth', null, 'Canned & jarred', '4 cups chicken broth'),
  (5, 2, 'can', 'white beans', 'rinsed', 'Canned & jarred', '2 cans white beans, rinsed'),
  (6, 1, 'can', 'diced green chiles', null, 'Canned & jarred', '1 can diced green chiles'),
  (7, 2, 'tsp', 'ground cumin', null, 'Spices & oils', '2 tsp ground cumin'),
  (8, 1, 'tsp', 'dried oregano', null, 'Spices & oils', '1 tsp dried oregano'),
  (9, 4, 'oz', 'cream cheese', null, 'Dairy & eggs', '4 oz cream cheese'),
  (10, 0.25, 'cup', 'fresh cilantro', null, 'Produce', '1/4 cup fresh cilantro'),
  (11, 1, null, 'lime', null, 'Produce', '1 lime')
) as v(position, quantity, unit, item, note, aisle, raw);

with r as (
  insert into public.recipes (household_id, name, cuisine, protein, meal_type, healthy, servings, notes, created_by)
  values (null, 'Creamy Tuscan Gnocchi', 'Italian', 'Vegetarian', 'Pasta', false, 4, 'Pan-fry the gnocchi in butter until golden and set aside. Cook garlic and sun-dried tomatoes, add cream and parmesan, then wilt in the spinach. Return the gnocchi and toss.', null)
  on conflict do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, position, quantity, unit, item, note, aisle, raw)
select r.id, v.position, v.quantity, v.unit, v.item, v.note, v.aisle, v.raw from r, (values
  (0, 1, 'lb', 'potato gnocchi', null, 'Pantry', '1 lb potato gnocchi'),
  (1, 2, 'tbsp', 'butter', null, 'Dairy & eggs', '2 tbsp butter'),
  (2, 3, 'clove', 'garlic', 'minced', 'Produce', '3 cloves garlic, minced'),
  (3, 0.5, 'cup', 'sun-dried tomatoes', null, 'Canned & jarred', '1/2 cup sun-dried tomatoes'),
  (4, 1, 'cup', 'heavy cream', null, 'Dairy & eggs', '1 cup heavy cream'),
  (5, 0.5, 'cup', 'parmesan cheese', null, 'Dairy & eggs', '1/2 cup parmesan cheese'),
  (6, 4, 'cup', 'baby spinach', null, 'Produce', '4 cups baby spinach'),
  (7, 0.5, 'tsp', 'salt', null, 'Spices & oils', '1/2 tsp salt')
) as v(position, quantity, unit, item, note, aisle, raw);

with r as (
  insert into public.recipes (household_id, name, cuisine, protein, meal_type, healthy, servings, notes, created_by)
  values (null, 'Thai Peanut Noodles', 'Asian', 'Chicken', 'Pasta', false, 4, 'Cook the noodles. Whisk peanut butter, soy sauce, lime juice, honey, sriracha and a splash of hot water into a sauce. Toss noodles with the sauce, shredded chicken, cabbage, carrots and green onions; top with peanuts.', null)
  on conflict do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, position, quantity, unit, item, note, aisle, raw)
select r.id, v.position, v.quantity, v.unit, v.item, v.note, v.aisle, v.raw from r, (values
  (0, 12, 'oz', 'spaghetti', null, 'Pantry', '12 oz spaghetti'),
  (1, 0.5, 'cup', 'peanut butter', null, 'Pantry', '1/2 cup peanut butter'),
  (2, 3, 'tbsp', 'soy sauce', null, 'Pantry', '3 tbsp soy sauce'),
  (3, 1, null, 'lime', null, 'Produce', '1 lime'),
  (4, 1, 'tbsp', 'honey', null, 'Pantry', '1 tbsp honey'),
  (5, 1, 'tsp', 'sriracha', null, 'Pantry', '1 tsp sriracha'),
  (6, 2, 'cup', 'cooked chicken', 'shredded', 'Meat & seafood', '2 cups cooked chicken, shredded'),
  (7, 2, 'cup', 'shredded cabbage', null, 'Produce', '2 cups shredded cabbage'),
  (8, 1, 'cup', 'shredded carrots', null, 'Produce', '1 cup shredded carrots'),
  (9, 4, null, 'green onions', 'sliced', 'Produce', '4 green onions, sliced'),
  (10, 0.25, 'cup', 'peanuts', null, 'Pantry', '1/4 cup peanuts')
) as v(position, quantity, unit, item, note, aisle, raw);

with r as (
  insert into public.recipes (household_id, name, cuisine, protein, meal_type, healthy, servings, notes, created_by)
  values (null, 'Turkey Meatball Subs', 'Italian', 'Ground Turkey', 'Sandwich', false, 4, 'Mix turkey, breadcrumbs, egg, parmesan, garlic and Italian seasoning; roll into meatballs and bake at 400°F for 18 minutes. Simmer in marinara, pile into rolls, top with mozzarella and broil 2 minutes.', null)
  on conflict do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, position, quantity, unit, item, note, aisle, raw)
select r.id, v.position, v.quantity, v.unit, v.item, v.note, v.aisle, v.raw from r, (values
  (0, 1, 'lb', 'ground turkey', null, 'Meat & seafood', '1 lb ground turkey'),
  (1, 0.5, 'cup', 'breadcrumbs', null, 'Pantry', '1/2 cup breadcrumbs'),
  (2, 1, null, 'egg', null, 'Dairy & eggs', '1 egg'),
  (3, 0.25, 'cup', 'parmesan cheese', null, 'Dairy & eggs', '1/4 cup parmesan cheese'),
  (4, 2, 'clove', 'garlic', 'minced', 'Produce', '2 cloves garlic, minced'),
  (5, 1, 'tsp', 'italian seasoning', null, 'Spices & oils', '1 tsp italian seasoning'),
  (6, 1, 'jar', 'marinara', null, 'Canned & jarred', '1 jar marinara'),
  (7, 4, null, 'hoagie rolls', null, 'Bakery', '4 hoagie rolls'),
  (8, 1, 'cup', 'shredded mozzarella cheese', null, 'Dairy & eggs', '1 cup shredded mozzarella cheese')
) as v(position, quantity, unit, item, note, aisle, raw);

with r as (
  insert into public.recipes (household_id, name, cuisine, protein, meal_type, healthy, servings, notes, created_by)
  values (null, 'Beef and Veggie Chili', 'American', 'Beef', 'Soup', true, 6, 'Brown the beef with onion and peppers. Stir in garlic, chili powder and cumin, then the tomatoes, beans and broth. Simmer 30 minutes. Good with cheese, sour cream and cornbread.', null)
  on conflict do nothing returning id
)
insert into public.recipe_ingredients (recipe_id, position, quantity, unit, item, note, aisle, raw)
select r.id, v.position, v.quantity, v.unit, v.item, v.note, v.aisle, v.raw from r, (values
  (0, 1, 'lb', 'ground beef', null, 'Meat & seafood', '1 lb ground beef'),
  (1, 1, null, 'yellow onion', 'diced', 'Produce', '1 yellow onion, diced'),
  (2, 2, null, 'bell peppers', 'diced', 'Produce', '2 bell peppers, diced'),
  (3, 3, 'clove', 'garlic', 'minced', 'Produce', '3 cloves garlic, minced'),
  (4, 2, 'tbsp', 'chili powder', null, 'Spices & oils', '2 tbsp chili powder'),
  (5, 2, 'tsp', 'ground cumin', null, 'Spices & oils', '2 tsp ground cumin'),
  (6, 1, 'can', 'crushed tomatoes', null, 'Canned & jarred', '1 can crushed tomatoes'),
  (7, 2, 'can', 'kidney beans', 'rinsed', 'Canned & jarred', '2 cans kidney beans, rinsed'),
  (8, 1, 'cup', 'beef broth', null, 'Canned & jarred', '1 cup beef broth'),
  (9, 1, 'tsp', 'salt', null, 'Spices & oils', '1 tsp salt')
) as v(position, quantity, unit, item, note, aisle, raw);

