import nodemailer from "nodemailer";

const port = Number(process.env.MAIL_PORT) || 587;
const mailConfig = {
  host: process.env.MAIL_HOST || "localhost",
  port: port,
  secure: port === 465,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
};

const transporter = nodemailer.createTransport(mailConfig);

export async function sendReceiptEmail(
  toEmail: string,
  registrationNo: string,
  pdfBuffer: ArrayBuffer
) {
  if (!toEmail) return false;

  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME || "Disdukcapil Kota Bandung"}" <${process.env.MAIL_FROM_ADDRESS || mailConfig.auth.user}>`,
    to: toEmail,
    subject: `Bukti Registrasi Pengajuan - ${registrationNo}`,
    text: `Yth. Pemohon,\n\nBerikut terlampir bukti registrasi pengajuan Anda dengan nomor registrasi ${registrationNo}.\n\nSimpan resi ini sebagai bukti registrasi pengajuan.\n\nTerima kasih.\n\nDisdukcapil Kota Bandung`,
    html: `<p>Yth. Pemohon,</p>
           <p>Berikut terlampir bukti registrasi pengajuan Anda dengan nomor registrasi <strong>${registrationNo}</strong>.</p>
           <p>Simpan resi ini sebagai bukti registrasi pengajuan.</p>
           <br/>
           <p>Terima kasih.</p>
           <p><strong>Disdukcapil Kota Bandung</strong></p>`,
    attachments: [
      {
        filename: `Resi-${registrationNo}.pdf`,
        content: Buffer.from(pdfBuffer),
        contentType: "application/pdf",
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
