import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  programOverrides,
  programEnrollments,
  userProfiles,
} from "@mhp/shared";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";
import {
  getPublishedPrograms,
  getProgramByCode,
} from "../services/program.js";
import {
  renderHtmlShell,
  getBaseUrl,
  generatePractitionerSlug,
  generateMetaDescription,
  type BreadcrumbItem,
} from "./html-shell.js";

const router = Router();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

function generateFaqFromProgram(program: {
  name: string;
  description?: string | null;
  category?: string | null;
  durationInDays?: number | null;
  durationInHours?: number | null;
  digiforma?: {
    goals?: { text: string }[] | null;
    graduationTarget?: string | null;
    admissionModality?: string | null;
    certificationModality?: string | null;
  } | null;
}): { question: string; answer: string }[] {
  const faqs: { question: string; answer: string }[] = [];
  const df = program.digiforma;

  if (program.description) {
    faqs.push({
      question: `Qu'est-ce que la formation "${program.name}" ?`,
      answer: stripHtml(program.description).slice(0, 300),
    });
  }

  if (df?.goals && df.goals.length > 0) {
    faqs.push({
      question: `Quels sont les objectifs de la formation "${program.name}" ?`,
      answer: df.goals.map((g) => g.text).join(". "),
    });
  }

  if (df?.graduationTarget) {
    faqs.push({
      question: `À qui s'adresse la formation "${program.name}" ?`,
      answer: df.graduationTarget,
    });
  }

  if (df?.admissionModality) {
    faqs.push({
      question: `Quels sont les prérequis pour la formation "${program.name}" ?`,
      answer: df.admissionModality,
    });
  }

  if (program.durationInDays || program.durationInHours) {
    let durationStr: string;
    if (program.durationInDays && program.durationInHours) {
      durationStr = `${program.durationInDays} jour${program.durationInDays > 1 ? "s" : ""} (${program.durationInHours} heures)`;
    } else if (program.durationInDays) {
      durationStr = `${program.durationInDays} jour${program.durationInDays > 1 ? "s" : ""}`;
    } else {
      durationStr = `${program.durationInHours} heures`;
    }
    faqs.push({
      question: `Quelle est la durée de la formation "${program.name}" ?`,
      answer: `La formation dure ${durationStr}.`,
    });
  }

  if (df?.certificationModality) {
    faqs.push({
      question: `Comment obtenir la certification à l'issue de la formation "${program.name}" ?`,
      answer: df.certificationModality,
    });
  }

  return faqs;
}

router.get("/catalogue", async (_req, res, next) => {
  if (_req.session?.userId) { next(); return; }
  try {
    const baseUrl = getBaseUrl();
    const catalogue = await getPublishedPrograms();

    const sections = catalogue
      .map(({ category, programs }) => {
        const cards = programs
          .map((p) => {
            const desc = p.description
              ? stripHtml(p.description).slice(0, 120) + "..."
              : "";
            const days = p.durationInDays ?? p.digiforma?.durationInDays ?? null;

            return `
        <a href="${baseUrl}/catalogue/${p.programCode}" class="ssr-card" style="text-decoration:none;display:block;">
          ${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" style="width:100%;height:10rem;object-fit:cover;border-radius:0.5rem 0.5rem 0 0;margin:-1.25rem -1.25rem 1rem -1.25rem;width:calc(100% + 2.5rem);filter:grayscale(1);" loading="lazy" />` : ""}
          ${p.highlightLabel ? `<span class="ssr-badge" style="background:#1a1a1a;color:#fff;border-color:#1a1a1a;">${escapeHtml(p.highlightLabel)}</span>` : ""}
          ${p.tags.slice(0, 2).map((t) => `<span class="ssr-badge">${escapeHtml(t)}</span>`).join("")}
          <h3 style="margin-top:0.5rem;">${escapeHtml(p.name)}</h3>
          ${desc ? `<p>${escapeHtml(desc)}</p>` : ""}
          ${days ? `<p style="margin-top:0.5rem;font-size:0.75rem;color:#999;">${days} jour${days > 1 ? "s" : ""}</p>` : ""}
        </a>`;
          })
          .join("");

        return `
      <section>
        <h2>${escapeHtml(category)}</h2>
        <p class="ssr-subtitle">${programs.length} formation${programs.length > 1 ? "s" : ""}</p>
        <div class="ssr-grid">${cards}</div>
      </section>`;
      })
      .join("");

    const bodyContent = `
    <h1>Catalogue de formations</h1>
    <p class="ssr-subtitle">Découvrez les formations de l'Institut MHP — certifiantes, spécialisées et pratiques.</p>
    ${sections}
    `;

    const breadcrumbs: BreadcrumbItem[] = [
      { name: "Accueil", url: baseUrl },
      { name: "Catalogue", url: `${baseUrl}/catalogue` },
    ];

    const html = renderHtmlShell({
      meta: {
        title: "Catalogue de formations — MHP Hypnose",
        description:
          "Découvrez les formations certifiantes et spécialisations en hypnose de l'Institut MHP — OMNI Hypnose® Suisse romande. Programmes, dates et inscriptions.",
        canonical: `${baseUrl}/catalogue`,
      },
      breadcrumbs,
      bodyContent,
    });

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    res.send(html);
  } catch (err) {
    logger.error({ err }, "SSR catalogue listing error");
    res.status(500).send("Erreur interne du serveur.");
  }
});

router.get("/catalogue/:code", async (req, res, next) => {
  if (req.session?.userId) { next(); return; }
  try {
    const baseUrl = getBaseUrl();
    const code = req.params.code as string;

    let program;
    try {
      program = await getProgramByCode(code);
    } catch {
      res.status(404).send("Programme introuvable.");
      return;
    }

    if (!program.published) {
      res.status(404).send("Programme introuvable.");
      return;
    }

    const df = program.digiforma;
    const days = df?.durationInDays ?? program.durationInDays ?? null;
    const hours = df?.durationInHours ?? program.durationInHours ?? null;

    const completedEnrollments = await db
      .select({
        userId: programEnrollments.userId,
      })
      .from(programEnrollments)
      .where(
        and(
          eq(programEnrollments.programCode, code),
          eq(programEnrollments.status, "completed")
        )
      );

    let certifiedPractitioners: {
      userId: string;
      slugId: number;
      firstName: string | null;
      lastName: string | null;
      city: string | null;
      profileImageUrl: string | null;
    }[] = [];
    if (completedEnrollments.length > 0) {
      const userIds = completedEnrollments.map((e) => e.userId);
      certifiedPractitioners = await db
        .select({
          userId: userProfiles.userId,
          slugId: userProfiles.slugId,
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName,
          city: userProfiles.city,
          profileImageUrl: userProfiles.profileImageUrl,
        })
        .from(userProfiles)
        .where(
          and(
            inArray(userProfiles.userId, userIds),
            eq(userProfiles.directoryVisibility, "public")
          )
        );
    }

    let relatedPrograms: {
      programCode: string;
      displayName: string | null;
      category: string | null;
      imageUrl: string | null;
    }[] = [];
    if (program.category) {
      relatedPrograms = await db
        .select({
          programCode: programOverrides.programCode,
          displayName: programOverrides.displayName,
          category: programOverrides.category,
          imageUrl: programOverrides.imageUrl,
        })
        .from(programOverrides)
        .where(
          and(
            eq(programOverrides.published, true),
            eq(programOverrides.category, program.category)
          )
        );
      relatedPrograms = relatedPrograms.filter(
        (p) => p.programCode !== code
      );
    }

    const faqs = generateFaqFromProgram({
      name: program.name,
      description: program.description,
      category: program.category,
      durationInDays: days,
      durationInHours: hours,
      digiforma: df,
    });

    const metaDesc = generateMetaDescription("program", {
      name: program.name,
      description: program.description,
      category: program.category,
      durationInDays: days,
      tags: program.tags,
    });

    const courseJsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Course",
      name: program.name,
      description: metaDesc,
      provider: {
        "@type": "Organization",
        name: "Institut MHP — OMNI Hypnose® Suisse romande",
        url: baseUrl,
      },
      ...(program.imageUrl && { image: program.imageUrl }),
      ...(days && {
        timeRequired: `P${days}D`,
      }),
      ...(program.category && {
        courseCategory: program.category,
      }),
    };

    const jsonLdItems: Record<string, unknown>[] = [courseJsonLd];

    if (faqs.length > 0) {
      jsonLdItems.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: f.answer,
          },
        })),
      });
    }

    const descHtml = program.description
      ? `<p style="font-size:0.875rem;color:#444;line-height:1.7;white-space:pre-line;margin-top:1rem;">${escapeHtml(stripHtml(program.description))}</p>`
      : "";

    const tagsHtml =
      program.tags.length > 0
        ? `<div style="margin-top:0.75rem;">${program.tags.map((t) => `<span class="ssr-badge">${escapeHtml(t)}</span>`).join("")}</div>`
        : "";

    const goalsHtml =
      df?.goals && df.goals.length > 0
        ? `<div class="ssr-section"><h2>Objectifs pédagogiques</h2><ul>${df.goals.map((g) => `<li style="font-size:0.875rem;color:#444;margin-bottom:0.375rem;">✓ ${escapeHtml(g.text)}</li>`).join("")}</ul></div>`
        : "";

    const stepsHtml =
      df?.steps && df.steps.length > 0
        ? `<div class="ssr-section"><h2>Programme</h2><ol>${df.steps.map((s, i) => `<li style="font-size:0.875rem;margin-bottom:0.5rem;"><strong>${i + 1}.</strong> ${escapeHtml(s.text)}${s.substeps?.length ? `<ul style="margin-top:0.25rem;margin-left:1rem;">${s.substeps.map((sub) => `<li style="font-size:0.8125rem;color:#666;">— ${escapeHtml(sub.text)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ol></div>`
        : "";

    const assessmentsHtml =
      df?.assessments && df.assessments.length > 0
        ? `<div class="ssr-section"><h2>Modalités d'évaluation</h2><ul>${df.assessments.map((a) => `<li style="font-size:0.875rem;color:#444;margin-bottom:0.25rem;">• ${escapeHtml(a.text)}</li>`).join("")}</ul></div>`
        : "";

    const infoHtml = (() => {
      const items: string[] = [];
      if (df?.admissionModality)
        items.push(`<dt>Admission</dt><dd>${escapeHtml(df.admissionModality)}</dd>`);
      if (df?.certificationModality)
        items.push(`<dt>Certification</dt><dd>${escapeHtml(df.certificationModality)}</dd>`);
      if (df?.graduationTarget)
        items.push(`<dt>Public visé</dt><dd>${escapeHtml(df.graduationTarget)}</dd>`);
      if (df?.handicappedAccessibility)
        items.push(`<dt>Accessibilité PMR</dt><dd>${escapeHtml(df.handicappedAccessibility)}</dd>`);
      if (items.length === 0) return "";
      return `<div class="ssr-section"><h2>Informations pratiques</h2><dl class="ssr-faq">${items.join("")}</dl></div>`;
    })();

    const faqHtml =
      faqs.length > 0
        ? `<div class="ssr-section"><h2>Questions fréquentes</h2><dl class="ssr-faq">${faqs.map((f) => `<dt>${escapeHtml(f.question)}</dt><dd>${escapeHtml(f.answer)}</dd>`).join("")}</dl></div>`
        : "";

    const practitionersHtml =
      certifiedPractitioners.length > 0
        ? `<div class="ssr-section"><h2>Praticiens certifiés</h2><p class="ssr-subtitle">${certifiedPractitioners.length} praticien${certifiedPractitioners.length > 1 ? "s" : ""} ayant complété cette formation</p><ul class="ssr-link-list">${certifiedPractitioners.map((p) => {
            const pName = [p.firstName, p.lastName].filter(Boolean).join(" ") || "Praticien";
            const pSlug = generatePractitionerSlug(p.firstName, p.lastName, p.city, p.slugId);
            return `<li><a href="${baseUrl}/annuaire/${pSlug}">${escapeHtml(pName)}${p.city ? ` <span style="color:#999;">— ${escapeHtml(p.city)}</span>` : ""} →</a></li>`;
          }).join("")}</ul></div>`
        : "";

    const durationText = days
      ? `${days} jour${days > 1 ? "s" : ""}${hours ? ` (${hours}h)` : ""}`
      : "";

    const bodyContent = `
    ${program.imageUrl ? `<div style="margin:-2rem -1rem 0 -1rem;"><img src="${escapeHtml(program.imageUrl)}" alt="${escapeHtml(program.name)}" style="width:100%;height:16rem;object-fit:cover;filter:grayscale(1);" /></div>` : ""}
    <h1 style="margin-top:1.5rem;">${escapeHtml(program.name)}</h1>
    ${program.highlightLabel ? `<span class="ssr-badge" style="background:#1a1a1a;color:#fff;border-color:#1a1a1a;">${escapeHtml(program.highlightLabel)}</span>` : ""}
    ${durationText ? `<p style="font-size:0.875rem;color:#666;margin-top:0.5rem;">${escapeHtml(durationText)}</p>` : ""}
    ${tagsHtml}
    ${descHtml}
    ${goalsHtml}
    ${stepsHtml}
    ${assessmentsHtml}
    ${infoHtml}
    ${faqHtml}
    ${practitionersHtml}
    ${relatedPrograms.length > 0 ? `<div class="ssr-section"><h2>Formations similaires</h2><p class="ssr-subtitle">${relatedPrograms.length} autre${relatedPrograms.length > 1 ? "s" : ""} formation${relatedPrograms.length > 1 ? "s" : ""} dans la catégorie ${escapeHtml(program.category ?? "")}</p><ul class="ssr-link-list">${relatedPrograms.map((r) => `<li><a href="${baseUrl}/catalogue/${r.programCode}">${escapeHtml(r.displayName ?? r.programCode)} →</a></li>`).join("")}</ul></div>` : ""}
    <p style="margin-top:2rem;"><a href="${baseUrl}/catalogue" style="font-size:0.875rem;color:#666;">← Retour au catalogue</a></p>
    `;

    const breadcrumbs: BreadcrumbItem[] = [
      { name: "Accueil", url: baseUrl },
      { name: "Catalogue", url: `${baseUrl}/catalogue` },
      { name: program.name, url: `${baseUrl}/catalogue/${code}` },
    ];

    const html = renderHtmlShell({
      meta: {
        title: `${program.name} — Formation MHP Hypnose`,
        description: metaDesc,
        canonical: `${baseUrl}/catalogue/${code}`,
        ogImage: program.imageUrl ?? undefined,
      },
      breadcrumbs,
      jsonLd: jsonLdItems,
      bodyContent,
    });

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    res.send(html);
  } catch (err) {
    logger.error({ err }, "SSR catalogue detail error");
    res.status(500).send("Erreur interne du serveur.");
  }
});

export default router;
