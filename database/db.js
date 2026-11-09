
const Database = require("better-sqlite3");
const path = require("path");

// DATABASE CONNECTION
const db = new Database(
    path.join(__dirname, "coffeshop.db")
);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// CREATE DATABASE TABLES
db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        product_name TEXT NOT NULL,
        flavor TEXT DEFAULT '',
        size TEXT DEFAULT 'Regular',
        image TEXT DEFAULT '',
        description TEXT DEFAULT '',
        cost_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 149,
        quantity INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS stock_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        note TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_type TEXT DEFAULT 'Takeout',
        total REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY,
        shop_name TEXT NOT NULL,
        shop_information TEXT DEFAULT '',
        low_stock_threshold INTEGER DEFAULT 5
    );
`);

// ONLY ONE CATEGORY
db.prepare(`
    INSERT OR IGNORE INTO categories (name)
    VALUES (?)
`).run("Coffee");

const coffeeCategory = db.prepare(`
    SELECT id FROM categories WHERE name = ?
`).get("Coffee");

// DEFAULT COFFEE PRODUCTS
const coffeeProducts = [
    {
        name: "Americano",
        flavor: "Coffee",
        image: "americano.jpg"
    },
    {
        name: "Caramel Macchiato",
        flavor: "Caramel",
        image: "caramel-macchiato.jpg"
    },
    {
        name: "Dark Mocha Latte",
        flavor: "Dark Chocolate",
        image: "dark-mocha-latte.jpg"
    },
    {
        name: "Hazelnut Latte",
        flavor: "Hazelnut",
        image: "hazelnut-latte.jpg"
    },
    {
        name: "Salted Caramel Latte",
        flavor: "Salted Caramel",
        image: "salted-caramel-latte.jpg"
    },
    {
        name: "Spanish Latte",
        flavor: "Spanish",
        image: "spanish-latte.jpg"
    },
    {
        name: "Strawberry Coffee",
        flavor: "Strawberry",
        image: "strawberry-coffee.jpg"
    },
    {
        name: "Vanilla Latte",
        flavor: "Vanilla",
        image: "vanilla-latte.jpg"
    },
    {
        name: "White Mocha Latte",
        flavor: "White Chocolate",
        image: "white-mocha-latte.jpg"
    }
];

// INSERT PRODUCTS WITHOUT DUPLICATING EXISTING RECORDS
const findProduct = db.prepare(`
    SELECT id FROM products WHERE product_name = ?
`);

const insertProduct = db.prepare(`
    INSERT INTO products (
        category_id,
        product_name,
        flavor,
        size,
        image,
        description,
        cost_price,
        selling_price,
        quantity,
        min_stock
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedProducts = db.transaction(() => {
    for (const product of coffeeProducts) {
        const existing = findProduct.get(product.name);

        if (!existing) {
            insertProduct.run(
                coffeeCategory.id,
                product.name,
                product.flavor,
                "Regular",
                "/images/products/" + product.image,
                product.name + " coffee product",
                0,
                149,
                0,
                5
            );
        }
    }
});

seedProducts();

// KEEP DEFAULT SHOP SETTINGS
db.prepare(`
    INSERT OR IGNORE INTO settings (
        id,
        shop_name,
        shop_information,
        low_stock_threshold
    )
    VALUES (1, ?, ?, ?)
`).run(
    "KAPEHAN NI KALOY",
    "Coffee Shop Management System",
    5
);

console.log("KAPEHAN NI KALOY database initialized!");
console.log("Coffee category ready!");
console.log("Default coffee products:", db.prepare(
    "SELECT COUNT(*) AS total FROM products"
).get().total);

module.exports = db;
