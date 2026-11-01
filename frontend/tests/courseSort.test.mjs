import test from "node:test";
import assert from "node:assert/strict";
import { sortCoursesByPrice } from "../src/courseSort.ts";

const courses = [
  { id: 1, price: 1500 },
  { id: 2, price: 500 },
  { id: 3, price: 1000 },
];

test("sorts courses from cheapest to most expensive", () => {
  assert.deepEqual(
    sortCoursesByPrice(courses, "price-asc").map((course) => course.id),
    [1, 2, 3],
  );
});

test("sorts courses from most expensive to cheapest", () => {
  assert.deepEqual(
    sortCoursesByPrice(courses, "price-desc").map((course) => course.id),
    [1, 3, 2],
  );
});

test("keeps the original order by default and never changes the source list", () => {
  const original = courses.map((course) => course.id);
  const result = sortCoursesByPrice(courses, "default");
  assert.deepEqual(
    result.map((course) => course.id),
    original,
  );
  assert.notStrictEqual(result, courses);
  sortCoursesByPrice(courses, "price-asc");
  assert.deepEqual(
    courses.map((course) => course.id),
    original,
  );
});

test("preserves source order for courses with equal prices", () => {
  const equalPrices = [
    { id: 1, price: 900 },
    { id: 2, price: 500 },
    { id: 3, price: 900 },
  ];
  assert.deepEqual(
    sortCoursesByPrice(equalPrices, "price-asc").map((course) => course.id),
    [2, 1, 3],
  );
});
