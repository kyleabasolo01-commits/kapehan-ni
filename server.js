
const express = require("express");
const path = require("path");
const multer = require("multer");
const db = require("./database/db");

const app = express();
const PORT = process.env.PORT || 3001;
const MAX_STOCK = 30;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "uploads"));
    },
    filename: (req, file, cb) => {
        cb(
            null,
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname).toLowerCase()
        );
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        file.mimetype.startsWith("image/")
            ? cb(null, true)
            : cb(new Error("Only image files are allowed."));
    }
});

const wrap = (fn) => (req, res) => {
    try {
        fn(req, res);
    } catch (e) {
        console.error(e);
        res.status(500).json({
            success: false,
            message: e.message || "Server error"
        });
    }
};

const getProduct = (id) =>
    db.prepare("SELECT * FROM products WHERE id = ?").get(id);

const pos = (n) =>
    Number.isInteger(Number(n)) && Number(n) > 0;

// SERVER STATUS
app.get("/api/status", (req, res) => {
    res.json({ success: true, message: "Server running" });
});

// PRODUCTS
app.get("/api/products", wrap((req, res) => {
    res.json({
        success: true,
        products: db.prepare(`
            SELECT p.*, c.name category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            ORDER BY p.id DESC
        `).all()
    });
}));

// ADD PRODUCT
app.post("/api/products", upload.single("image"), wrap((req, res) => {
    const b = req.body;

    if (!b.product_name?.trim()) {
        return res.status(400).json({
            success: false,
            message: "Product name required."
        });
    }

    const qty = Number(b.quantity || 0);
    const min = Number(b.min_stock || 5);

    if (
        !Number.isInteger(qty) ||
        qty < 0 ||
        qty > MAX_STOCK ||
        !Number.isInteger(min) ||
        min < 1
    ) {
        return res.status(400).json({
            success: false,
            message: "Initial stock must be between 0 and 30 units."
        });
    }

    const r = db.prepare(`
        INSERT INTO products
        (product_name, flavor, size, image, description,
         cost_price, selling_price, quantity, min_stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        b.product_name.trim(),
        b.flavor || "",
        b.size || "Regular",
        req.file ? "/uploads/" + req.file.filename : "",
        b.description || "",
        Number(b.cost_price || 0),
        Number(b.selling_price || 149),
        qty,
        min
    );

    res.status(201).json({
        success: true,
        product: getProduct(r.lastInsertRowid)
    });
}));

// UPDATE PRODUCT
app.put("/api/products/:id", upload.single("image"), wrap((req, res) => {
    const id = Number(req.params.id);
    const p = getProduct(id);

    if (!p) {
        return res.status(404).json({
            success: false,
            message: "Product not found."
        });
    }

    const b = req.body;

    db.prepare(`
        UPDATE products
        SET product_name = ?, flavor = ?, size = ?, image = ?,
            description = ?, cost_price = ?, selling_price = ?,
            min_stock = ?
        WHERE id = ?
    `).run(
        (b.product_name || p.product_name).trim(),
        b.flavor ?? p.flavor,
        b.size ?? p.size,
        req.file ? "/uploads/" + req.file.filename : p.image,
        b.description ?? p.description,
        Number(b.cost_price ?? p.cost_price),
        Number(b.selling_price ?? p.selling_price),
        Number(b.min_stock ?? p.min_stock),
        id
    );

    res.json({
        success: true,
        product: getProduct(id)
    });
}));

// DELETE PRODUCT
app.delete("/api/products/:id", wrap((req, res) => {
    const id = Number(req.params.id);

    if (!getProduct(id)) {
        return res.status(404).json({
            success: false,
            message: "Product not found."
        });
    }

    if (
        db.prepare(
            "SELECT COUNT(*) n FROM order_items WHERE product_id = ?"
        ).get(id).n
    ) {
        return res.status(400).json({
            success: false,
            message: "Product has order history and cannot be deleted."
        });
    }

    db.prepare("DELETE FROM stock_transactions WHERE product_id = ?").run(id);
    db.prepare("DELETE FROM products WHERE id = ?").run(id);

    res.json({ success: true });
}));

// STOCK IN AND STOCK OUT
function stock(type) {
    return wrap((req, res) => {
        const id = Number(req.body.productId);
        const qty = Number(req.body.quantity);
        const p = getProduct(id);

        if (!pos(id) || !p) {
            return res.status(400).json({
                success: false,
                message: "Select a valid product."
            });
        }

        if (!pos(qty)) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be a positive whole number."
            });
        }

        // MAXIMUM STOCK VALIDATION
        if (type === "STOCK IN" && p.quantity + qty > MAX_STOCK) {
            const remaining = Math.max(0, MAX_STOCK - p.quantity);

            return res.status(400).json({
                success: false,
                message:
                    "Maximum stock is 30 units. Current stock: " +
                    p.quantity +
                    ". You can only add " +
                    remaining +
                    " more units."
            });
        }

        // STOCK OUT VALIDATION
        if (type === "STOCK OUT" && p.quantity < qty) {
            return res.status(400).json({
                success: false,
                message: "Not enough stock. Current quantity: " + p.quantity
            });
        }

        const tx = db.transaction(() => {
            db.prepare(`
                UPDATE products
                SET quantity = quantity + ?
                WHERE id = ?
            `).run(type === "STOCK IN" ? qty : -qty, id);

            db.prepare(`
                INSERT INTO stock_transactions
                (product_id, transaction_type, quantity, note)
                VALUES (?, ?, ?, ?)
            `).run(id, type, qty, req.body.note || "");

            const updated = getProduct(id);

            if (updated.quantity <= updated.min_stock) {
                db.prepare(
                    "INSERT INTO notifications(message) VALUES(?)"
                ).run(
                    updated.product_name +
                    " has " +
                    updated.quantity +
                    " units remaining."
                );
            }

            return updated;
        });

        res.json({
            success: true,
            message: type + " saved successfully.",
            product: tx()
        });
    });
}

app.post("/api/stock-in", stock("STOCK IN"));
app.post("/api/stock-out", stock("STOCK OUT"));

// INVENTORY HISTORY
app.get("/api/history", wrap((req, res) => {
    res.json({
        success: true,
        history: db.prepare(`
            SELECT t.*, p.product_name
            FROM stock_transactions t
            JOIN products p ON p.id = t.product_id
            ORDER BY t.id DESC
        `).all()
    });
}));

// CATEGORIES
app.get("/api/categories", wrap((req, res) => {
    res.json({
        success: true,
        categories: db.prepare(
            "SELECT * FROM categories ORDER BY name"
        ).all()
    });
}));

app.post("/api/categories", wrap((req, res) => {
    const n = (req.body.name || "").trim();

    if (!n) {
        return res.status(400).json({
            success: false,
            message: "Category name required."
        });
    }

    try {
        const r = db.prepare(
            "INSERT INTO categories(name) VALUES(?)"
        ).run(n);

        res.status(201).json({
            success: true,
            id: r.lastInsertRowid
        });
    } catch {
        res.status(400).json({
            success: false,
            message: "Category already exists."
        });
    }
}));

app.delete("/api/categories/:id", wrap((req, res) => {
    if (
        db.prepare(
            "SELECT COUNT(*) n FROM products WHERE category_id = ?"
        ).get(req.params.id).n
    ) {
        return res.status(400).json({
            success: false,
            message: "Category is assigned to products."
        });
    }

    db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);

    res.json({ success: true });
}));

// ORDERS
app.get("/api/orders", wrap((req, res) => {
    res.json({
        success: true,
        orders: db.prepare(`
            SELECT o.*,
            GROUP_CONCAT(p.product_name || ' × ' || oi.quantity, ', ') items
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN products p ON p.id = oi.product_id
            GROUP BY o.id
            ORDER BY o.id DESC
        `).all()
    });
}));

app.post("/api/orders", wrap((req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!items.length) {
        return res.status(400).json({
            success: false,
            message: "Add at least one item."
        });
    }

    try {
        const tx = db.transaction(() => {
            let total = 0;

            const rows = items.map((item) => {
                const p = getProduct(Number(item.productId));
                const n = Number(item.quantity);

                if (!p || !pos(n)) {
                    throw Error("Invalid product or quantity.");
                }

                if (p.quantity < n) {
                    throw Error("Not enough stock for " + p.product_name);
                }

                total += p.selling_price * n;

                return { p, n };
            });

            const order = db.prepare(`
                INSERT INTO orders(order_type, total)
                VALUES (?, ?)
            `).run(
                ["Dine-in", "Takeout"].includes(req.body.orderType)
                    ? req.body.orderType
                    : "Takeout",
                total
            );

            rows.forEach(({ p, n }) => {
                db.prepare(`
                    INSERT INTO order_items
                    (order_id, product_id, quantity, unit_price)
                    VALUES (?, ?, ?, ?)
                `).run(order.lastInsertRowid, p.id, n, p.selling_price);

                db.prepare(`
                    UPDATE products
                    SET quantity = quantity - ?
                    WHERE id = ?
                `).run(n, p.id);

                db.prepare(`
                    INSERT INTO stock_transactions
                    (product_id, transaction_type, quantity, note)
                    VALUES (?, 'STOCK OUT', ?, 'Order')
                `).run(p.id, n);
            });

            return order.lastInsertRowid;
        });

        res.status(201).json({
            success: true,
            orderId: tx()
        });
    } catch (e) {
        res.status(400).json({
            success: false,
            message: e.message
        });
    }
}));

// NOTIFICATIONS
app.get("/api/notifications", wrap((req, res) => {
    res.json({
        success: true,
        notifications: db.prepare(
            "SELECT * FROM notifications ORDER BY id DESC"
        ).all()
    });
}));

app.post("/api/notifications/read", wrap((req, res) => {
    db.prepare("UPDATE notifications SET is_read = 1").run();
    res.json({ success: true });
}));

// SETTINGS
app.get("/api/settings", wrap((req, res) => {
    res.json({
        success: true,
        settings: db.prepare(
            "SELECT * FROM settings WHERE id = 1"
        ).get()
    });
}));

app.put("/api/settings", wrap((req, res) => {
    const b = req.body;
    const n = Number(b.low_stock_threshold);

    if (!b.shop_name?.trim() || !Number.isInteger(n) || n < 1) {
        return res.status(400).json({
            success: false,
            message: "Enter valid settings."
        });
    }

    db.prepare(`
        UPDATE settings
        SET shop_name = ?, shop_information = ?, low_stock_threshold = ?
        WHERE id = 1
    `).run(
        b.shop_name.trim(),
        b.shop_information || "",
        n
    );

    res.json({ success: true });
}));

// REPORTS
app.get("/api/reports/summary", wrap((req, res) => {
    const p = db.prepare(`
        SELECT COUNT(*) count, COALESCE(SUM(quantity), 0) units
        FROM products
    `).get();

    const low = db.prepare(`
        SELECT COUNT(*) n
        FROM products
        WHERE quantity > 0 AND quantity < min_stock
    `).get().n;

    const out = db.prepare(`
        SELECT COUNT(*) n
        FROM products
        WHERE quantity = 0
    `).get().n;

    const t = db.prepare(`
        SELECT COUNT(*) count, COALESCE(SUM(total), 0) sales
        FROM orders
        WHERE date(created_at) = date('now', 'localtime')
    `).get();

    res.json({
        success: true,
        summary: {
            ...p,
            low,
            out,
            todayOrders: t.count,
            todaySales: t.sales
        }
    });
}));

// ERROR HANDLER
app.use((err, req, res, next) => {
    console.error(err);

    res.status(400).json({
        success: false,
        message: err.message || "Request failed."
    });
});

// START SERVER
app.listen(PORT, () => {
    console.log(`KAPEHAN NI KALOY running at http://localhost:${PORT}`);
});
