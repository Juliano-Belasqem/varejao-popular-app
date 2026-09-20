import type {
  VisualDocument,
  VisualElement,
  VisualPage,
  VisualTransform,
} from "./visual-engine";

export type Matrix = [number, number, number, number, number, number];
export const identity: Matrix = [1, 0, 0, 1, 0, 0];
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export function point(m: Matrix, x: number, y: number) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}
export function inverse(m: Matrix): Matrix {
  const d = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(d) < 1e-9) throw new Error("Transformação não invertível.");
  return [
    m[3] / d,
    -m[1] / d,
    -m[2] / d,
    m[0] / d,
    (m[2] * m[5] - m[3] * m[4]) / d,
    (m[1] * m[4] - m[0] * m[5]) / d,
  ];
}
export function matrix(t: VisualTransform): Matrix {
  const r = (t.rotation * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r),
    kx = Math.tan(((t.skewX ?? 0) * Math.PI) / 180),
    ky = Math.tan(((t.skewY ?? 0) * Math.PI) / 180);
  const a = multiply(multiply([c, s, -s, c, 0, 0], [1, ky, kx, 1, 0, 0]), [
    t.scaleX ?? 1,
    0,
    0,
    t.scaleY ?? 1,
    0,
    0,
  ]);
  return [
    ...a.slice(0, 4),
    t.x + t.width / 2 - (a[0] * t.width) / 2 - (a[2] * t.height) / 2,
    t.y + t.height / 2 - (a[1] * t.width) / 2 - (a[3] * t.height) / 2,
  ] as Matrix;
}
export function groupMatrix(el: VisualElement): Matrix {
  return multiply(matrix(el.transform), [
    el.transform.width / (el.groupSize?.width ?? el.transform.width),
    0,
    0,
    el.transform.height / (el.groupSize?.height ?? el.transform.height),
    0,
    0,
  ]);
}
export function parentOf(page: VisualPage, id: string) {
  return page.elements.find(
    (e) => e.type === "group" && e.children?.includes(id),
  );
}
export function parentMatrix(page: VisualPage, id: string): Matrix {
  const parent = parentOf(page, id);
  return parent
    ? multiply(parentMatrix(page, parent.id), groupMatrix(parent))
    : identity;
}
export function worldMatrix(page: VisualPage, el: VisualElement) {
  return multiply(parentMatrix(page, el.id), matrix(el.transform));
}
export function bounds(el: VisualElement, m = matrix(el.transform)) {
  const t = el.transform,
    points = [
      point(m, 0, 0),
      point(m, t.width, 0),
      point(m, 0, t.height),
      point(m, t.width, t.height),
    ];
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p.x)) - x,
    height: Math.max(...points.map((p) => p.y)) - y,
  };
}
export function selectionBounds(page: VisualPage, ids: string[]) {
  const boxes = page.elements
    .filter((e) => ids.includes(e.id))
    .map((e) => bounds(e));
  if (!boxes.length) return { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}
export function isLocked(page: VisualPage, id: string): boolean {
  const e = page.elements.find((e) => e.id === id),
    p = parentOf(page, id);
  return !!e?.locked || (!!p && isLocked(page, p.id));
}
export function rootSelection(page: VisualPage, ids: string[]) {
  return ids.filter((id) => {
    let p = parentOf(page, id);
    while (p) {
      if (ids.includes(p.id)) return false;
      p = parentOf(page, p.id);
    }
    return true;
  });
}
export function descendants(page: VisualPage, ids: string[]): string[] {
  const set = new Set(ids);
  for (const id of ids) {
    const el = page.elements.find((e) => e.id === id);
    for (const child of descendantsOf(el)) set.add(child);
  }
  function descendantsOf(el?: VisualElement): string[] {
    return (el?.children ?? []).flatMap((id) => [
      id,
      ...descendantsOf(page.elements.find((e) => e.id === id)),
    ]);
  }
  return [...set];
}
export function removeElements(page: VisualPage, ids: string[]): VisualPage {
  const all = new Set(
    descendants(
      page,
      rootSelection(page, ids).filter((id) => !isLocked(page, id)),
    ),
  );
  return {
    ...page,
    elements: page.elements
      .filter((e) => !all.has(e.id))
      .map((e) =>
        e.children
          ? { ...e, children: e.children.filter((id) => !all.has(id)) }
          : e,
      ),
  };
}
export function cloneElements(
  page: VisualPage,
  ids: string[],
  idFactory = () => crypto.randomUUID(),
  offset = 20,
) {
  const roots = rootSelection(page, ids),
    all = descendants(page, roots),
    mapping = new Map(all.map((id) => [id, idFactory()]));
  const copies = page.elements
    .filter((e) => all.includes(e.id))
    .map((e) => ({
      ...structuredClone(e),
      id: mapping.get(e.id)!,
      name: `${e.name} (cópia)`,
      children: e.children?.map((id) => mapping.get(id)!),
      transform: {
        ...e.transform,
        x: e.transform.x + (roots.includes(e.id) ? offset : 0),
        y: e.transform.y + (roots.includes(e.id) ? offset : 0),
      },
    }));
  return { elements: copies, ids: roots.map((id) => mapping.get(id)!) };
}
export function groupElements(
  page: VisualPage,
  ids: string[],
  id: string,
): VisualPage {
  const roots = rootSelection(page, ids).filter((i) => !isLocked(page, i));
  if (roots.length < 2) return page;
  const parent = parentOf(page, roots[0]);
  if (roots.some((i) => parentOf(page, i)?.id !== parent?.id))
    throw new Error("Selecione elementos do mesmo grupo para agrupar.");
  const box = selectionBounds(page, roots),
    group: VisualElement = {
      id,
      type: "group",
      name: "Grupo",
      visible: true,
      locked: false,
      children: roots,
      groupSize: { width: box.width, height: box.height },
      transform: {
        ...box,
        rotation: 0,
        opacity: 1,
        layer: Math.max(
          ...page.elements
            .filter((e) => roots.includes(e.id))
            .map((e) => e.transform.layer),
        ),
      },
    };
  return {
    ...page,
    elements: [
      ...page.elements.map((e) =>
        roots.includes(e.id)
          ? {
              ...e,
              transform: {
                ...e.transform,
                x: e.transform.x - box.x,
                y: e.transform.y - box.y,
              },
            }
          : e.id === parent?.id
            ? {
                ...e,
                children: [
                  ...e.children!.filter((i) => !roots.includes(i)),
                  id,
                ],
              }
            : e,
      ),
      group,
    ],
  };
}
/** Decompose a positive-determinant affine transform while preserving element geometry. */
export function transformFromMatrix(
  m: Matrix,
  t: VisualTransform,
): VisualTransform {
  const sx = Math.hypot(m[0], m[1]),
    sy = (m[0] * m[3] - m[1] * m[2]) / sx;
  const width = t.width,
    height = t.height,
    rotation = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  const skewX =
    (Math.atan((m[0] * m[2] + m[1] * m[3]) / (sx * sy)) * 180) / Math.PI;
  const center = point(m, t.width / 2, t.height / 2);
  return {
    ...t,
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    rotation,
    skewX,
    skewY: 0,
    scaleX: sx,
    scaleY: sy,
  };
}
export function ungroupElement(page: VisualPage, id: string): VisualPage {
  const group = page.elements.find((e) => e.id === id);
  if (group?.type !== "group" || isLocked(page, id)) return page;
  const gm = groupMatrix(group),
    parent = parentOf(page, id);
  const siblings = page.elements
    .filter((e) => parentOf(page, e.id)?.id === parent?.id)
    .sort((a, b) => a.transform.layer - b.transform.layer);
  const children = page.elements
    .filter((e) => group.children?.includes(e.id))
    .sort((a, b) => a.transform.layer - b.transform.layer);
  const layers = new Map(
    siblings
      .flatMap((e) => (e.id === id ? children : [e]))
      .map((e, i) => [e.id, i]),
  );
  return {
    ...page,
    elements: page.elements
      .filter((e) => e.id !== id)
      .map((e) =>
        group.children?.includes(e.id)
          ? {
              ...e,
              visible: group.visible && e.visible,
              transform: {
                ...transformFromMatrix(
                  multiply(gm, matrix(e.transform)),
                  e.transform,
                ),
                opacity: group.transform.opacity * e.transform.opacity,
                layer: layers.get(e.id) ?? e.transform.layer,
              },
            }
          : e.id === parent?.id
            ? {
                ...e,
                children: e.children!.flatMap((i) =>
                  i === id ? (group.children ?? []) : [i],
                ),
              }
            : layers.has(e.id)
              ? {
                  ...e,
                  transform: { ...e.transform, layer: layers.get(e.id)! },
                }
              : e,
      ),
  };
}
export function alignElements(
  page: VisualPage,
  ids: string[],
  axis: "left" | "centerX" | "right" | "top" | "centerY" | "bottom",
  toPage = false,
): VisualPage {
  const roots = rootSelection(page, ids).filter((id) => !isLocked(page, id));
  if (!roots.length) return page;
  const parent = parentOf(page, roots[0]);
  if (roots.some((id) => parentOf(page, id)?.id !== parent?.id))
    throw new Error("Alinhe elementos do mesmo grupo.");
  const box =
    toPage || roots.length === 1
      ? {
          x: 0,
          y: 0,
          width:
            parent?.groupSize?.width ?? parent?.transform.width ?? page.width,
          height:
            parent?.groupSize?.height ??
            parent?.transform.height ??
            page.height,
        }
      : selectionBounds(page, roots);
  return {
    ...page,
    elements: page.elements.map((e) => {
      if (!roots.includes(e.id)) return e;
      const b = bounds(e),
        t = { ...e.transform };
      if (axis === "left") t.x += box.x - b.x;
      if (axis === "right") t.x += box.x + box.width - b.x - b.width;
      if (axis === "centerX") t.x += box.x + box.width / 2 - b.x - b.width / 2;
      if (axis === "top") t.y += box.y - b.y;
      if (axis === "bottom") t.y += box.y + box.height - b.y - b.height;
      if (axis === "centerY")
        t.y += box.y + box.height / 2 - b.y - b.height / 2;
      return { ...e, transform: t };
    }),
  };
}
export function distributeElements(
  page: VisualPage,
  ids: string[],
  axis: "x" | "y",
): VisualPage {
  const roots = rootSelection(page, ids).filter((id) => !isLocked(page, id));
  if (roots.length < 3) return page;
  const parent = parentOf(page, roots[0]);
  if (roots.some((id) => parentOf(page, id)?.id !== parent?.id))
    throw new Error("Distribua elementos do mesmo grupo.");
  const sorted = page.elements
    .filter((e) => roots.includes(e.id))
    .map((e) => ({ e, b: bounds(e) }))
    .sort((a, b) => a.b[axis] - b.b[axis]);
  const size = axis === "x" ? "width" : "height",
    first = sorted[0].b,
    last = sorted.at(-1)!.b,
    gap =
      (last[axis] +
        last[size] -
        first[axis] -
        sorted.reduce((sum, i) => sum + i.b[size], 0)) /
      (sorted.length - 1);
  let cursor = first[axis];
  const positions = new Map<string, number>();
  for (const { e, b } of sorted) {
    positions.set(e.id, e.transform[axis] + cursor - b[axis]);
    cursor += b[size] + gap;
  }
  return {
    ...page,
    elements: page.elements.map((e) =>
      positions.has(e.id)
        ? { ...e, transform: { ...e.transform, [axis]: positions.get(e.id)! } }
        : e,
    ),
  };
}
export function reorderElements(
  page: VisualPage,
  ids: string[],
  direction: "front" | "back" | "forward" | "backward",
): VisualPage {
  const roots = rootSelection(page, ids).filter((id) => !isLocked(page, id)),
    parent = parentOf(page, roots[0]);
  const siblings = page.elements
    .filter((e) => parentOf(page, e.id)?.id === parent?.id)
    .sort((a, b) => a.transform.layer - b.transform.layer);
  if (direction === "front" || direction === "back") {
    siblings.sort(
      (a, b) =>
        (Number(roots.includes(a.id)) - Number(roots.includes(b.id))) *
        (direction === "front" ? 1 : -1),
    );
  } else if (direction === "forward") {
    for (let i = siblings.length - 2; i >= 0; i--)
      if (roots.includes(siblings[i].id) && !roots.includes(siblings[i + 1].id))
        [siblings[i], siblings[i + 1]] = [siblings[i + 1], siblings[i]];
  } else {
    for (let i = 1; i < siblings.length; i++)
      if (roots.includes(siblings[i].id) && !roots.includes(siblings[i - 1].id))
        [siblings[i], siblings[i - 1]] = [siblings[i - 1], siblings[i]];
  }
  const layers = new Map(siblings.map((e, i) => [e.id, i]));
  return {
    ...page,
    elements: page.elements.map((e) =>
      layers.has(e.id)
        ? { ...e, transform: { ...e.transform, layer: layers.get(e.id)! } }
        : e,
    ),
  };
}
export function snapPosition(
  box: { x: number; y: number; width: number; height: number },
  targets: { x: number; y: number; width: number; height: number }[],
  threshold: number,
  grid: number,
) {
  let x = box.x,
    y = box.y,
    gx: number | undefined,
    gy: number | undefined;
  for (const axis of ["x", "y"] as const) {
    const size = axis === "x" ? "width" : "height";
    let best = threshold + Number.EPSILON,
      delta = 0,
      guide: number | undefined;
    for (const target of targets)
      for (const a of [0, 0.5, 1])
        for (const b of [0, 0.5, 1]) {
          const d = target[axis] + target[size] * b - box[axis] - box[size] * a;
          if (Math.abs(d) < best) {
            best = Math.abs(d);
            delta = d;
            guide = target[axis] + target[size] * b;
          }
        }
    if (axis === "x") {
      x = guide === undefined && grid ? Math.round(x / grid) * grid : x + delta;
      gx = guide;
    } else {
      y = guide === undefined && grid ? Math.round(y / grid) * grid : y + delta;
      gy = guide;
    }
  }
  return { x, y, gx, gy };
}
export function getPage(doc: VisualDocument, index: number): VisualPage {
  if (index > 0) return doc.pages?.[index - 1] ?? getPage(doc, 0);
  const { version: _, pages: __, ...page } = doc;
  return page;
}
export function setPage(
  doc: VisualDocument,
  index: number,
  page: VisualPage,
): VisualDocument {
  return index === 0
    ? { ...doc, ...page }
    : { ...doc, pages: doc.pages?.map((p, i) => (i === index - 1 ? page : p)) };
}
