export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
// Preserve only exact, attribute-free formatting tags; all other markup is displayed as text.
export function safeRichText(value: unknown) {
  return escapeHtml(value).replace(
    /&lt;(\/?(?:b|strong|em|i)|br\s*\/?)&gt;/gi,
    (_, tag: string) => `<${tag}>`,
  );
}
