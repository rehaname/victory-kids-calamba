import assert from "node:assert/strict";
import { test } from "node:test";
import { childMatchesQuery } from "@/lib/data/supabase";

const child = {
  firstName: "Noah",
  lastName: "Santos",
  nickname: "Noey",
  parent: { fullName: "Maria Dela Cruz" },
};

test("search matches parent name, nickname, and a comma in the query", () => {
  assert.equal(childMatchesQuery(child, "Dela Cruz"), true);
  assert.equal(childMatchesQuery(child, "noey"), true);
  assert.equal(childMatchesQuery(child, "Cruz, Maria"), false);
  assert.doesNotThrow(() => childMatchesQuery(child, "Cruz, Maria"));
  assert.equal(childMatchesQuery(child, "Santos, Noah"), false);
  assert.equal(childMatchesQuery(child, "Noah Santos"), true);
});
