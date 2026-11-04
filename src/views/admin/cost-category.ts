/**
 * Each cost category as a band reads it, in the order the costs form offers
 * them. The keys are what is stored; only these words ever reach the screen.
 */
export const COST_CATEGORY_LABEL: Record<string, string> = {
  sound: "Sonido",
  stage: "Tarima",
  promo: "Promoción",
  food: "Comida",
  art: "Arte",
  staff: "Personal",
  photo: "Fotos",
  decor: "Decoración",
  rental: "Alquiler",
  other: "Otro",
};

/** A stored category's name, or the stored value if this version does not know it. */
export function costCategoryLabel(category: string): string {
  return COST_CATEGORY_LABEL[category] ?? category;
}
