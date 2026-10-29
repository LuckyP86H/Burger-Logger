import type { Tag } from "./tags";

/** Classic styles to suggest beyond the user's own list, so the daily pick can surprise. */
export interface CatalogBurger {
  slug: string;
  en: string;
  zh: string;
  tags: Tag[];
}

export const CATALOG: readonly CatalogBurger[] = [
  {
    slug: "double-smash",
    en: "Double smash cheeseburger",
    zh: "双层 smash 芝士汉堡",
    tags: ["beef", "smash", "double", "cheesy", "pickles", "onion"],
  },
  {
    slug: "bacon-bbq",
    en: "Smoky bacon BBQ burger",
    zh: "烟熏培根 BBQ 汉堡",
    tags: ["beef", "thick", "smoky", "bacon", "sweet", "onion"],
  },
  {
    slug: "jalapeno-melt",
    en: "Jalapeño pepper-jack melt",
    zh: "墨西哥辣椒杰克奶酪堡",
    tags: ["beef", "spicy", "cheesy", "onion"],
  },
  {
    slug: "mushroom-swiss",
    en: "Mushroom Swiss",
    zh: "蘑菇瑞士芝士堡",
    tags: ["beef", "thick", "mushroom", "cheesy", "rich"],
  },
  {
    slug: "nashville-hot",
    en: "Nashville hot chicken",
    zh: "纳什维尔辣炸鸡堡",
    tags: ["chicken", "spicy", "pickles", "rich"],
  },
  {
    slug: "crispy-chicken",
    en: "Crispy buttermilk chicken",
    zh: "脆皮酪乳鸡堡",
    tags: ["chicken", "fresh", "pickles", "tangy"],
  },
  {
    slug: "fish-tartare",
    en: "Crispy fish with tartare",
    zh: "脆炸鱼堡配塔塔酱",
    tags: ["fish", "tangy", "fresh", "pickles"],
  },
  {
    slug: "teriyaki-salmon",
    en: "Teriyaki salmon burger",
    zh: "照烧三文鱼堡",
    tags: ["fish", "sweet", "fresh"],
  },
  {
    slug: "smoky-plant",
    en: "Smoky plant-based stack",
    zh: "烟熏植物肉叠堡",
    tags: ["plant", "smoky", "cheesy", "onion"],
  },
  {
    slug: "falafel-herb",
    en: "Falafel with herbs",
    zh: "香草法拉费堡",
    tags: ["plant", "fresh", "tangy"],
  },
  {
    slug: "avocado-veggie",
    en: "Avocado veggie burger",
    zh: "牛油果蔬菜堡",
    tags: ["plant", "avocado", "fresh"],
  },
  {
    slug: "pork-katsu",
    en: "Pork katsu burger",
    zh: "猪排堡",
    tags: ["pork", "tangy", "fresh", "sweet"],
  },
  {
    slug: "bulgogi",
    en: "Bulgogi beef with kimchi",
    zh: "韩式烤牛肉泡菜堡",
    tags: ["beef", "sweet", "spicy", "tangy"],
  },
  {
    slug: "lamb-feta",
    en: "Lamb, feta and mint",
    zh: "羊肉菲达奶酪薄荷堡",
    tags: ["lamb", "fresh", "tangy", "cheesy"],
  },
  {
    slug: "breakfast",
    en: "Breakfast burger with fried egg",
    zh: "煎蛋早餐堡",
    tags: ["beef", "egg", "bacon", "rich", "cheesy"],
  },
  {
    slug: "hawaiian",
    en: "Hawaiian teriyaki pineapple",
    zh: "夏威夷照烧菠萝堡",
    tags: ["beef", "pineapple", "sweet", "smoky"],
  },
  {
    slug: "truffle",
    en: "Truffle butter burger",
    zh: "松露黄油堡",
    tags: ["beef", "thick", "rich", "mushroom"],
  },
  {
    slug: "oklahoma-onion",
    en: "Oklahoma fried-onion smash",
    zh: "俄克拉荷马炸洋葱 smash 堡",
    tags: ["beef", "smash", "onion", "cheesy"],
  },
  {
    slug: "blue-ribbon",
    en: "Blue cheese & bacon",
    zh: "蓝纹奶酪培根堡",
    tags: ["beef", "thick", "cheesy", "bacon", "rich", "salty"],
  },
  {
    slug: "spicy-chicken-avocado",
    en: "Spicy chicken avocado",
    zh: "辣味鸡肉牛油果堡",
    tags: ["chicken", "spicy", "avocado", "fresh"],
  },
];
