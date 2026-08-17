// ============================================================================
// db.js — Universal Database Adapter (PostgreSQL for Cloud/Vercel + SQLite for Local/Fallback)
// ============================================================================

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

let dbClient = null;
let isPostgres = false;
let isInitialized = false;
let initPromise = null;

// Detect Environment
const DATABASE_URL = process.env.DATABASE_URL;
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);

if (DATABASE_URL && (DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://'))) {
    isPostgres = true;
    const { Pool } = require('pg');
    const isLocalPostgres = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');

    dbClient = new Pool({
        connectionString: DATABASE_URL,
        ssl: isLocalPostgres ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });

    dbClient.on('error', (err) => {
        console.error('Unexpected PostgreSQL Pool Error:', err);
    });

    console.log('📦 Database Mode: PostgreSQL (Production / Cloud)');
} else {
    isPostgres = false;
    const sqlite3 = require('sqlite3').verbose();
    
    // On Vercel serverless, the repository filesystem is READ-ONLY.
    // The only writable location on Vercel lambda is /tmp.
    const dbPath = isVercel 
        ? path.join('/tmp', 'database.db') 
        : path.join(__dirname, 'database.db');

    dbClient = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ SQLite connection failed:', err.message);
        } else {
            console.log(`📦 Database Mode: SQLite (${dbPath})`);
        }
    });
}

// Convert '?' SQL placeholders to '$1, $2, ...' for PostgreSQL compatibility
function formatSql(sql) {
    if (!isPostgres) return sql;
    let paramIndex = 1;
    return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

// ============================================================================
// Database Initialization & Schema Migrations
// ============================================================================

async function initDatabase() {
    if (isInitialized) return;
    
    try {
        console.log('🔄 Initializing database schema...');

        if (isPostgres) {
            // PostgreSQL Schema
            await dbClient.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(100) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS products (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    category VARCHAR(100),
                    price NUMERIC(10, 2) NOT NULL,
                    quantity INTEGER DEFAULT 0,
                    supplier VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS suppliers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    company VARCHAR(255),
                    phone VARCHAR(50),
                    email VARCHAR(100),
                    address TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS sales (
                    id SERIAL PRIMARY KEY,
                    invoice_number VARCHAR(100) UNIQUE NOT NULL,
                    customer_name VARCHAR(255),
                    subtotal NUMERIC(10, 2) NOT NULL,
                    gst NUMERIC(10, 2) DEFAULT 0,
                    total NUMERIC(10, 2) NOT NULL,
                    date VARCHAR(100) NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sale_items (
                    id SERIAL PRIMARY KEY,
                    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
                    product_id INTEGER,
                    quantity INTEGER NOT NULL,
                    price NUMERIC(10, 2) NOT NULL,
                    subtotal NUMERIC(10, 2) NOT NULL
                );
            `);
        } else {
            // SQLite Schema execution
            await executeRaw(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE,
                    password TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await executeRaw(`
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    category TEXT,
                    price REAL NOT NULL,
                    quantity INTEGER DEFAULT 0,
                    supplier TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await executeRaw(`
                CREATE TABLE IF NOT EXISTS suppliers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    company TEXT,
                    phone TEXT,
                    email TEXT,
                    address TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await executeRaw(`
                CREATE TABLE IF NOT EXISTS sales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    invoice_number TEXT UNIQUE,
                    customer_name TEXT,
                    subtotal REAL,
                    gst REAL,
                    total REAL,
                    date TEXT
                )
            `);

            await executeRaw(`
                CREATE TABLE IF NOT EXISTS sale_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_id INTEGER,
                    product_id INTEGER,
                    quantity INTEGER,
                    price REAL,
                    subtotal REAL,
                    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
                )
            `);
        }

        // Check and seed default admin user
        const adminUser = await executeGet('SELECT * FROM users WHERE username = ?', ['admin']);
        if (!adminUser) {
            const defaultHash = await bcrypt.hash('admin123', 10);
            await executeRun('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', defaultHash]);
            console.log('✅ Created default admin account (admin / admin123)');
        } else if (adminUser.password === 'admin123') {
            const upgradedHash = await bcrypt.hash('admin123', 10);
            await executeRun('UPDATE users SET password = ? WHERE id = ?', [upgradedHash, adminUser.id]);
            console.log('🔒 Upgraded legacy plaintext admin password to bcrypt hash');
        }

        // Check if sample data should be populated
        const productCount = await executeGet('SELECT COUNT(*) as count FROM products');
        const count = isPostgres ? parseInt(productCount.count, 10) : productCount.count;

        if (count === 0) {
            console.log('🌱 Seeding initial demo data...');
            await executeRun(`INSERT INTO suppliers (name, company, phone, email, address) VALUES (?, ?, ?, ?, ?)`, [
                'Rajesh Sharma', 'ElectroTech Global Ltd', '+91 9876543210', 'contact@electrotech.com', 'Plot 42, Electronics City, Bengaluru'
            ]);
            await executeRun(`INSERT INTO suppliers (name, company, phone, email, address) VALUES (?, ?, ?, ?, ?)`, [
                'Priya Patel', 'Apex Supplies & Paper', '+91 9123456780', 'sales@apexsupplies.in', '12 Industrial Area, Mumbai'
            ]);

            await executeRun(`INSERT INTO products (name, category, price, quantity, supplier) VALUES (?, ?, ?, ?, ?)`, [
                'Dell Latitude 5420 Laptop', 'Electronics', 58500.00, 15, 'ElectroTech Global Ltd'
            ]);
            await executeRun(`INSERT INTO products (name, category, price, quantity, supplier) VALUES (?, ?, ?, ?, ?)`, [
                'Logitech MX Master 3S Mouse', 'Accessories', 8999.00, 24, 'ElectroTech Global Ltd'
            ]);
            await executeRun(`INSERT INTO products (name, category, price, quantity, supplier) VALUES (?, ?, ?, ?, ?)`, [
                'Samsung 27" 4K Monitor', 'Displays', 24999.00, 8, 'ElectroTech Global Ltd'
            ]);
            await executeRun(`INSERT INTO products (name, category, price, quantity, supplier) VALUES (?, ?, ?, ?, ?)`, [
                'Mechanical Keyboard RGB', 'Accessories', 4500.00, 5, 'ElectroTech Global Ltd'
            ]);
            await executeRun(`INSERT INTO products (name, category, price, quantity, supplier) VALUES (?, ?, ?, ?, ?)`, [
                'A4 Copier Paper (500 Sheets)', 'Stationery', 320.00, 0, 'Apex Supplies & Paper'
            ]);

            console.log('✅ Demo inventory items seeded successfully');
        }

        isInitialized = true;
        console.log('✅ Database schema and seed data verified');
    } catch (err) {
        console.error('❌ Database Initialization Error:', err);
        throw err;
    }
}

function ensureInitialized() {
    if (!initPromise) {
        initPromise = initDatabase().catch(err => {
            initPromise = null; // Allow retry on failure
            throw err;
        });
    }
    return initPromise;
}

// Low-level execution helpers used during init
function executeRaw(sql, params = []) {
    return new Promise((resolve, reject) => {
        const formattedSql = formatSql(sql);
        if (isPostgres) {
            dbClient.query(formattedSql, params, (err, res) => {
                if (err) return reject(err);
                resolve(res);
            });
        } else {
            dbClient.run(formattedSql, params, function (err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        }
    });
}

function executeGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        const formattedSql = formatSql(sql);
        if (isPostgres) {
            dbClient.query(formattedSql, params, (err, res) => {
                if (err) return reject(err);
                resolve(res.rows && res.rows.length > 0 ? res.rows[0] : null);
            });
        } else {
            dbClient.get(formattedSql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        }
    });
}

function executeRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (isPostgres) {
            let pgSql = sql;
            const isInsert = /^\s*insert\s+into/i.test(sql);
            if (isInsert && !/returning/i.test(sql)) {
                pgSql += ' RETURNING id';
            }
            const formattedSql = formatSql(pgSql);
            dbClient.query(formattedSql, params, (err, res) => {
                if (err) return reject(err);
                const lastID = isInsert && res.rows && res.rows[0] ? res.rows[0].id : null;
                resolve({ lastID, changes: res.rowCount || 0 });
            });
        } else {
            const formattedSql = formatSql(sql);
            dbClient.run(formattedSql, params, function (err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        }
    });
}

// ============================================================================
// Public Query Methods (Auto-awaits database initialization)
// ============================================================================

async function all(sql, params = []) {
    await ensureInitialized();
    return new Promise((resolve, reject) => {
        const formattedSql = formatSql(sql);
        if (isPostgres) {
            dbClient.query(formattedSql, params, (err, res) => {
                if (err) return reject(err);
                resolve(res.rows || []);
            });
        } else {
            dbClient.all(formattedSql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        }
    });
}

async function get(sql, params = []) {
    await ensureInitialized();
    return executeGet(sql, params);
}

async function run(sql, params = []) {
    await ensureInitialized();
    return executeRun(sql, params);
}

async function transaction(callback) {
    await ensureInitialized();
    if (isPostgres) {
        const client = await dbClient.connect();
        try {
            await client.query('BEGIN');
            const trxHelper = {
                query: (sql, params = []) => client.query(formatSql(sql), params),
                get: async (sql, params = []) => {
                    const res = await client.query(formatSql(sql), params);
                    return res.rows[0] || null;
                },
                all: async (sql, params = []) => {
                    const res = await client.query(formatSql(sql), params);
                    return res.rows || [];
                },
                run: async (sql, params = []) => {
                    let pgSql = sql;
                    const isInsert = /^\s*insert\s+into/i.test(sql);
                    if (isInsert && !/returning/i.test(sql)) {
                        pgSql += ' RETURNING id';
                    }
                    const res = await client.query(formatSql(pgSql), params);
                    const lastID = isInsert && res.rows && res.rows[0] ? res.rows[0].id : null;
                    return { lastID, changes: res.rowCount || 0 };
                }
            };
            const result = await callback(trxHelper);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } else {
        await executeRun('BEGIN TRANSACTION');
        try {
            const trxHelper = {
                get: (sql, params = []) => executeGet(sql, params),
                all: (sql, params = []) => new Promise((resolve, reject) => {
                    dbClient.all(formatSql(sql), params, (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows || []);
                    });
                }),
                run: (sql, params = []) => executeRun(sql, params)
            };
            const result = await callback(trxHelper);
            await executeRun('COMMIT');
            return result;
        } catch (err) {
            await executeRun('ROLLBACK');
            throw err;
        }
    }
}

// Start initialization
ensureInitialized();

module.exports = {
    query: all,
    all,
    get,
    run,
    transaction,
    initDatabase: ensureInitialized,
    isPostgres: () => isPostgres
};
