import { createClient } from "npm:@supabase/supabase-js@2";

// Nickname accounts: no email, no confirmation. The nickname maps to a
// synthetic address that is never mailed. Keep in sync with
// accountEmailFromName in src/screens/god-workbench/cloud.js.
const ACCOUNT_EMAIL_DOMAIN = "users.god-workbench.local";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});

const accountEmailFromName = (name: string) => {
    const bytes = new TextEncoder().encode(name.trim().toLowerCase());
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `gw-${hex}@${ACCOUNT_EMAIL_DOMAIN}`;
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
        return json(405, { error: "method_not_allowed" });
    }

    let name = "";
    let password = "";
    try {
        const body = await req.json();
        name = String(body?.name || "").trim();
        password = String(body?.password || "");
    } catch {
        return json(400, { error: "invalid_body" });
    }
    if (!name || name.length > 24 || name.includes("@")) {
        return json(400, { error: "invalid_name" });
    }
    if (password.length < 6) {
        return json(400, { error: "weak_password" });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    const { error } = await admin.auth.admin.createUser({
        email: accountEmailFromName(name),
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
        app_metadata: { app: "god-workbench" }
    });
    if (error) {
        const message = String(error.message || "").toLowerCase();
        if (message.includes("already") || error.status === 422) {
            return json(409, { error: "name_taken" });
        }
        return json(400, { error: "signup_failed", detail: error.message });
    }
    return json(200, { ok: true });
});
