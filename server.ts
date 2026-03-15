import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) {
      console.log(`[AUTH] Accesso negato a ${req.path} - Cookie mancante`);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
      console.log(`[AUTH] Token non valido per ${req.path}`);
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  };

  // --- Auth Routes ---
  app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const id = Math.random().toString(36).substr(2, 9);
      db.prepare('INSERT INTO users (id, email, password) VALUES (?, ?, ?)')
        .run(id, email, hashedPassword);
      res.json({ message: 'Registration successful. Waiting for approval.' });
    } catch (err: any) {
      res.status(400).json({ error: 'Email already exists' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.status !== 'approved') {
      return res.status(403).json({ error: `Account ${user.status}. Contact admin.` });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    
    // Check if we are on HTTPS (AI Studio or Reverse Proxy with SSL)
    const isSecure = req.headers['x-forwarded-proto'] === 'https';
    
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: isSecure, 
      sameSite: isSecure ? 'none' : 'lax',
      path: '/' // Ensure cookie is available for all paths
    });
    res.json({ id: user.id, email: user.email, role: user.role });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
  });

  app.get('/api/auth/me', authenticate, (req, res) => {
    res.json((req as any).user);
  });

  // --- Admin Routes ---
  app.get('/api/admin/users', authenticate, isAdmin, (req, res) => {
    const users = db.prepare('SELECT id, email, role, status, created_at FROM users').all();
    res.json(users);
  });

  app.post('/api/admin/users', authenticate, isAdmin, (req, res) => {
    const { email, password, role, status } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const id = Math.random().toString(36).substr(2, 9);
      db.prepare('INSERT INTO users (id, email, password, role, status) VALUES (?, ?, ?, ?, ?)')
        .run(id, email, hashedPassword, role || 'user', status || 'approved');
      res.json({ id, email, role, status });
    } catch (err: any) {
      console.error('Error adding user:', err);
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        res.status(500).json({ error: 'Internal server error: ' + err.message });
      }
    }
  });

  app.patch('/api/admin/users/:id', authenticate, isAdmin, (req, res) => {
    const { status, role } = req.body;
    db.prepare('UPDATE users SET status = COALESCE(?, status), role = COALESCE(?, role) WHERE id = ?')
      .run(status, role, req.params.id);
    res.json({ message: 'User updated' });
  });

  app.delete('/api/admin/users/:id', authenticate, isAdmin, (req, res) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: 'User deleted' });
  });

  // --- Inventory Routes ---
  app.get('/api/products', authenticate, (req, res) => {
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
  });

  app.post('/api/products', authenticate, (req, res) => {
    const { name, category, unit, min_stock, barcode } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    try {
      db.prepare('INSERT INTO products (id, name, category, unit, min_stock, barcode) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, name, category, unit, min_stock || 5, barcode || null);
      res.json({ id, name, category, unit, min_stock: min_stock || 5, barcode });
    } catch (err) {
      res.status(400).json({ error: 'Barcode already exists or invalid data' });
    }
  });

  app.get('/api/products/barcode/:barcode', authenticate, (req, res) => {
    const product = db.prepare('SELECT * FROM products WHERE barcode = ?').get(req.params.barcode);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  });

  app.post('/api/batches/bulk', authenticate, (req, res) => {
    const { items, lotNumber, expiryDate, supplier, temperatureCheck } = req.body;
    const receivedDate = new Date().toISOString().split('T')[0];
    
    const stmt = db.prepare('INSERT INTO batches (id, product_id, lot_number, quantity, expiry_date, received_date, supplier, temperature_check) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    
    const results = [];
    const transaction = db.transaction((items) => {
      for (const item of items) {
        const id = Math.random().toString(36).substr(2, 9);
        stmt.run(id, item.productId, lotNumber, item.quantity, expiryDate, receivedDate, supplier, temperatureCheck);
        results.push({ id, ...item });
      }
    });

    try {
      transaction(items);
      res.json({ message: 'Bulk upload successful', count: items.length });
    } catch (err) {
      res.status(500).json({ error: 'Failed to process bulk upload' });
    }
  });

  app.get('/api/batches', authenticate, (req, res) => {
    const batches = db.prepare('SELECT * FROM batches').all();
    res.json(batches);
  });

  app.post('/api/batches', authenticate, (req, res) => {
    const { productId, lotNumber, quantity, expiryDate, supplier, temperatureCheck } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    const receivedDate = new Date().toISOString().split('T')[0];
    db.prepare('INSERT INTO batches (id, product_id, lot_number, quantity, expiry_date, received_date, supplier, temperature_check) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, productId, lotNumber, quantity, expiryDate, receivedDate, supplier, temperatureCheck);
    res.json({ id, productId, lotNumber, quantity, expiryDate, receivedDate, supplier, temperatureCheck });
  });

  app.delete('/api/batches/:id', authenticate, (req, res) => {
    db.prepare('DELETE FROM batches WHERE id = ?').run(req.params.id);
    res.json({ message: 'Batch deleted' });
  });

  app.get('/api/logs', authenticate, (req, res) => {
    const logs = db.prepare('SELECT * FROM haccp_logs ORDER BY date DESC').all();
    res.json(logs);
  });

  app.post('/api/logs', authenticate, (req, res) => {
    const { type, description, operator, status } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    const date = new Date().toISOString();
    db.prepare('INSERT INTO haccp_logs (id, date, type, description, operator, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, date, type, description, operator, status);
    res.json({ id, date, type, description, operator, status });
  });

  // Global Error Handler for API
  app.use('/api', (err: any, req: any, res: any, next: any) => {
    console.error('[SERVER ERROR]', err);
    res.status(err.status || 500).json({ 
      error: err.message || 'Internal Server Error',
      details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  });

  // --- Vite Integration ---
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
