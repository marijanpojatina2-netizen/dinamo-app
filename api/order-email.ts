// api/order-email.ts
// @ts-nocheck  <-- utišaj TypeScript u ovoj serverless datoteci
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { to, subject, text, html } = req.body || {};

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,                      // npr. mail.vasadomena.hr ili smtp.gmail.com
      port: Number(process.env.SMTP_PORT || 465),       // 465 ili 587
      secure: Number(process.env.SMTP_PORT || 465) === 465, // 465=true, 587=false
      auth: {
        user: process.env.SMTP_USER,                    // npr. oprema@kkdinamo.hr
        pass: process.env.SMTP_PASS,                    // lozinka (ili App Password za Gmail)
      },
    });

    await transporter.sendMail({
      from: `"KK Dinamo" <oprema@kkdinamo.hr>`,
      to,
      subject,
      text,
      html,
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("order-email error:", e);
    res.status(500).send("Email send failed");
  }
}
