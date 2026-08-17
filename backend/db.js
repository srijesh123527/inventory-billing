// ============================================================================
// db.js — Universal Database Adapter (PostgreSQL for Cloud/Vercel + SQLite for Local)
// ============================================================================

const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

let dbClient = null;
let isPostgres = false;

// Check for PostgreSQL connection string
const DATABASE_URL = process.env.DATABASE_URL;

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
    const dbPath = path.join(__dirname, 'database.db');

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
// Unified Query Methods
// ============================================================================

/**
 * Execute a query that returns multiple rows
 */
function all(sql, params = []) {
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

/**
 * Execute a query that returns a single row
 */
function get(sql, params = []) {
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

/**
 * Execute an INSERT, UPDATE, or DELETE query
 */
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (isPostgres) {
            // If it's an INSERT, append RETURNING id to get the inserted ID
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

/**
 * Transaction helper for atomic operations (like POS Checkout)
 */
async function transaction(callback) {
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
        // SQLite sequential execution helper
        await run('BEGIN TRANSACTION');
        try {
            const trxHelper = {
                get: (sql, params = []) => get(sql, params),
                all: (sql, params = []) => all(sql, params),
                run: (sql, params = []) => run(sql, params)
            };
            const result = await callback(trxHelper);
            await run('COMMIT');
            return result;
        } catch (err) {
            await run('ROLLBACK');
            throw err;
        }
    }
}

// ============================================================================
// Database Initialization & Schema Migrations
// ============================================================================

async function initDatabase() {
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
            // SQLite Schema
            await run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE,
                    password TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await run(`
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

            await run(`
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

            await run(`
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

            await run(`
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
        const adminUser = await get('SELECT * FROM users WHERE username = ?', ['admin']);
        if (!adminUser) {
            const defaultHash = await bcrypt.hash('admin123', 10);
            await run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', defaultHash]);
            console.log('✅ Created default admin account (admin / admin123)');
        } else if (adminUser.password === 'admin123') {
            // Migrate unhashed password to bcrypt
            const upgradedHash = await bcrypt.hash('admin123', 10);
            await run('UPDATE users SET password = ? WHERE id = ?', [upgradedHash, adminUser.id]);
            console.log('🔒 Upgraded legacy plaintext admin password to bcrypt hash');
        }

        // Check if sample data should be populated (if products table is empty)
        const productCount = await get('SELECT COUNT(*) as count FROM products');
        const count = isPostgres ? parseInt(productCount.count, 10) : productCount.count;

        if (count === 0) {
            console.log('🌱 Seeding initial demo data...');
            // Seed Suppliers
            await run(`INSERT INTO suppliers (name, company, phone, email, address) VALUES (?, ?, ?, ?, ?)`, [
                'Rajesh Sharma', 'ElectroTech Global Ltd', '+91 9876543210', 'contact@electrotech.com', 'Plot 42, Electronics City, Bengaluru'
            ]);
            await run(`INSERT INTO suppliers (name, company, phone, email, address) VALUES (?, ?, ?, ?, ?)`, [
                'Priya Patel', 'Apex Supplies & Paper', '+91 9123456780', 'sales@apexsupplies.in', '12 Industrial Area, Mumbai'
            ]);

            // Seed Products
            await run(`INSERT INTO products (name, category, price, quantity, supplier) VALUES (?, ?, ?, ?, ?)`, [
                'Dell Latitude 5420 Laptop', 'Electronics', 58500.00, 15, 'ElectroTech Global Ltd'
            ]);
            await run(`INSERT INTO products (name, category, price, quantity, supplier) VALUES (?, ?, ?, ?, ?)`, [
                'Logitech MX Master 3S Mouse', 'Accessories', 8999.00, 24, 'ElectroTech Global Ltd'
            ]);
            await run(`INSERT INTO products (name, category, price, quantity, supplier) VALUES (?, ?, ?, ?, ?)`, [
                'Samsung 27" 4K Monitor', 'Displays', 24999.00, 8, 'ElectroTech Global Ltd'
            ]);
            await run(`INSERT INTO products (name, category, price, quantity, supplier) VALUES (?, ?, ?, ?, ?)`, [
                'Mechanical Keyboard RGB', 'Accessories', 4500.00, 5, 'ElectroTech Global Ltd'
            ]);
            await run(`INSERT INTO products (name, category, price, quantity, supplier) VALUES (?, ?, ?, ?, ?)`, [
                'A4 Copier Paper (500 Sheets)', 'Stationery', 320.00, 0, 'Apex Supplies & Paper'
            ]);

            console.log('✅ Demo inventory items seeded successfully');
        }

        console.log('✅ Database schema and seed data verified');
    } catch (err) {
        console.error('❌ Database Initialization Error:', err);
    }
}

// Auto-initialize
initDatabase();

module.exports = {
    query: all,
    all,
    get,
    run,
    transaction,
    initDatabase,
    isPostgres: () => isPostgres
};
