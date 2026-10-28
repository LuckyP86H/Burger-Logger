import type { Tag } from "./tags";

/** Classic styles to suggest beyond the user's own list, so 今日汉堡 can surprise. */
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
    zh: "双层碾压芝士堡",
    tags: ["beef", "smash", "double", "cheesy", "pickles", "onion"],
  },
  {
    slug: "bacon-bbq",
    en: "Smoky bacon BBQ burger",
    zh: "烟熏培根烧烤堡",
    tags: ["beef", "thick", "smoky", "bacon", "sweet", "onion"],
  },
  {
    slug: "jalapeno-melt",
    en: "Jalapeño pepper-jack melt",
    zh: "墨西哥辣椒芝士堡",
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
    zh: "纳什维尔辣鸡堡",
    tags: ["chicken", "spicy", "pickles", "rich"],
  },
  {
    slug: "crispy-chicken",
    en: "Crispy buttermilk chicken",
    zh: "酥脆酪乳炸鸡堡",
    tags: ["chicken", "fresh", "pickles", "tangy"],
  },
  {
    slug: "fish-tartare",
    en: "Crispy fish with tartare",
    zh: "炸鱼塔塔酱堡",
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
    zh: "烟熏植物肉堡",
    tags: ["plant", "smoky", "cheesy", "onion"],
  },
  {
    slug: "falafel-herb",
    en: "Falafel with herbs",
    zh: "香草鹰嘴豆堡",
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
    zh: "日式炸猪排堡",
    tags: ["pork", "tangy", "fresh", "sweet"],
  },
  {
    slug: "bulgogi",
    en: "Bulgogi beef with kimchi",
    zh: "韩式烤肉泡菜堡",
    tags: ["beef", "sweet", "spicy", "tangy"],
  },
  {
    slug: "lamb-feta",
    en: "Lamb, feta and mint",
    zh: "羊肉菲达薄荷堡",
    tags: ["lamb", "fresh", "tangy", "cheesy"],
  },
  {
    slug: "breakfast",
    en: "Breakfast burger with fried egg",
    zh: "早餐煎蛋堡",
    tags: ["beef", "egg", "bacon", "rich", "cheesy"],
  },
  {
    slug: "hawaiian",
    en: "Hawaiian teriyaki pineapple",
    zh: "夏威夷菠萝堡",
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
    zh: "奥克拉荷马洋葱碾压堡",
    tags: ["beef", "smash", "onion", "cheesy"],
  },
  {
    slug: "blue-ribbon",
    en: "Blue cheese & bacon",
    zh: "蓝纹芝士培根堡",
    tags: ["beef", "thick", "cheesy", "bacon", "rich", "salty"],
  },
  {
    slug: "spicy-chicken-avocado",
    en: "Spicy chicken avocado",
    zh: "辣味鸡肉牛油果堡",
    tags: ["chicken", "spicy", "avocado", "fresh"],
  },
];
