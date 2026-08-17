// ================= IMPORTS =================
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

// ================= APP =================
const app = express();
app.use(cors());
app.use(express.json());

// ================= STATIC FRONTEND =================
app.use(express.static(path.join(__dirname, "../frontend"), { index: false }));

// ================= DATABASE =================
const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Database connected successfully");
    }
});

// Helper for safe non-destructive schema migrations
function ensureColumn(tableName, columnName, columnDef) {
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
        if (err) {
            console.error(`Error checking schema for ${tableName}:`, err.message);
            return;
        }
        const exists = columns && columns.some(c => c.name.toLowerCase() === columnName.toLowerCase());
        if (!exists) {
            db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`, (alterErr) => {
                if (alterErr) {
                    console.error(`Error adding column ${columnName} to ${tableName}:`, alterErr.message);
                } else {
                    console.log(`Successfully migrated schema: Added column ${columnName} to ${tableName}`);
                }
            });
        }
    });
}

// ================= CREATE TABLES & MIGRATE =================
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        price REAL NOT NULL,
        quantity INTEGER DEFAULT 0,
        supplier TEXT
    )`);

    // Ensure columns exist if table was created with older schema
    ensureColumn("products", "category", "TEXT");
    ensureColumn("products", "quantity", "INTEGER DEFAULT 0");
    ensureColumn("products", "supplier", "TEXT");

    db.run(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        company TEXT,
        phone TEXT,
        email TEXT,
        address TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        quantity INTEGER,
        status TEXT,
        last_updated TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT,
        customer_name TEXT,
        subtotal REAL,
        gst REAL,
        total REAL,
        date TEXT
    )`);

    // Ensure columns exist for sales if created with older schema
    ensureColumn("sales", "invoice_number", "TEXT");
    ensureColumn("sales", "customer_name", "TEXT");
    ensureColumn("sales", "subtotal", "REAL");
    ensureColumn("sales", "gst", "REAL");

    db.run(`CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        price REAL,
        subtotal REAL
    )`);

    // Insert default admin if not exists
    db.run(`
        INSERT INTO users (username, password)
        SELECT 'admin', 'admin123'
        WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin')
    `, () => {
        console.log("Database tables and seed data initialized");
    });
});

// =================================================
// 🏠 ROOT ROUTE
// =================================================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

// For any exact HTML request, let static middleware handle it, but fallback if needed.
app.get("/:page.html", (req, res, next) => {
    const pagePath = path.join(__dirname, "../frontend", req.params.page + ".html");
    res.sendFile(pagePath, (err) => {
        if (err) {
            res.status(404).send("Page not found");
        }
    });
});

// =================================================
// 🔐 LOGIN API
// =================================================
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    db.get(
        "SELECT * FROM users WHERE username = ? AND password = ?",
        [username, password],
        (err, row) => {
            if (err) {
                console.error("Login Error:", err);
                return res.status(500).json({ success: false, message: "Server error" });
            }
            if (row) {
                res.json({ success: true, message: "Login successful" });
            } else {
                res.json({ success: false, message: "Invalid login credentials" });
            }
        }
    );
});

// =================================================
// 📦 PRODUCTS API
// =================================================
app.get("/api/products", (req, res) => {
    db.all("SELECT * FROM products ORDER BY id DESC", (err, rows) => {
        if (err) {
            console.error("SQLite Products Fetch Error:", err);
            return res.status(500).json({
                success: false,
                message: "Error fetching products",
                error: err.message
            });
        }
        res.json({ success: true, data: rows || [] });
    });
});

app.post("/api/products", (req, res) => {
    const { name, category, price, quantity, supplier } = req.body;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const numPrice = Number(price);
    const numQty = quantity !== undefined && quantity !== null && quantity !== "" ? Number(quantity) : 0;
    const cat = typeof category === "string" ? category.trim() : "";
    const supp = typeof supplier === "string" ? supplier.trim() : "";

    // Validation
    if (!trimmedName) {
        return res.status(400).json({
            success: false,
            message: "Product name is required"
        });
    }

    if (!Number.isFinite(numPrice) || numPrice <= 0) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid price"
        });
    }

    if (!Number.isInteger(numQty) || numQty < 0) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid quantity"
        });
    }

    db.run(
        `INSERT INTO products
         (name, category, price, quantity, supplier)
         VALUES (?, ?, ?, ?, ?)`,
        [trimmedName, cat, numPrice, numQty, supp],
        function (err) {
            if (err) {
                console.error("SQLite Product Insert Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to add product",
                    error: err.message
                });
            }

            console.log(`Product added successfully with ID: ${this.lastID}`);
            res.json({
                success: true,
                message: "Product added successfully",
                data: {
                    id: this.lastID
                }
            });
        }
    );
});

app.put("/api/products/:id", (req, res) => {
    const { name, category, price, quantity, supplier } = req.body;
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const numPrice = Number(price);
    const numQty = quantity !== undefined && quantity !== null && quantity !== "" ? Number(quantity) : 0;
    const cat = typeof category === "string" ? category.trim() : "";
    const supp = typeof supplier === "string" ? supplier.trim() : "";

    if (!trimmedName) {
        return res.status(400).json({ success: false, message: "Product name is required" });
    }
    if (!Number.isFinite(numPrice) || numPrice <= 0) {
        return res.status(400).json({ success: false, message: "Enter a valid price" });
    }
    if (!Number.isInteger(numQty) || numQty < 0) {
        return res.status(400).json({ success: false, message: "Enter a valid quantity" });
    }

    db.run(
        "UPDATE products SET name = ?, category = ?, price = ?, quantity = ?, supplier = ? WHERE id = ?",
        [trimmedName, cat, numPrice, numQty, supp, req.params.id],
        function (err) {
            if (err) {
                console.error("SQLite Product Update Error:", err);
                return res.status(500).json({ success: false, message: "Error updating product", error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }
            res.json({ success: true, message: "Product updated successfully" });
        }
    );
});

app.delete("/api/products/:id", (req, res) => {
    db.run("DELETE FROM products WHERE id = ?", [req.params.id], function (err) {
        if (err) {
            console.error("SQLite Product Delete Error:", err);
            return res.status(500).json({ success: false, message: "Error deleting product", error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        res.json({ success: true, message: "Product deleted successfully" });
    });
});

// =================================================
// 🏭 SUPPLIERS API
// =================================================
app.get("/api/suppliers", (req, res) => {
    db.all("SELECT * FROM suppliers ORDER BY id DESC", (err, rows) => {
        if (err) {
            console.error("SQLite Suppliers Fetch Error:", err);
            return res.status(500).json({ success: false, message: "Error fetching suppliers" });
        }
        res.json({ success: true, data: rows || [] });
    });
});

app.post("/api/suppliers", (req, res) => {
    const { name, company, phone, email, address } = req.body;
    db.run(
        "INSERT INTO suppliers (name, company, phone, email, address) VALUES (?, ?, ?, ?, ?)",
        [name, company, phone, email, address],
        function (err) {
            if (err) {
                console.error("SQLite Supplier Insert Error:", err);
                return res.status(500).json({ success: false, message: "Error adding supplier" });
            }
            res.json({ success: true, message: "Supplier added successfully", id: this.lastID });
        }
    );
});

app.put("/api/suppliers/:id", (req, res) => {
    const { name, company, phone, email, address } = req.body;
    db.run(
        "UPDATE suppliers SET name = ?, company = ?, phone = ?, email = ?, address = ? WHERE id = ?",
        [name, company, phone, email, address, req.params.id],
        function (err) {
            if (err) {
                console.error("SQLite Supplier Update Error:", err);
                return res.status(500).json({ success: false, message: "Error updating supplier" });
            }
            res.json({ success: true, message: "Supplier updated successfully" });
        }
    );
});

app.delete("/api/suppliers/:id", (req, res) => {
    db.run("DELETE FROM suppliers WHERE id = ?", [req.params.id], function (err) {
        if (err) {
            console.error("SQLite Supplier Delete Error:", err);
            return res.status(500).json({ success: false, message: "Error deleting supplier" });
        }
        res.json({ success: true, message: "Supplier deleted successfully" });
    });
});

// =================================================
// 💰 SALES & BILLING API
// =================================================
app.post("/api/sales", (req, res) => {
    const { customer_name, items, gst_rate } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const invoice_number = "INV-" + Date.now();
        const effectiveGstRate = Number(gst_rate) || 0;
        let subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
        let gst = subtotal * (effectiveGstRate / 100);
        let total = subtotal + gst;
        const date = new Date().toISOString();

        db.run(
            "INSERT INTO sales (invoice_number, customer_name, subtotal, gst, total, date) VALUES (?, ?, ?, ?, ?, ?)",
            [invoice_number, customer_name || "Walk-in", subtotal, gst, total, date],
            function (err) {
                if (err) {
                    console.error("SQLite Sale Insert Error:", err);
                    db.run("ROLLBACK");
                    return res.status(500).json({ success: false, message: "Error processing sale" });
                }

                const sale_id = this.lastID;
                let itemsProcessed = 0;
                let hasError = false;

                items.forEach((item) => {
                    const itemSubtotal = Number(item.price) * Number(item.quantity);

                    db.run(
                        "INSERT INTO sale_items (sale_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)",
                        [sale_id, item.id, item.quantity, item.price, itemSubtotal],
                        function (err) {
                            if (err) {
                                console.error("SQLite Sale Item Insert Error:", err);
                                hasError = true;
                            }
                        }
                    );

                    db.run(
                        "UPDATE products SET quantity = quantity - ? WHERE id = ?",
                        [item.quantity, item.id],
                        function (err) {
                            if (err) {
                                console.error("SQLite Stock Deduct Error:", err);
                                hasError = true;
                            }

                            itemsProcessed++;
                            if (itemsProcessed === items.length) {
                                if (hasError) {
                                    db.run("ROLLBACK");
                                    res.status(500).json({ success: false, message: "Error updating stock" });
                                } else {
                                    db.run("COMMIT");
                                    res.json({
                                        success: true,
                                        message: "Bill generated successfully",
                                        invoice_number: invoice_number,
                                        sale_id: sale_id
                                    });
                                }
                            }
                        }
                    );
                });
            }
        );
    });
});

// =================================================
// 📊 REPORTS & DASHBOARD API
// =================================================
app.get("/api/dashboard", (req, res) => {
    let stats = {
        products: 0,
        suppliers: 0,
        stock_value: 0,
        low_stock: 0,
        out_of_stock: 0,
        total_invoices: 0,
        sales_today: 0,
        total_revenue: 0
    };

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    db.serialize(() => {
        db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
            if (row) stats.products = row.count;
        });
        db.get("SELECT COUNT(*) as count FROM suppliers", (err, row) => {
            if (row) stats.suppliers = row.count;
        });
        db.get("SELECT SUM(price * quantity) as total_val FROM products", (err, row) => {
            if (row) stats.stock_value = row.total_val || 0;
        });
        db.get("SELECT COUNT(*) as count FROM products WHERE quantity <= 10 AND quantity > 0", (err, row) => {
            if (row) stats.low_stock = row.count;
        });
        db.get("SELECT COUNT(*) as count FROM products WHERE quantity = 0", (err, row) => {
            if (row) stats.out_of_stock = row.count;
        });
        db.get("SELECT COUNT(*) as inv_count, SUM(total) as rev FROM sales", (err, row) => {
            if (row) {
                stats.total_invoices = row.inv_count || 0;
                stats.total_revenue = row.rev || 0;
            }
        });
        db.get("SELECT SUM(total) as rev FROM sales WHERE date LIKE ?", [`${today}%`], (err, row) => {
            if (row) stats.sales_today = row.rev || 0;
            res.json({ success: true, data: stats });
        });
    });
});

app.get("/api/reports/sales", (req, res) => {
    db.all("SELECT date, total, invoice_number, customer_name FROM sales ORDER BY date DESC", (err, rows) => {
        if (err) {
            console.error("SQLite Sales Reports Fetch Error:", err);
            return res.status(500).json({ success: false, message: "Error fetching reports" });
        }
        res.json({ success: true, data: rows || [] });
    });
});

// ================= START SERVER =================
const PORT = 3000;
app.listen(PORT, () => {
    console.log("Server running on http://localhost:" + PORT);
});
