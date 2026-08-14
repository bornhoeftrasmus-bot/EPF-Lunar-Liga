"use client";

import { useState } from "react";

const INITIAL = {
  name: "",
  email: "",
  phone: "",
  category: "",
  subject: "",
  message: "",
  website: "",
};

export default function ContactForm() {
  const [form, setForm] = useState(INITIAL);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [sending, setSending] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();

    if (sending) return;

    setSending(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Beskeden kunne ikke sendes lige nu. Prøv igen eller skriv til info@esbjergpadelforening.dk.",
        );
      }

      setForm(INITIAL);
      setStatus({
        type: "success",
        message: data.message || "Tak for din besked. Vi vender tilbage hurtigst muligt.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error?.message ||
          "Beskeden kunne ikke sendes lige nu. Prøv igen eller skriv til info@esbjergpadelforening.dk.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="epf-contact-page">
      <section className="epf-contact-shell">
        <div className="epf-contact-intro">
          <div className="epf-contact-eyebrow">Kontakt</div>

          <h1>
            Vi er klar til at
            <br />
            <span>hjælpe dig.</span>
          </h1>

          <p className="epf-contact-lead">
            Har du spørgsmål om medlemskab, træning, ungdom, events eller samarbejde,
            er du altid velkommen til at kontakte Esbjerg Padelforening.
          </p>

          <div className="epf-contact-details">
            <a
              className="epf-contact-detail"
              href="https://www.google.com/maps/search/?api=1&query=Kirkegade+102+6700+Esbjerg"
              target="_blank"
              rel="noreferrer"
            >
              <span className="epf-contact-detail-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
                  <circle cx="12" cy="9" r="2.3" />
                </svg>
              </span>
              <span>
                <small>Adresse</small>
                <strong>Kirkegade 102, 6700 Esbjerg</strong>
              </span>
            </a>

            <a className="epf-contact-detail" href="mailto:info@esbjergpadelforening.dk">
              <span className="epf-contact-detail-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="3.5" y="5" width="17" height="14" rx="2" />
                  <path d="m4.5 7 7.5 6 7.5-6" />
                </svg>
              </span>
              <span>
                <small>E-mail</small>
                <strong>info@esbjergpadelforening.dk</strong>
              </span>
            </a>

            <a className="epf-contact-detail" href="tel:+4527210419">
              <span className="epf-contact-detail-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M7 3.5 10 8 8 10c1.3 2.8 3.2 4.7 6 6l2-2 4.5 3c.3.2.5.6.4 1-.4 1.8-1.9 3-3.8 3C10 21 3 14 3 6.9 3 5 4.2 3.5 6 3.1c.4-.1.8.1 1 .4Z" />
                </svg>
              </span>
              <span>
                <small>Telefon</small>
                <strong>+45 27 21 04 19</strong>
              </span>
            </a>
          </div>
        </div>

        <div className="epf-contact-form-card">
          <div className="epf-contact-form-head">
            <span className="epf-contact-form-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 6h16v12H4z" />
                <path d="m4 7 8 6 8-6" />
              </svg>
            </span>
            <div>
              <span className="epf-contact-kicker">Skriv til os</span>
              <h2>Send en besked</h2>
            </div>
          </div>

          <form onSubmit={submit} className="epf-contact-form">
            <div className="epf-contact-two-col">
              <label>
                <span>Navn *</span>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  autoComplete="name"
                  required
                  maxLength={100}
                  placeholder="Dit navn"
                />
              </label>

              <label>
                <span>E-mail *</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                  autoComplete="email"
                  required
                  maxLength={160}
                  placeholder="din@email.dk"
                />
              </label>
            </div>

            <div className="epf-contact-two-col">
              <label>
                <span>Telefon</span>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={updateField}
                  autoComplete="tel"
                  maxLength={40}
                  placeholder="Valgfrit"
                />
              </label>

              <label>
                <span>Henvendelsen drejer sig om *</span>
                <select name="category" value={form.category} onChange={updateField} required>
                  <option value="" disabled>
                    Vælg emne
                  </option>
                  <option value="Medlemskab">Medlemskab</option>
                  <option value="Ungdom">Ungdom</option>
                  <option value="Træning">Træning</option>
                  <option value="Hold og liga">Hold og liga</option>
                  <option value="Events og turneringer">Events og turneringer</option>
                  <option value="Partnerskab">Partnerskab</option>
                  <option value="Andet">Andet</option>
                </select>
              </label>
            </div>

            <label>
              <span>Emne *</span>
              <input
                type="text"
                name="subject"
                value={form.subject}
                onChange={updateField}
                required
                maxLength={140}
                placeholder="Hvad handler din henvendelse om?"
              />
            </label>

            <label>
              <span>Besked *</span>
              <textarea
                name="message"
                value={form.message}
                onChange={updateField}
                required
                maxLength={4000}
                rows={7}
                placeholder="Skriv din besked her..."
              />
            </label>

            <label className="epf-contact-honeypot" aria-hidden="true">
              Website
              <input
                type="text"
                name="website"
                value={form.website}
                onChange={updateField}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>

            <div className="epf-contact-submit-row">
              <button type="submit" disabled={sending}>
                {sending ? "Sender..." : "Send besked"}
                {!sending && <span aria-hidden="true">→</span>}
              </button>

              <p>
                Ved at sende formularen accepterer du, at vi bruger oplysningerne til at besvare din
                henvendelse.
              </p>
            </div>

            {status.message && (
              <div
                className={`epf-contact-status ${
                  status.type === "success" ? "is-success" : "is-error"
                }`}
                role="status"
                aria-live="polite"
              >
                {status.message}
              </div>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
