const ALLOWED_ORIGINS = new Set([
  "https://www.esbjergpadelforening.dk",
  "https://esbjergpadelforening.dk",
  "https://www.holdsport.dk",
  "https://holdsport.dk",
]);

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function json(data, status, origin) {
  return Response.json(data, {
    status,
    headers: corsHeaders(origin),
  });
}

function clean(value, maxLength) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160;
}

const CATEGORIES = new Set([
  "Medlemskab",
  "Ungdom",
  "Træning",
  "Hold og liga",
  "Events og turneringer",
  "Partnerskab",
  "Andet",
]);

export async function OPTIONS(request) {
  const origin = request.headers.get("origin") || "";

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response(null, { status: 403, headers: corsHeaders(origin) });
  }

  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request) {
  const origin = request.headers.get("origin") || "";

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ ok: false, message: "Denne formular kan ikke bruges fra denne side." }, 403, origin);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: "Formularen kunne ikke læses." }, 400, origin);
  }

  // Honeypot: bots udfylder ofte skjulte felter. Vi svarer succes uden at sende mail.
  const website = clean(body.website, 200);
  if (website) {
    return json({ ok: true }, 200, origin);
  }

  const name = clean(body.name, 100);
  const email = clean(body.email, 160).toLowerCase();
  const phone = clean(body.phone, 40);
  const category = clean(body.category, 60);
  const subject = clean(body.subject, 140);
  const message = clean(body.message, 4000);

  if (name.length < 2) {
    return json({ ok: false, field: "name", message: "Skriv dit navn." }, 400, origin);
  }

  if (!validEmail(email)) {
    return json({ ok: false, field: "email", message: "Skriv en gyldig e-mailadresse." }, 400, origin);
  }

  if (!CATEGORIES.has(category)) {
    return json({ ok: false, field: "category", message: "Vælg hvad din henvendelse drejer sig om." }, 400, origin);
  }

  if (subject.length < 3) {
    return json({ ok: false, field: "subject", message: "Skriv et emne." }, 400, origin);
  }

  if (message.length < 10) {
    return json({ ok: false, field: "message", message: "Skriv lidt mere om din henvendelse." }, 400, origin);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL || "info@esbjergpadelforening.dk";

  if (!apiKey || !from) {
    console.error("Contact form is missing RESEND_API_KEY or CONTACT_FROM_EMAIL");
    return json(
      {
        ok: false,
        message: "Kontaktformularen er ved at blive sat op. Skriv i stedet til info@esbjergpadelforening.dk.",
      },
      503,
      origin,
    );
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone || "Ikke oplyst");
  const safeCategory = escapeHtml(category);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br>");

  const emailHtml = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#F0ECE5;padding:32px;color:#2C292A;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #D6CCBB;border-radius:14px;overflow:hidden;">
        <div style="height:5px;background:#2A3E91;"></div>
        <div style="padding:28px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#2A3E91;margin-bottom:8px;">Ny henvendelse fra hjemmesiden</div>
          <h1 style="font-size:25px;line-height:1.2;margin:0 0 22px;color:#2C292A;">${safeSubject}</h1>

          <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#686260;width:130px;">Navn</td><td style="padding:8px 0;font-weight:700;">${safeName}</td></tr>
            <tr><td style="padding:8px 0;color:#686260;">E-mail</td><td style="padding:8px 0;font-weight:700;">${safeEmail}</td></tr>
            <tr><td style="padding:8px 0;color:#686260;">Telefon</td><td style="padding:8px 0;font-weight:700;">${safePhone}</td></tr>
            <tr><td style="padding:8px 0;color:#686260;">Kategori</td><td style="padding:8px 0;font-weight:700;">${safeCategory}</td></tr>
          </table>

          <div style="border-top:1px solid #D6CCBB;padding-top:20px;">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#2A3E91;margin-bottom:8px;">Besked</div>
            <div style="font-size:15px;line-height:1.65;">${safeMessage}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const emailText = [
    "Ny henvendelse fra esbjergpadelforening.dk",
    "",
    `Navn: ${name}`,
    `E-mail: ${email}`,
    `Telefon: ${phone || "Ikke oplyst"}`,
    `Kategori: ${category}`,
    `Emne: ${subject}`,
    "",
    "Besked:",
    message,
  ].join("\n");

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `[Kontaktformular] ${category}: ${subject}`,
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!resendResponse.ok) {
      const details = await resendResponse.text();
      console.error("Resend contact form error", resendResponse.status, details);
      return json(
        {
          ok: false,
          message: "Beskeden kunne ikke sendes lige nu. Prøv igen eller skriv til info@esbjergpadelforening.dk.",
        },
        502,
        origin,
      );
    }

    return json(
      {
        ok: true,
        message: "Tak for din besked. Vi vender tilbage hurtigst muligt.",
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("Contact form send failed", error);
    return json(
      {
        ok: false,
        message: "Beskeden kunne ikke sendes lige nu. Prøv igen eller skriv til info@esbjergpadelforening.dk.",
      },
      500,
      origin,
    );
  }
}
