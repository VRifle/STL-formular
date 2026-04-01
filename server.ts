import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import path from "path";
import fs from "fs";
import cors from "cors";
import nodemailer from "nodemailer";
import Database from "better-sqlite3";
import { Resend } from "resend";

// Initialize Resend (API-based email, works on Cloudflare)
const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY missing. API-based emails will not be sent.");
    return null;
  }
  return new Resend(apiKey);
};

// Initialize SQLite database
const db = new Database("designs.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS designs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userName TEXT,
    filename TEXT,
    originalName TEXT,
    size INTEGER,
    createdAt TEXT
  )
`);

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer for storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Email Transporter Configuration
// Note: Use environment variables for security
const getTransporter = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn("Email configuration missing. Emails will not be sent.");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { filename, originalname, path: filePath, size } = req.file;
    const userName = req.body.userName || "Unbekannter Nutzer";
    const createdAt = new Date().toISOString();
    console.log(`File uploaded by ${userName}:`, filename);

    // Store metadata in SQLite
    try {
      const stmt = db.prepare("INSERT INTO designs (userName, filename, originalName, size, createdAt) VALUES (?, ?, ?, ?, ?)");
      stmt.run(userName, filename, originalname, size, createdAt);
      console.log("Metadata stored in SQLite");
    } catch (dbError) {
      console.error("Failed to store metadata in SQLite:", dbError);
    }

    // Send Email via Resend (API) - Works on Cloudflare
    const resendClient = getResend();
    if (resendClient) {
      try {
        await resendClient.emails.send({
          from: "Vasen Design <onboarding@resend.dev>", // Replace with your domain later
          to: "sk.vrifle@gmail.com",
          subject: `Neues Vasen-Design von ${userName}: ${originalname}`,
          text: `Ein neues Vasen-Design wurde hochgeladen.\n\nAbsender: ${userName}\nDateiname: ${originalname}\nGröße: ${(size / 1024 / 1024).toFixed(2)} MB`,
          // Note: Resend attachments need a special format, for now we send the text notification
        });
        console.log(`Resend API email sent for ${userName}`);
      } catch (resendError) {
        console.error("Resend API failed:", resendError);
      }
    }

    // Fallback: Send Email via Nodemailer (SMTP)
    const transporter = getTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"Design Upload" <${process.env.GMAIL_USER}>`,
          to: "sk.vrifle@gmail.com",
          subject: `Neues Vasen-Design von ${userName}: ${originalname}`,
          text: `Ein neues Vasen-Design wurde hochgeladen.\n\nAbsender: ${userName}\nDateiname: ${originalname}\nGröße: ${(size / 1024 / 1024).toFixed(2)} MB`,
          attachments: [
            {
              filename: originalname,
              path: filePath,
            },
          ],
        });
        console.log(`Email sent successfully to sk.vrifle@gmail.com for ${userName}`);
      } catch (error) {
        console.error("Failed to send email:", error);
        // We still return success for the upload, but log the email error
      }
    }

    res.json({
      message: "File uploaded successfully",
      filename: filename,
      originalName: originalname,
      size: size,
    });
  });

  app.get("/api/files", (req, res) => {
    try {
      const stmt = db.prepare("SELECT * FROM designs ORDER BY id DESC");
      const designs = stmt.all();
      res.json(designs);
    } catch (dbError) {
      console.error("Failed to fetch designs from SQLite:", dbError);
      res.status(500).json({ error: "Unable to fetch designs" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
