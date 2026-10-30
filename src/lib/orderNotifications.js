import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";

// Colour coding for order notification emails so CA.Orders can tell truck vs barge at a glance.
export const ORDER_TYPE_THEME = {
  Truck:   { label: "TRUCK ORDER",  icon: "🚛", header: "#7c2d12", accent: "#f97316", soft: "#fff7ed", text: "#9a3412" },
  Barge:   { label: "BARGE ORDER",  icon: "⚓", header: "#0c4a6e", accent: "#0ea5e9", soft: "#f0f9ff", text: "#075985" },
  "X-Pipe":{ label: "X-PIPE ORDER", icon: "🔗", header: "#134e4a", accent: "#14b8a6", soft: "#f0fdfa", text: "#115e59" },
};

export const themeFor = (type) => ORDER_TYPE_THEME[type] || ORDER_TYPE_THEME.Barge;

// Full-width coloured strip placed directly under the email header.
export const orderTypeBannerRow = (type) => {
  const t = themeFor(type);
  return `
          <tr>
            <td style="background-color: ${t.accent}; padding: 10px 30px; text-align: center;">
              <span style="color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 2px;">${t.icon} ${t.label}</span>
            </td>
          </tr>`;
};

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtDate = (d) => { try { return d ? format(parseISO(d), "EEEE, MMMM d, yyyy") : "—"; } catch { return d || "—"; } };

// Order-confirmation recipients for a market, falling back to the "all" setting.
export async function getOrderRecipients(market) {
  const settings = (await base44.entities.EmailNotificationSettings.filter({ notification_type: "order_confirmation" }))
    .filter((s) => s.is_active !== false && s.recipient_emails?.length > 0);
  const setting = settings.find((s) => s.market === market) || settings.find((s) => !s.market || s.market === "all");
  return [...new Set((setting?.recipient_emails || []).filter(Boolean))];
}

const row = (label, value) => value === undefined || value === null || value === "" ? "" : `
                <tr>
                  <td style="color: #64748b; font-size: 14px; padding: 6px 0; width: 170px;">${esc(label)}</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 600; padding: 6px 0;">${esc(value)}</td>
                </tr>`;

// Email for a dispatch entered directly on a dispatch page (not created from a Sales Order).
export function buildDirectDispatchEmail({ type, dispatch, enteredBy }) {
  const t = themeFor(type);
  const isTruck = type === "Truck";
  const date = isTruck ? dispatch.dispatch_date : (dispatch.start_date || dispatch.delivery_date);
  const time = isTruck ? "" : dispatch.requested_delivery_time;
  const customer = isTruck ? dispatch.customer_name : dispatch.customer;
  const pageName = isTruck ? "Trucking Dispatch" : type === "X-Pipe" ? "Fuel Dock Dispatch" : "Barge Dispatch";

  const lines = isTruck && dispatch.product_lines?.length
    ? dispatch.product_lines.map((l) => `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px;">${esc(l.product_name)}</td><td style="padding: 10px; text-align: right;">${l.ordered_qty != null ? Number(l.ordered_qty).toLocaleString() : "—"} ${esc(l.unit || "")}</td></tr>`).join("")
    : `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px;">${esc(isTruck ? dispatch.product + (dispatch.brand ? ` (${dispatch.brand})` : "") : dispatch.cargo_type) || "—"}</td><td style="padding: 10px; text-align: right;">${(isTruck ? dispatch.gallons : dispatch.gallons_delivered) ? `${Number(isTruck ? dispatch.gallons : dispatch.gallons_delivered).toLocaleString()} gal` : "—"}</td></tr>`;

  const subject = `New ${type === "Truck" ? "Trucking" : type} Order - ${dispatch.market}: ${customer || "—"}${dispatch.vessel_name ? ` - ${dispatch.vessel_name}` : ""}`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; border-top: 6px solid ${t.accent};">
          <tr>
            <td style="background-color: ${t.header}; padding: 28px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">${t.icon} New ${type === "Truck" ? "Trucking" : type} Order</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; opacity: 0.85; font-size: 17px; font-weight: 600;">${esc(dispatch.market)}</p>
            </td>
          </tr>
          ${orderTypeBannerRow(type)}
          <tr><td style="padding: 30px;">
              <div style="background-color: ${t.soft}; border-left: 4px solid ${t.accent}; padding: 14px 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0; color: ${t.text}; font-size: 14px; font-weight: 600;">Entered directly on ${pageName}${enteredBy ? ` by ${esc(enteredBy)}` : ""}</p>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">${format(new Date(), "MMMM d, yyyy h:mm a")}</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                ${row("Customer", customer)}
                ${row("Vessel", dispatch.vessel_name)}
                ${isTruck ? "" : row("Destination", dispatch.destination)}
                ${row(isTruck ? "Dispatch Date" : "Delivery Date", fmtDate(date) + (time ? (time === "TBD" ? " — time TBD" : ` at ${time}`) : ""))}
                ${isTruck ? row("Truck", dispatch.truck_number) : row(type === "X-Pipe" ? "Fuel Dock" : "Barge", dispatch.barge_name || dispatch.fuel_dock_location)}
                ${isTruck ? row("Driver", dispatch.driver_name) : row("Tug", dispatch.is_third_party_towing ? "Third-party towing" : dispatch.tug_name)}
                ${isTruck ? row("Delivery Type", dispatch.delivery_type) : ""}
                ${row("SO #", dispatch.so_number || dispatch.sage_order_number)}
                ${row("Status", dispatch.status)}
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
                <tr style="background-color: ${t.soft};"><th style="padding: 10px; text-align: left; color: ${t.text};">Product</th><th style="padding: 10px; text-align: right; color: ${t.text};">Quantity</th></tr>
                ${lines}
              </table>
              ${dispatch.notes ? `<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 15px; border-radius: 4px;"><p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Notes:</strong> ${esc(dispatch.notes)}</p></div>` : ""}
          </td></tr>
          <tr><td style="background-color: #f8fafc; padding: 16px 30px; border-top: 1px solid #e2e8f0;"><p style="margin: 0; color: #475569; font-size: 12px;">Sent by MyBarge</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject, html };
}

// Sends the direct-dispatch notification. Never throws; returns { sent, failed, recipients }.
export async function sendDirectDispatchNotification({ type, dispatch }) {
  const result = { sent: 0, failed: [], recipients: [] };
  try {
    let enteredBy = "";
    try { enteredBy = (await base44.auth.me())?.full_name || ""; } catch { /* ignore */ }
    const recipients = await getOrderRecipients(dispatch.market);
    result.recipients = recipients;
    if (!recipients.length) return result;
    const { subject, html } = buildDirectDispatchEmail({ type, dispatch, enteredBy });
    for (const to of recipients) {
      try { await base44.functions.invoke("sendEmail", { to, subject, html }); result.sent++; }
      catch (e) { result.failed.push(to); console.error("Order notification failed for", to, e); }
    }
  } catch (e) {
    console.error("Order notification failed:", e);
    result.failed.push("(lookup failed)");
  }
  return result;
}

// Shows a visible warning when a notification could not be sent (previously failures were silent).
export const warnIfNotificationFailed = (res) => {
  if (res && res.failed.length) {
    alert(`Order saved, but the email notification failed for: ${res.failed.join(", ")}. Please notify CA.Orders manually.`);
  }
};