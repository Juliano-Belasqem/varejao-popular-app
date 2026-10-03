import test from "node:test";
import assert from "node:assert/strict";
import { publicationFailureDisposition } from "../lib/meta/publication-outcome";

test("failure before any Meta call may use retryable error status", () => {
  assert.equal(publicationFailureDisposition(false), "retryable-error");
});
test("lost response after a Meta call requires reconciliation, never retryable error", () => {
  assert.equal(publicationFailureDisposition(true), "reconcile");
});
