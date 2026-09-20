"use client";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  createVisualDocument,
  validateVisualDocument,
  type VisualDocument,
  type VisualElement,
  type VisualPage,
} from "@/lib/visual-engine";
import {
  alignElements,
  bounds,
  cloneElements,
  descendants,
  distributeElements,
  getPage,
  groupElements,
  inverse,
  isLocked,
  matrix,
  parentMatrix,
  parentOf,
  point,
  reorderElements,
  rootSelection,
  selectionBounds,
  setPage,
  snapPosition,
  ungroupElement,
  worldMatrix,
} from "@/lib/visual-operations";
import {
  downloadVisual,
  rasterizeVisual,
  standaloneSvg,
} from "@/lib/visual-export";
import { useBrandKit } from "@/lib/brand-kit/client";
import {
  listVisualOffers,
  listVisualProducts,
  listVisualTemplates,
  listVisualVersions,
  loadVisualTemplate,
  saveVisualTemplate,
} from "@/app/app/editor-visual/actions";
import { VisualRenderer } from "./visual-renderer";
import {
  ElementProperties,
  NumberField,
  PageProperties,
  TextField,
} from "./visual-properties";
import "./visual-editor.css";

const demo = {
  product: {
    name: "Produto de exemplo",
    brand: "Marca",
    specification: "1 kg",
    ean: "7891234567895",
    image: "",
  },
  offer: {
    normalPrice: "12,99",
    price: "9,99",
    priceReais: "9",
    priceCents: "99",
    unit: "UN",
    startsOn: "01/09/2026",
    endsOn: "30/09/2026",
  },
  campaign: { name: "Ofertas da semana" },
};
function seed(): VisualDocument {
  return {
    ...createVisualDocument("Novo template"),
    elements: [
      {
        id: "product",
        type: "text",
        name: "Produto",
        visible: true,
        locked: false,
        binding: "product.name",
        transform: {
          x: 70,
          y: 90,
          width: 750,
          height: 150,
          rotation: 0,
          opacity: 1,
          layer: 0,
        },
        textStyle: { fontSize: 56, fontWeight: 800, color: "#111111" },
      },
      {
        id: "price",
        type: "text",
        name: "Preço",
        visible: true,
        locked: false,
        binding: "offer.price",
        transform: {
          x: 610,
          y: 690,
          width: 350,
          height: 160,
          rotation: 0,
          opacity: 1,
          layer: 1,
        },
        textStyle: {
          fontSize: 110,
          fontWeight: 900,
          color: "#111111",
          textAlign: "center",
        },
      },
    ],
  };
}
const names = {
  text: "Texto",
  image: "Imagem",
  shape: "Forma",
  barcode: "Código de barras",
  group: "Grupo",
};
const handles = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;
type Props = {
  initialDocument?: VisualDocument;
  initialTemplateId?: string;
  initialVersion?: number;
  initialCategory?: string;
  editable?: boolean;
};
export function VisualEngineEditor({
  initialDocument,
  initialTemplateId,
  initialVersion,
  initialCategory = "custom",
  editable = true,
}: Props) {
  const [doc, setDoc] = useState(() => initialDocument ?? seed()),
    docRef = useRef(doc);
  docRef.current = doc;
  const [history, setHistory] = useState<VisualDocument[]>([]),
    [future, setFuture] = useState<VisualDocument[]>([]),
    [pageIndex, setPageIndex] = useState(0),
    [scope, setScope] = useState<string | null>(null),
    [selected, setSelected] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState(initialTemplateId),
    [version, setVersion] = useState(initialVersion),
    [category, setCategory] = useState(initialCategory),
    [saved, setSaved] = useState(
      initialDocument ? JSON.stringify(initialDocument) : "",
    ),
    [savedCategory, setSavedCategory] = useState(initialCategory);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [zoom, setZoom] = useState(60),
    [snap, setSnap] = useState(true),
    [showGrid, setShowGrid] = useState(true),
    [grid, setGrid] = useState(10),
    [preview, setPreview] = useState(false),
    [alignToPage, setAlignToPage] = useState(false),
    [guides, setGuides] = useState<{ x?: number; y?: number }>({}),
    [centerGuides, setCenterGuides] = useState(true),
    [safeArea, setSafeArea] = useState(false),
    [exportScale, setExportScale] = useState(1),
    [activeTool, setActiveTool] = useState<
      "layers" | "elements" | "text" | "images" | "products" | "offers" | "templates" | "components" | "brand" | "uploads"
    >("layers"),
    [layersOpen, setLayersOpen] = useState(true),
    [sidebarOpen, setSidebarOpen] = useState(true),
    [savedComponents, setSavedComponents] = useState<{ id: string; name: string; elements: VisualElement[]; roots: string[] }[]>([]),
    [componentName, setComponentName] = useState("");
  const [templates, setTemplates] = useState<
      Awaited<ReturnType<typeof listVisualTemplates>>
    >({ items: [], hasMore: false }),
    [templatePage, setTemplatePage] = useState(0),
    [libraryId, setLibraryId] = useState(""),
    [versions, setVersions] = useState<
      Awaited<ReturnType<typeof listVisualVersions>>
    >({ items: [], hasMore: false }),
    [versionPage, setVersionPage] = useState(0);
  const [products, setProducts] = useState<
      Awaited<ReturnType<typeof listVisualProducts>>
    >([]),
    [productQuery, setProductQuery] = useState(""),
    [productId, setProductId] = useState("");
  const [offers, setOffers] = useState<
      Awaited<ReturnType<typeof listVisualOffers>>
    >({ items: [], hasMore: false }),
    [offerPage, setOfferPage] = useState(0),
    [offerId, setOfferId] = useState(""),
    [customData, setCustomData] = useState(""),
    [bindingData, setBindingData] = useState<Record<string, unknown> | null>(
      null,
    );
  const brand = useBrandKit(),
    page = getPage(doc, pageIndex),
    current = page.elements.find((e) => e.id === selected[0]),
    visible = page.elements
      .filter((e) => parentOf(page, e.id)?.id === (scope ?? undefined))
      .sort((a, b) => b.transform.layer - a.transform.layer);
  const dirty = JSON.stringify(doc) !== saved || category !== savedCategory,
    locked = busy || !editable;
  const selectedProduct = products.find((item) => item.id === productId),
    selectedOfferData = offers.items.find((o) => o.id === offerId)?.data,
    productPreview = selectedProduct
      ? {
          name: selectedProduct.name,
          brand: selectedProduct.brand ?? "",
          specification: selectedProduct.specification ?? "",
          ean: selectedProduct.ean,
          unit: selectedProduct.unit ?? "",
          salePrice:
            selectedProduct.sale_price == null
              ? ""
              : Number(selectedProduct.sale_price).toFixed(2).replace(".", ","),
          image: selectedProduct.image,
        }
      : undefined,
    data = {
      ...demo,
      ...(bindingData ?? {}),
      ...(selectedOfferData ?? {}),
      product: {
        ...demo.product,
        ...(productPreview ?? {}),
        ...((bindingData?.product as Record<string, unknown> | undefined) ?? {}),
        ...((selectedOfferData?.product as Record<string, unknown> | undefined) ?? {}),
      },
      offer: {
        ...demo.offer,
        ...((bindingData?.offer as Record<string, unknown> | undefined) ?? {}),
        ...((selectedOfferData?.offer as Record<string, unknown> | undefined) ?? {}),
      },
      campaign: {
        ...demo.campaign,
        ...((bindingData?.campaign as Record<string, unknown> | undefined) ?? {}),
        ...((selectedOfferData?.campaign as Record<string, unknown> | undefined) ?? {}),
      },
      brand: { logo: brand.logoUrl ?? "" },
    };
  const svgRef = useRef<SVGSVGElement | null>(null),
    viewport = useRef<HTMLDivElement>(null),
    printRefs = useRef<(SVGSVGElement | null)[]>([]),
    gesture = useRef<(() => void) | null>(null),
    space = useRef(false),
    clipboard = useRef<VisualElement[]>([]);
  const ratio = page.unit === "mm" ? 96 / 25.4 : 1,
    scale = (zoom / 100) * ratio;
  function fail(error: unknown) {
    setMessage(
      error instanceof Error
        ? error.message
        : "Não foi possível concluir a operação.",
    );
  }
  useEffect(() => {
    let active = true;
    listVisualTemplates(templatePage)
      .then((result) => {
        if (active) setTemplates(result);
      })
      .catch(fail);
    return () => {
      active = false;
    };
  }, [templatePage]);
  useEffect(() => {
    if (activeTool !== "products") return;
    const timer = window.setTimeout(() => {
      listVisualProducts(productQuery)
        .then(setProducts)
        .catch(fail);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeTool, productQuery]);
  useEffect(() => {
    let active = true;
    listVisualOffers(offerPage)
      .then((result) => {
        if (active) {
          setOffers(result);
          setOfferId("");
        }
      })
      .catch(fail);
    return () => {
      active = false;
    };
  }, [offerPage]);
  useEffect(() => {
    if (!templateId) return;
    let active = true;
    listVisualVersions(templateId, versionPage)
      .then((result) => {
        if (active) setVersions(result);
      })
      .catch(fail);
    return () => {
      active = false;
    };
  }, [templateId, version, versionPage]);
  useEffect(() => {
    function leave(event: BeforeUnloadEvent) {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  useEffect(
    () => () => {
      gesture.current?.();
    },
    [],
  );
  function commit(next: VisualDocument) {
    if (locked) return;
    const before = docRef.current;
    setHistory((h) => [...h, before]);
    setFuture([]);
    setDoc(next);
    docRef.current = next;
    setMessage("");
  }
  function updatePage(next: VisualPage) {
    commit(setPage(docRef.current, pageIndex, next));
  }
  function operate(fn: () => void) {
    try {
      fn();
    } catch (e) {
      fail(e);
    }
  }
  function patch(value: Partial<VisualElement>) {
    if (!current || locked) return;
    if (
      isLocked(page, current.id) &&
      !(
        Object.keys(value).length === 1 &&
        "locked" in value &&
        !parentOf(page, current.id)?.locked
      )
    )
      return;
    if (value.transform && current.type === "group" && !current.groupSize)
      value = {
        ...value,
        groupSize: {
          width: current.transform.width,
          height: current.transform.height,
        },
      };
    const next = {
      ...page,
      elements: page.elements.map((e) =>
        e.id === current.id ? { ...e, ...value } : e,
      ),
    };
    if (value.transform)
      try {
        validateVisualDocument({ ...next, version: 1 });
      } catch (error) {
        fail(error);
        return;
      }
    updatePage(next);
  }
  function undo() {
    if (locked || !history.length) return;
    gesture.current?.();
    const before = docRef.current;
    setFuture((f) => [before, ...f]);
    const prev = history.at(-1)!;
    setHistory((h) => h.slice(0, -1));
    setDoc(prev);
    docRef.current = prev;
    setSelected([]);
    setScope(null);
    setPageIndex((i) => Math.min(i, prev.pages?.length ?? 0));
  }
  function redo() {
    if (locked || !future.length) return;
    const before = docRef.current;
    setHistory((h) => [...h, before]);
    const next = future[0];
    setFuture((f) => f.slice(1));
    setDoc(next);
    docRef.current = next;
    setSelected([]);
    setScope(null);
    setPageIndex((i) => Math.min(i, next.pages?.length ?? 0));
  }
  function selectPage(index: number) {
    gesture.current?.();
    setPageIndex(index);
    setSelected([]);
    setScope(null);
  }
  function siblingsInsert(elements: VisualElement[], ids: string[]) {
    const parent = scope
      ? page.elements.find((e) => e.id === scope)
      : undefined;
    if (parent && isLocked(page, parent.id)) return;
    const top = Math.max(-1, ...visible.map((e) => e.transform.layer));
    const result = elements.map((e) =>
      ids.includes(e.id)
        ? {
            ...e,
            transform: { ...e.transform, layer: top + 1 + ids.indexOf(e.id) },
          }
        : e,
    );
    updatePage({
      ...page,
      elements: [
        ...page.elements.map((e) =>
          e.id === parent?.id
            ? { ...e, children: [...(e.children ?? []), ...ids] }
            : e,
        ),
        ...result,
      ],
    });
    setSelected(ids);
  }
  function add(type: VisualElement["type"]) {
    const id = crypto.randomUUID(),
      unit = page.unit === "mm" ? 0.2 : 1;
    const element: VisualElement = {
      id,
      type,
      name: names[type],
      visible: true,
      locked: false,
      transform: {
        x: 50 * unit,
        y: 50 * unit,
        width: 260 * unit,
        height: 100 * unit,
        rotation: 0,
        opacity: 1,
        layer: 0,
      },
      text:
        type === "text"
          ? "Texto"
          : type === "barcode"
            ? "7891234567895"
            : undefined,
      textStyle:
        type === "text"
          ? {
              fontFamily: brand.fieldFonts.body,
              fontSize: 48 * unit,
              color: "#111111",
            }
          : undefined,
      shape:
        type === "shape"
          ? {
              kind: "rectangle",
              fill: brand.primaryColor,
              stroke: "#111111",
              strokeWidth: unit,
            }
          : undefined,
    };
    siblingsInsert([element], [id]);
  }
  function remove() {
    const ids = rootSelection(page, selected).filter(
        (id) => !isLocked(page, id),
      ),
      all = new Set(descendants(page, ids));
    updatePage({
      ...page,
      elements: page.elements
        .filter((e) => !all.has(e.id))
        .map((e) =>
          e.children
            ? { ...e, children: e.children.filter((id) => !all.has(id)) }
            : e,
        ),
    });
    setSelected([]);
  }
  function copy() {
    clipboard.current = cloneElements(
      page,
      selected,
      () => crypto.randomUUID(),
      0,
    ).elements;
    setMessage("Elementos copiados. Use Ctrl/Cmd+V para colar.");
  }
  function paste() {
    if (!clipboard.current.length) return;
    const source = { ...page, elements: clipboard.current },
      roots = source.elements
        .filter((e) => !parentOf(source, e.id))
        .map((e) => e.id),
      result = cloneElements(source, roots);
    siblingsInsert(result.elements, result.ids);
  }
  function duplicate() {
    const result = cloneElements(page, selected);
    siblingsInsert(result.elements, result.ids);
  }
  function saveComponent() {
    const roots = rootSelection(page, selected);
    if (!roots.length) return;
    const ids = descendants(page, roots);
    const elements = page.elements.filter((e) => ids.includes(e.id)).map((e) => structuredClone(e));
    const name = componentName.trim() || (roots.length === 1 ? page.elements.find((e) => e.id === roots[0])?.name : "") || `Componente ${savedComponents.length + 1}`;
    setSavedComponents((items) => [...items, { id: crypto.randomUUID(), name, elements, roots }]);
    setComponentName("");
    setMessage(`Componente “${name}” salvo nesta sessão.`);
  }
  function insertComponent(component: { elements: VisualElement[]; roots: string[] }) {
    const source: VisualPage = { ...page, elements: component.elements };
    const result = cloneElements(source, component.roots);
    siblingsInsert(result.elements, result.ids);
  }
  function group() {
    operate(() => {
      const id = crypto.randomUUID(),
        next = groupElements(page, selected, id);
      if (next !== page) {
        updatePage(next);
        setSelected([id]);
      }
    });
  }
  function ungroup() {
    if (!current) return;
    updatePage(ungroupElement(page, current.id));
    setSelected(current.children ?? []);
  }
  function moveBy(dx: number, dy: number) {
    const ids = rootSelection(page, selected).filter(
      (id) => !isLocked(page, id),
    );
    updatePage({
      ...page,
      elements: page.elements.map((e) =>
        ids.includes(e.id)
          ? {
              ...e,
              transform: {
                ...e.transform,
                x: e.transform.x + dx,
                y: e.transform.y + dy,
              },
            }
          : e,
      ),
    });
  }
  function canvasPoint(x: number, y: number) {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(x, y).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
  function startGesture(
    event: ReactPointerEvent,
    move: (e: PointerEvent) => VisualPage,
  ) {
    if (locked || preview) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.current?.();
    const before = docRef.current;
    let changed = false;
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      try {
        const next = move(e);
        changed = true;
        const updated = setPage(before, pageIndex, next);
        docRef.current = updated;
        setDoc(updated);
      } catch (error) {
        fail(error);
        cancel();
      }
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      gesture.current = null;
      setGuides({});
    };
    const cancel = () => {
      cleanup();
      if (changed) {
        docRef.current = before;
        setDoc(before);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      cleanup();
      if (changed) {
        setHistory((h) => [...h, before]);
        setFuture([]);
      }
    };
    gesture.current = cancel;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
  }
  function drag(event: ReactPointerEvent, id: string) {
    if (space.current || event.button === 1) {
      pan(event);
      return;
    }
    if (event.button !== 0) return;
    if (event.shiftKey) {
      setSelected((ids) =>
        ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
      );
      event.stopPropagation();
      return;
    }
    const ids = selected.includes(id) ? selected : [id];
    setSelected(ids);
    event.stopPropagation();
    if (isLocked(page, id)) return;
    const moveIds = rootSelection(page, ids).filter((i) => !isLocked(page, i)),
      base = selectionBounds(page, moveIds),
      inv = inverse(parentMatrix(page, id)),
      cp = canvasPoint(event.clientX, event.clientY),
      start = point(inv, cp.x, cp.y);
    const targets = visible
      .filter((e) => !moveIds.includes(e.id) && e.visible)
      .map((e) => bounds(e));
    const parent = parentOf(page, id);
    const parentWidth =
        parent?.groupSize?.width ?? parent?.transform.width ?? page.width,
      parentHeight =
        parent?.groupSize?.height ?? parent?.transform.height ?? page.height;
    targets.push({
      x: 0,
      y: 0,
      width: parentWidth,
      height: parentHeight,
    });
    if (centerGuides) {
      targets.push(
        { x: parentWidth / 2, y: 0, width: 0, height: parentHeight },
        { x: 0, y: parentHeight / 2, width: parentWidth, height: 0 },
      );
    }
    startGesture(event, (e) => {
      const cp = canvasPoint(e.clientX, e.clientY),
        p = point(inv, cp.x, cp.y);
      let dx = p.x - start.x,
        dy = p.y - start.y;
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      if (snap && !e.altKey) {
        const snapped = snapPosition(
          { ...base, x: base.x + dx, y: base.y + dy },
          targets,
          6 / scale,
          grid,
        );
        dx = snapped.x - base.x;
        dy = snapped.y - base.y;
        setGuides({ x: snapped.gx, y: snapped.gy });
      } else setGuides({});
      return {
        ...page,
        elements: page.elements.map((el) =>
          moveIds.includes(el.id)
            ? {
                ...el,
                transform: {
                  ...el.transform,
                  x: el.transform.x + dx,
                  y: el.transform.y + dy,
                },
              }
            : el,
        ),
      };
    });
  }
  function resize(
    event: ReactPointerEvent,
    el: VisualElement,
    hx: number,
    hy: number,
  ) {
    const original = el.transform,
      localInverse = inverse(worldMatrix(page, el)),
      m = matrix(original);
    startGesture(event, (e) => {
      const cp = canvasPoint(e.clientX, e.clientY),
        p = point(localInverse, cp.x, cp.y);
      let left = hx < 0 ? Math.min(p.x, original.width - 0.1) : 0,
        top = hy < 0 ? Math.min(p.y, original.height - 0.1) : 0,
        right = hx > 0 ? Math.max(0.1, p.x) : original.width,
        bottom = hy > 0 ? Math.max(0.1, p.y) : original.height;
      if (e.shiftKey) {
        const aspect = original.width / original.height;
        let w = right - left,
          h = bottom - top;
        if (hx && hy) {
          if (w / h > aspect) h = w / aspect;
          else w = h * aspect;
        } else if (hx) h = w / aspect;
        else w = h * aspect;
        if (hx < 0) left = right - w;
        else right = left + w;
        if (hy < 0) top = bottom - h;
        else bottom = top + h;
      }
      const width = right - left,
        height = bottom - top,
        center = point(m, (left + right) / 2, (top + bottom) / 2);
      return {
        ...page,
        elements: page.elements.map((item) =>
          item.id === el.id
            ? {
                ...item,
                groupSize:
                  item.type === "group"
                    ? (item.groupSize ?? {
                        width: original.width,
                        height: original.height,
                      })
                    : item.groupSize,
                transform: {
                  ...original,
                  x: center.x - width / 2,
                  y: center.y - height / 2,
                  width,
                  height,
                },
              }
            : item,
        ),
      };
    });
  }
  function rotate(event: ReactPointerEvent, el: VisualElement) {
    const inv = inverse(parentMatrix(page, el.id)),
      t = el.transform,
      cx = t.x + t.width / 2,
      cy = t.y + t.height / 2;
    function angle(x: number, y: number) {
      const cp = canvasPoint(x, y),
        p = point(inv, cp.x, cp.y);
      return (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI;
    }
    const start = angle(event.clientX, event.clientY);
    startGesture(event, (e) => {
      let rotation = t.rotation + angle(e.clientX, e.clientY) - start;
      if (e.shiftKey) rotation = Math.round(rotation / 15) * 15;
      return {
        ...page,
        elements: page.elements.map((item) =>
          item.id === el.id ? { ...item, transform: { ...t, rotation } } : item,
        ),
      };
    });
  }
  function pan(event: ReactPointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const host = viewport.current;
    if (!host) return;
    const x = event.clientX,
      y = event.clientY,
      left = host.scrollLeft,
      top = host.scrollTop;
    const move = (e: PointerEvent) => {
      host.scrollLeft = left + x - e.clientX;
      host.scrollTop = top + y - e.clientY;
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      gesture.current = null;
    };
    gesture.current?.();
    gesture.current = end;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }
  function fit() {
    const width = viewport.current?.clientWidth ?? 600;
    setZoom(Math.max(1, ((width - 64) / (page.width * ratio)) * 100));
  }
  useEffect(() => {
    fit();
  }, [pageIndex, page.width, page.height, page.unit]);
  useEffect(() => {
    function down(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target?.closest("input,textarea,select,[contenteditable=true]"))
        return;
      if (event.code === "Space") {
        space.current = true;
        event.preventDefault();
      }
      if (event.key === "Escape") {
        gesture.current?.();
        setSelected([]);
        return;
      }
      const mod = event.ctrlKey || event.metaKey,
        key = event.key.toLowerCase();
      if (mod && key === "s") {
        event.preventDefault();
        if (!locked) void save();
        return;
      }
      if (mod && (key === "+" || key === "=")) {
        event.preventDefault();
        setZoom((value) => Math.min(400, value + 10));
        return;
      }
      if (mod && key === "-") {
        event.preventDefault();
        setZoom((value) => Math.max(10, value - 10));
        return;
      }
      if (mod && key === "0") {
        event.preventDefault();
        fit();
        return;
      }
      if (mod && (event.code === "Quote" || key === "'")) {
        event.preventDefault();
        setShowGrid((value) => !value);
        return;
      }
      if (mod && (event.code === "Semicolon" || key === ";")) {
        event.preventDefault();
        setCenterGuides((value) => !value);
        return;
      }
      if (locked || preview) return;
      if (mod && key === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (mod && key === "y") {
        event.preventDefault();
        redo();
      } else if (mod && key === "d") {
        event.preventDefault();
        duplicate();
      } else if (mod && key === "c" && selected.length) {
        event.preventDefault();
        copy();
      } else if (mod && key === "v") {
        event.preventDefault();
        paste();
      } else if (mod && key === "a") {
        event.preventDefault();
        setSelected(visible.map((e) => e.id));
      } else if (mod && key === "g") {
        event.preventDefault();
        event.shiftKey ? ungroup() : group();
      } else if ((key === "delete" || key === "backspace") && selected.length) {
        event.preventDefault();
        remove();
      } else if (selected.length && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        moveBy(
          event.key === "ArrowLeft"
            ? -step
            : event.key === "ArrowRight"
              ? step
              : 0,
          event.key === "ArrowUp"
            ? -step
            : event.key === "ArrowDown"
              ? step
              : 0,
        );
      }
    }
    function up(event: KeyboardEvent) {
      if (event.code === "Space") space.current = false;
    }
    function blur() {
      space.current = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  });
  async function save(asCopy = false, asComponent = false) {
    if (locked) return;
    setBusy(true);
    setMessage("");
    const snapshot = docRef.current;
    try {
      let document = snapshot;
      if (asComponent) {
        if (!selected.length)
          throw new Error("Selecione os elementos do componente.");
        const copied = cloneElements(
          page,
          selected,
          () => crypto.randomUUID(),
          0,
        );
        document = {
          ...createVisualDocument(
            `${page.name} · componente`,
            page.width,
            page.height,
          ),
          unit: page.unit,
          elements: copied.elements,
        };
      }
      validateVisualDocument(document);
      const result = await saveVisualTemplate({
        templateId: asCopy || asComponent ? null : templateId,
        name: document.name,
        category: asComponent ? "component" : category,
        document,
      });
      if (!asComponent) {
        setTemplateId(result.templateId);
        setVersion(result.version);
        setSaved(JSON.stringify(snapshot));
        setSavedCategory(category);
      }
      setMessage(
        asComponent
          ? "Componente salvo na biblioteca."
          : `Salvo · versão ${result.version}`,
      );
      setTemplates(await listVisualTemplates(templatePage));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File, target: "background" | "image") {
    if (locked) return;
    const id = current?.id,
      index = pageIndex;
    if (target === "image" && (!id || isLocked(page, id))) return;
    setBusy(true);
    setMessage("Enviando imagem…");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/visual-assets", {
          method: "POST",
          body: form,
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Falha no envio.");
      const before = docRef.current,
        p = getPage(before, index),
        next =
          target === "background"
            ? { ...p, background: { ...p.background, image: result.source } }
            : {
                ...p,
                elements: p.elements.map((e) =>
                  e.id === id
                    ? { ...e, source: result.source, binding: undefined }
                    : e,
                ),
              };
      setHistory((h) => [...h, before]);
      setFuture([]);
      const updated = setPage(before, index, next);
      setDoc(updated);
      docRef.current = updated;
      setMessage("Imagem guardada. Salve o template para criar a versão.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function insertTemplate() {
    if (!libraryId || locked) return;
    setBusy(true);
    try {
      const result = await loadVisualTemplate(libraryId),
        p = getPage(result.document, 0),
        roots = p.elements.filter((e) => !parentOf(p, e.id)).map((e) => e.id),
        copy = cloneElements(p, roots);
      const top = Math.max(0, ...page.elements.map((e) => e.transform.layer));
      const elements = copy.elements.map((e) =>
        copy.ids.includes(e.id)
          ? {
              ...e,
              transform: {
                ...e.transform,
                layer: top + 1 + copy.ids.indexOf(e.id),
              },
            }
          : e,
      );
      const before = docRef.current;
      setHistory((h) => [...h, before]);
      setFuture([]);
      const next = setPage(before, pageIndex, {
        ...page,
        elements: [...page.elements, ...elements],
      });
      setDoc(next);
      docRef.current = next;
      setScope(null);
      setSelected(copy.ids);
      setMessage(`Inserida cópia da versão ${result.version}.`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function restore(v: number) {
    if (!templateId || busy) return;
    if (
      dirty &&
      !window.confirm(
        "Abrir esta versão e substituir as alterações não salvas?",
      )
    )
      return;
    setBusy(true);
    try {
      const result = await loadVisualTemplate(templateId, v),
        before = docRef.current;
      setHistory((h) => [...h, before]);
      setFuture([]);
      setDoc(result.document);
      docRef.current = result.document;
      setCategory(result.template.category);
      setPageIndex(0);
      setScope(null);
      setSelected([]);
      setMessage(
        `Versão ${v} carregada. Salvar cria uma nova versão; o histórico é preservado.`,
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function exportFile(format: "svg" | "png" | "json") {
    if (busy) return;
    setBusy(true);
    try {
      validateVisualDocument(docRef.current);
      if (format === "json") {
        downloadVisual(
          new Blob([JSON.stringify(docRef.current, null, 2)], {
            type: "application/json",
          }),
          `${doc.name}.json`,
        );
      } else if (svgRef.current) {
        const svg = await standaloneSvg(svgRef.current, page, brand.fonts);
        downloadVisual(
          format === "svg"
            ? new Blob([svg], { type: "image/svg+xml" })
            : await rasterizeVisual(svg, page, exportScale),
          `${page.name}.${format}`,
        );
      }
      setMessage("Arquivo exportado.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function print() {
    if (busy) return;
    setBusy(true);
    let frame: HTMLIFrameElement | undefined;
    try {
      const pages = [getPage(doc, 0), ...(doc.pages ?? [])],
        svgs = await Promise.all(
          pages.map((p, i) =>
            standaloneSvg(printRefs.current[i]!, p, brand.fonts),
          ),
        );
      frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;width:0;height:0;border:0";
      document.body.append(frame);
      const target = frame.contentDocument!;
      target.open();
      target.write(
        `<!doctype html><html><head><title>Imprimir artes</title><style>body{margin:0}section>svg{width:100%;height:100%}section{break-after:page;overflow:hidden}${pages
          .map((p, i) => {
            const mm = p.unit === "mm" ? 1 : 25.4 / 96;
            return `@page sheet${i}{size:${p.width * mm}mm ${p.height * mm}mm;margin:0}section:nth-child(${i + 1}){page:sheet${i};width:${p.width * mm}mm;height:${p.height * mm}mm}`;
          })
          .join(
            "",
          )}</style></head><body>${svgs.map((s) => `<section>${s}</section>`).join("")}</body></html>`,
      );
      target.close();
      await target.fonts.ready;
      const cleanup = () => frame?.remove();
      frame.contentWindow!.addEventListener("afterprint", cleanup, {
        once: true,
      });
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      setMessage(
        "Impressão preparada. Escolha Salvar como PDF para gerar o documento.",
      );
    } catch (e) {
      frame?.remove();
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file: File) {
    if (locked) return;
    try {
      const next = validateVisualDocument(JSON.parse(await file.text()));
      commit(next);
      setPageIndex(0);
      setScope(null);
      setSelected([]);
      setMessage(
        "Documento importado. Salvar como cópia cria um template independente.",
      );
    } catch (e) {
      fail(e);
    }
  }
  function addPage(copy = false) {
    const next = copy
      ? structuredClone(page)
      : getPage(
          createVisualDocument(
            `Prancheta ${(doc.pages?.length ?? 0) + 2}`,
            page.width,
            page.height,
          ),
          0,
        );
    if (!copy) next.unit = page.unit;
    commit({ ...doc, pages: [...(doc.pages ?? []), next] });
    selectPage((doc.pages?.length ?? 0) + 1);
  }
  function deletePage() {
    if (!doc.pages?.length) return;
    const pages = [getPage(doc, 0), ...doc.pages];
    pages.splice(pageIndex, 1);
    commit({ ...pages[0], version: 1, pages: pages.slice(1) });
    selectPage(0);
  }
  function productComponent() {
    if (!productId) return;
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const unit = page.unit === "mm" ? 0.2 : 1;
    const id = crypto.randomUUID();
    const elements: VisualElement[] = [
      {
        id: crypto.randomUUID(), type: "image", name: "Imagem do produto", visible: true, locked: false,
        binding: "product.image",
        transform: { x: 0, y: 0, width: 260 * unit, height: 220 * unit, rotation: 0, opacity: 1, layer: 0 },
      },
      {
        id: crypto.randomUUID(), type: "text", name: "Nome do produto", visible: true, locked: false,
        binding: "product.name",
        transform: { x: 280 * unit, y: 10 * unit, width: 360 * unit, height: 90 * unit, rotation: 0, opacity: 1, layer: 1 },
        textStyle: { fontFamily: brand.fieldFonts.body, fontSize: 42 * unit, fontWeight: 800, color: "#111111" },
      },
      {
        id: crypto.randomUUID(), type: "text", name: "Especificação", visible: true, locked: false,
        binding: "product.specification",
        transform: { x: 280 * unit, y: 105 * unit, width: 360 * unit, height: 55 * unit, rotation: 0, opacity: 1, layer: 2 },
        textStyle: { fontFamily: brand.fieldFonts.body, fontSize: 25 * unit, color: "#444444" },
      },
      {
        id: crypto.randomUUID(), type: "text", name: "Marca", visible: true, locked: false,
        binding: "product.brand",
        transform: { x: 280 * unit, y: 150 * unit, width: 170 * unit, height: 38 * unit, rotation: 0, opacity: 1, layer: 3 },
        textStyle: { fontFamily: brand.fieldFonts.body, fontSize: 18 * unit, fontWeight: 650, color: "#555555" },
      },
      {
        id: crypto.randomUUID(), type: "text", name: "Preço de venda", visible: true, locked: false,
        binding: "product.salePrice",
        text: "0,00",
        transform: { x: 455 * unit, y: 142 * unit, width: 185 * unit, height: 58 * unit, rotation: 0, opacity: 1, layer: 4 },
        textStyle: { fontFamily: brand.fieldFonts.price, fontSize: 40 * unit, fontWeight: 900, color: brand.primaryColor },
      },
      {
        id: crypto.randomUUID(), type: "barcode", name: "Código de barras", visible: true, locked: false,
        binding: "product.ean",
        transform: { x: 280 * unit, y: 200 * unit, width: 240 * unit, height: 70 * unit, rotation: 0, opacity: 1, layer: 5 },
      },
    ];
    siblingsInsert([
      ...elements,
      {
        id, type: "group", name: product.name, visible: true, locked: false,
        children: elements.map((element) => element.id),
        groupSize: { width: 650 * unit, height: 275 * unit },
        transform: { x: 50 * unit, y: 50 * unit, width: 650 * unit, height: 275 * unit, rotation: 0, opacity: 1, layer: 0 },
      },
    ], [id]);
    setMessage(`${product.name} inserido e vinculado aos dados do produto.`);
  }
  function offerComponent() {
    if (!offerId) return;
    const offer = offers.items.find((item) => item.id === offerId);
    if (!offer) return;
    const unit = page.unit === "mm" ? 0.2 : 1;
    const id = crypto.randomUUID();
    const elements: VisualElement[] = [
      {
        id: crypto.randomUUID(), type: "image", name: "Imagem do produto", visible: true, locked: false,
        binding: "product.image",
        transform: { x: 0, y: 0, width: 250 * unit, height: 230 * unit, rotation: 0, opacity: 1, layer: 0 },
      },
      {
        id: crypto.randomUUID(), type: "text", name: "Produto da oferta", visible: true, locked: false,
        binding: "product.name",
        transform: { x: 270 * unit, y: 5 * unit, width: 390 * unit, height: 75 * unit, rotation: 0, opacity: 1, layer: 1 },
        textStyle: { fontFamily: brand.fieldFonts.body, fontSize: 38 * unit, fontWeight: 800, color: "#111111" },
      },
      {
        id: crypto.randomUUID(), type: "text", name: "Especificação da oferta", visible: true, locked: false,
        binding: "product.specification",
        transform: { x: 270 * unit, y: 80 * unit, width: 390 * unit, height: 45 * unit, rotation: 0, opacity: 1, layer: 2 },
        textStyle: { fontFamily: brand.fieldFonts.body, fontSize: 22 * unit, color: "#444444" },
      },
      {
        id: crypto.randomUUID(), type: "text", name: "Preço normal", visible: true, locked: false,
        binding: "offer.normalPrice",
        text: "0,00",
        transform: { x: 270 * unit, y: 135 * unit, width: 150 * unit, height: 42 * unit, rotation: 0, opacity: 1, layer: 3 },
        textStyle: { fontFamily: brand.fieldFonts.body, fontSize: 20 * unit, color: "#555555" },
      },
      {
        id: crypto.randomUUID(), type: "text", name: "Preço da oferta", visible: true, locked: false,
        binding: "offer.price",
        text: "0,00",
        transform: { x: 425 * unit, y: 125 * unit, width: 235 * unit, height: 85 * unit, rotation: 0, opacity: 1, layer: 4 },
        textStyle: { fontFamily: brand.fieldFonts.price, fontSize: 62 * unit, fontWeight: 900, color: brand.primaryColor },
      },
      {
        id: crypto.randomUUID(), type: "barcode", name: "Código de barras da oferta", visible: true, locked: false,
        binding: "product.ean",
        transform: { x: 270 * unit, y: 185 * unit, width: 145 * unit, height: 48 * unit, rotation: 0, opacity: 1, layer: 5 },
      },
    ];
    siblingsInsert([
      ...elements,
      {
        id, type: "group", name: `Oferta · ${offer.name}`, visible: true, locked: false,
        children: elements.map((element) => element.id),
        groupSize: { width: 670 * unit, height: 240 * unit },
        transform: { x: 50 * unit, y: 50 * unit, width: 670 * unit, height: 240 * unit, rotation: 0, opacity: 1, layer: 0 },
      },
    ], [id]);
    setMessage(`Oferta de ${offer.name} inserida e vinculada.`);
  }

  function addBoundText(binding: string | undefined, name: string, fontFamily = brand.fieldFonts.body) {
    const unit = page.unit === "mm" ? 0.2 : 1;
    const id = crypto.randomUUID();
    siblingsInsert([{
      id, type: "text", name, visible: true, locked: false, binding,
      transform: { x: 50 * unit, y: 50 * unit, width: 300 * unit, height: 70 * unit, rotation: 0, opacity: 1, layer: 0 },
      textStyle: { fontFamily, fontSize: 32 * unit, color: "#111111" },
    }], [id]);
  }
  function addBrandLogo(src: string) {
    const unit = page.unit === "mm" ? 0.2 : 1, id = crypto.randomUUID();
    siblingsInsert([{ id, type: "image", name: "Logo da marca", visible: true, locked: false, src, fit: "contain", transform: { x: 50 * unit, y: 50 * unit, width: 260 * unit, height: 120 * unit, rotation: 0, opacity: 1, layer: 0 } }], [id]);
  }

  function priceComponent() {
    const unit = page.unit === "mm" ? 0.2 : 1,
      id = crypto.randomUUID(),
      parts = [
        { name: "Moeda", text: "R$", x: 0, y: 35, w: 60, h: 60, size: 40 },
        {
          name: "Reais",
          binding: "offer.priceReais",
          x: 65,
          y: 0,
          w: 200,
          h: 160,
          size: 140,
        },
        {
          name: "Centavos",
          binding: "offer.priceCents",
          x: 265,
          y: 10,
          w: 95,
          h: 75,
          size: 65,
        },
        {
          name: "Unidade",
          binding: "offer.unit",
          x: 270,
          y: 90,
          w: 90,
          h: 50,
          size: 30,
        },
      ];
    const elements: VisualElement[] = parts.map((p, i) => ({
      id: crypto.randomUUID(),
      type: "text",
      name: p.name,
      visible: true,
      locked: false,
      text: p.text,
      binding: p.binding,
      transform: {
        x: p.x * unit,
        y: p.y * unit,
        width: p.w * unit,
        height: p.h * unit,
        rotation: 0,
        opacity: 1,
        layer: i,
      },
      textStyle: {
        fontFamily: brand.fieldFonts.price,
        fontSize: p.size * unit,
        fontWeight: 800,
        color: "#111111",
      },
    }));
    siblingsInsert(
      [
        ...elements,
        {
          id,
          type: "group",
          name: "Preço segmentado",
          visible: true,
          locked: false,
          children: elements.map((e) => e.id),
          groupSize: { width: 360 * unit, height: 160 * unit },
          transform: {
            x: 50 * unit,
            y: 50 * unit,
            width: 360 * unit,
            height: 160 * unit,
            rotation: 0,
            opacity: 1,
            layer: 0,
          },
        },
      ],
      [id],
    );
  }
  return (
    <div className="visual-editor">
      <section className="card visual-toolbar">
        <fieldset disabled={locked} className="visual-fields">
          <TextField
            label="Nome do template"
            value={doc.name}
            onChange={(name) => commit({ ...doc, name })}
          />
        </fieldset>
        <label className="field">
          <span>Categoria</span>
          <select
            aria-label="Categoria"
            className="input"
            disabled={locked}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["custom", "digital", "print", "validity", "component"].map(
              (v, i) => (
                <option key={v} value={v}>
                  {
                    [
                      "Personalizado",
                      "Digital",
                      "Impresso",
                      "Validade",
                      "Componente",
                    ][i]
                  }
                </option>
              ),
            )}
          </select>
        </label>
        <span className="visual-top-spacer" />
        <button className="btn" title="Desfazer (Ctrl/Cmd+Z)" disabled={locked || !history.length} onClick={undo}>↶</button>
        <button className="btn" title="Refazer (Ctrl/Cmd+Y)" disabled={locked || !future.length} onClick={redo}>↷</button>
        <button className="btn" title="Alternar preview limpo" aria-pressed={preview} onClick={() => setPreview(!preview)}>◉ Preview</button>
        <button className="btn" title="Exportar PNG" disabled={busy} onClick={() => exportFile("png")}>⇩ Exportar</button>
        <button
          className="btn primary"
          disabled={locked}
          onClick={() => save()}
        >
          Salvar template
        </button>
        <button className="btn" disabled={locked} onClick={() => save(true)}>
          Salvar como cópia
        </button>
        <span role="status">
          {message ||
            `${dirty ? "Alterações não salvas" : "Salvo"}${version ? ` · v${version}` : ""}`}
        </span>
        {!editable && <span className="pill">Somente leitura</span>}
      </section>
      <details className="card">
        <summary>Biblioteca, versões e dados de preview</summary>
        <div className="visual-library">
          <section>
            <h3>Templates e componentes</h3>
            <select
              className="input"
              aria-label="Template da biblioteca"
              value={libraryId}
              onChange={(e) => setLibraryId(e.target.value)}
            >
              <option value="">Selecione</option>
              {templates.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · v{t.current_version}
                  {t.category === "component" ? " · componente" : ""}
                </option>
              ))}
            </select>
            <div className="visual-buttons">
              <button
                className="btn"
                disabled={!libraryId || busy}
                onClick={() => {
                  if (
                    !dirty ||
                    window.confirm("Sair sem salvar as alterações?")
                  )
                    location.href = `/app/editor-visual?template=${encodeURIComponent(libraryId)}`;
                }}
              >
                Abrir template
              </button>
              <button
                className="btn"
                disabled={!libraryId || locked}
                onClick={insertTemplate}
              >
                Inserir como componente
              </button>
              <button
                className="btn"
                disabled={locked || !selected.length}
                onClick={() => save(false, true)}
              >
                Salvar seleção como componente
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (
                    !dirty ||
                    window.confirm("Sair sem salvar as alterações?")
                  )
                    location.href = "/app/editor-visual";
                }}
              >
                Novo template
              </button>
              <button
                className="btn"
                disabled={!templatePage}
                onClick={() => setTemplatePage((p) => p - 1)}
              >
                Templates anteriores
              </button>
              <button
                className="btn"
                disabled={!templates.hasMore}
                onClick={() => setTemplatePage((p) => p + 1)}
              >
                Mais templates
              </button>
            </div>
          </section>
          <section>
            <h3>Histórico</h3>
            {templateId ? (
              <>
                <div className="visual-buttons">
                  {versions.items.map((v) => (
                    <button
                      className="btn"
                      key={v.version}
                      disabled={busy}
                      onClick={() => restore(v.version)}
                    >
                      Abrir v{v.version}
                    </button>
                  ))}
                </div>
                <button
                  className="btn"
                  disabled={!versionPage}
                  onClick={() => setVersionPage((p) => p - 1)}
                >
                  Versões recentes
                </button>
                <button
                  className="btn"
                  disabled={!versions.hasMore}
                  onClick={() => setVersionPage((p) => p + 1)}
                >
                  Versões anteriores
                </button>
                <p className="muted">
                  Reabrir e salvar uma versão antiga cria uma nova versão.
                </p>
              </>
            ) : (
              <p>Salve para iniciar o histórico.</p>
            )}
          </section>
          <section>
            <h3>Dados</h3>
            <label className="field">
              <span>Oferta no preview</span>
              <select
                aria-label="Oferta no preview"
                className="input"
                value={offerId}
                onChange={(e) => {
                  setOfferId(e.target.value);
                  setBindingData(null);
                }}
              >
                <option value="">Dados de exemplo</option>
                {offers.items.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} · {o.data.offer.price}
                  </option>
                ))}
              </select>
            </label>
            <div className="visual-buttons">
              <button
                className="btn"
                disabled={!offerPage}
                onClick={() => setOfferPage((p) => p - 1)}
              >
                Ofertas anteriores
              </button>
              <button
                className="btn"
                disabled={!offers.hasMore}
                onClick={() => setOfferPage((p) => p + 1)}
              >
                Mais ofertas
              </button>
            </div>
            <details>
              <summary>Dados personalizados (JSON)</summary>
              <textarea
                aria-label="Dados personalizados"
                className="input"
                value={customData}
                onChange={(e) => setCustomData(e.target.value)}
                rows={5}
              />
              <button
                className="btn"
                onClick={() =>
                  operate(() => {
                    const parsed = JSON.parse(customData);
                    if (
                      !parsed ||
                      typeof parsed !== "object" ||
                      Array.isArray(parsed)
                    )
                      throw new Error("Use um objeto JSON.");
                    setBindingData(parsed);
                    setMessage("Dados personalizados aplicados ao preview.");
                  })
                }
              >
                Aplicar dados
              </button>
            </details>
          </section>
        </div>
      </details>
      <div className={`visual-workspace${sidebarOpen ? "" : " visual-workspace-sidebar-collapsed"}`}>
        <aside className={`card visual-layers${sidebarOpen ? "" : " visual-layers-collapsed"}`}>
          <nav className="visual-tool-rail" aria-label="Ferramentas do editor">
            {([
              ["layers", "☷", "Camadas"],
              ["elements", "○", "Elementos"],
              ["text", "T", "Texto"],
              ["images", "▧", "Imagens"],
              ["products", "▦", "Produtos"],
              ["offers", "R$", "Ofertas"],
              ["templates", "◇", "Templates"],
              ["components", "◫", "Componentes"],
              ["brand", "◆", "Marca"],
              ["uploads", "↑", "Uploads"],
            ] as const).map(([tool, icon, label]) => (
              <button
                key={tool}
                title={label}
                aria-pressed={activeTool === tool && sidebarOpen}
                onClick={() => {
                  if (activeTool === tool && sidebarOpen) setSidebarOpen(false);
                  else {
                    setActiveTool(tool);
                    setSidebarOpen(true);
                  }
                }}
              >
                <b>{icon}</b><span>{label}</span>
              </button>
            ))}
          </nav>
          {sidebarOpen && <div className="visual-context-panel">
            <div className="visual-context-head">
              <h3>{({
                layers: "Camadas",
                elements: "Elementos",
                text: "Texto",
                images: "Imagens",
                products: "Produtos",
                offers: "Ofertas",
                templates: "Templates",
                components: "Componentes",
                brand: "Marca",
                uploads: "Uploads",
              } as const)[activeTool]}</h3>
              <span className="muted">{visible.length} itens</span>
            </div>
            {activeTool === "layers" && (
              <button
                className="btn visual-collapse"
                aria-expanded={layersOpen}
                onClick={() => setLayersOpen((open) => !open)}
              >
                {layersOpen ? "Ocultar camadas" : "Mostrar camadas"}
              </button>
            )}
            {activeTool === "elements" && (
              <div className="visual-tool-grid">
                <button className="btn" disabled={locked} onClick={() => add("shape")}>▭ Forma</button>
                <button className="btn" disabled={locked} onClick={() => add("barcode")}>▥ Código</button>
              </div>
            )}
            {activeTool === "text" && (
              <div className="visual-tool-grid">
                <button className="btn" disabled={locked} onClick={() => add("text")}>+ Texto</button>
                <button className="btn" disabled={locked} onClick={priceComponent}>R$ Preço segmentado</button>
              </div>
            )}
            {activeTool === "images" && (
              <div className="visual-tool-stack">
                <button className="btn" disabled={locked} onClick={() => add("image")}>+ Quadro de imagem</button>
                {current?.type === "image" ? (
                  <>
                    <label className="field"><span>Enviar / substituir</span>
                      <input
                        aria-label="Enviar ou substituir imagem"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={locked || current.locked}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) upload(file, "image");
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <div className="visual-tool-grid">
                      {(["contain", "cover", "fill"] as const).map((fit) => (
                        <button
                          key={fit}
                          className="btn"
                          aria-pressed={(current.fit ?? "contain") === fit}
                          disabled={locked || current.locked}
                          onClick={() => patch({ fit })}
                        >
                          {fit === "contain" ? "Ajustar" : fit === "cover" ? "Preencher" : "Esticar"}
                        </button>
                      ))}
                    </div>
                    <button
                      className="btn"
                      disabled={locked || current.locked}
                      onClick={() => patch({ imagePosition: { x: 0.5, y: 0.5 } })}
                    >
                      Centralizar recorte
                    </button>
                  </>
                ) : (
                  <p className="muted">Selecione um quadro para enviar, substituir e enquadrar a imagem diretamente por aqui.</p>
                )}
              </div>
            )}
            {activeTool === "products" && (
              <div className="visual-tool-stack">
                <label className="field"><span>Buscar produto</span>
                  <input className="input" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Nome, marca ou EAN" />
                </label>
                <select className="input" aria-label="Produto para inserir" value={productId} onChange={(e) => { setProductId(e.target.value); if (e.target.value) { setOfferId(""); setBindingData(null); } }}>
                  <option value="">Selecione um produto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}{product.brand ? ` · ${product.brand}` : ""}{product.specification ? ` · ${product.specification}` : ""}
                    </option>
                  ))}
                </select>
                <button className="btn" disabled={!productId || locked} onClick={productComponent}>+ Inserir produto vinculado</button>
                <p className="muted">Insere imagem, nome, marca, especificação, preço de venda e código de barras como um bloco editável e vinculado.</p>
              </div>
            )}
            {activeTool === "offers" && (
              <div className="visual-tool-stack">
                <label className="field"><span>Dados da oferta</span>
                  <select aria-label="Dados da oferta" className="input" value={offerId} onChange={(e) => { setOfferId(e.target.value); if (e.target.value) setProductId(""); setBindingData(null); }}>
                    <option value="">Dados de exemplo</option>
                    {offers.items.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.data.offer.price}</option>)}
                  </select>
                </label>
                <button className="btn" disabled={!offerId || locked} onClick={offerComponent}>+ Inserir oferta vinculada</button>
                <button className="btn" disabled={locked} onClick={priceComponent}>+ Bloco de preço</button>
                <div className="visual-tool-grid">
                  <button className="btn" disabled={locked} onClick={() => addBoundText("product.name", "Nome do produto")}>Nome</button>
                  <button className="btn" disabled={locked} onClick={() => addBoundText("product.specification", "Especificação")}>Especificação</button>
                  <button className="btn" disabled={locked} onClick={() => addBoundText("offer.normalPrice", "Preço normal")}>Preço normal</button>
                  <button className="btn" disabled={locked} onClick={() => addBoundText("offer.price", "Preço da oferta")}>Preço oferta</button>
                  <button className="btn" disabled={locked} onClick={() => addBoundText("offer.unit", "Unidade")}>Unidade</button>
                  <button className="btn" disabled={locked} onClick={() => addBoundText("campaign.name", "Campanha")}>Campanha</button>
                </div>
              </div>
            )}
            {activeTool === "templates" && (
              <div className="visual-tool-stack">
                <select className="input" aria-label="Template para inserir" value={libraryId} onChange={(e) => setLibraryId(e.target.value)}>
                  <option value="">Selecione um template</option>
                  {templates.items.map((t) => <option key={t.id} value={t.id}>{t.name} · v{t.current_version}</option>)}
                </select>
                <button className="btn" disabled={!libraryId || locked} onClick={insertTemplate}>Inserir no design</button>
              </div>
            )}
            {activeTool === "components" && (
              <div className="visual-tool-stack">
                <label className="field"><span>Nome do componente</span>
                  <input className="input" aria-label="Nome do componente" value={componentName} onChange={(e) => setComponentName(e.target.value)} placeholder="Ex.: Card de oferta" />
                </label>
                <button className="btn" disabled={locked || !selected.length} onClick={saveComponent}>+ Salvar seleção como componente</button>
                {savedComponents.length ? (
                  <div className="visual-component-list">
                    {savedComponents.map((component) => (
                      <div key={component.id} className="visual-component-item">
                        <strong>{component.name}</strong>
                        <button className="btn" disabled={locked} onClick={() => insertComponent(component)}>Inserir</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="muted">Selecione um ou mais elementos para criar um bloco reutilizável durante esta edição.</p>}
              </div>
            )}
            {activeTool === "brand" && (
              <div className="visual-tool-stack">
                <div className="visual-brand-summary"><span className="visual-brand-swatch" style={{ background: brand.primaryColor }} /><div><strong>Brand Kit</strong><p className="muted">Cores e fontes oficiais disponíveis para aplicar no design.</p></div></div>
                <div className="visual-brand-colors">
                  <button className="btn visual-brand-color" disabled={locked || !current || (current.type !== "text" && current.type !== "shape")} onClick={() => current?.type === "shape" ? patch({ shape: { ...current.shape!, fill: brand.primaryColor } }) : current?.type === "text" ? patch({ textStyle: { ...current.textStyle, color: brand.primaryColor } }) : undefined}><span style={{ background: brand.primaryColor }} />Primária</button>
                  <button className="btn visual-brand-color" disabled={locked || !current || (current.type !== "text" && current.type !== "shape")} onClick={() => current?.type === "shape" ? patch({ shape: { ...current.shape!, fill: brand.accentColor } }) : current?.type === "text" ? patch({ textStyle: { ...current.textStyle, color: brand.accentColor } }) : undefined}><span style={{ background: brand.accentColor }} />Destaque</button>
                </div>
                <div className="visual-tool-grid"><button className="btn" disabled={locked} onClick={() => addBoundText(undefined, "Título", brand.fieldFonts.title)}>+ Título da marca</button><button className="btn" disabled={locked} onClick={() => addBoundText(undefined, "Texto", brand.fieldFonts.body)}>+ Texto da marca</button></div>
                {brand.logoUrl && <button className="btn" disabled={locked} onClick={() => addBrandLogo(brand.logoUrl!)}>+ Logo da marca</button>}
                <div className="visual-brand-fonts"><span className="muted">Fontes configuradas</span><strong style={{ fontFamily: brand.fieldFonts.title }}>Título</strong><span style={{ fontFamily: brand.fieldFonts.body }}>Texto principal</span></div>
              </div>
            )}
            {activeTool === "uploads" && (
              <div className="visual-tool-stack">
                <p className="muted">Crie um quadro de imagem e use “Enviar imagem” nas propriedades para guardar um arquivo no acervo visual.</p>
                <button className="btn" disabled={locked} onClick={() => { add("image"); setActiveTool("images"); }}>+ Nova imagem</button>
              </div>
            )}
          </div>}
          {sidebarOpen && activeTool === "layers" && layersOpen && <>
          {scope && (
            <button
              className="btn"
              onClick={() => {
                setScope(parentOf(page, scope)?.id ?? null);
                setSelected([]);
              }}
            >
              ← Sair do grupo
            </button>
          )}
          <p className="muted">
            Shift+clique seleciona vários. Duplo clique abre grupos.
          </p>
          <div className="visual-layer-list">
            {visible.map((e) => (
              <button
                className="btn"
                key={e.id}
                aria-pressed={selected.includes(e.id)}
                onClick={(event) =>
                  setSelected((ids) =>
                    event.shiftKey
                      ? ids.includes(e.id)
                        ? ids.filter((i) => i !== e.id)
                        : [...ids, e.id]
                      : [e.id],
                  )
                }
                onDoubleClick={() => {
                  if (e.type === "group") {
                    setScope(e.id);
                    setSelected([]);
                  }
                }}
              >
                {e.locked ? "🔒 " : ""}
                {!e.visible ? "◌ " : ""}
                {e.name}
                {e.type === "group" ? " ▸" : ""}
              </button>
            ))}
          </div>
          <div className="visual-buttons">
            <button
              className="btn"
              disabled={locked || !selected.length}
              onClick={duplicate}
            >
              Duplicar
            </button>
            <button
              className="btn"
              disabled={locked || !selected.length}
              onClick={remove}
            >
              Excluir
            </button>
            <button
              className="btn"
              disabled={locked || selected.length < 2}
              onClick={group}
            >
              Agrupar
            </button>
            <button
              className="btn"
              disabled={locked || current?.type !== "group"}
              onClick={ungroup}
            >
              Desagrupar
            </button>
            {(
              [
                ["forward", "Avançar"],
                ["backward", "Recuar"],
                ["front", "Trazer à frente"],
                ["back", "Enviar ao fundo"],
              ] as const
            ).map(([direction, label]) => (
              <button
                className="btn"
                key={direction}
                disabled={locked || !selected.length}
                onClick={() =>
                  updatePage(reorderElements(page, selected, direction))
                }
              >
                {label}
              </button>
            ))}
          </div>
          </>}
          {sidebarOpen && selected.length > 0 && (
            <div className="visual-selection-summary" role="status">
              <strong>{selected.length === 1 ? current?.name ?? "1 elemento" : `${selected.length} elementos`}</strong>
              <span>{selected.length === 1 ? names[current?.type ?? "text"] : "Seleção múltipla"}</span>
            </div>
          )}
          {sidebarOpen && selected.length > 0 && (
            <div className="visual-selection-actions" aria-label="Ações da seleção">
              <button className="btn" disabled={locked} title="Duplicar seleção (Ctrl/Cmd+D)" onClick={duplicate}>Duplicar seleção</button>
              <button className="btn" disabled={locked} title="Excluir seleção (Delete)" onClick={remove}>Excluir seleção</button>
              {selected.length > 1 && (
                <button className="btn" disabled={locked} title="Agrupar seleção (Ctrl/Cmd+G)" onClick={group}>Agrupar seleção</button>
              )}
              {selected.length === 1 && current?.type === "group" && (
                <button className="btn" disabled={locked} title="Desagrupar seleção (Ctrl/Cmd+Shift+G)" onClick={ungroup}>Desagrupar seleção</button>
              )}
            </div>
          )}
          {sidebarOpen && <>
          <h3>Alinhar {selected.length > 1 ? "seleção" : "à prancheta"}</h3>
          <label>
            <input
              type="checkbox"
              checked={alignToPage}
              onChange={(e) => setAlignToPage(e.target.checked)}
            />{" "}
            Usar limites da prancheta/grupo
          </label>
          <div className="visual-buttons">
            {(
              [
                ["left", "Esquerda"],
                ["centerX", "Centro X"],
                ["right", "Direita"],
                ["top", "Topo"],
                ["centerY", "Centro Y"],
                ["bottom", "Base"],
              ] as const
            ).map(([axis, label]) => (
              <button
                className="btn"
                key={axis}
                disabled={locked || !selected.length}
                onClick={() =>
                  operate(() =>
                    updatePage(
                      alignElements(page, selected, axis, alignToPage),
                    ),
                  )
                }
              >
                {label}
              </button>
            ))}
            <button
              className="btn"
              disabled={locked || selected.length < 3}
              onClick={() =>
                operate(() =>
                  updatePage(distributeElements(page, selected, "x")),
                )
              }
            >
              Distribuir X
            </button>
            <button
              className="btn"
              disabled={locked || selected.length < 3}
              onClick={() =>
                operate(() =>
                  updatePage(distributeElements(page, selected, "y")),
                )
              }
            >
              Distribuir Y
            </button>
          </div>
          </>}
          <button className="btn visual-sidebar-toggle" aria-label={sidebarOpen ? "Recolher menu lateral" : "Expandir menu lateral"} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}>{sidebarOpen ? "‹ Recolher" : "›"}</button>
        </aside>
        <main className="visual-main">
          <div className="visual-toolbar">
            <button
              className="btn"
              disabled={locked || !history.length}
              onClick={undo}
            >
              Desfazer
            </button>
            <button
              className="btn"
              disabled={locked || !future.length}
              onClick={redo}
            >
              Refazer
            </button>
            <button
              className="btn"
              aria-pressed={preview}
              onClick={() => setPreview(!preview)}
            >
              Preview limpo
            </button>
            <div className="visual-zoom-controls" aria-label="Controles de zoom">
              <button className="btn" title="Reduzir zoom (Ctrl/Cmd+-)" onClick={() => setZoom((value) => Math.max(10, value - 10))}>−</button>
              <button className="btn visual-zoom-value" title="Ajustar à tela (Ctrl/Cmd+0)" onClick={fit}>{Math.round(zoom)}%</button>
              <button className="btn" title="Aumentar zoom (Ctrl/Cmd++)" onClick={() => setZoom((value) => Math.min(400, value + 10))}>+</button>
            </div>
            <label>
              <input
                aria-label="Encaixe e guias"
                type="checkbox"
                checked={snap}
                onChange={(e) => setSnap(e.target.checked)}
              />{" "}
              Encaixe e guias
            </label>
            <label>
              <input
                aria-label="Mostrar grade"
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />{" "}
              Mostrar grade
            </label>
            <NumberField
              label={`Grade (${page.unit})`}
              value={grid}
              min={0}
              onChange={setGrid}
            />
            <label>
              <input
                aria-label="Guias centrais"
                type="checkbox"
                checked={centerGuides}
                onChange={(e) => setCenterGuides(e.target.checked)}
              />{" "}
              Guias centrais
            </label>
            <label>
              <input
                aria-label="Margem segura"
                type="checkbox"
                checked={safeArea}
                onChange={(e) => setSafeArea(e.target.checked)}
              />{" "}
              Margem segura
            </label>
          </div>
          <div
            className="visual-viewport"
            ref={viewport}
            onWheel={(event) => {
              if (!(event.ctrlKey || event.metaKey)) return;
              event.preventDefault();
              setZoom((value) => Math.max(10, Math.min(400, value + (event.deltaY < 0 ? 10 : -10))));
            }}
            onPointerDown={(event) => {
              if (space.current || event.button === 1) pan(event);
            }}
          >
            <div
              className="visual-canvas-shell"
              style={{ width: page.width * scale, height: page.height * scale }}
            >
              <VisualRenderer
                ref={svgRef}
                page={page}
                data={data}
                className="visual-canvas"
                width={page.width * scale}
                height={page.height * scale}
                aria-label="Prancheta visual"
                onPointerDown={(event) => {
                  if (space.current || event.button === 1) {
                    pan(event);
                    return;
                  }
                  if (!preview) setSelected([]);
                }}
              >
                {!preview && (
                  <g data-editor-overlay="true">
                    {showGrid && grid > 0 && (
                      <defs>
                        <pattern
                          id="visual-grid"
                          width={grid}
                          height={grid}
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d={`M ${grid} 0 L 0 0 0 ${grid}`}
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth={0.3 / scale}
                          />
                        </pattern>
                      </defs>
                    )}
                    {showGrid && grid > 0 && (
                      <rect
                        width={page.width}
                        height={page.height}
                        fill="url(#visual-grid)"
                        pointerEvents="none"
                      />
                    )}
                    {centerGuides && (
                      <>
                        <line
                          x1={page.width / 2}
                          y1={0}
                          x2={page.width / 2}
                          y2={page.height}
                          className="visual-static-guide"
                          strokeWidth={0.7 / scale}
                          pointerEvents="none"
                        />
                        <line
                          x1={0}
                          y1={page.height / 2}
                          x2={page.width}
                          y2={page.height / 2}
                          className="visual-static-guide"
                          strokeWidth={0.7 / scale}
                          pointerEvents="none"
                        />
                      </>
                    )}
                    {safeArea && (
                      <rect
                        data-safe-area="true"
                        x={page.width * 0.05}
                        y={page.height * 0.05}
                        width={page.width * 0.9}
                        height={page.height * 0.9}
                        fill="none"
                        className="visual-safe-area"
                        strokeWidth={0.7 / scale}
                        pointerEvents="none"
                      />
                    )}
                    {visible
                      .filter((e) => e.visible)
                      .reverse()
                      .map((e) => (
                        <g
                          key={e.id}
                          transform={`matrix(${worldMatrix(page, e).join(" ")})`}
                        >
                          <rect
                            data-hit-id={e.id}
                            width={e.transform.width}
                            height={e.transform.height}
                            fill="transparent"
                            stroke={
                              selected.includes(e.id)
                                ? "#2563eb"
                                : "transparent"
                            }
                            strokeWidth={1.5 / scale}
                            style={{
                              cursor: isLocked(page, e.id) ? "default" : "move",
                              touchAction: "none",
                            }}
                            onPointerDown={(event) => drag(event, e.id)}
                            onDoubleClick={() => {
                              if (e.type === "group") {
                                setScope(e.id);
                                setSelected([]);
                              }
                            }}
                          />
                          {selected.length === 1 &&
                            selected[0] === e.id &&
                            !isLocked(page, e.id) &&
                            !locked && (
                              <>
                                {handles.map(([hx, hy]) => (
                                  <rect
                                    key={`${hx},${hy}`}
                                    role="button"
                                    aria-label={`Redimensionar ${hx},${hy}`}
                                    x={
                                      ((hx + 1) * e.transform.width) / 2 -
                                      5 / scale
                                    }
                                    y={
                                      ((hy + 1) * e.transform.height) / 2 -
                                      5 / scale
                                    }
                                    width={10 / scale}
                                    height={10 / scale}
                                    fill="white"
                                    stroke="#2563eb"
                                    strokeWidth={1 / scale}
                                    style={{
                                      cursor: !hx
                                        ? "ns-resize"
                                        : !hy
                                          ? "ew-resize"
                                          : hx === hy
                                            ? "nwse-resize"
                                            : "nesw-resize",
                                      touchAction: "none",
                                    }}
                                    onPointerDown={(event) =>
                                      resize(event, e, hx, hy)
                                    }
                                  />
                                ))}
                                <line
                                  x1={e.transform.width / 2}
                                  x2={e.transform.width / 2}
                                  y1={0}
                                  y2={-24 / scale}
                                  stroke="#2563eb"
                                  strokeWidth={1 / scale}
                                />
                                <circle
                                  role="button"
                                  aria-label="Rotacionar"
                                  cx={e.transform.width / 2}
                                  cy={-24 / scale}
                                  r={6 / scale}
                                  fill="#2563eb"
                                  style={{
                                    cursor: "grab",
                                    touchAction: "none",
                                  }}
                                  onPointerDown={(event) => rotate(event, e)}
                                />
                              </>
                            )}
                        </g>
                      ))}
                    <g
                      transform={
                        current
                          ? `matrix(${parentMatrix(page, current.id).join(" ")})`
                          : undefined
                      }
                      pointerEvents="none"
                    >
                      {guides.x !== undefined && (
                        <line
                          data-snap-guide="x"
                          x1={guides.x}
                          x2={guides.x}
                          y1={-page.height * 5}
                          y2={page.height * 5}
                          className="visual-snap-guide"
                          strokeWidth={1 / scale}
                        />
                      )}
                      {guides.y !== undefined && (
                        <line
                          data-snap-guide="y"
                          y1={guides.y}
                          y2={guides.y}
                          x1={-page.width * 5}
                          x2={page.width * 5}
                          className="visual-snap-guide"
                          strokeWidth={1 / scale}
                        />
                      )}
                    </g>
                  </g>
                )}
              </VisualRenderer>
            </div>
          </div>
          <p className="muted">
            Espaço+arraste navega · Ctrl/Cmd+roda ou +/- controla zoom · Ctrl/Cmd+0 ajusta à tela · Ctrl/Cmd+' alterna grade · Ctrl/Cmd+; alterna guias · Alt desativa encaixe · Shift mantém proporção/ângulo · setas movem.
          </p>
          <div className="visual-buttons">
            {[getPage(doc, 0), ...(doc.pages ?? [])].map((p, i) => (
              <button
                className="btn"
                key={i}
                aria-pressed={pageIndex === i}
                onClick={() => selectPage(i)}
              >
                {i + 1}. {p.name}
              </button>
            ))}
            <button className="btn" disabled={locked} onClick={() => addPage()}>
              + Prancheta
            </button>
            <button
              className="btn"
              disabled={locked}
              onClick={() => addPage(true)}
            >
              Duplicar prancheta
            </button>
            <button
              className="btn"
              disabled={locked || !doc.pages?.length}
              onClick={deletePage}
            >
              Excluir prancheta
            </button>
          </div>
          <section className="card visual-toolbar">
            <button
              className="btn"
              disabled={busy}
              onClick={() => exportFile("png")}
            >
              Exportar PNG
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => exportFile("svg")}
            >
              Exportar SVG
            </button>
            <NumberField
              label="Escala de exportação"
              min={0.1}
              value={exportScale}
              onChange={setExportScale}
            />
            <button className="btn" disabled={busy} onClick={print}>
              Imprimir / PDF (todas)
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => exportFile("json")}
            >
              Exportar documento
            </button>
            <label className="field">
              <span>Importar documento</span>
              <input
                type="file"
                disabled={locked}
                accept="application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </section>
        </main>
        <aside className="card visual-properties">
          <h3>
            {current
              ? `${selected.length > 1 ? `${selected.length} selecionados · ` : ""}${current.name}`
              : "Prancheta"}
          </h3>
          {current ? (
            <>
              <button className="btn" onClick={() => setSelected([])}>
                Propriedades da prancheta
              </button>
              <ElementProperties
                element={current}
                patch={patch}
                disabled={
                  locked ||
                  (!!parentOf(page, current.id) &&
                    isLocked(page, parentOf(page, current.id)!.id))
                }
                upload={upload}
                fonts={brand.fonts}
              />
            </>
          ) : (
            <PageProperties
              page={page}
              patch={(values) => updatePage({ ...page, ...values })}
              upload={upload}
              disabled={locked}
            />
          )}
        </aside>
      </div>
      <div className="visual-print-source" aria-hidden="true">
        {[getPage(doc, 0), ...(doc.pages ?? [])].map((p, i) => (
          <VisualRenderer
            key={i}
            ref={(el) => {
              printRefs.current[i] = el;
            }}
            page={p}
            data={data}
          />
        ))}
      </div>
    </div>
  );
}
