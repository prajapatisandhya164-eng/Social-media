import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '64kb' }));

function sanitizeUserText(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#([a-zA-Z0-9_]{2,30})/g) || [];
  const unique = Array.from(new Set(matches.map((tag) => tag.slice(1).toLowerCase())));
  return unique.slice(0, 10);
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'connectly-runtime',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/validate-content', (req, res) => {
  const { type, content, displayName, username, bio } = req.body ?? {};

  if (type === 'post') {
    const clean = sanitizeUserText(content, 1000);
    if (!clean && !req.body?.hasImage) {
      return res.status(400).json({ valid: false, error: 'Post content or an image is required.' });
    }
    return res.json({
      valid: true,
      sanitizedContent: clean,
      hashtags: extractHashtags(clean),
    });
  }

  if (type === 'comment') {
    const clean = sanitizeUserText(content, 400);
    if (!clean) {
      return res.status(400).json({ valid: false, error: 'Comment cannot be empty.' });
    }
    return res.json({ valid: true, sanitizedContent: clean });
  }

  if (type === 'message') {
    const clean = sanitizeUserText(content, 1500);
    if (!clean && !req.body?.hasImage) {
      return res.status(400).json({ valid: false, error: 'Message text or image is required.' });
    }
    return res.json({ valid: true, sanitizedContent: clean });
  }

  if (type === 'profile') {
    const cleanName = sanitizeUserText(displayName, 50);
    const cleanUsername = sanitizeUserText(username, 30).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanBio = sanitizeUserText(bio, 240);

    if (cleanName.length < 2) {
      return res.status(400).json({ valid: false, error: 'Display name must be at least 2 characters.' });
    }
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      return res.status(400).json({
        valid: false,
        error: 'Username must be 3–30 characters using lowercase letters, numbers, or underscores.',
      });
    }
    return res.json({
      valid: true,
      sanitizedProfile: {
        displayName: cleanName,
        username: cleanUsername,
        bio: cleanBio,
      },
    });
  }

  return res.status(400).json({ valid: false, error: 'Unsupported validation type.' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CONNECTLY server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
