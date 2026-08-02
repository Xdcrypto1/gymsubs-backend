<<<<<<< HEAD
import { Resend } from "resend";
=======
import nodemailer from "nodemailer";
>>>>>>> c72b316ed9b6088579d802fee62200c02891e4ef
import dotenv from "dotenv";

dotenv.config();

<<<<<<< HEAD
const resend = new Resend(process.env.RESEND_API_KEY);

const sendReminder = async ({ name, email, plan, expiry_date, daysLeft }) => {
  await resend.emails.send({
    from: "GymSubs <onboarding@resend.dev>",
=======
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendReminder = async ({ name, email, plan, expiry_date, daysLeft }) => {
  const mailOptions = {
    from: `"Gym Membership" <${process.env.EMAIL_USER}>`,
>>>>>>> c72b316ed9b6088579d802fee62200c02891e4ef
    to: email,
    subject: `⚠️ Your ${plan} membership expires in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #111; padding: 24px; text-align: center;">
<<<<<<< HEAD
          <h1 style="color: #e53e3e; margin: 0;">⚡ GymSubs</h1>
        </div>
        <div style="padding: 32px; background: #fff;">
          <h2>Hey ${name} 👋</h2>
          <p style="color: #555; font-size: 16px;">
            Your <strong>${plan}</strong> membership expires in 
            <strong style="color: #e53e3e;">${daysLeft} day${daysLeft > 1 ? "s" : ""}</strong> 
            on <strong>${new Date(expiry_date).toDateString()}</strong>.
          </p>
          <p style="color: #555; font-size: 16px;">
            Renew now to keep your access 💪
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.FRONTEND_URL}"
              style="background: #e53e3e; color: white; padding: 14px 32px; 
                     border-radius: 50px; text-decoration: none; font-weight: bold;">
              Renew Membership
            </a>
          </div>
        </div>
      </div>
    `,
  });
=======
          <h1 style="color: #e53e3e; margin: 0;">EliteFit Gym</h1>
        </div>
        
        <div style="padding: 32px; background: #fff;">
          <h2>Hey ${name} 👋</h2>
          <p style="color: #555; font-size: 16px;">
            Just a heads up — your <strong>${plan}</strong> membership expires in 
            <strong style="color: #e53e3e;">${daysLeft} day${daysLeft > 1 ? "s" : ""}</strong> 
            on <strong>${new Date(expiry_date).toDateString()}</strong>.
          </p>
          
          <p style="color: #555; font-size: 16px;">
            Renew now to keep your access and avoid any interruption to your fitness journey 💪
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a 
              href="https://demo-gym-yxxh.vercel.app/plans"
              style="background: #e53e3e; color: white; padding: 14px 32px; 
                     border-radius: 50px; text-decoration: none; font-weight: bold;
                     font-size: 16px;"
            >
              Renew Membership
            </a>
          </div>

          <p style="color: #999; font-size: 13px;">
            If you have any questions reach us on WhatsApp or reply to this email.
          </p>
        </div>

        <div style="background: #111; padding: 16px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            © 2026 EliteFit Gym. All rights reserved.
          </p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
>>>>>>> c72b316ed9b6088579d802fee62200c02891e4ef
};

export default sendReminder;