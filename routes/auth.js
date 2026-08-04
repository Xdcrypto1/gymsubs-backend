import express from "express";
import pool from "../db/index.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Register
router.post("/register", async (req, res) => {
  const { gym_name, email } = req.body;

  if (!gym_name || !email) {
    return res.status(400).json({ error: "Gym name and email are required" });
  }

  try {
    const exists = await pool.query(
      "SELECT * FROM gyms WHERE email = $1",
      [email]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    await pool.query(
      "INSERT INTO gyms (gym_name, email) VALUES ($1, $2)",
      [gym_name, email]
    );

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      "UPDATE gyms SET magic_token = $1, magic_token_expiry = $2 WHERE email = $3",
      [token, expiry, email]
    );

    const magicLink = `${process.env.FRONTEND_URL}/verify?token=${token}`;

    await resend.emails.send({
      from: "GymSubs <onboarding@resend.dev>",
      to: email,
      subject: "Welcome to GymSubs — Access your dashboard",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #111; padding: 24px; text-align: center;">
            <h1 style="color: #e53e3e; margin: 0;">⚡ GymSubs</h1>
          </div>
          <div style="padding: 32px; background: #fff;">
            <h2>Welcome to GymSubs 💪</h2>
            <p style="color: #555;">Your gym account has been created. Click the button below to access your dashboard.</p>
            <p style="color: #999; font-size: 13px;">This link expires in 15 minutes.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${magicLink}"
                style="background: #e53e3e; color: white; padding: 14px 32px;
                       border-radius: 50px; text-decoration: none; font-weight: bold;">
                Access My Dashboard
              </a>
            </div>
            <p style="color: #999; font-size: 13px;">If you didn't create this account ignore this email.</p>
          </div>
        </div>
      `,
    });

    res.status(201).json({ message: "Account created. Check your email to log in." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Request magic link
router.post("/magic-link", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM gyms WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "No account found with this email" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      "UPDATE gyms SET magic_token = $1, magic_token_expiry = $2 WHERE email = $3",
      [token, expiry, email]
    );

    const magicLink = `${process.env.FRONTEND_URL}/verify?token=${token}`;

    await resend.emails.send({
      from: "GymSubs <onboarding@resend.dev>",
      to: email,
      subject: "Your GymSubs login link",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #111; padding: 24px; text-align: center;">
            <h1 style="color: #e53e3e; margin: 0;">⚡ GymSubs</h1>
          </div>
          <div style="padding: 32px; background: #fff;">
            <h2>Your login link 🔐</h2>
            <p style="color: #555;">Click the button below to log in to your GymSubs dashboard. This link expires in 15 minutes and can only be used once.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${magicLink}"
                style="background: #e53e3e; color: white; padding: 14px 32px;
                       border-radius: 50px; text-decoration: none; font-weight: bold;">
                Log In to GymSubs
              </a>
            </div>
            <p style="color: #999; font-size: 13px;">If you didn't request this ignore this email.</p>
          </div>
        </div>
      `,
    });

    res.json({ message: "Magic link sent to your email" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send magic link" });
  }
});

// Verify magic link token
router.post("/verify", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM gyms 
       WHERE magic_token = $1 
       AND magic_token_expiry > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired link" });
    }

    const gym = result.rows[0];

    await pool.query(
      "UPDATE gyms SET magic_token = NULL, magic_token_expiry = NULL WHERE id = $1",
      [gym.id]
    );

    const jwtToken = jwt.sign({ id: gym.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token: jwtToken,
      gym: { id: gym.id, gym_name: gym.gym_name, email: gym.email },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;