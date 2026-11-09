// LOAD PRODUCTS
async function loadProducts() {
    try {
        // Try loading products from the local Express API
        const data = await api("/api/products");
        products = data.products || [];

    } catch (error) {
        // GitHub Pages fallback: display static coffee products
        console.warn("Using static products for GitHub Pages.");

        products = [
            {
                id: 2,
                product_name: "Americano",
                flavor: "Coffee",
                size: "Regular",
                image: "images/products/americano.jpg",
                selling_price: 149,
                quantity: 0,
                min_stock: 5
            },
            {
                id: 3,
                product_name: "Caramel Macchiato",
                flavor: "Caramel",
                size: "Regular",
                image: "images/products/caramel-macchiato.jpg",
                selling_price: 149,
                quantity: 0,
                min_stock: 5
            },
            {
                id: 4,
                product_name: "Dark Mocha Latte",
                flavor: "Dark Chocolate",
                size: "Regular",
                image: "images/products/dark-mocha-latte.jpg",
                selling_price: 149,
                quantity: 0,
                min_stock: 5
            },
            {
                id: 5,
                product_name: "Hazelnut Latte",
                flavor: "Hazelnut",
                size: "Regular",
                image: "images/products/hazelnut-latte.jpg",
                selling_price: 149,
                quantity: 0,
                min_stock: 5
            },
            {
                id: 6,
                product_name: "Salted Caramel Latte",
                flavor: "Salted Caramel",
                size: "Regular",
                image: "images/products/salted-caramel-latte.jpg",
                selling_price: 149,
                quantity: 0,
                min_stock: 5
            },
            {
                id: 7,
                product_name: "Spanish Latte",
                flavor: "Spanish",
                size: "Regular",
                image: "images/products/spanish-latte.jpg",
                selling_price: 149,
                quantity: 0,
                min_stock: 5
            },
            {
                id: 8,
                product_name: "Strawberry Coffee",
                flavor: "Strawberry",
                size: "Regular",
                image: "images/products/strawberry-coffee.jpg",
                selling_price: 149,
                quantity: 0,
                min_stock: 5
            },
            {
                id: 9,
                product_name: "Vanilla Latte",
                flavor: "Vanilla",
                size: "Regular",
                image: "images/products/vanilla-latte.jpg",
                selling_price: 149,
                quantity: 0,
                min_stock: 5
            },
            {
                id: 10,
                product_name: "White Mocha Latte",
                flavor: "White Chocolate",
                size: "Regular",
                image: "images/products/white-mocha-latte.jpg",
                selling_price: 149,
                quantity: 0,
                min_stock: 5
            }
        ];
    }

    renderRows(products);
    dashboard();
    fillSelects();
    renderStock();
}