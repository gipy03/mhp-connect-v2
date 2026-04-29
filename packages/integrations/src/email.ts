import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_APP_PASSWORD,
  },
});

const FROM_NAME = "mhp | connect";
const FROM_EMAIL = process.env.SMTP_USER || "noreply@mhp-hypnose.com";

function getBaseUrl(requestBaseUrl?: string): string {
  if (requestBaseUrl) return requestBaseUrl;
  return process.env.BASE_URL || "http://localhost:5000";
}

export function deriveBaseUrl(req: {
  protocol: string;
  get: (name: string) => string | undefined;
}): string {
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  const host = req.get("host");
  if (host) return `${proto}://${host}`;
  return getBaseUrl();
}

export async function sendSetPasswordEmail(
  email: string,
  token: string,
  firstName?: string | null,
  requestBaseUrl?: string
): Promise<void> {
  const url = `${getBaseUrl(requestBaseUrl)}/set-password?token=${token}`;
  const greeting = firstName ? `Bonjour ${firstName}` : "Bonjour";

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: "Créez votre mot de passe — mhp | connect",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
          ${greeting},
        </p>
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
          Votre compte sur mhp | connect est prêt. Cliquez sur le lien ci-dessous pour créer votre mot de passe et accéder à votre espace.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${url}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 14px; font-weight: 500;">
            Créer mon mot de passe
          </a>
        </div>
        <p style="font-size: 13px; color: #868686; line-height: 1.5;">
          Ce lien est valable pendant 24 heures. Si vous n'avez pas demandé ce lien, vous pouvez ignorer cet email.
        </p>
        <hr style="border: none; border-top: 1px solid #E5E5E5; margin: 32px 0 16px;" />
        <p style="font-size: 12px; color: #868686;">
          mhp | connect
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  firstName?: string | null,
  requestBaseUrl?: string
): Promise<void> {
  const url = `${getBaseUrl(requestBaseUrl)}/reset-password?token=${token}`;
  const greeting = firstName ? `Bonjour ${firstName}` : "Bonjour";

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: "Réinitialisation de mot de passe — mhp | connect",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
          ${greeting},
        </p>
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
          Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le lien ci-dessous pour en créer un nouveau.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${url}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 14px; font-weight: 500;">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="font-size: 13px; color: #868686; line-height: 1.5;">
          Ce lien est valable pendant 1 heure. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.
        </p>
        <hr style="border: none; border-top: 1px solid #E5E5E5; margin: 32px 0 16px;" />
        <p style="font-size: 12px; color: #868686;">
          mhp | connect
        </p>
      </div>
    `,
  });
}

export async function sendRegistrationConfirmationEmail(
  email: string,
  firstName: string | null,
  programName: string,
  sessionDates: string | null,
  invoiceDocumentNr: string | null,
  invoiceTotal: string | null,
  invoiceNetworkLink: string | null,
  extranetUrl: string | null = null
): Promise<void> {
  const greeting = firstName ? `Bonjour ${firstName}` : "Bonjour";

  let invoiceSection = "";
  if (invoiceDocumentNr || invoiceTotal) {
    invoiceSection = `
      <p style="font-size: 15px; color: #333; line-height: 1.6; margin-top: 16px;">
        <strong>Facture :</strong> ${invoiceDocumentNr || "—"}<br/>
        <strong>Montant :</strong> CHF ${invoiceTotal || "—"}
      </p>
    `;
  }

  let invoiceButton = "";
  if (invoiceNetworkLink) {
    invoiceButton = `
      <div style="margin: 24px 0;">
        <a href="${invoiceNetworkLink}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 14px; font-weight: 500;">
          Consulter ma facture
        </a>
      </div>
    `;
  }

  const sessionSection = sessionDates
    ? `
    <p style="font-size: 15px; color: #333; line-height: 1.6;">
      <strong>Session :</strong> ${sessionDates}
    </p>
  `
    : "";

  const extranetSection = extranetUrl
    ? `
      <div style="margin: 28px 0;">
        <a href="${extranetUrl}" style="display: block; text-decoration: none; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px 20px; background: linear-gradient(135deg, #f0fdfb 0%, #fdf8f6 100%);">
          <table cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="width: 44px; vertical-align: middle;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: #0d9488; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 36px;">
                  <span style="color: #fff; font-size: 18px;">🎓</span>
                </div>
              </td>
              <td style="vertical-align: middle; padding-left: 12px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111;">Espace apprenant DigiForma</p>
                <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Documents, évaluations et ressources de votre formation</p>
              </td>
              <td style="width: 60px; text-align: right; vertical-align: middle;">
                <span style="font-size: 13px; font-weight: 500; color: #0d9488; white-space: nowrap;">Ouvrir →</span>
              </td>
            </tr>
          </table>
        </a>
      </div>
    `
    : "";

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: "Confirmation d'inscription — mhp | connect",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
          ${greeting},
        </p>
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
          Votre inscription à la formation <strong>${programName}</strong> a bien été enregistrée.
        </p>
        ${sessionSection}
        ${invoiceSection}
        ${invoiceButton}
        ${extranetSection}
        <hr style="border: none; border-top: 1px solid #E5E5E5; margin: 32px 0 16px;" />
        <p style="font-size: 12px; color: #868686;">
          mhp | connect
        </p>
      </div>
    `,
  });
}

// Generic send — used by the notification processor to deliver rendered templates
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
}

export async function verifySmtpConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log("SMTP connection verified successfully");
    return true;
  } catch (err) {
    console.error("SMTP connection failed:", err);
    return false;
  }
}
