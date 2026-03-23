import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { Dropbox } from 'dropbox';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.enable('trust proxy');
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  }));
  app.use(express.json());

  // Middleware to allow iframe embedding
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', "frame-ancestors *;");
    next();
  });

  // Handle OPTIONS preflight for all routes
  app.options('*', cors());

  // Request logger middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Health check and diagnostic endpoints
  app.get('/ping', (req, res) => {
    res.send('pong');
  });

  app.get('/debug-root', (req, res) => {
    res.send('Server is alive and reaching debug-root');
  });

  app.get('/api/v1/test', (req, res) => {
    res.json({ message: 'API Test-Endpunkt ist bereit. Bitte nutzen Sie POST für den E-Mail-Test.', method: req.method });
  });

  app.get('/api/v1/upload', (req, res) => {
    res.json({ message: 'API Upload-Endpunkt ist bereit. Bitte nutzen Sie POST für Datei-Uploads.', method: req.method });
  });

  // Test email connection endpoint
  app.post('/api/v1/test', async (req, res) => {
    console.log('POST /api/v1/test reached');
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ error: 'SMTP-Zugangsdaten fehlen.' });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.verify();
      console.log('SMTP Connection verified successfully!');
      
      const targetEmail = process.env.TARGET_EMAIL || 'sk.vrifle@gmail.com';
      await transporter.sendMail({
        from: `"${process.env.SMTP_USER}" <${process.env.SMTP_USER}>`,
        to: targetEmail,
        subject: 'Test-E-Mail von Ihrer App',
        text: 'Die E-Mail-Verbindung funktioniert einwandfrei!'
      });

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('SMTP Verification failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for form submission
  app.post('/api/v1/upload', upload.single('file'), async (req, res) => {
    console.log('POST /api/v1/upload reached');
    const { name, email } = req.body;
    const file = req.file;

    if (!name || !email || !file) {
      return res.status(400).json({ error: 'Bitte füllen Sie alle Pflichtfelder aus und laden Sie eine Datei hoch.' });
    }

    // Check for missing environment variables
    if (!process.env.DROPBOX_ACCESS_TOKEN) {
      console.error('Missing DROPBOX_ACCESS_TOKEN environment variable.');
      return res.status(500).json({ error: 'Server-Konfigurationsfehler: Dropbox-Zugangsdaten fehlen.' });
    }

    try {
      console.log(`Uploading file ${file.originalname} to Dropbox...`);
      
      // Initialize Dropbox
      const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });
      
      // Upload to Dropbox
      const dropboxPath = `/Uploads/${new Date().toISOString().split('T')[0]}_${name.replace(/\s+/g, '_')}_${file.originalname}`;
      
      const uploadResponse = await dbx.filesUpload({
        path: dropboxPath,
        contents: file.buffer,
        mode: { '.tag': 'overwrite' }
      });
      
      console.log('Dropbox upload successful:', uploadResponse.result.path_display);

      // Send email notification
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        console.log(`Sending notification email to ${process.env.TARGET_EMAIL || 'sk.vrifle@gmail.com'}`);
        
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

        await transporter.sendMail({
          from: `"${name}" <${process.env.SMTP_USER}>`,
          to: targetEmail,
          replyTo: email,
          subject: `Neuer Dropbox-Upload von ${name}`,
          text: `Name: ${name}\nEmail: ${email}\n\nEs wurde eine neue Datei in Dropbox hochgeladen:\nPfad: ${uploadResponse.result.path_display}\nGröße: ${(file.size / 1024 / 1024).toFixed(2)} MB`,
        });
        
        console.log('Notification email sent successfully!');
      } else {
        console.warn('SMTP credentials missing, skipping notification email.');
      }

      res.status(200).json({ success: 'Datei erfolgreich in Dropbox hochgeladen!' });
    } catch (error: any) {
      console.error('Upload error details:', error);
      const errorMsg = error.error?.error_summary || error.message || 'Unbekannter Fehler beim Upload.';
      res.status(500).json({ error: `Fehler beim Upload: ${errorMsg}` });
    }
  });

  // 404 for any other /api routes
  app.all('/api/*', (req, res) => {
    console.log(`404 on API route: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API-Endpunkt ${req.method} ${req.url} nicht gefunden.` });
  });

  console.log(`NODE_ENV is currently: ${process.env.NODE_ENV}`);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('Starting in DEVELOPMENT mode with Vite middleware');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    // Fallback for SPA in dev mode
    app.get('*', async (req, res, next) => {
      if (req.url.startsWith('/api/')) return next();
      try {
        const fs = await import('fs');
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    console.log('Starting in PRODUCTION mode serving static files');
    const distPath = path.resolve(process.cwd(), 'dist');
    console.log(`Serving static files from: ${distPath}`);
    
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      if (req.url.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
