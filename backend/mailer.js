// ======================================================
// BOOK N MEET - EMAILS
//
// Sends confirmation emails (new account, appointment
// request with token, appointment confirmed, cancelled,
// visit completed) from a Gmail account.
//
// Set these in backend/.env (and in Vercel -> Settings ->
// Environment Variables):
//
//   SMTP_USER = the Gmail address that sends the emails
//   SMTP_PASS = that Gmail's 16-letter "App password"
//
// If they are not set, the website still works; emails are
// simply not sent (the token is still shown on the profile).
// ======================================================

const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");

let transporter = null;

if (SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 465),
        secure: Number(process.env.SMTP_PORT || 465) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
}
else if (process.env.MAIL_TEST_FILE) {
    // Used by the automatic tests: emails are written to a file instead
    transporter = nodemailer.createTransport({ jsonTransport: true });
}

function isEmailOn() {
    return Boolean(transporter);
}

function esc(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// The same look for every email
function layout(title, bodyHtml) {
    return `<!doctype html><html><body style="margin:0;background:#f3f6f9;font-family:Arial,Helvetica,sans-serif;color:#1e2a36">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f9;padding:24px 0"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e1e7ee">
<tr><td style="background:linear-gradient(90deg,#123a63,#1d9c96);background-color:#123a63;padding:18px 24px;color:#ffffff;font-size:20px;font-weight:bold">&#10010; BOOK N MEET</td></tr>
<tr><td style="padding:24px">
<h2 style="margin:0 0 14px;color:#123a63;font-size:20px">${esc(title)}</h2>
${bodyHtml}
<p style="margin:22px 0 0;color:#7a8794;font-size:12px">This is an automatic email from BOOK N MEET. Please do not reply.</p>
</td></tr></table></td></tr></table></body></html>`;
}

function detailsTable(rows) {
    return `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 4px">` +
        rows.filter((r) => r[1]).map((r) =>
            `<tr><td style="padding:7px 0;color:#6b7785;width:38%;border-bottom:1px solid #eef1f4">${esc(r[0])}</td>` +
            `<td style="padding:7px 0;font-weight:bold;border-bottom:1px solid #eef1f4">${esc(r[1])}</td></tr>`).join("") +
        `</table>`;
}

function tokenBlock(token) {
    if (!token) return "";
    return `<div style="margin:18px 0;padding:16px;border:2px dashed #1d9c96;border-radius:12px;text-align:center;background:#f0faf9">
<div style="color:#6b7785;font-size:12px;letter-spacing:1px">YOUR APPOINTMENT TOKEN</div>
<div style="font-size:30px;font-weight:bold;color:#123a63;letter-spacing:2px;margin:6px 0">${esc(token)}</div>
<img src="cid:token-qr" width="150" height="150" alt="QR code for token ${esc(token)}" style="display:block;margin:8px auto 0">
<div style="color:#6b7785;font-size:12px;margin-top:6px">Show this token (or the QR code) at the hospital reception.</div></div>`;
}

function button(link, text) {
    if (!link) return "";
    return `<p style="margin:18px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#1d9c96;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:bold">${esc(text)}</a></p>`;
}

// Send one email. Never throws: a failed email must not stop a booking.
async function send({ to, subject, html, token }) {
    let recipients = Array.from(new Set([].concat(to).filter(Boolean).map((e) => String(e).toLowerCase())));

    // Accounts made by the automatic tests (bnmtest.…) never get real emails
    if (!process.env.MAIL_TEST_FILE) {
        recipients = recipients.filter((e) => !e.startsWith("bnmtest."));
    }
    if (!recipients.length) return false;

    if (!transporter) {
        console.log(`Email not sent (email is not set up in .env): "${subject}" to ${recipients.join(", ")}`);
        return false;
    }

    const attachments = [];
    if (token) {
        attachments.push({
            filename: "token-" + token + ".png",
            content: await QRCode.toBuffer(token, { width: 300, margin: 1 }),
            cid: "token-qr"
        });
    }

    const message = {
        from: `"BOOK N MEET" <${SMTP_USER || "no-reply@booknmeet.test"}>`,
        to: recipients.join(", "),
        subject,
        html,
        attachments
    };

    try {
        const sending = transporter.sendMail(message);
        const timeout = new Promise((resolve) => setTimeout(() => resolve("timeout"), 10000));
        const result = await Promise.race([sending, timeout]);
        if (result === "timeout") {
            console.error("Email took too long and was skipped:", subject);
            return false;
        }
        if (process.env.MAIL_TEST_FILE) {
            require("fs").appendFileSync(process.env.MAIL_TEST_FILE,
                JSON.stringify({ to: message.to, subject, token: token || null }) + "\n");
        }
        return true;
    }
    catch (error) {
        console.error("Email could not be sent:", error.message);
        return false;
    }
}

function bookingRows(b) {
    return [
        ["Patient", b.patientName],
        ["Hospital", b.hospital],
        ["Doctor", b.doctor],
        ["Date", b.date],
        ["Time", b.slot],
        ["Status", b.status]
    ];
}

// ---------------- The emails ----------------

function welcome({ to, name, role, hospital, siteUrl }) {
    const staff = role === "staff";
    return send({
        to,
        subject: "Welcome to BOOK N MEET - your account is ready",
        html: layout("Your account has been created", `
<p>Hello ${esc(name)},</p>
<p>Your BOOK N MEET account was created successfully with this email address.</p>
${detailsTable([["Name", name], ["Email", to], ["Account type", staff ? "Hospital Staff" : "Patient"], ["Hospital", staff ? hospital : ""]])}
<p>${staff ? "You can now log in to manage your hospital's appointments, doctors and schedules." :
            "You can now log in, find hospitals and doctors and book appointments online."}</p>
${button(siteUrl && siteUrl + "/landing.html", "Log in to BOOK N MEET")}
<p style="color:#6b7785;font-size:13px">If you did not create this account, you can ignore this email.</p>`)
    });
}

function bookingReceived(b, to, siteUrl) {
    return send({
        to, token: b.token,
        subject: `Appointment request received - Token ${b.token}`,
        html: layout("We received your appointment request", `
<p>Hello ${esc(b.patientName)},</p>
<p>Your appointment request has been sent to <b>${esc(b.hospital)}</b>. You will get another email when the hospital confirms it.</p>
${tokenBlock(b.token)}
${detailsTable(bookingRows({ ...b, status: "Pending (waiting for the hospital)" }))}
${button(siteUrl && siteUrl + "/profile.html", "View my appointments")}`)
    });
}

function bookingConfirmed(b, to, siteUrl) {
    return send({
        to, token: b.token,
        subject: `Appointment confirmed - Token ${b.token}`,
        html: layout("Your appointment is confirmed", `
<p>Hello ${esc(b.patientName)},</p>
<p><b>${esc(b.hospital)}</b> has confirmed your appointment. Please arrive 10 minutes early and show this token at the reception.</p>
${tokenBlock(b.token)}
${detailsTable(bookingRows({ ...b, status: "Confirmed" }))}
${button(siteUrl && siteUrl + "/profile.html", "View my appointments")}`)
    });
}

function bookingCancelled(b, to, byPatient, siteUrl) {
    return send({
        to,
        subject: `Appointment cancelled - Token ${b.token || ""}`.trim(),
        html: layout("Your appointment was cancelled", `
<p>Hello ${esc(b.patientName)},</p>
<p>${byPatient ? "As you asked, your appointment has been cancelled." :
            "Sorry, " + esc(b.hospital) + " could not accept this appointment. Please book another time slot."}</p>
${detailsTable([["Token", b.token], ...bookingRows({ ...b, status: "Cancelled" })])}
${button(siteUrl && siteUrl + "/first.html", "Book another appointment")}`)
    });
}

function visitCompleted(b, to, siteUrl) {
    return send({
        to,
        subject: `How was your visit to ${b.doctor}?`,
        html: layout("Thank you for visiting", `
<p>Hello ${esc(b.patientName)},</p>
<p>Your appointment with <b>${esc(b.doctor)}</b> at ${esc(b.hospital)} on ${esc(b.date)} is complete.</p>
<p>Please take a minute to rate the doctor and share your experience. It helps other patients choose the right doctor.</p>
${button(siteUrl && siteUrl + "/profile.html", "Rate your doctor")}`)
    });
}

module.exports = { isEmailOn, welcome, bookingReceived, bookingConfirmed, bookingCancelled, visitCompleted };
