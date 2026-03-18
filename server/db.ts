import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'data', 'database.sqlite')
  : path.join(__dirname, 'database.sqlite');

if (process.env.NODE_ENV === 'production') {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// --- Migration System ---
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY,
    description TEXT,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const migrations = [
  {
    id: 1,
    description: 'Initial schema',
    run: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          unit TEXT NOT NULL,
          min_stock REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS batches (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          lot_number TEXT NOT NULL,
          quantity REAL NOT NULL,
          expiry_date TEXT NOT NULL,
          received_date TEXT NOT NULL,
          FOREIGN KEY (product_id) REFERENCES products(id)
        );
        CREATE TABLE IF NOT EXISTS haccp_logs (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          type TEXT NOT NULL,
          description TEXT NOT NULL,
          operator TEXT NOT NULL,
          status TEXT NOT NULL
        );
      `);
    }
  },
  {
    id: 2,
    description: 'Add barcode to products',
    run: () => {
      try {
        db.exec('ALTER TABLE products ADD COLUMN barcode TEXT');
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');
      } catch (err) {
        console.log('[DB] Column barcode might already exist or error occurred:', err);
      }
    }
  },
  {
    id: 3,
    description: 'Add supplier and temperature_check to batches',
    run: () => {
      try {
        db.exec('ALTER TABLE batches ADD COLUMN supplier TEXT');
      } catch (err) {
        console.log('[DB] Column supplier might already exist, skipping...');
      }
      try {
        db.exec('ALTER TABLE batches ADD COLUMN temperature_check REAL');
      } catch (err) {
        console.log('[DB] Column temperature_check might already exist, skipping...');
      }
    }
  },
  {
    id: 4,
    description: 'Link haccp_logs to products and lots',
    run: () => {
      try {
        db.exec('ALTER TABLE haccp_logs ADD COLUMN product_id TEXT');
      } catch (err) {
        console.log('[DB] Column product_id might already exist, skipping...');
      }
      try {
        db.exec('ALTER TABLE haccp_logs ADD COLUMN lot_number TEXT');
      } catch (err) {
        console.log('[DB] Column lot_number might already exist, skipping...');
      }
    }
  },
  {
    id: 5,
    description: 'Add quantity to products and create sales table',
    run: () => {
      try {
        db.exec('ALTER TABLE products ADD COLUMN quantity REAL DEFAULT 0');
        // Initialize quantity from existing batches
        db.exec(`
          UPDATE products 
          SET quantity = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM batches 
            WHERE batches.product_id = products.id
          )
        `);
      } catch (err) {
        console.log('[DB] Column quantity might already exist, skipping...');
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          batch_id TEXT NOT NULL,
          quantity REAL NOT NULL,
          customer_name TEXT NOT NULL,
          customer_address TEXT NOT NULL,
          date TEXT NOT NULL,
          FOREIGN KEY (product_id) REFERENCES products(id),
          FOREIGN KEY (batch_id) REFERENCES batches(id)
        )
      `);
    }
  },
  {
    id: 6,
    description: 'Add customer_phone and invoice_number to sales',
    run: () => {
      try {
        db.exec('ALTER TABLE sales ADD COLUMN customer_phone TEXT');
      } catch (err) {
        console.log('[DB] Column customer_phone might already exist, skipping...');
      }
      try {
        db.exec('ALTER TABLE sales ADD COLUMN invoice_number TEXT');
      } catch (err) {
        console.log('[DB] Column invoice_number might already exist, skipping...');
      }
    }
  },
  {
    id: 7,
    description: 'Add barcode to batches',
    run: () => {
      try {
        db.exec('ALTER TABLE batches ADD COLUMN barcode TEXT');
      } catch (err) {
        console.log('[DB] Column barcode might already exist in batches, skipping...');
      }
    }
  }
];

// Apply migrations in a transaction
const applyMigrations = () => {
  const applied = db.prepare('SELECT id FROM _migrations').all().map((m: any) => m.id);
  
  for (const migration of migrations) {
    if (!applied.includes(migration.id)) {
      console.log(`[DB] Applying migration ${migration.id}: ${migration.description}`);
      try {
        db.transaction(() => {
          migration.run();
          db.prepare('INSERT INTO _migrations (id, description) VALUES (?, ?)').run(migration.id, migration.description);
        })();
      } catch (err) {
        console.error(`[DB] Failed to apply migration ${migration.id}:`, err);
        // If it's a "duplicate column" error, we might want to mark it as applied anyway 
        // if we are fixing a legacy DB state.
        if (err instanceof Error && err.message.includes('duplicate column name')) {
          db.prepare('INSERT INTO _migrations (id, description) VALUES (?, ?)').run(migration.id, migration.description);
        } else {
          throw err;
        }
      }
    }
  }
};

applyMigrations();

// Robust check for barcode column (fallback if migration was marked applied but failed)
const tableInfo = db.prepare("PRAGMA table_info(products)").all() as any[];
const hasBarcode = tableInfo.some(col => col.name === 'barcode');
if (!hasBarcode && tableInfo.length > 0) {
  console.log('[DB] Manually adding missing barcode column to products');
  try {
    db.exec('ALTER TABLE products ADD COLUMN barcode TEXT');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');
  } catch (err) {
    console.error('[DB] Failed to add barcode column:', err);
  }
}

// Robust check for lot_number column in haccp_logs
const haccpTableInfo = db.prepare("PRAGMA table_info(haccp_logs)").all() as any[];
const hasLotNumber = haccpTableInfo.some(col => col.name === 'lot_number');
if (!hasLotNumber && haccpTableInfo.length > 0) {
  console.log('[DB] Manually adding missing lot_number column to haccp_logs');
  try {
    db.exec('ALTER TABLE haccp_logs ADD COLUMN lot_number TEXT');
  } catch (err) {
    console.error('[DB] Failed to add lot_number column:', err);
  }
}

// Create initial admin if not exists
const adminEmail = 'admin@gastrostock.it';
const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
if (!existingAdmin) {
  // Password will be 'admin123' - in a real app this should be changed immediately
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (id, email, password, role, status) VALUES (?, ?, ?, ?, ?)')
    .run(Math.random().toString(36).substr(2, 9), adminEmail, hashedPassword, 'admin', 'approved');
}

export default db;
