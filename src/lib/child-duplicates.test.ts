import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findLikelyDuplicates,
  formatDuplicateBlockMessage,
  isLikelyDuplicateChild,
  normalizePersonName,
} from "@/lib/child-duplicates";

test("normalizePersonName trims and lowercases", () => {
  assert.equal(normalizePersonName("  Juan   Cruz "), "juan cruz");
});

test("isLikelyDuplicateChild matches first+last+birthday", () => {
  assert.equal(
    isLikelyDuplicateChild(
      { firstName: "Juan", lastName: "Dela Cruz", birthday: "2018-05-01" },
      { firstName: "juan", lastName: "dela cruz", birthday: "2018-05-01" },
    ),
    true,
  );
});

test("isLikelyDuplicateChild matches nickname+last against first+last", () => {
  assert.equal(
    isLikelyDuplicateChild(
      {
        firstName: "Juancho",
        lastName: "Dela Cruz",
        nickname: "",
        birthday: "2018-05-01",
      },
      {
        firstName: "Juan",
        lastName: "Dela Cruz",
        nickname: "Juancho",
        birthday: "2018-05-01",
      },
    ),
    true,
  );
});

test("isLikelyDuplicateChild ignores different birthdays", () => {
  assert.equal(
    isLikelyDuplicateChild(
      { firstName: "Juan", lastName: "Dela Cruz", birthday: "2018-05-01" },
      { firstName: "Juan", lastName: "Dela Cruz", birthday: "2019-05-01" },
    ),
    false,
  );
});

test("findLikelyDuplicates returns hits with input indexes", () => {
  const hits = findLikelyDuplicates(
    [
      { firstName: "Ana", lastName: "Reyes", birthday: "2017-01-02" },
      { firstName: "Other", lastName: "Kid", birthday: "2016-01-01" },
    ],
    [
      {
        firstName: "Ana",
        lastName: "Reyes",
        nickname: "",
        birthday: "2017-01-02",
        id: "c1",
      },
    ],
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.inputIndex, 0);
  assert.equal(hits[0]?.existing.id, "c1");
});

test("formatDuplicateBlockMessage lists parent", () => {
  const message = formatDuplicateBlockMessage([
    {
      childFirstName: "Ana",
      childLastName: "Reyes",
      birthday: "2017-01-02",
      parentName: "Maria Reyes",
    },
  ]);
  assert.match(message, /Already registered: Ana Reyes \(birthday 2017-01-02\), parent Maria Reyes/);
  assert.match(message, /Remove the duplicate on List/);
});
