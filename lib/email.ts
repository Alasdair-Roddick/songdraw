import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;

// Null when unconfigured instead of throwing at import time. lib/auth.ts is
// imported by every authed page and route; a missing key should break only the
// reset flow, not the whole app. The request endpoint already answers with the
// same neutral message either way, so an unconfigured deploy leaks nothing —
// it just never delivers.
const resend = apiKey && from ? new Resend(apiKey) : null;

export function emailConfigured() {
	return resend !== null;
}

// Email clients strip <style> blocks and most modern CSS, so this is inlined
// and table-free by design: a single centred column that degrades to plain
// left-aligned text anywhere exotic. oklch() is unsupported in mail, so the
// brand yellow is hard-coded as hex here rather than read from globals.css.
function resetEmailHtml(name: string, url: string) {
	return `<div style="margin:0;padding:24px;background:#faf9f7;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:2px solid #111111;">
    <div style="padding:24px 24px 0 24px;">
      <p style="margin:0 0 4px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6b6b6b;">SongDraw</p>
      <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.1;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase;color:#111111;">Reset your password</h1>
      <p style="margin:0 0 20px 0;font-size:15px;line-height:1.5;color:#111111;">Hi ${escapeHtml(name)} — tap the button to choose a new password. The link works once and expires in an hour.</p>
      <a href="${escapeHtml(url)}" style="display:block;padding:14px 20px;background:#f5c518;border:2px solid #111111;color:#111111;font-size:16px;font-weight:700;text-align:center;text-decoration:none;">Choose a new password</a>
      <p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:#6b6b6b;">Didn't ask for this? Ignore this email — your password stays as it is.</p>
      <p style="margin:16px 0 24px 0;font-size:11px;line-height:1.5;color:#6b6b6b;word-break:break-all;">${escapeHtml(url)}</p>
    </div>
  </div>
</div>`;
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export async function sendPasswordResetEmail({
	name,
	email,
	url,
}: {
	name: string;
	email: string;
	url: string;
}) {
	if (!resend || !from) {
		console.error(
			"password reset requested but RESEND_API_KEY/EMAIL_FROM unset",
		);
		return;
	}

	const { error } = await resend.emails.send({
		from,
		to: email,
		subject: "Reset your SongDraw password",
		html: resetEmailHtml(name, url),
		// Plain-text alternative keeps it out of spam folders that penalise
		// HTML-only mail, and makes the link usable in a text-mode client.
		text: `Hi ${name} — choose a new password here (the link works once and expires in an hour):\n\n${url}\n\nDidn't ask for this? Ignore this email.`,
	});

	// Thrown so Better Auth's endpoint surfaces a failure rather than telling
	// the user to check an inbox nothing was ever sent to.
	if (error) {
		throw new Error(`resend failed: ${error.name}: ${error.message}`);
	}
}
