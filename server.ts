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

  // --- Debug Middleware ---
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      const hasToken = !!req.cookies.token;
      console.log(`[API] ${req.method} ${req.path} - Token presente: ${hasToken}`);
    }
    next();
  });

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    // Check both cookie and Authorization header
    let token = req.cookies.token;
    
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      console.log(`[AUTH] Accesso negato a ${req.path} - Token mancante (no cookie, no header)`);
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
    
    // AI Studio preview and production run on HTTPS and require SameSite=None for iframes
    // We force these settings because the app is always accessed via HTTPS in the preview/shared environment
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    console.log(`[AUTH] Login successful for ${email}, token generated`);
    res.json({ id: user.id, email: user.email, role: user.role, token });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/'
    });
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

  app.patch('/api/products/:id', authenticate, (req, res) => {
    const { name, category, unit, min_stock, quantity } = req.body;
    db.prepare('UPDATE products SET name = COALESCE(?, name), category = COALESCE(?, category), unit = COALESCE(?, unit), min_stock = COALESCE(?, min_stock), quantity = COALESCE(?, quantity) WHERE id = ?')
      .run(name, category, unit, min_stock, quantity, req.params.id);
    res.json({ message: 'Product updated' });
  });

  app.delete('/api/products/:id', authenticate, (req, res) => {
    const productId = req.params.id;
    console.log(`[DB] Deleting product: ${productId}`);
    
    try {
      db.transaction(() => {
        // Delete child records first
        db.prepare('DELETE FROM sales WHERE product_id = ?').run(productId);
        db.prepare('DELETE FROM haccp_logs WHERE product_id = ?').run(productId);
        db.prepare('DELETE FROM batches WHERE product_id = ?').run(productId);
        // Finally delete the product
        const result = db.prepare('DELETE FROM products WHERE id = ?').run(productId);
        console.log(`[DB] Deleted ${result.changes} product and its associated data`);
        res.json({ message: 'Product and associated data deleted', changes: result.changes });
      })();
    } catch (err: any) {
      console.error('[DB] Error deleting product:', err);
      res.status(500).json({ error: 'Failed to delete product: ' + err.message });
    }
  });

  app.post('/api/products', authenticate, (req, res) => {
    const { name, category, unit, min_stock, quantity } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    try {
      db.prepare('INSERT INTO products (id, name, category, unit, min_stock, quantity) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, name, category, unit, min_stock || 5, quantity || 0);
      res.json({ id, name, category, unit, min_stock: min_stock || 5, quantity: quantity || 0 });
    } catch (err: any) {
      console.error('Error adding product:', err);
      res.status(400).json({ error: 'Dati non validi o errore del database: ' + err.message });
    }
  });

  app.get('/api/products/barcode/:barcode', authenticate, (req, res) => {
    const batch = db.prepare('SELECT product_id FROM batches WHERE barcode = ?').get(req.params.barcode) as any;
    if (!batch) return res.status(404).json({ error: 'Product not found for this barcode' });
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(batch.product_id);
    res.json(product);
  });

  app.post('/api/batches/bulk', authenticate, (req, res) => {
    const items = Array.isArray(req.body) ? req.body : req.body.items;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid bulk data' });
    }

    const receivedDate = new Date().toISOString().split('T')[0];
    const insertBatchStmt = db.prepare('INSERT INTO batches (id, product_id, lot_number, quantity, expiry_date, received_date, supplier, temperature_check, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const updateProductStmt = db.prepare('UPDATE products SET quantity = quantity + ? WHERE id = ?');
    
    try {
      db.transaction(() => {
        for (const item of items) {
          const id = Math.random().toString(36).substr(2, 9);
          insertBatchStmt.run(
            id, 
            item.product_id || item.productId, 
            item.lot_number || item.lotNumber, 
            item.quantity, 
            item.expiry_date || item.expiryDate, 
            receivedDate, 
            item.supplier, 
            item.temperature || item.temperatureCheck || null, 
            item.barcode || null
          );
          updateProductStmt.run(item.quantity, item.product_id || item.productId);
        }
      })();
      res.json({ message: 'Bulk upload successful', count: items.length });
    } catch (err: any) {
      console.error('[DB] Bulk batch error:', err);
      res.status(500).json({ error: 'Failed to process bulk upload: ' + err.message });
    }
  });

  app.get('/api/batches', authenticate, (req, res) => {
    const batches = db.prepare('SELECT * FROM batches').all();
    res.json(batches);
  });

  app.patch('/api/batches/:id', authenticate, (req, res) => {
    const { lotNumber, quantity, expiryDate, supplier, temperatureCheck, barcode } = req.body;
    const batchId = req.params.id;
    
    try {
      db.transaction(() => {
        if (quantity !== undefined) {
          const oldBatch = db.prepare('SELECT product_id, quantity FROM batches WHERE id = ?').get(batchId) as any;
          if (oldBatch) {
            const diff = Number(quantity) - oldBatch.quantity;
            db.prepare('UPDATE products SET quantity = quantity + ? WHERE id = ?')
              .run(diff, oldBatch.product_id);
          }
        }

        db.prepare('UPDATE batches SET lot_number = COALESCE(?, lot_number), quantity = COALESCE(?, quantity), expiry_date = COALESCE(?, expiry_date), supplier = COALESCE(?, supplier), temperature_check = COALESCE(?, temperature_check), barcode = COALESCE(?, barcode) WHERE id = ?')
          .run(lotNumber, quantity, expiryDate, supplier, temperatureCheck, barcode, batchId);
      })();
      res.json({ message: 'Batch updated and stock adjusted' });
    } catch (err: any) {
      console.error('[DB] Batch update error:', err);
      res.status(400).json({ error: 'Failed to update batch: ' + err.message });
    }
  });

  app.post('/api/batches', authenticate, (req, res) => {
    const { productId, lotNumber, quantity, expiryDate, supplier, temperatureCheck, barcode } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    const receivedDate = new Date().toISOString().split('T')[0];
    const qty = Number(quantity) || 0;

    try {
      db.transaction(() => {
        db.prepare('INSERT INTO batches (id, product_id, lot_number, quantity, expiry_date, received_date, supplier, temperature_check, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, productId, lotNumber, qty, expiryDate, receivedDate, supplier, temperatureCheck, barcode || null);
        
        db.prepare('UPDATE products SET quantity = quantity + ? WHERE id = ?')
          .run(qty, productId);
      })();
      res.json({ id, productId, lotNumber, quantity: qty, expiryDate, receivedDate, supplier, temperatureCheck, barcode });
    } catch (err: any) {
      console.error('[DB] Batch creation error:', err);
      res.status(400).json({ error: 'Failed to create batch: ' + err.message });
    }
  });

  app.delete('/api/batches/:id', authenticate, (req, res) => {
    const batchId = req.params.id;
    console.log(`[DB] Deleting batch: ${batchId}`);
    
    try {
      db.transaction(() => {
        const batch = db.prepare('SELECT product_id, quantity FROM batches WHERE id = ?').get(batchId) as any;
        if (batch) {
          // Decrement product quantity when a batch is deleted
          db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?')
            .run(batch.quantity, batch.product_id);
        }

        // Delete child records first (sales reference batches)
        db.prepare('DELETE FROM sales WHERE batch_id = ?').run(batchId);
        
        const result = db.prepare('DELETE FROM batches WHERE id = ?').run(batchId);
        console.log(`[DB] Deleted ${result.changes} batches`);
        res.json({ message: 'Batch deleted and stock updated', changes: result.changes });
      })();
    } catch (err: any) {
      console.error('[DB] Error deleting batch:', err);
      res.status(500).json({ error: 'Failed to delete batch: ' + err.message });
    }
  });

  app.get('/api/logs', authenticate, (req, res) => {
    const logs = db.prepare('SELECT * FROM haccp_logs ORDER BY date DESC').all();
    res.json(logs);
  });

  app.patch('/api/logs/:id', authenticate, (req, res) => {
    const { type, description, operator, status, productId, lotNumber } = req.body;
    db.prepare('UPDATE haccp_logs SET type = COALESCE(?, type), description = COALESCE(?, description), operator = COALESCE(?, operator), status = COALESCE(?, status), product_id = COALESCE(?, product_id), lot_number = COALESCE(?, lot_number) WHERE id = ?')
      .run(type, description, operator, status, productId, lotNumber, req.params.id);
    res.json({ message: 'Log updated' });
  });

  app.post('/api/logs', authenticate, (req, res) => {
    const { type, description, operator, status, productId, lotNumber } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    const date = new Date().toISOString();
    db.prepare('INSERT INTO haccp_logs (id, date, type, description, operator, status, product_id, lot_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, date, type, description, operator, status, productId || null, lotNumber || null);
    res.json({ id, date, type, description, operator, status, productId, lotNumber });
  });

  app.delete('/api/logs/:id', authenticate, (req, res) => {
    console.log(`[DB] Deleting log: ${req.params.id}`);
    const result = db.prepare('DELETE FROM haccp_logs WHERE id = ?').run(req.params.id);
    console.log(`[DB] Deleted ${result.changes} logs`);
    res.json({ message: 'Log deleted', changes: result.changes });
  });

  // --- Sales Routes ---
  app.get('/api/sales', authenticate, (req, res) => {
    const sales = db.prepare('SELECT * FROM sales ORDER BY date DESC').all();
    res.json(sales);
  });

  app.post('/api/sales', authenticate, (req, res) => {
    const { product_id, batch_id, quantity, customer_name, customer_address, customer_phone, invoice_number } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    const date = new Date().toISOString();
    
    try {
      db.transaction(() => {
        db.prepare('INSERT INTO sales (id, product_id, batch_id, quantity, customer_name, customer_address, customer_phone, invoice_number, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, product_id, batch_id, quantity, customer_name, customer_address, customer_phone || null, invoice_number || null, date);
        
        // Update product quantity
        db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?')
          .run(quantity, product_id);

        // Update batch quantity
        db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?')
          .run(quantity, batch_id);
      })();
      res.json({ id, product_id, batch_id, quantity, customer_name, customer_address, customer_phone, invoice_number, date });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
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
