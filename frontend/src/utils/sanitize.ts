import DOMPurify from "dompurify";

/**
 * Sanitize HTML content before rendering with dangerouslySetInnerHTML.
 * Allows safe formatting tags while stripping scripts and event handlers.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "sub", "sup",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "table", "thead", "tbody", "tr", "th", "td",
      "blockquote", "pre", "code",
      "img", "figure", "figcaption",
      "a", "span", "div",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "width", "height",
      "class", "style", "id",
      "colspan", "rowspan", "scope",
      "target", "rel",
    ],
  });
}
