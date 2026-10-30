import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Secret is configured as POSTMARK_EMAIL_API.
const POSTMARK_SERVER_TOKEN = (Deno.env.get("POSTMARK_EMAIL_API") || "").trim().replace(/^["']|["']$/g, "");
const FROM_EMAIL = "MyBarge Notifications <Notifications@Mybarge.org>";
// Notifications@Mybarge.org is send-only (no mailbox), so replies must be directed to a real inbox.
// Override per send by passing replyTo.
const DEFAULT_REPLY_TO = "CA.Orders@ptlmarine.com";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { to, subject, html, replyTo } = body;

        if (!to || !subject || !html) {
            return Response.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 });
        }

        // Support comma-separated recipients or array
        const recipients = Array.isArray(to) ? to : to.split(',').map(e => e.trim()).filter(Boolean);

        const response = await fetch('https://api.postmarkapp.com/email', {
            method: 'POST',
            headers: {
                'X-Postmark-Server-Token': POSTMARK_SERVER_TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                From: FROM_EMAIL,
                To: recipients.join(', '),
                Subject: subject,
                HtmlBody: html,
                ReplyTo: (replyTo || DEFAULT_REPLY_TO),
                MessageStream: 'outbound',
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Postmark API error:', result);
            return Response.json({ error: result.Message || 'Failed to send email', details: result }, { status: 500 });
        }

        return Response.json({ success: true, id: result.MessageID, sentTo: recipients });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});