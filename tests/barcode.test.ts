import test from "node:test";
import assert from "node:assert/strict";
import { ean13 } from "../lib/visual-barcode";

test("shared EAN-13 encoder produces standard 95 modules and guard bars", () => {
  const encoded = ean13("4006381333931");
  assert.ok(encoded);
  assert.equal(encoded.code, "4006381333931");
  assert.equal(encoded.bits.length, 95);
  assert.equal(encoded.bits.slice(0, 3), "101");
  assert.equal(encoded.bits.slice(45, 50), "01010");
  assert.equal(encoded.bits.slice(-3), "101");
});

test("shared EAN-13 encoder calculates a check digit and rejects invalid input", () => {
  assert.equal(ean13("400638133393")?.code, "4006381333931");
  assert.equal(ean13("4006381333932"), null);
  assert.equal(ean13("40063813339X1"), null);
  assert.equal(ean13("40063813339"), null);
});
