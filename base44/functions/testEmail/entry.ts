import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Secret is configured as POSTMARK_EMAIL_API; POSTMARK_SERVER_TOKEN kept as a fallback name.
const SECRET_NAME = Deno.env.get("POSTMARK_EMAIL_API") !== undefined ? "POSTMARK_EMAIL_API" : (Deno.env.get("POSTMARK_SERVER_TOKEN") !== undefined ? "POSTMARK_SERVER_TOKEN" : null);
const RAW_TOKEN = SECRET_NAME ? Deno.env.get(SECRET_NAME) : undefined;
const POSTMARK_SERVER_TOKEN = (RAW_TOKEN || "").trim().replace(/^["']|["']$/g, "");

// Safe diagnostics: never returns the token itself.
const tokenDiagnostics = () => ({
    secret_found: RAW_TOKEN !== undefined,
    secret_name_used: SECRET_NAME,
    raw_length: RAW_TOKEN ? RAW_TOKEN.length : 0,
    cleaned_length: POSTMARK_SERVER_TOKEN.length,
    had_whitespace_or_quotes: !!RAW_TOKEN && RAW_TOKEN !== POSTMARK_SERVER_TOKEN,
    looks_like_uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(POSTMARK_SERVER_TOKEN),
    ends_with: POSTMARK_SERVER_TOKEN ? POSTMARK_SERVER_TOKEN.slice(-4) : null,
});
const FROM_EMAIL = "MyBarge <Notifications@Mybarge.org>";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin only' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const toEmail = body.to || user.email;
        const ccEmail = body.cc || null;

        const postmarkPayload = {
            From: FROM_EMAIL,
            To: toEmail,
            Subject: 'Test Email from MyBarge - ' + new Date().toISOString(),
            HtmlBody: '<p>This is a test email sent at ' + new Date().toISOString() + '. If you receive this, email notifications are working via Postmark.</p>',
            MessageStream: 'outbound',
        };
        if (ccEmail) {
            postmarkPayload.Cc = ccEmail;
        }

        const response = await fetch('https://api.postmarkapp.com/email', {
            method: 'POST',
            headers: {
                'X-Postmark-Server-Token': POSTMARK_SERVER_TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(postmarkPayload),
        });

        const result = await response.json();

        if (!response.ok) {
            return Response.json({ error: result.Message || 'Postmark API error', details: result, token_check: tokenDiagnostics() }, { status: 500 });
        }

        return Response.json({ success: true, result, sentTo: toEmail, ccedTo: ccEmail, token_check: tokenDiagnostics() });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});