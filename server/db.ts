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

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'pending', -- pending, approved, suspended
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    min_stock REAL NOT NULL,
    barcode TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    lot_number TEXT NOT NULL,
    quantity REAL NOT NULL,
    expiry_date TEXT NOT NULL,
    received_date TEXT NOT NULL,
    supplier TEXT NOT NULL,
    temperature_check REAL,
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
