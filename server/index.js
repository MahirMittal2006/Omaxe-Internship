require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DB_NAME = process.env.MYSQL_DATABASE || 'claude_wrapper';
const DOCUMENT_ROOTS = (process.env.DOCUMENT_ROOTS || process.env.DOCUMENT_ROOT || '')
  .split(/[;,\n]/)
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => path.resolve(value));
const DOCUMENT_SCAN_DEPTH = Math.max(0, Number(process.env.DOCUMENT_SCAN_DEPTH || 3));
const DOCUMENT_MAX_FILES = Math.max(1, Number(process.env.DOCUMENT_MAX_FILES || 6));
const DOCUMENT_MAX_CHARS = Math.max(1000, Number(process.env.DOCUMENT_MAX_CHARS || 12000));
const DOCUMENT_MAX_FILE_SIZE = Math.max(1, Number(process.env.DOCUMENT_MAX_FILE_SIZE || 250000));
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.csv', '.log', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.xml', '.yml', '.yaml', '.ini', '.env'
]);
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'when', 'where', 'have', 'has', 'had', 'you', 'your', 'are', 'can', 'will', 'how', 'why', 'use', 'using', 'into', 'about', 'please', 'tell', 'show', 'give', 'make', 'need', 'want', 'folder', 'file', 'documents', 'document'
]);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());

// Initialize Anthropic client
const anthropic = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
};

const pool = mysql.createPool({ ...dbConfig, database: DB_NAME });
let databaseReady = false;

function normalizeTextContent(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join(' ');
  }

  return '';
}

function extractLatestUserMessage(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return normalizeTextContent(messages[index].content);
    }
  }

  return '';
}

function extractKeywords(text) {
  return [...new Set((text.toLowerCase().match(/[a-z0-9]{3,}/g) || [])
    .filter((word) => !STOP_WORDS.has(word))
    .slice(0, 12))];
}

function isTextFile(fileName) {
  return TEXT_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function isPdfFile(fileName) {
  return path.extname(fileName).toLowerCase() === '.pdf';
}

function isSupportedDocumentFile(fileName) {
  return isTextFile(fileName) || isPdfFile(fileName);
}

function isWithinAnyDocumentRoot(candidatePath) {
  return DOCUMENT_ROOTS.some((documentRoot) => {
    const relative = path.relative(documentRoot, candidatePath);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  });
}

async function gatherDocumentMatches(query) {
  if (!DOCUMENT_ROOTS.length) {
    return [];
  }

  const keywords = extractKeywords(query);
  const matches = [];
  let directoriesVisited = 0;
  let filesVisited = 0;

  async function walk(currentDirectory, depth) {
    if (matches.length >= DOCUMENT_MAX_FILES || filesVisited >= 200 || directoriesVisited >= 200 || depth > DOCUMENT_SCAN_DEPTH) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch {
      return;
    }

    directoriesVisited += 1;
    entries.sort((left, right) => {
      if (left.isDirectory() === right.isDirectory()) {
        return left.name.localeCompare(right.name);
      }

      return left.isDirectory() ? 1 : -1;
    });

    for (const entry of entries) {
      if (matches.length >= DOCUMENT_MAX_FILES || filesVisited >= 200) {
        return;
      }

      const fullPath = path.join(currentDirectory, entry.name);
      if (!isWithinAnyDocumentRoot(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
        continue;
      }

      if (!entry.isFile() || !isSupportedDocumentFile(entry.name)) {
        continue;
      }

      filesVisited += 1;

      try {
        const stats = await fs.stat(fullPath);
        if (stats.size > DOCUMENT_MAX_FILE_SIZE) {
          continue;
        }

        const content = isPdfFile(entry.name)
          ? (await pdfParse(await fs.readFile(fullPath))).text || ''
          : await fs.readFile(fullPath, 'utf8');
        const lowerContent = content.toLowerCase();
        const lowerName = entry.name.toLowerCase();

        let score = keywords.length ? 0 : 1;
        let firstMatchIndex = -1;

        for (const keyword of keywords) {
          if (lowerName.includes(keyword)) {
            score += 4;
          }

          const occurrences = lowerContent.split(keyword).length - 1;
          if (occurrences > 0) {
            score += Math.min(occurrences, 3);
            const keywordIndex = lowerContent.indexOf(keyword);
            if (firstMatchIndex === -1 || keywordIndex < firstMatchIndex) {
              firstMatchIndex = keywordIndex;
            }
          }
        }

        if (keywords.length && score <= 0) {
          continue;
        }

        const excerptStart = firstMatchIndex >= 0 ? Math.max(0, firstMatchIndex - 180) : 0;
        const excerpt = content
          .slice(excerptStart, excerptStart + DOCUMENT_MAX_CHARS)
          .replace(/\s+\n/g, '\n')
          .trim();

        matches.push({
          path: DOCUMENT_ROOTS.map((documentRoot) => path.relative(documentRoot, fullPath))
            .find((relativePath) => relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)) || path.basename(fullPath),
          score,
          excerpt,
        });
      } catch {
        // Skip unreadable files and continue scanning other documents.
      }
    }
  }

  for (const documentRoot of DOCUMENT_ROOTS) {
    if (matches.length >= DOCUMENT_MAX_FILES) {
      break;
    }

    await walk(documentRoot, 0);
  }

  return matches
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, DOCUMENT_MAX_FILES);
}

function buildDocumentContext(matches) {
  if (!DOCUMENT_ROOTS.length) {
    return '';
  }

  if (!matches.length) {
    return `Local document folders configured at ${DOCUMENT_ROOTS.join(', ')}, but no relevant text files or PDFs matched this request.`;
  }

  return [
    `Local document folders: ${DOCUMENT_ROOTS.join(', ')}`,
    'Relevant files:',
    ...matches.flatMap((match, index) => [
      `[${index + 1}] ${match.path}`,
      match.excerpt,
    ]),
  ].join('\n');
}

async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await connection.end();
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }

  try {
    req.authUser = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.authUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  return next();
}

async function getUserByUsername(username, skipReadyCheck = false) {
  if (!skipReadyCheck && !databaseReady) {
    return null;
  }

  const [rows] = await pool.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
  return rows[0] || null;
}

async function getUserById(id, skipReadyCheck = false) {
  if (!skipReadyCheck && !databaseReady) {
    return null;
  }

  const [rows] = await pool.query('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function seedAdminIfNeeded() {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminFullName = process.env.ADMIN_FULL_NAME || 'Admin';

  if (!adminUsername || !adminPassword) {
    return;
  }

  const existing = await getUserByUsername(adminUsername, true);
  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  try {
    await pool.query(
      'INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, \'admin\', TRUE)',
      [adminUsername, passwordHash, adminFullName]
    );
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') {
      throw error;
    }
  }
}

async function bootstrap() {
  await ensureDatabase();
  await ensureSchema();
  await seedAdminIfNeeded();
  databaseReady = true;
}

bootstrap().catch((error) => {
  databaseReady = false;
  console.warn('MySQL auth bootstrap failed; starting server without database support:', error.message);
});

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || 'You are a helpful, concise assistant.';

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await getUserByUsername(username.trim());
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials or account disabled.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials or account disabled.' });
    }

    const token = signToken(user);
    const safeUser = await getUserById(user.id);

    return res.json({ token, user: safeUser });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed.', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const user = await getUserById(req.authUser.id);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Account not available.' });
  }
  return res.json({ user });
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ users: rows });
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, fullName, role } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'username, password, and fullName are required.' });
    }

    const existing = await getUserByUsername(username.trim());
    if (existing) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, TRUE)',
      [username.trim(), passwordHash, fullName.trim(), role === 'admin' ? 'admin' : 'user']
    );

    const created = await getUserByUsername(username.trim());
    return res.status(201).json({ user: await getUserById(created.id) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create user.', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

app.patch('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { isActive, role } = req.body;

    const updates = [];
    const values = [];

    if (typeof isActive === 'boolean') {
      updates.push('is_active = ?');
      values.push(isActive);
    }

    if (role === 'admin' || role === 'user') {
      updates.push('role = ?');
      values.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided.' });
    }

    values.push(userId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    if (userId === req.authUser.id && typeof isActive === 'boolean' && !isActive) {
      return res.status(200).json({ user: await getUserById(userId), note: 'Your own admin account was disabled.' });
    }

    return res.json({ user: await getUserById(userId) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update user.', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

app.patch('/api/admin/users/:id/password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

    return res.json({ user: await getUserById(userId) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reset password.', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (userId === req.authUser.id) {
      return res.status(400).json({ error: 'You cannot delete your own account while logged in.' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete user.', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

// Chat endpoint
app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { messages, model } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Invalid request. "messages" must be a non-empty array.'
      });
    }

    const allowedModels = new Set(['claude-sonnet-4-6', 'claude-haiku-4-5']);
    const selectedModel = allowedModels.has(model) ? model : 'claude-sonnet-4-6';

    // Format messages for Anthropic API
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const latestUserMessage = extractLatestUserMessage(messages);
    const documentMatches = await gatherDocumentMatches(latestUserMessage);
    const documentContext = buildDocumentContext(documentMatches);
    const systemPrompt = documentContext
      ? `${SYSTEM_PROMPT}\n\nUse the local document context below when it is relevant to the user's request. Rely on it when it answers the question, and mention the document path naturally when helpful.\n\n${documentContext}`
      : SYSTEM_PROMPT;

    const response = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages: formattedMessages,
    });

    const assistantMessage = response.content[0]?.text || '';

    res.json({
      role: 'assistant',
      content: assistantMessage,
    });
  } catch (error) {
    console.error('Anthropic API Error:', error.message);

    if (error.status === 401) {
      return res.status(401).json({ error: 'Invalid API key. Please check your ANTHROPIC_API_KEY.' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    res.status(500).json({
      error: 'An error occurred while processing your request.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ System prompt: "${SYSTEM_PROMPT.substring(0, 60)}..."`);
  if (DOCUMENT_ROOTS.length) {
    console.log(`✓ Document folders: ${DOCUMENT_ROOTS.join(', ')}`);
  } else {
    console.log('✓ Document folders: not configured');
  }
});
