import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: process.env.NODE_ENV });
  });

  // Configure Multer for file uploads
  const storage = multer.memoryStorage();
  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for ZIP files
  });

  // API Route for form submission
  app.post('/api/contact', upload.single('file'), async (req, res) => {
    const { name, email } = req.body;
    const file = req.file;

    if (!name || !email || !file) {
      return res.status(400).json({ error: 'Bitte füllen Sie alle Pflichtfelder aus und laden Sie eine Datei hoch.' });
    }

    // Check for missing environment variables
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('Missing SMTP_USER or SMTP_PASS environment variables.');
      return res.status(500).json({ error: 'Server-Konfigurationsfehler: SMTP-Zugangsdaten fehlen in den Secrets.' });
    }

    try {
      console.log(`Attempting to send email from ${name} (${email}) to ${process.env.TARGET_EMAIL || 'sk.vrifle@gmail.com'}`);
      
      // Create transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const targetEmail = process.env.TARGET_EMAIL || 'sk.vrifle@gmail.com';

      // Email options
      const mailOptions: any = {
        from: `"${name}" <${process.env.SMTP_USER}>`,
        to: targetEmail,
        replyTo: email,
        subject: `Neue ZIP-Anfrage von ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nEs wurde eine neue ZIP-Datei hochgeladen.`,
        attachments: []
      };

      if (file) {
        mailOptions.attachments.push({
          filename: file.originalname,
          content: file.buffer,
        });
      }

      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully!');
      res.status(200).json({ success: 'Nachricht erfolgreich gesendet!' });
    } catch (error: any) {
      console.error('Email sending error details:', {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response
      });
      res.status(500).json({ error: `Fehler beim Senden: ${error.message || 'Bitte versuchen Sie es später erneut.'}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
