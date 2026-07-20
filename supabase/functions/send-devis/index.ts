// Sends a devis PDF (base64) by email via Resend.
// Invoked from the client with: { devis_id, to, pdf_base64, filename }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { devis_id, to, pdf_base64, filename } = await req.json();
    if (!devis_id || !to || !pdf_base64) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: profile } = await supabase
      .from("business_profile")
      .select("sender_email, trading_name, legal_name")
      .limit(1)
      .maybeSingle();
    const { data: devis } = await supabase
      .from("devis")
      .select("devis_number, language")
      .eq("id", devis_id)
      .maybeSingle();
    const sender = profile?.sender_email;
    if (!sender) {
      return new Response(JSON.stringify({ error: "No sender_email set in business profile" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const tradingName = profile?.trading_name || profile?.legal_name || "Plan B Concept";
    const num = devis?.devis_number ?? "";
    const lang = devis?.language ?? "en";

    const body =
      lang === "fr"
        ? `Bonjour,\n\nVeuillez trouver ci-joint le devis Nº ${num}.\nN'hésitez pas à me contacter pour toute question.\n\nCordialement,\n${tradingName}`
        : `Hello,\n\nPlease find attached quote No. ${num}.\nFeel free to reach out with any questions.\n\nBest regards,\n${tradingName}`;
    const subject =
      lang === "fr" ? `Devis Nº ${num} — ${tradingName}` : `Quote No. ${num} — ${tradingName}`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${tradingName} <${sender}>`,
        to: [to],
        subject,
        text: body,
        attachments: [{ filename: filename || `${num}.pdf`, content: pdf_base64 }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: `Resend ${resp.status}: ${errText}` }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
