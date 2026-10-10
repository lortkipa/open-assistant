import nodemailer from 'nodemailer'

const user = process.env.SMTP_USER
const transport = user
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: { user, pass: process.env.SMTP_PASS },
    })
  : null

export async function sendCode(email: string, code: string) {
  if (!transport) {
    console.log(`[dev] sign-in code for ${email}: ${code}`)
    return
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM ?? user,
    to: email,
    subject: `${code} is your Open Assistant code`,
    text: `Your Open Assistant sign-in code is ${code}\n\nIt expires in 10 minutes. If you didn't try to sign in, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;color:#111">
  <h2 style="margin:0 0 12px">Your sign-in code</h2>
  <p style="margin:0 0 20px;color:#555">Enter this code in Open Assistant to continue.</p>
  <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px;background:#f4f4f5;border-radius:10px;text-align:center">${code}</div>
  <p style="margin:20px 0 0;color:#888;font-size:13px">It expires in 10 minutes. If you didn't try to sign in, you can ignore this email.</p>
</div>`,
  })
}
