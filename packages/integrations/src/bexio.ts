const API_BASE = "https://api.bexio.com/2.0";

export class BexioError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "BexioError";
  }
}

function getToken(): string {
  const token = process.env.BEXIO_API_TOKEN;
  if (!token) throw new BexioError("BEXIO_API_TOKEN is not configured");
  return token;
}

async function bexioRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `Bexio API ${method} ${path} failed: ${res.status} ${res.statusText}`,
      text
    );
    throw new BexioError(
      `Bexio API error: ${res.status} ${res.statusText}`,
      res.status,
      text
    );
  }

  return res.json() as Promise<T>;
}

export interface BexioArticle {
  id: number;
  intern_code: string;
  intern_name: string;
  sale_price: string | null;
  purchase_price: string | null;
  remarks: string | null;
  delivery_price: string | null;
  article_type_id: number;
  stock_id: number | null;
  stock_nr: string | null;
  stock_min_nr: number | null;
  is_stock: boolean;
}

export interface BexioContact {
  id: number;
  nr: string;
  contact_type_id: number;
  name_1: string;
  name_2: string;
  salutation_id: number;
  address: string;
  postcode: string;
  city: string;
  country_id: number | null;
  mail: string;
  mail_second: string;
  phone_fixed: string;
  phone_mobile: string;
  url: string;
  remarks: string;
  language_id: number | null;
  is_lead: boolean;
}

export interface BexioInvoice {
  id: number;
  document_nr: string;
  title: string;
  contact_id: number;
  total_gross: string;
  total_net: string;
  total: string;
  kb_item_status_id: number;
  is_valid_from: string;
  is_valid_to: string;
  api_reference: string | null;
  network_link: string | null;
}

export async function fetchArticles(): Promise<BexioArticle[]> {
  return bexioRequest<BexioArticle[]>("GET", "/article");
}

export async function createArticle(params: {
  internCode: string;
  internName: string;
  salePrice: number;
  articleTypeId?: number;
}): Promise<BexioArticle> {
  return bexioRequest<BexioArticle>("POST", "/article", {
    intern_code: params.internCode,
    intern_name: params.internName,
    sale_price: String(params.salePrice),
    article_type_id: params.articleTypeId ?? 2,
  });
}

export async function fetchArticleByInternCode(
  internCode: string
): Promise<BexioArticle | null> {
  const results = await bexioRequest<BexioArticle[]>("POST", "/article/search", [
    { field: "intern_code", value: internCode, criteria: "=" },
  ]);
  if (results.length > 0) return results[0]!;

  const prefixResults = await bexioRequest<BexioArticle[]>("POST", "/article/search", [
    { field: "intern_code", value: `${internCode}_%`, criteria: "like" },
  ]);
  return prefixResults.length > 0 ? prefixResults[0]! : null;
}

export async function searchContactByEmail(
  email: string
): Promise<BexioContact | null> {
  const results = await bexioRequest<BexioContact[]>("POST", "/contact/search", [
    { field: "mail", value: email, criteria: "=" },
  ]);
  return results.length > 0 ? results[0]! : null;
}

export async function createContact(params: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  postcode?: string;
  city?: string;
  countryId?: number;
}): Promise<BexioContact> {
  return bexioRequest<BexioContact>("POST", "/contact", {
    contact_type_id: 2,
    name_1: params.lastName,
    name_2: params.firstName,
    mail: params.email,
    phone_fixed: params.phone || "",
    address: params.address || "",
    postcode: params.postcode || "",
    city: params.city || "",
    country_id: params.countryId || null,
  });
}

export async function findOrCreateContact(params: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  postcode?: string;
  city?: string;
}): Promise<BexioContact> {
  const existing = await searchContactByEmail(params.email);
  if (existing) return existing;
  return createContact(params);
}

export async function createInvoice(params: {
  contactId: number;
  title: string;
  articleId: number;
  articleName: string;
  price: number;
  quantity?: number;
  apiReference?: string;
}): Promise<BexioInvoice> {
  const invoice = await bexioRequest<BexioInvoice>("POST", "/kb_invoice", {
    title: params.title,
    contact_id: params.contactId,
    user_id: 1,
    bank_account_id: 1,
    payment_type_id: 4,
    language_id: 2,
    currency_id: 1,
    logopaper_id: 1,
    template_slug: "5d3079d503cf225e4a8b4592",
    is_valid_from: new Date().toISOString().split("T")[0],
    is_valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    api_reference: params.apiReference || null,
    mwst_type: 2,
    mwst_is_net: true,
    positions: [
      {
        type: "KbPositionArticle",
        article_id: params.articleId,
        text: params.articleName,
        unit_price: params.price,
        amount: params.quantity || 1,
        tax_id: 6,
      },
    ],
  });
  return invoice;
}

export async function issueInvoice(invoiceId: number): Promise<BexioInvoice> {
  return bexioRequest<BexioInvoice>("POST", `/kb_invoice/${invoiceId}/issue`);
}

export async function getInvoice(invoiceId: number): Promise<BexioInvoice> {
  return bexioRequest<BexioInvoice>("GET", `/kb_invoice/${invoiceId}`);
}

export async function sendInvoice(
  invoiceId: number,
  recipientEmail: string,
  subject?: string
): Promise<unknown> {
  return bexioRequest("POST", `/kb_invoice/${invoiceId}/send`, {
    recipient_email: recipientEmail,
    subject: subject || "Votre facture",
    message: "Veuillez trouver ci-joint votre facture.",
  });
}

export async function createAndSendInvoice(params: {
  contactId: number;
  title: string;
  articleId: number;
  articleName: string;
  price: number;
  email: string;
  apiReference?: string;
}): Promise<BexioInvoice> {
  console.log(
    "Bexio: creating invoice for contact",
    params.contactId,
    "article",
    params.articleId
  );
  const invoice = await createInvoice(params);
  console.log("Bexio: invoice created id=", invoice.id, "- issuing...");
  await issueInvoice(invoice.id);
  console.log("Bexio: invoice issued id=", invoice.id, "- sending to", params.email);
  try {
    await sendInvoice(invoice.id, params.email, params.title);
    console.log("Bexio: invoice sent to", params.email);
  } catch (sendErr) {
    console.error(
      "Bexio: failed to send invoice id=",
      invoice.id,
      "error:",
      sendErr
    );
  }
  const finalInvoice = await getInvoice(invoice.id);
  return finalInvoice;
}
