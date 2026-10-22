// Only workspace destinations may be restored after authentication.
export function workspaceReturnTo(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    Array.from(value).some((c) => c.charCodeAt(0) <= 32)
  )
    return "/app";
  const url = new URL(value, "https://numdock.invalid");
  if (
    url.origin !== "https://numdock.invalid" ||
    (url.pathname !== "/app" && !url.pathname.startsWith("/app/"))
  )
    return "/app";
  return url.pathname + url.search;
}
