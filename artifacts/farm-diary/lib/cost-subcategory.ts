// An input used in an activity is a cost under "Inputs". Its subcategory (Fungicide, Fertilizer, Seed…)
// must come from the product itself. It used to be hard-coded to "Fungicide" for everything, which put
// fertilizer and seed under fungicides in every cost breakdown.

export const UNKNOWN_INPUT_SUBCATEGORY = "Other Inputs";

const norm = (s: string) => s.trim().toLocaleLowerCase();

export function resolveInputSubcategory(
  productName: string,
  inventory: readonly { product_name: string; category?: string | null }[],
  catalog: readonly { product: string; category: string }[] = [],
): string {
  const name = norm(productName);
  if (!name) return UNKNOWN_INPUT_SUBCATEGORY;
  const fromStock = inventory.find((item) => norm(item.product_name) === name && item.category && item.category.trim());
  if (fromStock) return fromStock.category!.trim();
  const fromCatalog = catalog.find((item) => norm(item.product) === name);
  if (fromCatalog) return fromCatalog.category;
  return UNKNOWN_INPUT_SUBCATEGORY;
}
