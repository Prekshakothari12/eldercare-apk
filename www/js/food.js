/* Healthy Recipes — filters + allergy exclusion (no health-condition personalization) */
const FOOD_PROFILE_KEY = "eldercareFoodProfile";
const RECIPE_FILTERS_KEY = "eldercareRecipeFilters";

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast", labelHi: "नाश्ता", icon: "fa-mug-hot" },
  { id: "lunch", label: "Lunch", labelHi: "दोपहर का भोजन", icon: "fa-utensils" },
  { id: "snack", label: "Evening Snack", labelHi: "शाम का नाश्ता", icon: "fa-cookie-bite" },
  { id: "dinner", label: "Dinner", labelHi: "रात का खाना", icon: "fa-bowl-food" }
];

const COOK_TIME_OPTIONS = [
  { id: "any", label: "Any time", labelHi: "कोई भी समय", max: 999 },
  { id: "15", label: "Under 15 min", labelHi: "15 मिनट से कम", max: 15 },
  { id: "30", label: "Under 30 min", labelHi: "30 मिनट से कम", max: 30 },
  { id: "45", label: "Under 45 min", labelHi: "45 मिनट से कम", max: 45 }
];

const DIET_OPTIONS = [
  { id: "any", label: "All diets", labelHi: "सभी आहार" },
  { id: "veg", label: "Vegetarian", labelHi: "शाकाहारी" },
  { id: "egg", label: "Eggetarian", labelHi: "अंडा सहित" },
  { id: "nonveg", label: "Non-vegetarian", labelHi: "मांसाहारी" }
];

/* Allergy matching against ingredients + allergen fields (not name-only) */
const ALLERGY_ALIASES = {
  milk: ["milk", "curd", "dahi", "yogurt", "yoghurt", "butter", "ghee", "paneer", "cheese", "chaas", "buttermilk", "lassi", "cream", "dairy"],
  dairy: ["milk", "curd", "dahi", "yogurt", "yoghurt", "butter", "ghee", "paneer", "cheese", "chaas", "buttermilk", "lassi", "cream", "dairy"],
  दूध: ["milk", "curd", "dahi", "yogurt", "paneer", "cheese", "ghee", "butter", "lassi", "cream"],
  egg: ["egg", "eggs", "omelette", "omelet"],
  eggs: ["egg", "eggs", "omelette", "omelet"],
  अंडा: ["egg", "eggs", "omelette", "omelet"],
  peanut: ["peanut", "peanuts", "groundnut", "groundnuts", "moongphali"],
  peanuts: ["peanut", "peanuts", "groundnut", "groundnuts", "moongphali"],
  मूंगफली: ["peanut", "peanuts", "groundnut", "moongphali"],
  nut: ["nut", "nuts", "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pistachio"],
  nuts: ["nut", "nuts", "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pistachio"],
  fish: ["fish", "rohu", "basa", "salmon", "mackerel", "sardine"],
  shellfish: ["prawn", "prawns", "shrimp", "crab", "lobster", "shellfish"],
  gluten: ["gluten", "wheat", "roti", "phulka", "chapati", "atta", "maida", "semolina", "rava", "daliya", "broken wheat", "bread", "toast", "thepla"],
  wheat: ["gluten", "wheat", "roti", "phulka", "chapati", "atta", "maida", "semolina", "rava", "daliya", "broken wheat", "bread", "toast", "thepla"],
  soy: ["soy", "soya", "tofu", "soybean"],
  coconut: ["coconut", "nariyal"],
  sesame: ["sesame", "til", "tahini"]
};

let recipesCache = null;

/* Embedded fallback so recipes always show even if fetch fails */
const EMBEDDED_RECIPES = [{"id":"veg-daliya","name":"Vegetable Daliya","nameHi":"सब्ज़ी दलिया","description":"Warm broken-wheat porridge with mixed vegetables. High in fibre and gentle on blood sugar.","ingredients":["1 cup daliya (broken wheat)","1 cup mixed vegetables (carrot, peas, beans)","1 tsp cumin seeds","1 tsp oil or ghee","Pinch of turmeric","Salt to taste (low)","2 cups water"],"instructions":["Rinse daliya and set aside.","Heat oil in a pan, add cumin seeds and turmeric.","Add chopped vegetables and sauté for 2–3 minutes.","Add daliya and water. Bring to a boil.","Simmer on low heat for 12–15 minutes until soft.","Serve warm. Optional: squeeze of lemon."],"cookTimeMinutes":25,"mealTypes":["breakfast","dinner"],"dietTypes":["veg"],"healthTags":["diabetes","heart","bp","cholesterol","digestion"],"nutrition":{"calories":240,"protein":8,"fibre":7},"allergens":["gluten"],"matchHints":["high-fibre","suitable-diet","matches-meal"],"descriptionHi":"मिश्रित सब्ज़ियों वाला गरम दलिया। रेशे से भरपूर और ब्लड शुगर के लिए हल्का।","ingredientsHi":["1 कप दलिया (टूटा गेहूँ)","1 कप मिश्रित सब्ज़ियाँ (गाजर, मटर, बीन्स)","1 छोटा चम्मच जीरा","1 छोटा चम्मच तेल या घी","हल्दी चुटकी भर","नमक स्वादानुसार (कम)","2 कप पानी"],"instructionsHi":["दलिया धोकर अलग रखें।","कढ़ाही में तेल गरम करें, जीरा और हल्दी डालें।","कटी सब्ज़ियाँ डालकर 2–3 मिनट भूनें।","दलिया और पानी डालें। उबाल आने दें।","हल्की आँच पर 12–15 मिनट पकाएँ जब तक नरम हो जाए।","गरम परोसें। चाहें तो नींबू निचोड़ें।"]},{"id":"moong-chilla","name":"Moong Dal Chilla","nameHi":"मूंग दाल चिल्ला","description":"Savoury moong-dal pancakes with vegetables. Light protein, easy to digest.","ingredients":["1 cup split yellow moong dal (soaked 2 hrs)","½ cup grated carrot or finely chopped spinach","1 green chilli (optional)","½ tsp cumin powder","Pinch of turmeric","Salt to taste","1 tsp oil for cooking"],"instructions":["Grind soaked moong dal with little water to a smooth batter.","Mix in vegetables, spices and salt.","Heat a non-stick tawa, spread a thin layer of batter.","Cook on medium heat until golden, flip once.","Serve with mint chutney (no sugar)."],"cookTimeMinutes":20,"mealTypes":["breakfast","snack"],"dietTypes":["veg"],"healthTags":["diabetes","anaemia","digestion","cholesterol"],"nutrition":{"calories":180,"protein":12,"fibre":5},"allergens":[],"matchHints":["high-protein","high-fibre","quick"],"descriptionHi":"सब्ज़ियों वाले नमकीन मूंग दाल के चिल्ले। हल्का प्रोटीन, आसानी से पचने वाला।","ingredientsHi":["1 कप धुली पीली मूंग दाल (2 घंटे भिगोई)","½ कप कद्दूकस गाजर या बारीक कटी पालक","1 हरी मिर्च (वैकल्पिक)","½ छोटा चम्मच जीरा पाउडर","हल्दी चुटकी भर","नमक स्वादानुसार","1 छोटा चम्मच तेल"],"instructionsHi":["भिगोई मूंग दाल को थोड़े पानी के साथ पीसकर चिकना घोल बनाएँ।","सब्ज़ियाँ, मसाले और नमक मिलाएँ।","नॉन-स्टिक तवे पर घोल की पतली परत फैलाएँ।","मध्यम आँच पर सुनहरा होने तक पकाएँ, एक बार पलटें।","पुदीने की चटनी (बिना चीनी) के साथ परोसें।"]},{"id":"oats-apple","name":"Oats Porridge with Apple","nameHi":"ओट्स और सेब का दलिया","description":"Simple oats cooked with grated apple. Supports cholesterol management.","ingredients":["½ cup rolled oats","1 small apple (grated)","1 cup low-fat milk or water","Pinch of cinnamon","4–5 soaked almonds (optional)"],"instructions":["Boil milk or water in a small pan.","Add oats and cook for 5–7 minutes, stirring.","Add grated apple and cinnamon; cook 2 more minutes.","Top with chopped soaked almonds if using.","Serve warm without added sugar."],"cookTimeMinutes":12,"mealTypes":["breakfast"],"dietTypes":["veg"],"healthTags":["cholesterol","heart","diabetes","bp"],"nutrition":{"calories":220,"protein":8,"fibre":6},"allergens":["milk","nuts"],"matchHints":["high-fibre","quick","suitable-diet"],"descriptionHi":"कद्दूकस सेब के साथ सादा ओट्स। कोलेस्ट्रॉल नियंत्रण में सहायक।","ingredientsHi":["½ कप रोल्ड ओट्स","1 छोटा सेब (कद्दूकस)","1 कप कम वसा वाला दूध या पानी","दालचीनी चुटकी भर","4–5 भीगे बादाम (वैकल्पिक)"],"instructionsHi":["छोटे बर्तन में दूध या पानी उबालें।","ओट्स डालकर 5–7 मिनट हिलाते हुए पकाएँ।","कद्दूकस सेब और दालचीनी डालें; 2 मिनट और पकाएँ।","चाहें तो कटे भीगे बादाम डालें।","बिना चीनी गरम परोसें।"]},{"id":"idli-sambar","name":"Idli with Light Sambar","nameHi":"इडली और हल्का सांभर","description":"Steamed rice-lentil cakes with vegetable sambar. Low oil and filling.","ingredients":["Idli batter (ready or homemade)","½ cup toor dal","1 cup mixed vegetables (drumstick, carrot, pumpkin)","1 tsp sambar powder","Pinch of turmeric","Few curry leaves","1 tsp oil","Salt to taste"],"instructions":["Steam idlis in an idli stand for 10–12 minutes.","Cook toor dal with turmeric until soft.","In a pan, heat oil, add curry leaves and vegetables; sauté briefly.","Add dal, sambar powder, salt and water; simmer 10 minutes.","Serve 2 idlis with a bowl of sambar."],"cookTimeMinutes":30,"mealTypes":["breakfast","dinner"],"dietTypes":["veg"],"healthTags":["diabetes","digestion","bp","heart"],"nutrition":{"calories":260,"protein":10,"fibre":6},"allergens":[],"matchHints":["high-fibre","suitable-diet","matches-meal"],"descriptionHi":"भाप में पकी इडली और सब्ज़ी वाला हल्का सांभर। कम तेल, पेट भरने वाला।","ingredientsHi":["इडली बैटर (तैयार या घर का)","½ कप अरहर दाल","1 कप मिश्रित सब्ज़ियाँ (सहजन, गाजर, कद्दू)","1 छोटा चम्मच सांभर पाउडर","हल्दी चुटकी भर","कुछ कढ़ी पत्ता","1 छोटा चम्मच तेल","नमक स्वादानुसार"],"instructionsHi":["इडली स्टैंड में 10–12 मिनट भाप में पकाएँ।","अरहर दाल हल्दी के साथ नरम होने तक पकाएँ।","कढ़ाही में तेल गरम करें, कढ़ी पत्ता और सब्ज़ियाँ थोड़ी भूनें।","दाल, सांभर पाउडर, नमक और पानी डालकर 10 मिनट उबालें।","2 इडली एक कटोरी सांभर के साथ परोसें।"]},{"id":"ragi-porridge","name":"Ragi Porridge","nameHi":"रागी जावा","description":"Finger-millet porridge that digests slowly and supports steady energy.","ingredients":["3 tbsp ragi flour","1 cup water","½ cup low-fat milk (optional)","Pinch of cardamom","Jaggery alternative: skip or use very little"],"instructions":["Mix ragi flour with a little cold water to a smooth paste.","Boil remaining water; slowly stir in the paste.","Cook on low heat 6–8 minutes until thick.","Add milk if using; simmer 2 minutes.","Serve warm. Prefer without sugar."],"cookTimeMinutes":15,"mealTypes":["breakfast"],"dietTypes":["veg"],"healthTags":["diabetes","anaemia","bp","heart"],"nutrition":{"calories":160,"protein":5,"fibre":4},"allergens":["milk"],"matchHints":["high-fibre","quick"],"descriptionHi":"कैल्शियम से भरपूर रागी (मंडुआ) का दलिया — हड्डियों और पाचन के लिए अच्छा।","ingredientsHi":["3 बड़े चम्मच रागी आटा","1 कप पानी या कम वसा वाला दूध","चुटकी भर नमक या दालचीनी","1 छोटा चम्मच गुड़ (वैकल्पिक, कम)"],"instructionsHi":["रागी आटा थोड़े ठंडे पानी में घोल लें ताकि गांठें न बनें।","बचा पानी/दूध गरम करें; रागी का घोल डालें।","लगातार हिलाते हुए 5–7 मिनट गाढ़ा होने तक पकाएँ।","नमक या दालचीनी डालें। गुड़ कम इस्तेमाल करें।","गरम परोसें।"]},{"id":"veg-upma","name":"Vegetable Upma","nameHi":"सब्जी उपमा","description":"Semolina cooked with vegetables. Light and fibre-rich when oil is controlled.","ingredients":["½ cup rava (semolina)","½ cup mixed vegetables","1 tsp mustard seeds","Few curry leaves","1 tsp oil","Pinch of turmeric","Salt to taste","1½ cups water"],"instructions":["Dry-roast rava on low heat until aromatic; set aside.","Heat oil, add mustard and curry leaves.","Add vegetables and sauté 3 minutes.","Add water, salt and turmeric; bring to boil.","Add roasted rava slowly while stirring; cook 5 minutes.","Serve hot."],"cookTimeMinutes":20,"mealTypes":["breakfast","snack"],"dietTypes":["veg"],"healthTags":["diabetes","heart","digestion"],"nutrition":{"calories":210,"protein":6,"fibre":4},"allergens":["gluten"],"matchHints":["quick","suitable-diet"],"descriptionHi":"सब्ज़ियों वाला हल्का उपमा — नाश्ते या शाम के नाश्ते के लिए जल्दी तैयार।","ingredientsHi":["½ कप सूजी (रवा)","½ कप मिश्रित सब्ज़ियाँ (गाजर, मटर, बीन्स)","1 छोटा चम्मच तेल","½ छोटा चम्मच राई","कुछ कढ़ी पत्ता","1 हरी मिर्च (वैकल्पिक)","1½ कप पानी","नमक स्वादानुसार"],"instructionsHi":["सूजी को सूखे तवे पर हल्की भूरे रंग तक भूनें; अलग रखें।","तेल में राई, कढ़ी पत्ता और सब्ज़ियाँ भूनें।","पानी और नमक डालकर उबालें।","सूजी डालकर हिलाएँ; ढककर 3–4 मिनट पकाएँ।","गरम परोसें।"]},{"id":"roti-sabzi-dal","name":"Roti, Mixed Sabzi & Dal","nameHi":"रोटी, सब्जी और दाल","description":"Balanced Indian plate with whole-wheat roti, seasonal vegetables and lentils.","ingredients":["2 whole-wheat rotis","1 cup mixed vegetable sabzi (low oil)","1 katori cooked dal (moong or toor)","Cucumber or salad on the side","Pinch of cumin and turmeric in dal"],"instructions":["Cook dal with turmeric and a little cumin until soft.","Prepare sabzi with minimal oil and salt.","Make soft whole-wheat rotis.","Plate: 2 rotis + sabzi + dal + salad.","Avoid extra pickle or papad."],"cookTimeMinutes":35,"mealTypes":["lunch","dinner"],"dietTypes":["veg"],"healthTags":["diabetes","bp","heart","cholesterol"],"nutrition":{"calories":380,"protein":14,"fibre":10},"allergens":["gluten"],"matchHints":["high-protein","high-fibre","suitable-diet"],"descriptionHi":"सादी रोटी, सब्ज़ी और दाल — संतुलित रोज का भोजन।","ingredientsHi":["2 फुलका/रोटी (गेहूँ का आटा)","1 कप कोई भी सब्ज़ी (कम तेल)","½ कप पकी दाल (मूंग या अरहर)","नमक और हल्दी स्वादानुसार"],"instructionsHi":["रोटी तवे पर कम तेल से सेंकें।","सब्ज़ी कम तेल में पकाएँ।","दाल हल्दी-नमक के साथ नरम पकाएँ।","रोटी, सब्ज़ी और दाल एक साथ परोसें।"]},{"id":"brown-khichdi","name":"Brown Rice Khichdi with Curd","nameHi":"ब्राउन राइस खिचड़ी और दही","description":"One-pot rice and dal dish that is light on the stomach.","ingredients":["½ cup brown rice","¼ cup moong dal","1 tsp cumin","Pinch of turmeric","1 tsp oil or ghee","Salt to taste","2 cups water","2 tbsp plain curd (unsweetened)"],"instructions":["Rinse rice and dal together.","Heat oil, add cumin and turmeric.","Add rice, dal, water and salt; pressure-cook 3–4 whistles or simmer 25 minutes.","Serve with a spoon of plain curd.","Keep salt low if you have high BP or kidney concerns."],"cookTimeMinutes":30,"mealTypes":["lunch","dinner"],"dietTypes":["veg"],"healthTags":["digestion","diabetes","thyroid","heart"],"nutrition":{"calories":320,"protein":12,"fibre":6},"allergens":["milk"],"matchHints":["high-fibre","suitable-diet"],"descriptionHi":"ब्राउन राइस और दाल की खिचड़ी — नरम, पाचन के लिए आसान।","ingredientsHi":["½ कप ब्राउन राइस","¼ कप मूंग दाल","हल्दी चुटकी भर","½ छोटा चम्मच जीरा","1 छोटा चम्मच घी या तेल","2½ कप पानी","नमक स्वादानुसार","½ कप कटी सब्ज़ियाँ (वैकल्पिक)"],"instructionsHi":["चावल और दाल धोएँ।","बर्तन में घी/तेल में जीरा तड़कें।","चावल, दाल, हल्दी, नमक, सब्ज़ियाँ और पानी डालें।","ढककर नरम होने तक 25–30 मिनट पकाएँ।","गरम परोसें।"]},{"id":"lauki-phulka","name":"Lauki Sabzi with Phulka","nameHi":"लौकी सब्जी और फुलका","description":"Bottle gourd cooked lightly; hydrating and kidney-friendly when salt is controlled.","ingredients":["2 cups chopped lauki (bottle gourd)","1 tsp cumin","Pinch of turmeric","1 tsp oil","Salt to taste (low)","2 soft phulkas","Fresh coriander"],"instructions":["Heat oil, add cumin and turmeric.","Add lauki, cover and cook on low heat 12–15 minutes until soft.","Add minimal salt and coriander.","Serve with soft phulkas."],"cookTimeMinutes":25,"mealTypes":["lunch","dinner"],"dietTypes":["veg"],"healthTags":["kidney","bp","diabetes","digestion"],"nutrition":{"calories":220,"protein":6,"fibre":5},"allergens":["gluten"],"matchHints":["suitable-diet","matches-meal"],"descriptionHi":"लौकी की सब्ज़ी और नरम फुलका — हल्का रात का खाना।","ingredientsHi":["1 कप कद्दूकस या कटी लौकी","1 छोटा चम्मच तेल","½ छोटा चम्मच जीरा","हल्दी चुटकी भर","नमक स्वादानुसार","2 फुलका"],"instructionsHi":["तेल में जीरा तड़कें; लौकी, हल्दी, नमक डालें।","ढककर नरम होने तक पकाएँ (थोड़ा पानी डाल सकते हैं)।","गर्म फुलका के साथ परोसें।"]},{"id":"veg-soup-roti","name":"Light Vegetable Soup with Roti","nameHi":"सब्जी सूप और रोटी","description":"Clear vegetable soup paired with one roti — ideal light dinner.","ingredients":["2 cups mixed vegetables (carrot, beans, cabbage, bottle gourd)","1 tsp oil","½ tsp black pepper","Salt to taste","1 whole-wheat roti","Fresh herbs if available"],"instructions":["Chop vegetables into small pieces.","Sauté briefly in oil, add water and simmer 15 minutes.","Season with pepper and little salt.","Serve soup with one soft roti."],"cookTimeMinutes":20,"mealTypes":["dinner"],"dietTypes":["veg"],"healthTags":["heart","bp","digestion","cholesterol"],"nutrition":{"calories":180,"protein":5,"fibre":5},"allergens":["gluten"],"matchHints":["quick","suitable-diet"],"descriptionHi":"मिश्रित सब्ज़ी सूप और एक रोटी — हल्का रात का खाना।","ingredientsHi":["2 कप मिश्रित सब्ज़ियाँ (गाजर, बीन्स, पत्ता गोभी, टमाटर)","1 छोटा चम्मच तेल","काली मिर्च और नमक स्वादानुसार","1 रोटी"],"instructionsHi":["सब्ज़ियाँ तेल में हल्की भूनें।","पानी डालकर नरम होने तक उबालें।","ब्लेंड करें या टुकड़ों में रखें; नमक-मिर्च डालें।","एक रोटी के साथ परोसें।"]},{"id":"roasted-chana","name":"Roasted Chana with Cucumber","nameHi":"भुना चना और खीरा","description":"Crunchy roasted chickpeas with cucumber sticks — low-oil evening snack.","ingredients":["½ cup roasted chana (unsalted preferred)","1 cucumber, cut into sticks","Pinch of chaat masala (optional, low salt)"],"instructions":["Portion roasted chana into a small bowl.","Cut cucumber into sticks.","Sprinkle a tiny pinch of chaat masala if desired.","Eat slowly as a filling snack."],"cookTimeMinutes":5,"mealTypes":["snack"],"dietTypes":["veg"],"healthTags":["diabetes","bp","cholesterol","heart"],"nutrition":{"calories":150,"protein":8,"fibre":6},"allergens":[],"matchHints":["high-protein","high-fibre","quick"],"descriptionHi":"भुना चना — बिना तलने का प्रोटीन वाला नाश्ता।","ingredientsHi":["1 कप भुना चना","चुटकी भर काला नमक या चाट मसाला (वैकल्पिक)"],"instructionsHi":["भुना चना साफ कटोरी में लें।","चाहें तो थोड़ा काला नमक या चाट मसाला छिड़कें।","नाश्ते में खाएँ।"]},{"id":"chaas","name":"Buttermilk (Chaas)","nameHi":"छाछ","description":"Spiced diluted curd drink that cools the stomach and aids digestion.","ingredients":["½ cup plain curd","1 cup cold water","Pinch of roasted cumin powder","Pinch of salt (optional)","Few mint leaves"],"instructions":["Whisk curd until smooth.","Add water and mix well.","Add cumin powder and a little salt if needed.","Garnish with mint. Serve chilled or at room temperature."],"cookTimeMinutes":5,"mealTypes":["snack"],"dietTypes":["veg"],"healthTags":["digestion","bp"],"nutrition":{"calories":60,"protein":3,"fibre":0},"allergens":["milk"],"matchHints":["quick","suitable-diet"],"descriptionHi":"हल्का छाछ (मठा) — पाचन और गर्मी से राहत।","ingredientsHi":["½ कप दही","1 कप पानी","½ छोटा चम्मच भुना जीरा पाउडर","चुटकी भर नमक","पुदीना (वैकल्पिक)"],"instructionsHi":["दही और पानी को अच्छी तरह फेंटें।","जीरा, नमक और पुदीना मिलाएँ।","ठंडा या कमरे के तापमान पर पिएँ।"]},{"id":"sprouts-salad","name":"Steamed Sprouts Salad","nameHi":"स्प्रोउट्स सलाद","description":"Lightly steamed mixed sprouts with cucumber and lemon.","ingredients":["1 cup mixed sprouts (moong, chana)","½ cucumber diced","1 tsp lemon juice","Pinch of black salt or regular salt","Fresh coriander"],"instructions":["Steam sprouts for 3–4 minutes (or use ready steamed).","Mix with cucumber, lemon and salt.","Garnish with coriander.","Serve immediately."],"cookTimeMinutes":10,"mealTypes":["breakfast","snack"],"dietTypes":["veg"],"healthTags":["diabetes","bp","cholesterol","anaemia"],"nutrition":{"calories":140,"protein":10,"fibre":6},"allergens":[],"matchHints":["high-protein","high-fibre","quick"],"descriptionHi":"अंकुरित अनाज का सलाद — विटामिन और रेशे से भरपूर।","ingredientsHi":["1 कप अंकुरित मूंग या चना","½ कटी खीरा","½ कटा टमाटर","1 छोटा चम्मच नींबू रस","चुटकी भर नमक","धनिया पत्ती"],"instructionsHi":["अंकुरित अनाज धोएँ।","खीरा, टमाटर मिलाएँ।","नींबू, नमक और धनिया डालकर मिलाएँ।","तुरंत परोसें।"]},{"id":"veg-poha","name":"Vegetable Poha (Less Oil)","nameHi":"सब्जी पोहा","description":"Flattened rice with peas and vegetables — light when cooked with little oil.","ingredients":["1 cup thick poha","¼ cup peas","1 small onion (optional)","1 tsp mustard seeds","Few curry leaves","1 tsp oil","Pinch of turmeric","Salt to taste","Lemon juice"],"instructions":["Rinse poha and drain; keep soft but not mushy.","Heat oil, add mustard and curry leaves.","Add onion (if using) and peas; cook 3 minutes.","Add turmeric, poha and salt; toss gently 2–3 minutes.","Finish with lemon juice."],"cookTimeMinutes":15,"mealTypes":["breakfast","snack"],"dietTypes":["veg"],"healthTags":["diabetes","digestion"],"nutrition":{"calories":230,"protein":5,"fibre":3},"allergens":[],"matchHints":["quick","suitable-diet"],"descriptionHi":"सब्ज़ियों वाला हल्का पोहा — जल्दी तैयार नाश्ता।","ingredientsHi":["1 कप पतला पोहा","½ कप मिश्रित सब्ज़ियाँ","1 छोटा चम्मच तेल","½ छोटा चम्मच राई","कुछ कढ़ी पत्ता","हल्दी चुटकी भर","नमक स्वादानुसार","नींबू (वैकल्पिक)"],"instructionsHi":["पोहा धोकर 2 मिनट भिगोएँ; पानी निथारें।","तेल में राई, कढ़ी पत्ता और सब्ज़ियाँ भूनें।","हल्दी, नमक, पोहा डालकर 3–4 मिनट मिलाएँ।","नींबू निचोड़कर गरम परोसें।"]},{"id":"dal-soup","name":"Light Dal Soup","nameHi":"हल्की दाल सूप","description":"Thin moong-dal soup with mild spices — easy evening meal.","ingredients":["½ cup yellow moong dal","2 cups water","Pinch of turmeric","½ tsp cumin","1 tsp oil or ghee","Salt to taste","Fresh coriander"],"instructions":["Wash and cook moong dal with turmeric until very soft.","Mash lightly or blend for smoother soup.","Temper cumin in oil; pour over dal.","Adjust consistency with water; season lightly.","Garnish with coriander."],"cookTimeMinutes":25,"mealTypes":["dinner","lunch"],"dietTypes":["veg"],"healthTags":["digestion","kidney","heart","diabetes"],"nutrition":{"calories":160,"protein":10,"fibre":4},"allergens":[],"matchHints":["high-protein","suitable-diet"],"descriptionHi":"पतली दाल का सूप — प्रोटीन और आसानी से पचने वाला।","ingredientsHi":["½ कप मूंग या मसूर दाल","हल्दी चुटकी भर","½ छोटा चम्मच जीरा","1 छोटा चम्मच तेल","नमक स्वादानुसार","अदरक (वैकल्पिक)"],"instructionsHi":["दाल हल्दी के साथ नरम पकाएँ; थोड़ा पतला रखें।","तेल में जीरा (और अदरक) तड़कें।","दाल में मिलाएँ; 2 मिनट उबालें।","गरम सूप के रूप में परोसें।"]},{"id":"boiled-egg-toast","name":"Boiled Egg with Multigrain Toast","nameHi":"उबला अंडा और मल्टीग्रेन टोस्ट","description":"Simple quality protein breakfast without frying.","ingredients":["1–2 eggs","1 slice multigrain toast","Pinch of black pepper","Optional: tomato slices"],"instructions":["Boil eggs for 8–10 minutes; cool and peel.","Toast multigrain bread lightly.","Slice egg; season with pepper.","Serve with toast and tomato if desired."],"cookTimeMinutes":12,"mealTypes":["breakfast"],"dietTypes":["egg"],"healthTags":["anaemia","thyroid"],"nutrition":{"calories":220,"protein":14,"fibre":3},"allergens":["egg","gluten"],"matchHints":["high-protein","quick"],"descriptionHi":"उबला अंडा और सादा टोस्ट — सादा प्रोटीन वाला नाश्ता।","ingredientsHi":["1 उबला अंडा","1 स्लाइस सादा ब्रेड (टोस्ट)","चुटकी भर काली मिर्च और नमक"],"instructionsHi":["अंडा 8–10 मिनट उबालें; छीलें।","ब्रेड टोस्ट करें।","अंडा काटें; नमक-मिर्च छिड़कें।","टोस्ट के साथ परोसें।"]},{"id":"egg-white-omelette","name":"Egg-White Vegetable Omelette","nameHi":"अंडे की सफेदी का वेज ऑमलेट","description":"Egg whites with vegetables — protein with less cholesterol.","ingredients":["2–3 egg whites","2 tbsp chopped onion, tomato, spinach","Pinch of black pepper","1 tsp oil","Salt to taste"],"instructions":["Whisk egg whites with pepper and a little salt.","Heat oil in a non-stick pan; sauté vegetables briefly.","Pour egg whites over vegetables.","Cook on medium heat until set; fold once.","Serve hot."],"cookTimeMinutes":10,"mealTypes":["breakfast"],"dietTypes":["egg"],"healthTags":["cholesterol","heart","anaemia"],"nutrition":{"calories":120,"protein":12,"fibre":1},"allergens":["egg"],"matchHints":["high-protein","quick"],"descriptionHi":"अंडे की सफेदी का ऑमलेट सब्ज़ियों के साथ — कम कोलेस्ट्रॉल।","ingredientsHi":["2 अंडे की सफेदी","2 बड़े चम्मच कटी सब्ज़ियाँ (प्याज़, टमाटर, पालक)","1 छोटा चम्मच तेल","नमक और काली मिर्च"],"instructionsHi":["सफेदी को हल्का फेंटें; नमक-मिर्च मिलाएँ।","तेल गरम करें; सब्ज़ियाँ थोड़ी भूनें।","सफेदी डालें; मध्यम आँच पर पकाएँ।","पलटकर दूसरी तरफ पकाएँ; गरम परोसें।"]},{"id":"grilled-fish-salad","name":"Grilled Fish with Salad & Roti","nameHi":"ग्रिल मछली, सलाद और रोटी","description":"Modest portion of grilled fish with fresh salad — supports heart health.","ingredients":["1 small fish fillet (e.g. rohu or basa)","1 tsp oil","Pinch of turmeric and pepper","Cucumber and tomato salad","1 whole-wheat roti","Lemon juice"],"instructions":["Marinate fish with turmeric, pepper and lemon for 10 minutes.","Grill or pan-sear with 1 tsp oil until cooked through.","Prepare a simple cucumber-tomato salad.","Serve with one roti."],"cookTimeMinutes":25,"mealTypes":["lunch","dinner"],"dietTypes":["nonveg"],"healthTags":["heart","cholesterol","arthritis"],"nutrition":{"calories":320,"protein":28,"fibre":4},"allergens":["fish","gluten"],"matchHints":["high-protein","suitable-diet"],"descriptionHi":"हल्का ग्रिल मछली और सलाद — ओमेगा-3 और प्रोटीन।","ingredientsHi":["100–120 ग्राम मछली का टुकड़ा","1 छोटा चम्मच तेल","नींबू, नमक, काली मिर्च","सलाद: खीरा, टमाटर, सलाद पत्ता"],"instructionsHi":["मछली पर तेल, नींबू, नमक, मिर्च लगाएँ।","तवे या ग्रिल पर दोनों तरफ 4–5 मिनट पकाएँ।","ताज़ा सलाद के साथ परोसें।"]},{"id":"chicken-stew","name":"Light Chicken Stew","nameHi":"हल्का चिकन स्टू","description":"Chicken pieces simmered with vegetables in a light broth — not fried.","ingredients":["100 g boneless chicken","1 cup mixed vegetables (carrot, beans, potato)","1 tsp oil","½ tsp black pepper","Pinch of turmeric","Salt to taste","2 cups water"],"instructions":["Cut chicken into small pieces.","Heat oil; lightly sauté chicken and vegetables.","Add water, turmeric, pepper and salt.","Simmer 20–25 minutes until chicken is tender.","Serve as a bowl of stew (optional: one roti)."],"cookTimeMinutes":35,"mealTypes":["lunch","dinner"],"dietTypes":["nonveg"],"healthTags":["anaemia","thyroid"],"nutrition":{"calories":280,"protein":26,"fibre":3},"allergens":[],"matchHints":["high-protein","suitable-diet"],"descriptionHi":"हल्का चिकन स्टू सब्ज़ियों के साथ — नरम और पौष्टिक।","ingredientsHi":["100 ग्राम चिकन (बिना चमड़ी)","1 कप मिश्रित सब्ज़ियाँ","1 छोटा चम्मच तेल","अदरक-लहसुन थोड़ा","काली मिर्च, नमक","1½ कप पानी"],"instructionsHi":["तेल में अदरक-लहसुन भूनें; चिकन हल्का सेंकें।","सब्ज़ियाँ, पानी, नमक-मिर्च डालें।","ढककर नरम होने तक 20–25 मिनट पकाएँ।","गरम परोसें।"]},{"id":"fish-curry-light","name":"Light Fish Curry with Red Rice","nameHi":"हल्की मछली करी और लाल चावल","description":"Fish in a mild curry with controlled oil, served with a small portion of red rice.","ingredients":["1 small fish piece","1 tsp oil","½ tsp mustard seeds","Pinch of turmeric","½ tsp mild curry powder","½ cup red rice (cooked)","Curry leaves"],"instructions":["Heat oil; add mustard and curry leaves.","Add turmeric, mild curry powder and a little water.","Slide in fish; simmer gently 8–10 minutes.","Serve with ½ cup cooked red rice."],"cookTimeMinutes":30,"mealTypes":["lunch"],"dietTypes":["nonveg"],"healthTags":["heart","arthritis"],"nutrition":{"calories":340,"protein":24,"fibre":3},"allergens":["fish"],"matchHints":["high-protein","suitable-diet"],"descriptionHi":"हल्की मछली करी कम मसाले में — लाल चावल के साथ।","ingredientsHi":["100–120 ग्राम मछली","1 छोटा चम्मच तेल","½ छोटा चम्मच राई","कुछ कढ़ी पत्ता","हल्दी, हल्का करी पाउडर","नमक","½ कप पका लाल चावल"],"instructionsHi":["तेल में राई और कढ़ी पत्ता तड़कें।","हल्दी, हल्का करी पाउडर और थोड़ा पानी डालें।","मछली डालकर धीमी आँच पर 8–10 मिनट पकाएँ।","½ कप लाल चावल के साथ परोसें।"]},{"id":"turmeric-milk","name":"Warm Turmeric Milk (Unsweetened)","nameHi":"हल्दी दूध (बिना चीनी)","description":"Small cup of warm milk with turmeric — traditional comfort drink without sugar.","ingredients":["½ cup low-fat milk","¼ tsp turmeric powder","Pinch of black pepper (optional)"],"instructions":["Warm milk on low heat; do not boil hard.","Stir in turmeric and a pinch of pepper.","Drink warm. Do not add sugar."],"cookTimeMinutes":5,"mealTypes":["snack","dinner"],"dietTypes":["veg"],"healthTags":["arthritis","digestion"],"nutrition":{"calories":70,"protein":4,"fibre":0},"allergens":["milk"],"matchHints":["quick"],"descriptionHi":"बिना चीनी का गरम हल्दी दूध — पारंपरिक आरामदायक पेय।","ingredientsHi":["½ कप कम वसा वाला दूध","¼ छोटा चम्मच हल्दी पाउडर","काली मिर्च चुटकी भर (वैकल्पिक)"],"instructionsHi":["दूध हल्की आँच पर गरम करें; जोर से न उबालें।","हल्दी और काली मिर्च मिलाएँ।","गरम पिएँ। चीनी न डालें।"]},{"id":"cucumber-salad","name":"Cucumber & Tomato Salad","nameHi":"खीरा टमाटर सलाद","description":"Fresh, hydrating salad with lemon — pairs well with any meal.","ingredients":["1 cucumber","1 tomato","1 tsp lemon juice","Pinch of salt (optional)","Fresh coriander"],"instructions":["Dice cucumber and tomato.","Toss with lemon juice and a little salt.","Add coriander. Serve immediately."],"cookTimeMinutes":5,"mealTypes":["lunch","dinner","snack"],"dietTypes":["veg"],"healthTags":["bp","diabetes","kidney","heart"],"nutrition":{"calories":40,"protein":1,"fibre":2},"allergens":[],"matchHints":["quick","high-fibre"],"descriptionHi":"नींबू वाला ताज़ा खीरा-टमाटर सलाद — किसी भी भोजन के साथ।","ingredientsHi":["1 खीरा","1 टमाटर","1 छोटा चम्मच नींबू रस","चुटकी भर नमक (वैकल्पिक)","ताज़ा धनिया"],"instructionsHi":["खीरा और टमाटर काटें।","नींबू और थोड़ा नमक मिलाएँ।","धनिया डालें। तुरंत परोसें।"]},{"id":"methi-thepla-light","name":"Light Methi Thepla with Curd","nameHi":"हल्का मेथी थेपला और दही","description":"One soft fenugreek flatbread with plain curd — skip extra oil.","ingredients":["½ cup whole-wheat flour","2 tbsp chopped methi (fenugreek) leaves","Pinch of turmeric and cumin","Salt to taste","1 tsp oil for rolling","2 tbsp plain curd"],"instructions":["Knead flour with methi, spices, salt and little water into soft dough.","Roll one thin thepla; cook on tawa with minimal oil.","Serve with plain unsweetened curd."],"cookTimeMinutes":20,"mealTypes":["breakfast","snack"],"dietTypes":["veg"],"healthTags":["anaemia","digestion","diabetes"],"nutrition":{"calories":200,"protein":7,"fibre":4},"allergens":["gluten","milk"],"matchHints":["suitable-diet"],"descriptionHi":"एक नरम मेथी थेपला और सादा दही — कम तेल।","ingredientsHi":["½ कप गेहूँ का आटा","2 बड़े चम्मच कटी मेथी","हल्दी और जीरा चुटकी भर","नमक स्वादानुसार","1 छोटा चम्मच तेल (बेलने के लिए)","2 बड़े चम्मच सादा दही"],"instructionsHi":["आटा, मेथी, मसाले, नमक और थोड़ा पानी से नरम आटा गूँधें।","एक पतला थेपला बेलें; तवे पर कम तेल से सेंकें।","बिना मीठा सादा दही के साथ परोसें।"]},{"id":"palak-dal","name":"Palak Dal","nameHi":"पालक दाल","description":"Spinach cooked with lentils — iron-friendly and fibre-rich.","ingredients":["½ cup toor or moong dal","1 cup chopped spinach","1 tsp cumin","Pinch of turmeric","1 tsp oil","Salt to taste","1–2 garlic cloves (optional)"],"instructions":["Cook dal with turmeric until soft.","In a pan, heat oil; add cumin and garlic if using.","Add spinach; cook until wilted.","Mix in cooked dal; simmer 5 minutes.","Serve with roti or a small portion of rice."],"cookTimeMinutes":30,"mealTypes":["lunch","dinner"],"dietTypes":["veg"],"healthTags":["anaemia","diabetes","bp","heart"],"nutrition":{"calories":200,"protein":12,"fibre":6},"allergens":[],"matchHints":["high-protein","high-fibre"],"descriptionHi":"पालक वाली दाल — आयरन और रेशे से भरपूर।","ingredientsHi":["½ कप अरहर या मूंग दाल","1 कप कटी पालक","1 छोटा चम्मच जीरा","हल्दी चुटकी भर","1 छोटा चम्मच तेल","नमक स्वादानुसार","1–2 लहसुन की कलियाँ (वैकल्पिक)"],"instructionsHi":["दाल हल्दी के साथ नरम पकाएँ।","कढ़ाही में तेल गरम करें; जीरा और लहसुन डालें।","पालक डालकर मुरझाने तक पकाएँ।","पकी दाल मिलाकर 5 मिनट उबालें।","रोटी या थोड़ा चावल के साथ परोसें।"]},{"id":"bajra-roti-sabzi","name":"Bajra Roti with Mixed Sabzi","nameHi":"बाजरा रोटी और सब्जी","description":"Millet flatbread with vegetables — good alternative to refined grains.","ingredients":["½ cup bajra (pearl millet) flour","Warm water for dough","1 cup mixed vegetable sabzi","Pinch of salt","1 tsp ghee or oil (optional)"],"instructions":["Knead bajra flour with warm water into soft dough.","Pat into a thick roti; cook on tawa on both sides.","Serve with low-oil mixed sabzi."],"cookTimeMinutes":25,"mealTypes":["lunch","dinner"],"dietTypes":["veg"],"healthTags":["diabetes","heart","bp","cholesterol"],"nutrition":{"calories":280,"protein":8,"fibre":7},"allergens":[],"matchHints":["high-fibre","suitable-diet"],"descriptionHi":"बाजरे की रोटी और मिश्रित सब्ज़ी — मैदा के विकल्प के रूप में अच्छा।","ingredientsHi":["½ कप बाजरा आटा","गर्म पानी (आटे के लिए)","1 कप मिश्रित सब्ज़ी","चुटकी भर नमक","1 छोटा चम्मच घी या तेल (वैकल्पिक)"],"instructionsHi":["बाजरा आटा गर्म पानी से नरम गूँधें।","मोटी रोटी बनाकर तवे पर दोनों तरफ सेंकें।","कम तेल वाली मिश्रित सब्ज़ी के साथ परोसें।"]},{"id":"fruit-bowl","name":"Seasonal Fruit Bowl","nameHi":"मौसमी फल का बाउल","description":"A small bowl of seasonal whole fruit — better than juice for sugar control.","ingredients":["1 small apple or guava or orange segments","Optional: 2–3 soaked almonds"],"instructions":["Wash and cut fruit into bite-sized pieces.","Serve as a mid-morning or evening snack.","Avoid adding sugar or honey."],"cookTimeMinutes":5,"mealTypes":["snack","breakfast"],"dietTypes":["veg"],"healthTags":["diabetes","digestion","heart"],"nutrition":{"calories":80,"protein":1,"fibre":3},"allergens":["nuts"],"matchHints":["quick","high-fibre"],"descriptionHi":"मौसमी फलों का कटोरा — प्राकृतिक मिठास, बिना चीनी।","ingredientsHi":["1 कप कटे मौसमी फल (सेब, पपीता, संतरा, अमरूद आदि)","नींबू चुटकी भर (वैकल्पिक)"],"instructionsHi":["फल धोकर काटें।","चाहें तो थोड़ा नींबू छिड़कें।","तुरंत खाएँ।"]},{"id":"vegetable-stew","name":"Vegetable Stew with Appam or Roti","nameHi":"वेजिटेबल स्टू","description":"Mild coconut-light vegetable stew — gentle for evening digestion.","ingredients":["2 cups mixed vegetables (carrot, beans, potato, peas)","½ cup thin coconut milk (optional, light)","1 tsp oil","Few curry leaves","Pinch of pepper","Salt to taste"],"instructions":["Sauté vegetables lightly in oil with curry leaves.","Add water and simmer until soft.","Stir in thin coconut milk if using; heat gently — do not boil hard.","Serve with one appam or roti."],"cookTimeMinutes":25,"mealTypes":["dinner"],"dietTypes":["veg"],"healthTags":["digestion","heart"],"nutrition":{"calories":200,"protein":5,"fibre":5},"allergens":["coconut"],"matchHints":["suitable-diet"],"descriptionHi":"हल्का नारियल वाला सब्ज़ी स्टू — शाम के पाचन के लिए नरम।","ingredientsHi":["2 कप मिश्रित सब्ज़ियाँ (गाजर, बीन्स, आलू, मटर)","½ कप पतला नारियल दूध (वैकल्पिक, हल्का)","1 छोटा चम्मच तेल","कुछ कढ़ी पत्ता","काली मिर्च चुटकी भर","नमक स्वादानुसार"],"instructionsHi":["तेल में कढ़ी पत्ता के साथ सब्ज़ियाँ हल्की भूनें।","पानी डालकर नरम होने तक उबालें।","पतला नारियल दूध मिलाएँ; हल्की आँच पर गरम करें — जोर से न उबालें।","एक अप्पम या रोटी के साथ परोसें।"]},{"id":"jeera-water","name":"Warm Jeera Water","nameHi":"जीरा पानी","description":"Simple cumin water to start the day and ease digestion.","ingredients":["1 cup water","½ tsp cumin seeds"],"instructions":["Boil water with cumin seeds for 3–4 minutes.","Strain and sip warm.","Do not add sugar."],"cookTimeMinutes":5,"mealTypes":["breakfast"],"dietTypes":["veg"],"healthTags":["digestion","bp","diabetes"],"nutrition":{"calories":5,"protein":0,"fibre":0},"allergens":[],"matchHints":["quick"],"descriptionHi":"सादा जीरा पानी — दिन की शुरुआत और पाचन के लिए।","ingredientsHi":["1 कप पानी","½ छोटा चम्मच जीरा"],"instructionsHi":["पानी और जीरा 3–4 मिनट उबालें।","छानकर गरम पिएँ।","चीनी न डालें।"]},{"id":"sundal","name":"Light Sundal (Chickpea Snack)","nameHi":"हल्का सुंडल","description":"Tempered boiled chickpeas — protein snack without deep frying.","ingredients":["1 cup boiled chickpeas (or chana)","1 tsp oil","½ tsp mustard seeds","Few curry leaves","Pinch of salt","Grated coconut optional (1 tsp)"],"instructions":["Heat oil; add mustard and curry leaves.","Add boiled chickpeas and salt; toss 2 minutes.","Optional light coconut garnish.","Serve warm or at room temperature."],"cookTimeMinutes":10,"mealTypes":["snack"],"dietTypes":["veg"],"healthTags":["diabetes","anaemia","cholesterol"],"nutrition":{"calories":170,"protein":9,"fibre":6},"allergens":["coconut"],"matchHints":["high-protein","high-fibre","quick"],"descriptionHi":"तड़के वाला उबला चना — बिना तलने का प्रोटीन नाश्ता।","ingredientsHi":["1 कप उबला चना","1 छोटा चम्मच तेल","½ छोटा चम्मच राई","कुछ कढ़ी पत्ता","चुटकी भर नमक","कद्दूकस नारियल वैकल्पिक (1 छोटा चम्मच)"],"instructionsHi":["तेल गरम करें; राई और कढ़ी पत्ता डालें।","उबला चना और नमक डालकर 2 मिनट मिलाएँ।","चाहें तो हल्का नारियल छिड़कें।","गरम या कमरे के तापमान पर परोसें।"]}];

async function loadRecipes() {
  if (recipesCache && recipesCache.length) return recipesCache;
  const paths = ["data/recipes.json", "./data/recipes.json", "/data/recipes.json"];
  for (const path of paths) {
    try {
      const r = await fetch(path, { cache: "no-store" });
      if (!r.ok) continue;
      const data = await r.json();
      if (Array.isArray(data) && data.length) {
        recipesCache = data;
        return recipesCache;
      }
    } catch (e) {
      console.warn("loadRecipes try", path, e);
    }
  }
  console.warn("loadRecipes: using embedded recipe list");
  recipesCache = Array.isArray(EMBEDDED_RECIPES) ? EMBEDDED_RECIPES.slice() : [];
  return recipesCache;
}

function foodLang() {
  try {
    if (typeof activeLanguage !== "undefined") return activeLanguage === "hi" ? "hi" : "en";
  } catch (e) {}
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("language") === "hi") return "hi";
  } catch (e) {}
  return "en";
}

function L(en, hi) {
  return foodLang() === "hi" ? hi : en;
}

function loadFoodProfile() {
  let profile;
  try {
    profile = JSON.parse(localStorage.getItem(FOOD_PROFILE_KEY) || "null");
  } catch (e) {
    profile = null;
  }
  if (!profile) profile = { allergies: "" };
  return { allergies: profile.allergies || "" };
}

function saveFoodProfile(profile) {
  let prev = {};
  try {
    prev = JSON.parse(localStorage.getItem(FOOD_PROFILE_KEY) || "{}") || {};
  } catch (e) {}
  localStorage.setItem(
    FOOD_PROFILE_KEY,
    JSON.stringify({ ...prev, allergies: profile.allergies || "" })
  );
}

function loadFilters() {
  try {
    return (
      JSON.parse(localStorage.getItem(RECIPE_FILTERS_KEY) || "null") || {
        diet: "any",
        meal: "any",
        cookTime: "any"
      }
    );
  } catch (e) {
    return { diet: "any", meal: "any", cookTime: "any" };
  }
}

function saveFilters(f) {
  localStorage.setItem(RECIPE_FILTERS_KEY, JSON.stringify(f));
}

function parseAllergies(allergiesStr) {
  return String(allergiesStr || "")
    .toLowerCase()
    .split(/[,;|/]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recipeHasAllergyConflict(recipe, allergyTokens) {
  if (!allergyTokens.length) return false;
  const allergenList = (recipe.allergens || []).map(a => String(a).toLowerCase());
  const ingredientText = (recipe.ingredients || []).join(" ").toLowerCase();
  const haystack = allergenList.join(" ") + " " + ingredientText;

  for (const token of allergyTokens) {
    if (allergenList.some(a => a === token || a.includes(token) || token.includes(a))) return true;
    const aliases = ALLERGY_ALIASES[token] || [token];
    for (const alias of aliases) {
      const a = String(alias).toLowerCase();
      if (allergenList.includes(a)) return true;
      try {
        const re = new RegExp("(?:^|[^a-z\\u0900-\\u097f])" + escapeRegExp(a) + "(?:[^a-z\\u0900-\\u097f]|$)", "i");
        if (re.test(ingredientText) || re.test(haystack)) return true;
      } catch (e) {
        if (ingredientText.includes(a) || haystack.includes(a)) return true;
      }
    }
  }
  return false;
}

/** Diet filter: any = all; veg = pure vegetarian; egg = veg + egg; nonveg = all types */
function dietMatchesFilter(recipeDietTypes, filterDiet) {
  if (!filterDiet || filterDiet === "any") return true;
  const types = recipeDietTypes || ["veg"];
  if (filterDiet === "veg") {
    return types.includes("veg") && !types.includes("egg") && !types.includes("nonveg");
  }
  if (filterDiet === "egg") {
    return (types.includes("veg") || types.includes("egg")) && !types.includes("nonveg");
  }
  if (filterDiet === "nonveg") {
    return types.includes("nonveg");
  }
  return true;
}

/**
 * Filter recipes by diet, meal, cooking time, and allergies.
 * Stable dataset order — no random selection. No health-condition logic.
 */
function filterRecipes(allRecipes, filters, allergiesStr) {
  const allergyTokens = parseAllergies(allergiesStr);
  const mealFilter = filters.meal || "any";
  const dietFilter = filters.diet || "any";
  const cookOpt =
    COOK_TIME_OPTIONS.find(c => c.id === (filters.cookTime || "any")) || COOK_TIME_OPTIONS[0];

  return allRecipes.filter(recipe => {
    if (recipeHasAllergyConflict(recipe, allergyTokens)) return false;
    if (!dietMatchesFilter(recipe.dietTypes, dietFilter)) return false;
    const cookMins = Number(recipe.cookTimeMinutes) || 30;
    if (cookMins > cookOpt.max) return false;
    const mealTypes = recipe.mealTypes || [];
    if (mealFilter !== "any" && !mealTypes.includes(mealFilter)) return false;
    return true;
  });
}

function recipeDisplayName(recipe) {
  if (foodLang() === "hi" && recipe.nameHi) return recipe.nameHi;
  return recipe.name || "";
}

function recipeDescription(recipe) {
  if (foodLang() === "hi" && recipe.descriptionHi) return recipe.descriptionHi;
  return recipe.description || "";
}

function recipeIngredients(recipe) {
  if (foodLang() === "hi" && Array.isArray(recipe.ingredientsHi) && recipe.ingredientsHi.length)
    return recipe.ingredientsHi;
  return recipe.ingredients || [];
}

function recipeInstructions(recipe) {
  if (foodLang() === "hi" && Array.isArray(recipe.instructionsHi) && recipe.instructionsHi.length)
    return recipe.instructionsHi;
  return recipe.instructions || [];
}

function mealTypeLabel(id) {
  const m = MEAL_TYPES.find(x => x.id === id);
  if (!m) return id;
  return foodLang() === "hi" ? m.labelHi : m.label;
}

function dietTypeLabel(recipe) {
  const hi = foodLang() === "hi";
  const types = recipe.dietTypes || [];
  if (types.includes("nonveg")) return hi ? "मांसाहारी" : "Non-vegetarian";
  if (types.includes("egg")) return hi ? "अंडा सहित" : "Eggetarian";
  return hi ? "शाकाहारी" : "Vegetarian";
}

function safeEsc(s) {
  if (typeof esc === "function") return esc(s);
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAllergyForm(profile) {
  const saved = String(profile.allergies || "").trim();
  return `<form id="food-allergy-form" class="card food-setup recipe-allergy-card recipe-allergy-compact">
    <div class="recipe-allergy-row">
      <label for="allergy-input" class="recipe-allergy-label">${L("Your allergies", "आपकी एलर्जी")}</label>
      <input id="allergy-input" name="allergies" value="${safeEsc(saved)}"
        placeholder="${L("e.g. milk, peanuts, egg", "जैसे: दूध, मूंगफली, अंडा")}" autocomplete="off">
      <button type="submit" class="btn btn-primary recipe-allergy-save">${L("Save", "सेव")}</button>
    </div>
  </form>`;
}


function renderFilterBar(filters) {
  const dietChips = DIET_OPTIONS.map(o => {
    const active = filters.diet === o.id ? " active" : "";
    const label = foodLang() === "hi" ? o.labelHi : o.label;
    return `<button type="button" class="chip recipe-filter-chip${active}" data-filter="diet" data-value="${o.id}">${safeEsc(label)}</button>`;
  }).join("");

  const mealOpts = [{ id: "any", label: L("All meals", "सभी भोजन") }].concat(
    MEAL_TYPES.map(m => ({ id: m.id, label: foodLang() === "hi" ? m.labelHi : m.label }))
  );
  const mealChips = mealOpts
    .map(o => {
      const active = filters.meal === o.id ? " active" : "";
      return `<button type="button" class="chip recipe-filter-chip${active}" data-filter="meal" data-value="${o.id}">${safeEsc(o.label)}</button>`;
    })
    .join("");

  const timeChips = COOK_TIME_OPTIONS.map(o => {
    const active = filters.cookTime === o.id ? " active" : "";
    const label = foodLang() === "hi" ? o.labelHi : o.label;
    return `<button type="button" class="chip recipe-filter-chip${active}" data-filter="cookTime" data-value="${o.id}">${safeEsc(label)}</button>`;
  }).join("");

  return `<div class="card recipe-filters">
    <h2 class="recipe-section-title"><i class="fa-solid fa-sliders" style="color:var(--primary);margin-right:8px"></i>${L("Filters", "फ़िल्टर")}</h2>
    <div class="recipe-filter-group">
      <p class="recipe-filter-label">${L("Diet type", "आहार का प्रकार")}</p>
      <div class="recipe-chip-row" id="filter-diet-row">${dietChips}</div>
    </div>
    <div class="recipe-filter-group">
      <p class="recipe-filter-label">${L("Meal type", "भोजन का प्रकार")}</p>
      <div class="recipe-chip-row" id="filter-meal-row">${mealChips}</div>
    </div>
    <div class="recipe-filter-group">
      <p class="recipe-filter-label">${L("Cooking time", "पकाने का समय")}</p>
      <div class="recipe-chip-row" id="filter-cooktime-row">${timeChips}</div>
    </div>
    <button type="button" class="btn btn-primary recipe-full-btn" id="btn-apply-filters" onclick="window.applyRecipeFilters && window.applyRecipeFilters()">${L("Show recipes", "रेसिपी दिखाएँ")}</button>
  </div>`;
}

window.applyRecipeFilters = async function applyRecipeFilters() {
  try {
    const filters = (typeof readFiltersFromUI === "function") ? readFiltersFromUI() : { diet: "any", meal: "any", cookTime: "any" };
    if (typeof saveFilters === "function") saveFilters(filters);
    recipesCache = null;
    await refreshRecipeResults();
    const results = document.getElementById("recipe-results");
    if (results) {
      results.scrollIntoView({ behavior: "smooth", block: "start" });
      results.classList.add("recipe-results-flash");
      setTimeout(() => results.classList.remove("recipe-results-flash"), 800);
    }
    const count = results ? results.querySelectorAll(".recipe-card").length : 0;
    if (typeof toast === "function") {
      toast(
        count
          ? L(count + " recipes", count + " रेसिपी")
          : L("No recipes match. Try changing filters.", "कोई रेसिपी नहीं। फ़िल्टर बदलें।")
      );
    }
  } catch (e) {
    console.error("applyRecipeFilters", e);
    if (typeof toast === "function") toast(String(e.message || e), true);
  }
};


function renderRecipeCard(recipe) {
  const name = recipeDisplayName(recipe);
  const meals = (recipe.mealTypes || []).map(mealTypeLabel).join(", ");
  const n = recipe.nutrition || {};
  const time = recipe.cookTimeMinutes != null ? recipe.cookTimeMinutes : "—";
  const id = safeEsc(recipe.id);
  return `<article class="card meal-card recipe-card" role="button" tabindex="0" data-recipe-id="${id}">
    <div class="meal-card-head">
      <div class="meal-icon recipe-icon"><i class="fa-solid fa-utensils"></i></div>
      <div class="recipe-card-body">
        <h3 class="recipe-card-title">${safeEsc(name)}</h3>
        <p class="muted recipe-card-meta">${safeEsc(meals)} · ${time} ${L("min", "मिनट")} · ${safeEsc(dietTypeLabel(recipe))}</p>
      </div>
    </div>
    <p class="recipe-card-desc">${safeEsc(recipeDescription(recipe))}</p>
    <p class="recipe-card-nutrition">
      ${n.calories != null ? `<span>${n.calories} kcal</span>` : ""}
      ${n.protein != null ? `<span>· ${L("Protein", "प्रोटीन")} ${n.protein}g</span>` : ""}
      ${n.fibre != null ? `<span>· ${L("Fibre", "फाइबर")} ${n.fibre}g</span>` : ""}
    </p>
    <div class="recipe-card-action">
      <span class="btn btn-primary btn-sm">${L("View recipe", "रेसिपी देखें")}</span>
    </div>
  </article>`;
}

function renderRecipeList(recipes) {
  if (!recipes.length) {
    return `<div class="card empty recipe-empty">
      <div class="empty-icon"><i class="fa-solid fa-bowl-food"></i></div>
      <h2>${L("No recipes found", "कोई रेसिपी नहीं मिली")}</h2>
      <p class="muted">${L(
        "No recipes match your filters or allergies. Try changing filters.",
        "फ़िल्टर या एलर्जी बदलकर देखें।"
      )}</p>
    </div>`;
  }
  return `<div class="stack recipe-list">
    <p class="muted recipe-count">${L(
      recipes.length + " recipes",
      recipes.length + " रेसिपी"
    )}</p>
    ${recipes.map(renderRecipeCard).join("")}
  </div>`;
}

function renderDisclaimer() {
  return `<p class="muted recipe-disclaimer">${L(
    "Healthy recipe ideas for everyday cooking. Not medical advice — follow your doctor's guidance when needed.",
    "रोज़मर्रा के लिए स्वस्थ रेसिपी सुझाव। यह चिकित्सा सलाह नहीं है — ज़रूरत पड़ने पर डॉक्टर की बात मानें।"
  )}</p>`;
}

async function renderHealthyRecipesPage() {
  const profile = loadFoodProfile();
  const filters = loadFilters();
  const all = await loadRecipes();
  const list = filterRecipes(all, filters, profile.allergies);
  const loadError = !all.length
    ? `<div class="card empty"><p class="muted">${L(
        "Could not load recipe list. Check that data/recipes.json is present, then refresh.",
        "रेसिपी सूची लोड नहीं हुई। data/recipes.json चेक करें और रिफ़्रेश करें।"
      )}</p></div>`
    : "";

  /* Order: allergies first, then filters, then recipes */
  return `<div id="food-panel" class="recipe-page stack">
    <div class="card tip-card recipe-hero">
      <h2 class="recipe-hero-title">🥗 ${L("Healthy Recipes", "स्वस्थ रेसिपी")}</h2>
      <p class="recipe-hero-text">${L(
        "Enter allergies, choose filters, then tap Show recipes.",
        "एलर्जी लिखें, फ़िल्टर चुनें, फिर «रेसिपी दिखाएँ» दबाएँ।"
      )}</p>
    </div>
    ${renderAllergyForm(profile)}
    ${renderFilterBar(filters)}
    ${loadError}
    <div id="recipe-results">${renderRecipeList(list)}</div>
    ${renderDisclaimer()}
  </div>`;
}

async function showRecipeDetail(recipeId) {
  const all = await loadRecipes();
  const recipe = all.find(r => r.id === recipeId);
  if (!recipe) {
    if (typeof toast === "function") toast(L("Recipe not found", "रेसिपी नहीं मिली"), true);
    return;
  }
  const name = recipeDisplayName(recipe);
  const n = recipe.nutrition || {};
  const ingredients = recipeIngredients(recipe).map(i => `<li>${safeEsc(i)}</li>`).join("");
  /* Use plain list items — <ol> provides the numbers (avoid 1. 1. double numbering) */
  const steps = recipeInstructions(recipe)
    .map(s => `<li class="recipe-step">${safeEsc(s)}</li>`)
    .join("");
  const meals = (recipe.mealTypes || []).map(mealTypeLabel).join(", ");

  const content = `
    <h2 class="recipe-detail-title">${safeEsc(name)}</h2>
    <p class="muted recipe-detail-desc">${safeEsc(recipeDescription(recipe))}</p>
    <div class="recipe-detail-chips">
      <span class="chip">⏱ ${recipe.cookTimeMinutes != null ? recipe.cookTimeMinutes : "—"} ${L("min", "मिनट")}</span>
      <span class="chip">${safeEsc(meals)}</span>
      <span class="chip">${safeEsc(dietTypeLabel(recipe))}</span>
    </div>
    <div class="card recipe-nutrition-box">
      <strong>${L("Nutrition (approx.)", "पोषण (अनुमानित)")}</strong>
      <p class="recipe-nutrition-line">${n.calories != null ? `${n.calories} kcal` : "—"}
        ${n.protein != null ? ` · ${L("Protein", "प्रोटीन")} ${n.protein}g` : ""}
        ${n.fibre != null ? ` · ${L("Fibre", "फाइबर")} ${n.fibre}g` : ""}</p>
    </div>
    <h3 class="recipe-detail-h">${L("Ingredients", "सामग्री")}</h3>
    <ul class="food-list recipe-ingredients">${ingredients}</ul>
    <h3 class="recipe-detail-h">${L("Preparation steps", "बनाने का तरीका")}</h3>
    <ol class="recipe-steps">${steps}</ol>
    <p class="muted recipe-detail-note">${L(
      "Recipe ideas for everyday cooking — not medical advice.",
      "रोज़मर्रा के लिए रेसिपी सुझाव — चिकित्सा सलाह नहीं।"
    )}</p>
    <button type="button" class="btn btn-primary recipe-full-btn" id="recipe-detail-close">${L("Close", "बंद करें")}</button>
  `;
  if (typeof modal === "function") {
    const backdrop = modal(content);
    const closeBtn = backdrop && backdrop.querySelector("#recipe-detail-close");
    if (closeBtn) closeBtn.addEventListener("click", () => backdrop.remove());
  } else {
    alert(name);
  }
}

function bindAllergyForm() {
  const form = document.getElementById("food-allergy-form");
  if (!form) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const allergies = String(fd.get("allergies") || "").trim();
    saveFoodProfile({ allergies });
    if (typeof toast === "function") toast(L("Allergies saved", "एलर्जी सेव हो गई"));
    await fillFoodPanel();
  });
}

function readFiltersFromUI() {
  const diet =
    document.querySelector('.recipe-filter-chip[data-filter="diet"].active')?.dataset?.value ||
    "any";
  const meal =
    document.querySelector('.recipe-filter-chip[data-filter="meal"].active')?.dataset?.value ||
    "any";
  const cookTime =
    document.querySelector('.recipe-filter-chip[data-filter="cookTime"].active')?.dataset?.value ||
    "any";
  return { diet, meal, cookTime };
}

function bindRecipeFilters() {
  const panel = document.getElementById("food-panel");
  if (!panel) return;

  panel.querySelectorAll(".recipe-filter-chip").forEach(btn => {
    btn.addEventListener("click", async () => {
      const group = btn.dataset.filter;
      panel.querySelectorAll(`.recipe-filter-chip[data-filter="${group}"]`).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const filters = readFiltersFromUI();
      saveFilters(filters);
      await refreshRecipeResults();
    });
  });

  const applyBtn = document.getElementById("btn-apply-filters");
  if (applyBtn) {
    applyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof window.applyRecipeFilters === "function") window.applyRecipeFilters();
    });
  }

  panel.querySelectorAll(".recipe-card").forEach(card => {
    const open = () => {
      const id = card.getAttribute("data-recipe-id");
      if (id) showRecipeDetail(id);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

async function refreshRecipeResults() {
  const results = document.getElementById("recipe-results");
  if (!results) {
    await fillFoodPanel();
    return;
  }
  const profile = loadFoodProfile();
  const filters = loadFilters();
  const all = await loadRecipes();
  const list = filterRecipes(all, filters, profile.allergies);
  results.innerHTML = renderRecipeList(list);

  results.querySelectorAll(".recipe-card").forEach(card => {
    const open = () => {
      const id = card.getAttribute("data-recipe-id");
      if (id) showRecipeDetail(id);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

/** Entry used by app routes */
async function fillFoodPanel() {
  const el = document.getElementById("food-panel");
  if (!el) {
    console.warn("fillFoodPanel: #food-panel not found");
    return;
  }
  try {
    const role = typeof session !== "undefined" ? session?.role : null;
    if (role === "caregiver" || role === "helper") {
      el.innerHTML = `<div class="card"><p class="muted">${L(
        "Healthy recipes are on the family / senior screens.",
        "स्वस्थ रेसिपी फ़ैमिली/सीनियर स्क्रीन पर है।"
      )}</p></div>`;
      return;
    }
    const wrap = document.createElement("div");
    wrap.innerHTML = await renderHealthyRecipesPage();
    const inner = wrap.querySelector("#food-panel") || wrap;
    el.innerHTML = inner.innerHTML;
    if (inner.className) el.className = inner.className;
    bindAllergyForm();
    bindRecipeFilters();
  } catch (err) {
    console.error("fillFoodPanel", err);
    el.innerHTML = `<div class="card"><p class="muted">${L(
      "Could not load recipes. Please refresh.",
      "रेसिपी लोड नहीं हुई। कृपया रिफ़्रेश करें।"
    )}</p><p class="muted">${safeEsc(String(err.message || err))}</p></div>`;
  }
}

window.showRecipeDetail = showRecipeDetail;
window.fillFoodPanel = fillFoodPanel;
window.markMeal = function () {
  /* compatibility no-op */
};
