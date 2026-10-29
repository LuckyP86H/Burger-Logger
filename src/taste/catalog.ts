import type { Tag } from "./tags";

/** Classic styles to suggest beyond the user's own list, so the daily pick can surprise. */
export interface CatalogBurger {
  slug: string;
  en: string;
  tags: Tag[];
}

export const CATALOG: readonly CatalogBurger[] = [
  {
    slug: "double-smash",
    en: "Double smash cheeseburger",
    tags: ["beef", "smash", "double", "cheesy", "pickles", "onion"],
  },
  {
    slug: "bacon-bbq",
    en: "Smoky bacon BBQ burger",
    tags: ["beef", "thick", "smoky", "bacon", "sweet", "onion"],
  },
  {
    slug: "jalapeno-melt",
    en: "Jalapeño pepper-jack melt",
    tags: ["beef", "spicy", "cheesy", "onion"],
  },
  {
    slug: "mushroom-swiss",
    en: "Mushroom Swiss",
    tags: ["beef", "thick", "mushroom", "cheesy", "rich"],
  },
  {
    slug: "nashville-hot",
    en: "Nashville hot chicken",
    tags: ["chicken", "spicy", "pickles", "rich"],
  },
  {
    slug: "crispy-chicken",
    en: "Crispy buttermilk chicken",
    tags: ["chicken", "fresh", "pickles", "tangy"],
  },
  {
    slug: "fish-tartare",
    en: "Crispy fish with tartare",
    tags: ["fish", "tangy", "fresh", "pickles"],
  },
  {
    slug: "teriyaki-salmon",
    en: "Teriyaki salmon burger",
    tags: ["fish", "sweet", "fresh"],
  },
  {
    slug: "smoky-plant",
    en: "Smoky plant-based stack",
    tags: ["plant", "smoky", "cheesy", "onion"],
  },
  {
    slug: "falafel-herb",
    en: "Falafel with herbs",
    tags: ["plant", "fresh", "tangy"],
  },
  {
    slug: "avocado-veggie",
    en: "Avocado veggie burger",
    tags: ["plant", "avocado", "fresh"],
  },
  {
    slug: "pork-katsu",
    en: "Pork katsu burger",
    tags: ["pork", "tangy", "fresh", "sweet"],
  },
  {
    slug: "bulgogi",
    en: "Bulgogi beef with kimchi",
    tags: ["beef", "sweet", "spicy", "tangy"],
  },
  {
    slug: "lamb-feta",
    en: "Lamb, feta and mint",
    tags: ["lamb", "fresh", "tangy", "cheesy"],
  },
  {
    slug: "breakfast",
    en: "Breakfast burger with fried egg",
    tags: ["beef", "egg", "bacon", "rich", "cheesy"],
  },
  {
    slug: "hawaiian",
    en: "Hawaiian teriyaki pineapple",
    tags: ["beef", "pineapple", "sweet", "smoky"],
  },
  {
    slug: "truffle",
    en: "Truffle butter burger",
    tags: ["beef", "thick", "rich", "mushroom"],
  },
  {
    slug: "oklahoma-onion",
    en: "Oklahoma fried-onion smash",
    tags: ["beef", "smash", "onion", "cheesy"],
  },
  {
    slug: "blue-ribbon",
    en: "Blue cheese & bacon",
    tags: ["beef", "thick", "cheesy", "bacon", "rich", "salty"],
  },
  {
    slug: "spicy-chicken-avocado",
    en: "Spicy chicken avocado",
    tags: ["chicken", "spicy", "avocado", "fresh"],
  },
];
