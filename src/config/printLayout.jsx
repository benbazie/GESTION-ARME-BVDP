const STORAGE_KEY = "print-layout-config";

const DEFAULT_LAYOUT = {
  headerTitle: "Bilan des armes",
  headerSubtitle: "Système de gestion opérationnelle",
  footerLeft: "Édité le {{date}}",
  footerRight: "Total : {{total}}",
};

export function loadPrintLayout() {
  try {
    if (typeof localStorage === "undefined") return { ...DEFAULT_LAYOUT };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LAYOUT, ...parsed };
  } catch (err) {
    console.warn("[printLayout] lecture configuration impossible :", err);
    return { ...DEFAULT_LAYOUT };
  }
}

export function savePrintLayout(nextLayout) {
  try {
    if (typeof localStorage === "undefined") return;
    const payload = { ...DEFAULT_LAYOUT, ...nextLayout };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[printLayout] sauvegarde impossible :", err);
  }
}
