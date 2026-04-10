import { validateEnv } from "@mhp/integrations/env";

const env = validateEnv();

export function getBaseUrl(): string {
  if (env.NODE_ENV === "production") {
    return `https://${process.env.REPLIT_DEV_DOMAIN || "mhp-connect.replit.app"}`;
  }
  return `https://${process.env.REPLIT_DEV_DOMAIN || "localhost:3001"}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface HtmlShellOptions {
  meta: SeoMeta;
  breadcrumbs?: BreadcrumbItem[];
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  bodyContent: string;
}

function safeJsonLd(obj: Record<string, unknown>): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function breadcrumbJsonLd(items: BreadcrumbItem[]): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return `<script type="application/ld+json">${safeJsonLd(schema)}</script>`;
}

export function renderHtmlShell(options: HtmlShellOptions): string {
  const { meta, breadcrumbs, jsonLd, bodyContent } = options;
  const baseUrl = getBaseUrl();

  const ogTitle = escapeHtml(meta.ogTitle ?? meta.title);
  const ogDesc = escapeHtml(meta.ogDescription ?? meta.description);
  const ogType = meta.ogType ?? "website";

  const jsonLdScripts: string[] = [];
  if (breadcrumbs && breadcrumbs.length > 0) {
    jsonLdScripts.push(breadcrumbJsonLd(breadcrumbs));
  }
  if (jsonLd) {
    const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    for (const item of items) {
      jsonLdScripts.push(
        `<script type="application/ld+json">${safeJsonLd(item)}</script>`
      );
    }
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#1a1a1a" />
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}" />
  <link rel="canonical" href="${escapeHtml(meta.canonical)}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDesc}" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:url" content="${escapeHtml(meta.canonical)}" />
  ${meta.ogImage ? `<meta property="og:image" content="${escapeHtml(meta.ogImage)}" />` : ""}
  <meta property="og:locale" content="fr_CH" />
  <meta property="og:site_name" content="MHP Connect" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
  <link rel="apple-touch-icon" href="/icon-192x192.png" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  ${jsonLdScripts.join("\n  ")}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1a1a1a; background: #fff; line-height: 1.6; }
    a { color: #1a1a1a; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .ssr-header { border-bottom: 1px solid #e5e5e5; padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; }
    .ssr-header-logo { font-weight: 700; font-size: 1.125rem; letter-spacing: -0.025em; }
    .ssr-header-nav { display: flex; gap: 1.5rem; font-size: 0.875rem; }
    .ssr-header-nav a { color: #666; }
    .ssr-header-nav a:hover { color: #1a1a1a; }
    .ssr-footer { border-top: 1px solid #e5e5e5; padding: 2rem 1.5rem; text-align: center; font-size: 0.75rem; color: #999; margin-top: 4rem; }
    .ssr-main { max-width: 72rem; margin: 0 auto; padding: 2rem 1rem; }
    .ssr-breadcrumb { font-size: 0.75rem; color: #666; margin-bottom: 1.5rem; }
    .ssr-breadcrumb a { color: #666; }
    .ssr-breadcrumb a:hover { color: #1a1a1a; }
    .ssr-breadcrumb span { margin: 0 0.375rem; }
    h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.025em; margin-bottom: 0.5rem; }
    h2 { font-size: 1.125rem; font-weight: 600; letter-spacing: -0.015em; margin-bottom: 0.75rem; margin-top: 2rem; }
    .ssr-subtitle { font-size: 0.875rem; color: #666; margin-bottom: 1.5rem; }
    .ssr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
    .ssr-card { border: 1px solid #e5e5e5; border-radius: 0.75rem; padding: 1.25rem; transition: box-shadow 0.2s; }
    .ssr-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .ssr-card h3 { font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem; }
    .ssr-card p { font-size: 0.8125rem; color: #666; }
    .ssr-badge { display: inline-block; font-size: 0.6875rem; padding: 0.125rem 0.5rem; border-radius: 9999px; border: 1px solid #e5e5e5; color: #666; margin-right: 0.375rem; margin-bottom: 0.25rem; }
    .ssr-detail-header { display: flex; gap: 1.5rem; align-items: flex-start; margin-bottom: 2rem; }
    .ssr-avatar { width: 5rem; height: 5rem; border-radius: 9999px; object-fit: cover; background: #f0f0f0; flex-shrink: 0; }
    .ssr-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e5e5; }
    .ssr-faq dt { font-weight: 600; font-size: 0.875rem; margin-top: 1rem; }
    .ssr-faq dd { font-size: 0.8125rem; color: #666; margin-top: 0.25rem; }
    .ssr-link-list { list-style: none; padding: 0; }
    .ssr-link-list li { padding: 0.5rem 0; border-bottom: 1px solid #f0f0f0; }
    .ssr-link-list li:last-child { border-bottom: none; }
    .ssr-link-list a { font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center; }
    .ssr-cta { display: inline-block; margin-top: 1rem; padding: 0.5rem 1.25rem; background: #1a1a1a; color: #fff; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; }
    .ssr-cta:hover { background: #333; text-decoration: none; }
    @media (max-width: 640px) {
      .ssr-main { padding: 1rem 0.75rem; }
      h1 { font-size: 1.25rem; }
      .ssr-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="ssr-header">
    <a href="${baseUrl}" class="ssr-header-logo"><img src="/icon-192x192.png" alt="MHP" style="height:1.5rem;width:1.5rem;vertical-align:middle;margin-right:0.5rem;display:inline-block;" />mhp | connect</a>
    <nav class="ssr-header-nav">
      <a href="${baseUrl}/catalogue">Formations</a>
      <a href="${baseUrl}/annuaire">Annuaire</a>
      <a href="${baseUrl}/agenda">Agenda</a>
    </nav>
  </header>

  <main class="ssr-main">
    ${breadcrumbs && breadcrumbs.length > 0 ? `
    <nav class="ssr-breadcrumb" aria-label="Fil d'Ariane">
      ${breadcrumbs.map((b, i) => i < breadcrumbs.length - 1 ? `<a href="${escapeHtml(b.url)}">${escapeHtml(b.name)}</a><span>›</span>` : `<strong>${escapeHtml(b.name)}</strong>`).join("")}
    </nav>` : ""}
    ${bodyContent}
  </main>

  <footer class="ssr-footer">
    <p>&copy; ${new Date().getFullYear()} MHP Hypnose — Institut de formation OMNI Hypnose&reg; Suisse romande. Tous droits r&eacute;serv&eacute;s.</p>
  </footer>
</body>
</html>`;
}

export function generatePractitionerSlug(
  firstName: string | null,
  lastName: string | null,
  city: string | null,
  slugId: number
): string {
  const parts = [firstName, lastName, city]
    .filter((p): p is string => !!p)
    .map((p) =>
      p
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    )
    .filter((p) => p.length > 0);

  if (parts.length === 0) return String(slugId);
  return `${parts.join("-")}-${slugId}`;
}

export function parseSlugId(slug: string): number | null {
  const match = slug.match(/-(\d+)$/);
  if (match) return parseInt(match[1], 10);
  const asNum = parseInt(slug, 10);
  return isNaN(asNum) ? null : asNum;
}

export function generateMetaDescription(
  type: "practitioner",
  data: {
    name: string;
    practiceName?: string | null;
    specialties?: string[] | null;
    city?: string | null;
    country?: string | null;
    credentials?: { credentialName: string }[];
  }
): string;
export function generateMetaDescription(
  type: "program",
  data: {
    name: string;
    description?: string | null;
    category?: string | null;
    durationInDays?: number | null;
    tags?: string[];
  }
): string;
export function generateMetaDescription(
  type: "practitioner" | "program",
  data: Record<string, unknown>
): string {
  if (type === "practitioner") {
    const d = data as {
      name: string;
      practiceName?: string | null;
      specialties?: string[] | null;
      city?: string | null;
      country?: string | null;
      credentials?: { credentialName: string }[];
    };
    const location = [d.city, d.country].filter(Boolean).join(", ");
    const specs = d.specialties?.slice(0, 3).join(", ");
    const creds = d.credentials?.slice(0, 2).map((c) => c.credentialName).join(", ");

    const parts: string[] = [];
    if (d.practiceName) {
      parts.push(`${d.name}, ${d.practiceName}`);
    } else {
      parts.push(d.name);
    }
    parts.push("praticien(ne) certifié(e) MHP");
    if (location) parts.push(`à ${location}`);
    if (specs) parts.push(`Spécialités : ${specs}`);
    if (creds) parts.push(`Certifications : ${creds}`);
    parts.push("Consultez son profil sur l'annuaire MHP Connect.");

    return parts.join(". ").slice(0, 160);
  }

  const d = data as {
    name: string;
    description?: string | null;
    category?: string | null;
    durationInDays?: number | null;
    tags?: string[];
  };

  if (d.description) {
    const clean = d.description.replace(/<[^>]*>/g, "").trim();
    if (clean.length > 50) return clean.slice(0, 157) + "...";
  }

  const parts: string[] = [`Formation ${d.name}`];
  if (d.category) parts.push(`catégorie ${d.category}`);
  if (d.durationInDays) parts.push(`${d.durationInDays} jours`);
  parts.push("par l'Institut MHP — OMNI Hypnose® Suisse romande.");
  if (d.tags && d.tags.length > 0) parts.push(`Thèmes : ${d.tags.slice(0, 3).join(", ")}.`);
  return parts.join(", ").slice(0, 160);
}
