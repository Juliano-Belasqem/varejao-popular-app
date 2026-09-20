import test from "node:test";
import assert from "node:assert/strict";
import {
  createVisualDocument,
  validateVisualDocument,
  resolveBinding,
  type VisualElement,
} from "../lib/visual-engine";
import {
  alignElements,
  cloneElements,
  distributeElements,
  groupElements,
  ungroupElement,
  worldMatrix,
  point,
  snapPosition,
  reorderElements,
  removeElements,
  isLocked,
  getPage,
  setPage,
} from "../lib/visual-operations";
import { ean13 } from "../lib/visual-barcode";
const element = (id: string, x = 0, y = 0, layer = 0): VisualElement => ({
  id,
  type: "text",
  name: id,
  visible: true,
  locked: false,
  transform: { x, y, width: 100, height: 50, rotation: 0, opacity: 1, layer },
  text: "Test",
});
const document = () => ({
  ...createVisualDocument(),
  elements: [
    element("a", 20, 30, 0),
    element("b", 200, 150, 1),
    element("c", 500, 50, 2),
  ],
});
function near(a: number, b: number) {
  assert.ok(Math.abs(a - b) < 0.000001, `${a} != ${b}`);
}
test("grouping, affine resize/rotate and ungroup preserve all child corners and text size", () => {
  let doc = groupElements(document(), ["a", "b"], "group");
  assert.equal(doc.elements.find((e) => e.id === "a")!.transform.x, 0);
  const group = doc.elements.find((e) => e.id === "group")!;
  group.transform.rotation = 37;
  group.transform.width *= 1.7;
  group.transform.height *= 0.6;
  group.transform.skewX = 14;
  const before = doc.elements
    .filter((e) => ["a", "b"].includes(e.id))
    .map((e) => ({ e, m: worldMatrix(doc, e) }));
  doc = ungroupElement(doc, "group");
  for (const { e, m } of before) {
    const after = doc.elements.find((a) => a.id === e.id)!;
    for (const [x, y] of [
      [0, 0],
      [100, 0],
      [0, 50],
      [100, 50],
    ]) {
      const p = point(m, x, y),
        q = point(worldMatrix(doc, after), x, y);
      near(p.x, q.x);
      near(p.y, q.y);
    }
    assert.equal(after.transform.width, e.transform.width);
  }
  validateVisualDocument({ ...doc, version: 1 });
});
test("clone recursively remaps children; deleting a group leaves no dangling references", () => {
  const doc = groupElements(document(), ["a", "b"], "g");
  let n = 0;
  const copy = cloneElements(doc, ["g", "a"], () => `copy${++n}`);
  assert.equal(copy.elements.length, 3);
  assert.equal(copy.ids.length, 1);
  const combined = { ...doc, elements: [...doc.elements, ...copy.elements] };
  validateVisualDocument({ ...combined, version: 1 });
  const result = removeElements(combined, ["g"]);
  assert.equal(result.elements.length, 4);
  validateVisualDocument({ ...result, version: 1 });
});
test("locked groups protect descendants from deletion and alignment", () => {
  const doc = groupElements(document(), ["a", "b"], "g");
  doc.elements.find((e) => e.id === "g")!.locked = true;
  assert.equal(isLocked(doc, "a"), true);
  assert.deepEqual(removeElements(doc, ["a", "g"]), doc);
  assert.deepEqual(alignElements(doc, ["a"], "left"), doc);
});
test("alignment uses rotated bounds and distribution uses equal gaps", () => {
  const doc = document();
  doc.elements[0].transform.rotation = 90;
  const aligned = alignElements(doc, ["a"], "left");
  const p = point(worldMatrix(aligned, aligned.elements[0]), 0, 50);
  near(p.x, 0);
  const result = distributeElements(document(), ["a", "b", "c"], "x");
  assert.equal(result.elements[1].transform.x, 260);
});
test("layer movement swaps neighbors even with sparse or equal layer values", () => {
  const doc = document();
  doc.elements[1].transform.layer = 100;
  doc.elements[2].transform.layer = 100;
  const result = reorderElements(doc, ["a"], "forward");
  assert.ok(
    result.elements[0].transform.layer > result.elements[1].transform.layer,
  );
  assert.ok(
    result.elements[0].transform.layer < result.elements[2].transform.layer,
  );
});
test("snap chooses nearest target rather than the last target, and free movement is exact", () => {
  const result = snapPosition(
    { x: 98, y: 47, width: 100, height: 50 },
    [
      { x: 100, y: 50, width: 100, height: 50 },
      { x: 104, y: 54, width: 100, height: 50 },
    ],
    6,
    10,
  );
  assert.equal(result.x, 100);
  assert.equal(result.y, 50);
  const free = snapPosition(
    { x: 98.2, y: 47.3, width: 100, height: 50 },
    [],
    0,
    0,
  );
  assert.equal(free.x, 98.2);
  assert.equal(free.y, 47.3);
});
test("legacy documents and additional pages round-trip without losing the first artboard", () => {
  const doc = document();
  const second = getPage(createVisualDocument("A4", 210, 297), 0);
  second.unit = "mm";
  doc.pages = [second];
  const updated = setPage(doc, 1, { ...second, name: "Cartaz" });
  assert.equal(updated.name, doc.name);
  assert.equal(
    getPage(validateVisualDocument(JSON.parse(JSON.stringify(updated))), 1)
      .name,
    "Cartaz",
  );
});
test("validation rejects malformed styles, unsafe sources, cycles, shared children and bad pages", () => {
  for (const patch of [
    { source: "javascript:alert(1)" },
    { textStyle: { fontSize: -1 } },
    {
      shape: {
        kind: "rectangle",
        fill: "red",
        stroke: "#000000",
        strokeWidth: 1,
      },
    },
    { transform: { ...element("a").transform, scaleX: 0 } },
  ]) {
    const doc = document();
    Object.assign(doc.elements[0], patch);
    assert.throws(() => validateVisualDocument(doc));
  }
  const doc = groupElements(document(), ["a", "b"], "g");
  doc.elements.push({ ...element("g2"), type: "group", children: ["a"] });
  assert.throws(() => validateVisualDocument(doc));
  assert.equal(resolveBinding("constructor.name", {}), undefined);
  assert.throws(() =>
    validateVisualDocument({ ...document(), pages: [{ width: -1 }] }),
  );
});
test("EAN13 produces guard bars, 95 modules and validates checksum", () => {
  const result = ean13("4006381333931")!;
  assert.equal(result.bits.length, 95);
  assert.equal(result.bits.slice(0, 3), "101");
  assert.equal(result.bits.slice(45, 50), "01010");
  assert.equal(result.bits.slice(-3), "101");
  assert.equal(ean13("400638133393")?.code, "4006381333931");
  assert.equal(ean13("4006381333932"), null);
  assert.equal(ean13("12"), null);
});
