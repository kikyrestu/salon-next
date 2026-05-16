/**
 * tenantFetch — Wrapper fetch terpusat untuk multi-tenant.
 * Secara otomatis menyisipkan header `x-store-slug` di setiap request
 * agar tidak ada lagi fetch yang ketinggalan header tenant.
 *
 * Penggunaan:
 *   const res = await tenantFetch("/api/invoices", slug);
 *   const res = await tenantFetch("/api/invoices", slug, { method: "POST", body: ... });
 */
export const tenantFetch = (
  url: string,
  slug: string,
  options?: RequestInit
): Promise<Response> => {
  const headers = new Headers(options?.headers);
  if (!headers.has("x-store-slug")) {
    headers.set("x-store-slug", slug);
  }
  return fetch(url, { ...options, headers });
};
