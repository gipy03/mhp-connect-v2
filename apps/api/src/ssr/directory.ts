import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  userProfiles,
  users,
  accredibleCredentials,
  programEnrollments,
  programOverrides,
} from "@mhp/shared";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";
import {
  renderHtmlShell,
  getBaseUrl,
  generatePractitionerSlug,
  parseSlugId,
  generateMetaDescription,
  type BreadcrumbItem,
} from "./html-shell.js";

const router = Router();

function fullName(
  firstName: string | null,
  lastName: string | null
): string {
  return [firstName, lastName].filter(Boolean).join(" ") || "Praticien";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

router.get("/annuaire", async (_req, res, next) => {
  if (_req.session?.userId) { next(); return; }
  try {
    const baseUrl = getBaseUrl();

    const rows = await db
      .select({
        userId: userProfiles.userId,
        slugId: userProfiles.slugId,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
        practiceName: userProfiles.practiceName,
        city: userProfiles.city,
        country: userProfiles.country,
        specialties: userProfiles.specialties,
        profileImageUrl: userProfiles.profileImageUrl,
      })
      .from(userProfiles)
      .where(eq(userProfiles.directoryVisibility, "public"));

    const cards = rows
      .map((r) => {
        const name = fullName(r.firstName, r.lastName);
        const slug = generatePractitionerSlug(
          r.firstName,
          r.lastName,
          r.city,
          r.slugId
        );
        const location = [r.city, r.country].filter(Boolean).join(", ");
        const specs = r.specialties?.slice(0, 3).join(", ") ?? "";

        return `
      <a href="${baseUrl}/annuaire/${slug}" class="ssr-card" style="text-decoration:none;display:block;">
        <div style="display:flex;gap:1rem;align-items:center;">
          ${r.profileImageUrl ? `<img src="${escapeHtml(r.profileImageUrl)}" alt="${escapeHtml(name)}" class="ssr-avatar" loading="lazy" />` : `<div class="ssr-avatar" style="display:flex;align-items:center;justify-content:center;font-weight:600;font-size:1.25rem;color:#666;">${escapeHtml((r.firstName?.[0] ?? "") + (r.lastName?.[0] ?? ""))}</div>`}
          <div>
            <h3>${escapeHtml(name)}</h3>
            ${r.practiceName ? `<p style="font-size:0.8125rem;color:#444;">${escapeHtml(r.practiceName)}</p>` : ""}
            ${location ? `<p>${escapeHtml(location)}</p>` : ""}
            ${specs ? `<p style="margin-top:0.25rem;">${specs.split(", ").map((s) => `<span class="ssr-badge">${escapeHtml(s)}</span>`).join("")}</p>` : ""}
          </div>
        </div>
      </a>`;
      })
      .join("");

    const bodyContent = `
    <h1>Annuaire des praticiens</h1>
    <p class="ssr-subtitle">${rows.length} praticien${rows.length !== 1 ? "s" : ""} certifié${rows.length !== 1 ? "s" : ""} MHP</p>
    <div class="ssr-grid">${cards}</div>
    `;

    const breadcrumbs: BreadcrumbItem[] = [
      { name: "Accueil", url: baseUrl },
      { name: "Annuaire", url: `${baseUrl}/annuaire` },
    ];

    const html = renderHtmlShell({
      meta: {
        title: "Annuaire des praticiens certifiés — MHP Connect",
        description:
          "Trouvez un praticien certifié MHP près de chez vous. Consultez les profils, spécialités et coordonnées des hypnothérapeutes formés par l'Institut MHP.",
        canonical: `${baseUrl}/annuaire`,
      },
      breadcrumbs,
      bodyContent,
    });

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    res.send(html);
  } catch (err) {
    logger.error({ err }, "SSR directory listing error");
    res.status(500).send("Erreur interne du serveur.");
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/annuaire/:slug", async (req, res, next) => {
  if (req.session?.userId) { next(); return; }
  try {
    const baseUrl = getBaseUrl();
    const paramSlug = req.params.slug as string;
    const isUuid = UUID_RE.test(paramSlug);
    const slugId = isUuid ? null : parseSlugId(paramSlug);

    if (!isUuid && slugId === null) {
      res.status(404).send("Praticien introuvable.");
      return;
    }

    const condition = isUuid
      ? eq(userProfiles.userId, paramSlug)
      : eq(userProfiles.slugId, slugId!);

    const [row] = await db
      .select({ profile: userProfiles, email: users.email })
      .from(userProfiles)
      .innerJoin(users, eq(userProfiles.userId, users.id))
      .where(
        and(
          condition,
          eq(userProfiles.directoryVisibility, "public")
        )
      )
      .limit(1);

    if (!row) {
      res.status(404).send("Praticien introuvable.");
      return;
    }

    const profile = row.profile;
    const name = fullName(profile.firstName, profile.lastName);
    const location = [profile.city, profile.country].filter(Boolean).join(", ");
    const canonicalSlug = generatePractitionerSlug(
      profile.firstName,
      profile.lastName,
      profile.city,
      profile.slugId
    );

    if (req.params.slug !== canonicalSlug) {
      res.redirect(301, `${baseUrl}/annuaire/${canonicalSlug}`);
      return;
    }

    const creds = await db
      .select({
        credentialName: accredibleCredentials.credentialName,
        badgeUrl: accredibleCredentials.badgeUrl,
        issuedAt: accredibleCredentials.issuedAt,
      })
      .from(accredibleCredentials)
      .where(eq(accredibleCredentials.userId, profile.userId));

    const completedEnrollments = await db
      .select({
        programCode: programEnrollments.programCode,
      })
      .from(programEnrollments)
      .where(
        and(
          eq(programEnrollments.userId, profile.userId),
          eq(programEnrollments.status, "completed")
        )
      );

    let linkedPrograms: {
      programCode: string;
      displayName: string | null;
    }[] = [];
    if (completedEnrollments.length > 0) {
      const codes = completedEnrollments.map((e) => e.programCode);
      linkedPrograms = await db
        .select({
          programCode: programOverrides.programCode,
          displayName: programOverrides.displayName,
        })
        .from(programOverrides)
        .where(
          and(
            inArray(programOverrides.programCode, codes),
            eq(programOverrides.published, true)
          )
        );
    }

    const metaDesc = generateMetaDescription("practitioner", {
      name,
      practiceName: profile.practiceName,
      specialties: profile.specialties,
      city: profile.city,
      country: profile.country,
      credentials: creds,
    });

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: profile.practiceName || name,
      description: metaDesc,
      ...(profile.profileImageUrl && { image: profile.profileImageUrl }),
      ...(profile.city && {
        address: {
          "@type": "PostalAddress",
          addressLocality: profile.city,
          ...(profile.country && { addressCountry: profile.country }),
        },
      }),
      ...(profile.website && { url: profile.website }),
    };

    const specsHtml =
      profile.specialties && profile.specialties.length > 0
        ? `<div style="margin-top:0.75rem;">${profile.specialties.map((s) => `<span class="ssr-badge">${escapeHtml(s)}</span>`).join("")}</div>`
        : "";

    const credsHtml =
      creds.length > 0
        ? `<div class="ssr-section"><h2>Certifications</h2><ul class="ssr-link-list">${creds.map((c) => `<li>${escapeHtml(c.credentialName)}${c.issuedAt ? ` <span style="color:#999;font-size:0.75rem;">(${new Date(c.issuedAt).getFullYear()})</span>` : ""}</li>`).join("")}</ul></div>`
        : "";

    const programsHtml =
      linkedPrograms.length > 0
        ? `<div class="ssr-section"><h2>Formations suivies</h2><ul class="ssr-link-list">${linkedPrograms.map((p) => `<li><a href="${baseUrl}/catalogue/${p.programCode}">${escapeHtml(p.displayName ?? p.programCode)} →</a></li>`).join("")}</ul></div>`
        : "";

    const bodyContent = `
    <div class="ssr-detail-header">
      ${profile.profileImageUrl ? `<img src="${escapeHtml(profile.profileImageUrl)}" alt="${escapeHtml(name)}" class="ssr-avatar" style="width:6rem;height:6rem;" />` : `<div class="ssr-avatar" style="width:6rem;height:6rem;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:1.5rem;color:#666;">${escapeHtml((profile.firstName?.[0] ?? "") + (profile.lastName?.[0] ?? ""))}</div>`}
      <div>
        <h1>${escapeHtml(name)}</h1>
        ${profile.practiceName ? `<p style="font-size:1rem;color:#444;margin-bottom:0.25rem;">${escapeHtml(profile.practiceName)}</p>` : ""}
        ${location ? `<p style="color:#666;font-size:0.875rem;">${escapeHtml(location)}</p>` : ""}
        ${specsHtml}
      </div>
    </div>
    ${profile.bio ? `<div style="margin-top:1rem;"><p style="font-size:0.875rem;color:#444;line-height:1.7;white-space:pre-line;">${escapeHtml(profile.bio)}</p></div>` : ""}
    ${profile.website ? `<p style="margin-top:0.75rem;"><a href="${escapeHtml(profile.website)}" target="_blank" rel="noopener noreferrer" style="font-size:0.875rem;color:#2563eb;">Site web →</a></p>` : ""}
    ${credsHtml}
    ${programsHtml}
    <p style="margin-top:2rem;"><a href="${baseUrl}/annuaire" style="font-size:0.875rem;color:#666;">← Retour à l'annuaire</a></p>
    `;

    const breadcrumbs: BreadcrumbItem[] = [
      { name: "Accueil", url: baseUrl },
      { name: "Annuaire", url: `${baseUrl}/annuaire` },
      { name, url: `${baseUrl}/annuaire/${canonicalSlug}` },
    ];

    const html = renderHtmlShell({
      meta: {
        title: `${name} — Annuaire des praticiens MHP`,
        description: metaDesc,
        canonical: `${baseUrl}/annuaire/${canonicalSlug}`,
        ogImage: profile.profileImageUrl ?? undefined,
      },
      breadcrumbs,
      jsonLd,
      bodyContent,
    });

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    res.send(html);
  } catch (err) {
    logger.error({ err }, "SSR directory detail error");
    res.status(500).send("Erreur interne du serveur.");
  }
});

export default router;
