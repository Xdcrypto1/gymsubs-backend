import express from "express";
import pool from "../db/index.js";
import protect from "../middleware/auth.js";
import sendReminder from "../mailer/sendReminder.js";

const router = express.Router();

// Get all members
router.get("/", protect, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM members WHERE gym_id = $1 ORDER BY expiry_date ASC",
      [req.gymId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

// Add member manually
router.post("/", protect, async (req, res) => {
  const { name, email, plan, amount, payment_method, payment_reference, whatsapp } =
    req.body;

  const start_date = new Date();
  const expiry_date = new Date();
  expiry_date.setDate(expiry_date.getDate() + 30);

  try {
    const result = await pool.query(
      `INSERT INTO members 
        (name, email, plan, amount, start_date, expiry_date, payment_method, payment_reference, gym_id, whatsapp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        name,
        email,
        plan,
        amount,
        start_date,
        expiry_date,
        payment_method || "cash",
        payment_reference || null,
        req.gymId,
        whatsapp || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add member" });
  }
});

// Update member status
router.patch("/:id", protect, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      "UPDATE members SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update member" });
  }
});

// Delete member
router.delete("/:id", protect, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM members WHERE id = $1", [id]);
    res.json({ message: "Member deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete member" });
  }
});

// Revenue at risk stats
router.get("/stats", protect, async (req, res) => {
  try {
    // Total active members
    const totalResult = await pool.query(
      "SELECT COUNT(*) FROM members WHERE gym_id = $1 AND status = 'active'",
      [req.gymId]
    );

    // Expiring this week
    const expiringResult = await pool.query(
      `SELECT * FROM members 
       WHERE gym_id = $1 
       AND status = 'active'
       AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
       ORDER BY expiry_date ASC`,
      [req.gymId]
    );

    // Revenue at risk this week
    const revenueAtRiskResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM members 
       WHERE gym_id = $1 
       AND status = 'active'
       AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`,
      [req.gymId]
    );

    // Revenue lost this month (expired members)
    const revenueLostResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM members 
       WHERE gym_id = $1 
       AND status = 'expired'
       AND expiry_date >= DATE_TRUNC('month', CURRENT_DATE)`,
      [req.gymId]
    );

    // Recovery rate — active members who were previously expired
    const recoveredResult = await pool.query(
      `SELECT COUNT(*) FROM members 
       WHERE gym_id = $1 
       AND status = 'active'
       AND payment_method = 'renewal'`,
      [req.gymId]
    );

    const expiredThisMonth = await pool.query(
      `SELECT COUNT(*) FROM members
       WHERE gym_id = $1
       AND status = 'expired'
       AND expiry_date >= DATE_TRUNC('month', CURRENT_DATE)`,
      [req.gymId]
    );

    const totalExpired = parseInt(expiredThisMonth.rows[0].count);
    const totalRecovered = parseInt(recoveredResult.rows[0].count);
    const recoveryRate = totalExpired > 0
      ? Math.round((totalRecovered / totalExpired) * 100)
      : 0;

    res.json({
      totalActive: parseInt(totalResult.rows[0].count),
      expiringThisWeek: expiringResult.rows,
      revenueAtRisk: parseInt(revenueAtRiskResult.rows[0].total),
      revenueLost: parseInt(revenueLostResult.rows[0].total),
      recoveryRate,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Send manual reminder
router.post("/:id/remind", protect, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM members WHERE id = $1 AND gym_id = $2",
      [req.params.id, req.gymId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }

    const member = result.rows[0];
    const expiry = new Date(member.expiry_date);
    const today = new Date();
    const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (member.whatsapp) {
      // Format number for WhatsApp API
      const number = member.whatsapp.replace(/^0/, "234").replace(/\D/g, "");
      const message = encodeURIComponent(
        `Hi ${member.name} 👋, your *${member.plan}* membership at our gym expires in *${daysLeft} day${daysLeft !== 1 ? "s" : ""}*. Renew now to keep your access 💪`
      );
      const whatsappUrl = `https://wa.me/${number}?text=${message}`;
      return res.json({ whatsappUrl });
    }

    // Fallback to email if no WhatsApp number
    await sendReminder({
      name: member.name,
      email: member.email,
      plan: member.plan,
      expiry_date: member.expiry_date,
      daysLeft,
    });

    res.json({ message: "Reminder sent via email" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send reminder" });
  }
});

router.post("/remind-all", protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM members 
       WHERE gym_id = $1 
       AND status = 'active'
       AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`,
      [req.gymId]
    );

    const members = result.rows;
    const whatsappLinks = [];

    for (const member of members) {
      const expiry = new Date(member.expiry_date);
      const today = new Date();
      const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

      if (member.whatsapp) {
        const number = member.whatsapp.replace(/^0/, "234").replace(/\D/g, "");
        const message = encodeURIComponent(
          `Hi ${member.name} 👋, your *${member.plan}* membership expires in *${daysLeft} day${daysLeft !== 1 ? "s" : ""}*. Renew now to keep your access 💪`
        );
        whatsappLinks.push({
          name: member.name,
          url: `https://wa.me/${number}?text=${message}`,
        });
      } else {
        await sendReminder({
          name: member.name,
          email: member.email,
          plan: member.plan,
          expiry_date: member.expiry_date,
          daysLeft,
        });
      }
    }

    res.json({
      message: `Processed ${members.length} members`,
      whatsappLinks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send reminders" });
  }
});

export default router;