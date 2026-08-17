// ============================================================================
// app.js — Core Express Application & Standardized REST APIs
// ============================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'invflow-super-secret-production-jwt-key-2026';

// Middleware
app.use(cors());
app.use(express.json());

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../frontend'), { index: false }));

// Helper: Verify JWT Token (Optional protection middleware)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ============================================================================
// API Router (Mounted on both '/api' and '/' for bulletproof Vercel routing)
// ============================================================================
const apiRouter = express.Router();

// 🔐 Login Handler
async function handleLogin(req, res) {
    try {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both username and password'
            });
        }

        const user = await db.get('SELECT * FROM users WHERE username = ?', [username.trim()]);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        let isMatch = false;
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            isMatch = (user.password === password);
            if (isMatch) {
                const newHash = await bcrypt.hash(password, 10);
                await db.run('UPDATE users SET password = ? WHERE id = ?', [newHash, user.id]);
            }
        }

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: 'admin'
                }
            }
        });
    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during authentication: ' + err.message
        });
    }
}

// Mount Auth endpoints
apiRouter.post('/auth/login', handleLogin);
apiRouter.post('/login', handleLogin);

apiRouter.get('/auth/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }
        res.json({
            success: true,
            data: { user }
        });
    });
});

// 📦 Product Management Endpoints
apiRouter.get('/products', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM products ORDER BY id DESC');
        const formatted = rows.map(p => ({
            ...p,
            price: Number(p.price) || 0,
            quantity: Number(p.quantity) || 0
        }));
        res.json({
            success: true,
            message: 'Products retrieved successfully',
            data: formatted
        });
    } catch (err) {
        console.error('Fetch Products Error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch products',
            error: err.message
        });
    }
});

apiRouter.get('/products/:id', async (req, res) => {
    try {
        const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        product.price = Number(product.price) || 0;
        product.quantity = Number(product.quantity) || 0;
        res.json({ success: true, data: product });
    } catch (err) {
        console.error('Fetch Single Product Error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving product' });
    }
});

apiRouter.post('/products', async (req, res) => {
    try {
        const { name, category, price, quantity, supplier } = req.body || {};

        const trimmedName = typeof name === 'string' ? name.trim() : '';
        const numPrice = Number(price);
        const numQty = quantity !== undefined && quantity !== null && quantity !== '' ? Number(quantity) : 0;
        const cat = typeof category === 'string' ? category.trim() : '';
        const supp = typeof supplier === 'string' ? supplier.trim() : '';

        if (!trimmedName) {
            return res.status(400).json({ success: false, message: 'Product name is required' });
        }

        if (!Number.isFinite(numPrice) || numPrice <= 0) {
            return res.status(400).json({ success: false, message: 'Price must be a valid positive number' });
        }

        if (!Number.isInteger(numQty) || numQty < 0) {
            return res.status(400).json({ success: false, message: 'Quantity must be a valid non-negative integer' });
        }

        const result = await db.run(
            `INSERT INTO products (name, category, price, quantity, supplier) VALUES (?, ?, ?, ?, ?)`,
            [trimmedName, cat, numPrice, numQty, supp]
        );

        res.status(201).json({
            success: true,
            message: 'Product added successfully',
            data: {
                id: result.lastID,
                name: trimmedName,
                category: cat,
                price: numPrice,
                quantity: numQty,
                supplier: supp
            }
        });
    } catch (err) {
        console.error('Add Product Error:', err);
        res.status(500).json({ success: false, message: 'Failed to add product', error: err.message });
    }
});

apiRouter.put('/products/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { name, category, price, quantity, supplier } = req.body || {};

        const trimmedName = typeof name === 'string' ? name.trim() : '';
        const numPrice = Number(price);
        const numQty = quantity !== undefined && quantity !== null && quantity !== '' ? Number(quantity) : 0;
        const cat = typeof category === 'string' ? category.trim() : '';
        const supp = typeof supplier === 'string' ? supplier.trim() : '';

        if (!trimmedName) {
            return res.status(400).json({ success: false, message: 'Product name is required' });
        }
        if (!Number.isFinite(numPrice) || numPrice <= 0) {
            return res.status(400).json({ success: false, message: 'Price must be a valid positive number' });
        }
        if (!Number.isInteger(numQty) || numQty < 0) {
            return res.status(400).json({ success: false, message: 'Quantity must be a valid non-negative integer' });
        }

        const result = await db.run(
            `UPDATE products SET name = ?, category = ?, price = ?, quantity = ?, supplier = ? WHERE id = ?`,
            [trimmedName, cat, numPrice, numQty, supp, id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({
            success: true,
            message: 'Product updated successfully',
            data: { id, name: trimmedName, category: cat, price: numPrice, quantity: numQty, supplier: supp }
        });
    } catch (err) {
        console.error('Update Product Error:', err);
        res.status(500).json({ success: false, message: 'Failed to update product', error: err.message });
    }
});

apiRouter.delete('/products/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await db.run('DELETE FROM products WHERE id = ?', [id]);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Delete Product Error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete product', error: err.message });
    }
});

// 🏭 Supplier Management Endpoints
apiRouter.get('/suppliers', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM suppliers ORDER BY id DESC');
        res.json({ success: true, message: 'Suppliers retrieved successfully', data: rows });
    } catch (err) {
        console.error('Fetch Suppliers Error:', err);
        res.status(500).json({ success: false, message: 'Error fetching suppliers', error: err.message });
    }
});

apiRouter.get('/suppliers/:id', async (req, res) => {
    try {
        const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }
        res.json({ success: true, data: supplier });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error retrieving supplier' });
    }
});

apiRouter.post('/suppliers', async (req, res) => {
    try {
        const { name, company, phone, email, address } = req.body || {};

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Supplier name is required' });
        }

        const result = await db.run(
            `INSERT INTO suppliers (name, company, phone, email, address) VALUES (?, ?, ?, ?, ?)`,
            [name.trim(), (company || '').trim(), (phone || '').trim(), (email || '').trim(), (address || '').trim()]
        );

        res.status(201).json({
            success: true,
            message: 'Supplier added successfully',
            data: { id: result.lastID, name, company, phone, email, address }
        });
    } catch (err) {
        console.error('Add Supplier Error:', err);
        res.status(500).json({ success: false, message: 'Failed to add supplier', error: err.message });
    }
});

apiRouter.put('/suppliers/:id', async (req, res) => {
    try {
        const { name, company, phone, email, address } = req.body || {};
        const id = req.params.id;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Supplier name is required' });
        }

        const result = await db.run(
            `UPDATE suppliers SET name = ?, company = ?, phone = ?, email = ?, address = ? WHERE id = ?`,
            [name.trim(), (company || '').trim(), (phone || '').trim(), (email || '').trim(), (address || '').trim(), id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }

        res.json({ success: true, message: 'Supplier updated successfully' });
    } catch (err) {
        console.error('Update Supplier Error:', err);
        res.status(500).json({ success: false, message: 'Failed to update supplier', error: err.message });
    }
});

apiRouter.delete('/suppliers/:id', async (req, res) => {
    try {
        const result = await db.run('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }
        res.json({ success: true, message: 'Supplier deleted successfully' });
    } catch (err) {
        console.error('Delete Supplier Error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete supplier', error: err.message });
    }
});

// 📊 Stock Management Endpoints
apiRouter.get('/stock', async (req, res) => {
    try {
        const products = await db.all('SELECT * FROM products ORDER BY quantity ASC');
        let totalUnits = 0;
        let totalValuation = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;

        const stockItems = products.map(p => {
            const qty = Number(p.quantity) || 0;
            const price = Number(p.price) || 0;
            const val = qty * price;

            totalUnits += qty;
            totalValuation += val;

            let status = 'In Stock';
            if (qty === 0) {
                status = 'Out of Stock';
                outOfStockCount++;
            } else if (qty <= 10) {
                status = 'Low Stock';
                lowStockCount++;
            }

            return {
                id: p.id,
                name: p.name,
                category: p.category,
                quantity: qty,
                price: price,
                valuation: val,
                supplier: p.supplier,
                status: status
            };
        });

        res.json({
            success: true,
            data: {
                summary: {
                    totalUnits,
                    totalValuation,
                    lowStockCount,
                    outOfStockCount,
                    totalProducts: products.length
                },
                items: stockItems
            }
        });
    } catch (err) {
        console.error('Fetch Stock Error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving stock levels' });
    }
});

apiRouter.put('/stock/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { quantity, delta } = req.body || {};

        const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        let newQty = Number(product.quantity) || 0;
        if (quantity !== undefined) {
            newQty = Number(quantity);
        } else if (delta !== undefined) {
            newQty += Number(delta);
        }

        if (newQty < 0) {
            return res.status(400).json({ success: false, message: 'Stock cannot be negative' });
        }

        await db.run('UPDATE products SET quantity = ? WHERE id = ?', [newQty, id]);

        res.json({
            success: true,
            message: 'Stock updated successfully',
            data: { id, quantity: newQty }
        });
    } catch (err) {
        console.error('Update Stock Error:', err);
        res.status(500).json({ success: false, message: 'Failed to update stock' });
    }
});

// 💰 POS Billing & Invoicing Endpoints
async function processSaleCheckout(req, res) {
    try {
        const { customer_name, items, gst_rate, discount } = req.body || {};

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty. Add products to checkout.' });
        }

        for (const item of items) {
            if (!item.id || !item.quantity || item.quantity <= 0) {
                return res.status(400).json({ success: false, message: `Invalid item or quantity for item ID ${item.id}` });
            }
            const product = await db.get('SELECT * FROM products WHERE id = ?', [item.id]);
            if (!product) {
                return res.status(404).json({ success: false, message: `Product ID #${item.id} no longer exists` });
            }
            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for "${product.name}". Available: ${product.quantity}, Requested: ${item.quantity}`
                });
            }
        }

        const invoice_number = 'INV-' + Date.now();
        const effectiveGstRate = Number(gst_rate) || 0;
        const discountAmount = Number(discount) || 0;

        let subtotal = 0;
        items.forEach(item => {
            subtotal += (Number(item.price) * Number(item.quantity));
        });

        const gst = subtotal * (effectiveGstRate / 100);
        const total = Math.max(0, (subtotal + gst - discountAmount));
        const date = new Date().toISOString();
        const customer = (customer_name || '').trim() || 'Walk-in Customer';

        const transactionResult = await db.transaction(async (trx) => {
            const saleRes = await trx.run(
                `INSERT INTO sales (invoice_number, customer_name, subtotal, gst, total, date) VALUES (?, ?, ?, ?, ?, ?)`,
                [invoice_number, customer, subtotal, gst, total, date]
            );

            const sale_id = saleRes.lastID;

            for (const item of items) {
                const itemSubtotal = Number(item.price) * Number(item.quantity);

                await trx.run(
                    `INSERT INTO sale_items (sale_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)`,
                    [sale_id, item.id, item.quantity, item.price, itemSubtotal]
                );

                await trx.run(
                    `UPDATE products SET quantity = quantity - ? WHERE id = ?`,
                    [item.quantity, item.id]
                );
            }

            return { sale_id, invoice_number };
        });

        res.status(201).json({
            success: true,
            message: 'Invoice created and stock updated successfully',
            data: {
                sale_id: transactionResult.sale_id,
                invoice_number: transactionResult.invoice_number,
                customer_name: customer,
                subtotal,
                gst_rate: effectiveGstRate,
                gst,
                discount: discountAmount,
                total,
                date,
                items
            }
        });
    } catch (err) {
        console.error('POS Checkout Error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to process checkout and update stock',
            error: err.message
        });
    }
}

apiRouter.post('/billing', processSaleCheckout);
apiRouter.post('/sales', processSaleCheckout);

apiRouter.get('/invoices', async (req, res) => {
    try {
        const invoices = await db.all('SELECT * FROM sales ORDER BY id DESC');
        res.json({ success: true, message: 'Invoices retrieved successfully', data: invoices });
    } catch (err) {
        console.error('Fetch Invoices Error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
    }
});

apiRouter.get('/invoices/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const invoice = await db.get('SELECT * FROM sales WHERE id = ? OR invoice_number = ?', [id, id]);

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const items = await db.all(
            `SELECT si.*, p.name as product_name, p.category 
             FROM sale_items si 
             LEFT JOIN products p ON si.product_id = p.id 
             WHERE si.sale_id = ?`,
            [invoice.id]
        );

        res.json({ success: true, data: { ...invoice, items } });
    } catch (err) {
        console.error('Fetch Invoice Details Error:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve invoice details' });
    }
});

// 📊 Dashboard & Reports Endpoints
apiRouter.get('/dashboard', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const prodCount = await db.get('SELECT COUNT(*) as count FROM products');
        const suppCount = await db.get('SELECT COUNT(*) as count FROM suppliers');
        const valRes = await db.get('SELECT SUM(price * quantity) as total_val FROM products');
        const lowRes = await db.get('SELECT COUNT(*) as count FROM products WHERE quantity <= 10 AND quantity > 0');
        const outRes = await db.get('SELECT COUNT(*) as count FROM products WHERE quantity = 0');
        const invRes = await db.get('SELECT COUNT(*) as count, SUM(total) as rev FROM sales');
        const todayRes = await db.get('SELECT SUM(total) as rev FROM sales WHERE date LIKE ?', [`${today}%`]);

        const stats = {
            products: Number(prodCount ? prodCount.count : 0),
            suppliers: Number(suppCount ? suppCount.count : 0),
            stock_value: Number(valRes && valRes.total_val ? valRes.total_val : 0),
            low_stock: Number(lowRes ? lowRes.count : 0),
            out_of_stock: Number(outRes ? outRes.count : 0),
            total_invoices: Number(invRes && invRes.count ? invRes.count : 0),
            total_revenue: Number(invRes && invRes.rev ? invRes.rev : 0),
            sales_today: Number(todayRes && todayRes.rev ? todayRes.rev : 0)
        };

        res.json({ success: true, message: 'Dashboard stats retrieved', data: stats });
    } catch (err) {
        console.error('Dashboard Stats Error:', err);
        res.status(500).json({ success: false, message: 'Failed to compute dashboard metrics', error: err.message });
    }
});

apiRouter.get('/reports/sales', async (req, res) => {
    try {
        const rows = await db.all('SELECT date, total, invoice_number, customer_name, subtotal, gst FROM sales ORDER BY id DESC');
        res.json({ success: true, message: 'Sales reports retrieved', data: rows });
    } catch (err) {
        console.error('Sales Reports Error:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve sales reports' });
    }
});

apiRouter.get('/reports', async (req, res) => {
    try {
        const sales = await db.all('SELECT date, total, invoice_number, customer_name, subtotal, gst FROM sales ORDER BY id DESC');
        const topProducts = await db.all(
            `SELECT p.name, SUM(si.quantity) as units_sold, SUM(si.subtotal) as total_sales 
             FROM sale_items si 
             LEFT JOIN products p ON si.product_id = p.id 
             GROUP BY si.product_id, p.name 
             ORDER BY units_sold DESC 
             LIMIT 5`
        );

        res.json({ success: true, data: { sales, topProducts } });
    } catch (err) {
        console.error('Reports Error:', err);
        res.status(500).json({ success: false, message: 'Failed to generate reports' });
    }
});

// ============================================================================
// Mount API Router on both '/api' and '/' (handles Vercel path rewrites smoothly)
// ============================================================================
app.use('/api', apiRouter);
app.use('/', apiRouter);

// 🏠 Navigation Fallbacks
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/:page.html', (req, res) => {
    const pagePath = path.join(__dirname, '../frontend', req.params.page + '.html');
    res.sendFile(pagePath, (err) => {
        if (err) {
            res.status(404).send('Page not found');
        }
    });
});

module.exports = app;
