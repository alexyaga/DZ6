export type CourseSortOrder = "default" | "price-asc" | "price-desc";

export function sortCoursesByPrice<T extends { price: number }>(
  courses: readonly T[],
  order: CourseSortOrder,
): T[] {
  const sorted = [...courses];
  if (order === "default") return sorted;
  const direction = order === "price-asc" ? 1 : -1;
  return sorted.sort((left, right) => direction * (left.price - right.price));
}
