import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import path from "path";
import fs from "fs";
import cors from "cors";
import nodemailer from "nodemailer";
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

// Configure multer for memory storage (required for Cloudflare/Serverless)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB Limit
});

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
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "serverless", storage: "memory" });
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        console.error("Upload attempt without file");
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { originalname, size, buffer } = req.file;
      const userName = req.body.userName || "Unbekannter Nutzer";
      console.log(`Processing memory upload: ${originalname} from ${userName}`);

      // Send Email via Resend (API)
      const resendClient = getResend();
      if (resendClient) {
        try {
          await resendClient.emails.send({
            from: "Vasen Design <onboarding@resend.dev>",
            to: "sk.vrifle@gmail.com",
            subject: `Neues Vasen-Design von ${userName}: ${originalname}`,
            text: `Ein neues Vasen-Design wurde hochgeladen.\n\nAbsender: ${userName}\nDateiname: ${originalname}\nGröße: ${(size / 1024 / 1024).toFixed(2)} MB`,
            attachments: [
              {
                filename: originalname,
                content: buffer,
              }
            ]
          });
          console.log("Resend email sent with attachment");
        } catch (resendError) {
          console.error("Resend API Error:", resendError);
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
            attachments: [{ filename: originalname, content: buffer }],
          });
          console.log("Nodemailer email sent with attachment");
        } catch (error) {
          console.error("Nodemailer Error:", error);
        }
      }

      return res.json({
        message: "File uploaded and sent successfully",
        originalName: originalname,
        size: size,
      });
    } catch (globalError) {
      console.error("Global Upload Route Error:", globalError);
      return res.status(500).json({ 
        error: globalError instanceof Error ? globalError.message : "Interner Serverfehler beim Upload",
        details: String(globalError)
      });
    }
  });

  app.get("/api/files", (req, res) => {
    // SQLite is removed, so we return an empty list or a message
    res.json([]);
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

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express Global Error:", err);
    res.status(500).json({ 
      error: "Server-Fehler", 
      message: err.message || String(err),
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
