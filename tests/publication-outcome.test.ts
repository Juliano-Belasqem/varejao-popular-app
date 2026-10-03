import test from "node:test";
import assert from "node:assert/strict";
import { publicationFailureDisposition, isAutomaticallyPublishable } from "../lib/meta/publication-outcome";

test("validation or local media failure before any Meta call can be retryable", () => {
  assert.equal(publicationFailureDisposition(false), "retryable-error");
});
test("lost response after Meta request must require manual reconciliation", () => {
  assert.equal(publicationFailureDisposition(true), "reconcile");
});
test("uncertain publishing state is never eligible for scheduled processing", () => {
  assert.equal(isAutomaticallyPublishable("publishing"), false);
  assert.equal(isAutomaticallyPublishable("error"), false);
  assert.equal(isAutomaticallyPublishable("published"), false);
  assert.equal(isAutomaticallyPublishable("scheduled"), true);
});
