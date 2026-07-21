export function contentDisposition(
  fileName: string,
  type: "inline" | "attachment" = "inline"
): string {
  const name = String(fileName ?? "").slice(0, 200);
  const asciiFallback =
    Array.from(name)
      .map((char) => {
        const code = char.codePointAt(0) ?? 0;
        return code > 0x1f && code < 0x7f && char !== '"' && char !== "\\"
          ? char
          : "_";
      })
      .join("")
      .trim() || "document";
  const encoded = encodeURIComponent(name).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
