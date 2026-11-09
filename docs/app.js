
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);
    const money = n => "₱" + Number(n || 0).toFixed(2);

    let products = [];

    const titles = {
        dashboard: ["Dashboard Overview", "Welcome to Kapehan ni Kaloy!"],
        products: ["Coffee Products", "Manage your coffee menu."],
        orders: ["Orders", "Manage in-store orders."],
        categories: ["Categories", "Organize your coffee products."],
        stock: ["Stock Management", "Monitor quantities."],
        "stock-in": ["Stock In", "Add inventory quantities."],
        "stock-out": ["Stock Out", "Record inventory deductions."],
        history: ["Inventory History", "Review stock movements."],
        reports: ["Reports", "Inventory and sales summary."],
        notifications: ["Notifications", "Inventory alerts."],
        settings: ["Settings", "Shop information."]
    };

    function toast(message) {
        $("toast").textContent = message;
        $("toast").classList.add("show");
        setTimeout(() => $("toast").classList.remove("show"), 2600);
    }

    async function api(url, options = {}) {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw Error(data.message || "Request failed");
        }

        return data;
    }

    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function productImage(product) {
        return product.image || "";
    }

    function status(product) {
        if (product.quantity === 0) {
            return ["Out of Stock", "out"];
        }

        if (product.quantity < product.min_stock) {
            return ["Low Stock", "low"];
        }

        return ["Available", "available"];
    }

    // PAGE NAVIGATION
    function go(page) {
        if (!$ (page)) return;

        document.querySelectorAll(".page").forEach(element => {
            element.classList.toggle("active", element.id === page);
        });

        document.querySelectorAll(".nav").forEach(element => {
            element.classList.toggle(
                "active",
                element.dataset.page === page
            );
        });

        $("pageTitle").textContent = (titles[page] || titles.dashboard)[0];
        $("pageSubtitle").textContent = (titles[page] || titles.dashboard)[1];

        history.replaceState(null, "", "#" + page);

        loadPage(page);
    }

    document.querySelectorAll("[data-page]").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            go(link.dataset.page);
        });
    });

    $("currentDate").textContent = new Date().toLocaleDateString(
        "en-PH",
        {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );

    // PRODUCT TABLE
    function renderRows(list) {
        $("productTableBody").innerHTML = list.length
            ? list.map(product => {
                const [state, color] = status(product);

                return `
                    <tr>
                        <td>
                            <img
                                src="${esc(productImage(product))}"
                                onerror="this.style.visibility='hidden'"
                            >
                        </td>
                        <td>${esc(product.product_name)}</td>
                        <td>${esc(product.flavor || "-")}</td>
                        <td>${esc(product.size)}</td>
                        <td>${money(product.selling_price)}</td>
                        <td>${product.quantity}</td>
                        <td>
                            <span class="status ${color}">
                                ${state}
                            </span>
                        </td>
                        <td>
                            <div class="action-group">
                                <button data-edit="${product.id}">Edit</button>
                                <button class="delete" data-delete="${product.id}">
                                    Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("")
            : '<tr><td colspan="8">No products found.</td></tr>';
    }

    // DASHBOARD
    function dashboard() {
        const low = products.filter(
            product => product.quantity > 0 &&
                product.quantity < product.min_stock
        );

        const out = products.filter(
            product => product.quantity === 0
        );

        const units = products.reduce(
            (total, product) => total + product.quantity,
            0
        );

        $("totalProducts").textContent = products.length;
        $("availableStock").textContent = units;
        $("lowStock").textContent = low.length;
        $("outOfStock").textContent = out.length;
        $("alertCount").textContent = low.length + " Alerts";

        $("lowStockList").innerHTML = low.length
            ? low.map(product => `
                <div class="product-row">
                    <div>
                        <b>${esc(product.product_name)}</b>
                        <small>${product.quantity} units remaining</small>
                    </div>
                </div>
            `).join("")
            : "No low stock products.";

        const recent = products.slice(0, 5);

        $("recentProducts").innerHTML = recent.length
            ? recent.map(product => `
                <div class="product-row">
                    <img
                        src="${esc(productImage(product))}"
                        onerror="this.style.visibility='hidden'"
                    >
                    <div>
                        <b>${esc(product.product_name)}</b>
                        <small>
                            ${money(product.selling_price)} ·
                            ${product.quantity} in stock
                        </small>
                    </div>
                </div>
            `).join("")
            : "No products yet.";

        $("inventoryOverview").innerHTML = [
            ["Total Products", products.length],
            ["Available Units", units],
            ["Low Stock", low.length],
            ["Out of Stock", out.length],
            ["Stocked Products", products.filter(p => p.quantity > 0).length]
        ].map(([label, value]) => `
            <div>
                <b>${label}</b>
                <strong>${value}</strong>
            </div>
        `).join("");
    }

    // CUSTOM PRODUCT DROPDOWNS WITH IMAGES
    function fillSelects() {
        const dropdowns = [
            {
                container: "stockInDropdown",
                input: "stockInProduct"
            },
            {
                container: "stockOutDropdown",
                input: "stockOutProduct"
            }
        ];

        dropdowns.forEach(item => {
            const container = $(item.container);
            const hiddenInput = $(item.input);

            const options = container.querySelector(
                ".product-select-options"
            );

            const button = container.querySelector(
                ".product-select-button"
            );

            if (!container || !options || !button) return;

            const previousValue = hiddenInput.value;

            options.innerHTML = products.length
                ? products.map(product => `
                    <button
                        type="button"
                        class="product-option"
                        data-product-id="${product.id}"
                    >
                        <img
                            src="${esc(productImage(product))}"
                            alt="${esc(product.product_name)}"
                            onerror="this.style.display='none'"
                        >
                        <span class="product-option-info">
                            <b>${esc(product.product_name)}</b>
                            <small>
                                Stock: ${product.quantity} units
                            </small>
                        </span>
                    </button>
                `).join("")
                : '<div class="product-empty">No coffee products available.</div>';

            const selectedProduct = products.find(
                product => String(product.id) === previousValue
            );

            if (selectedProduct) {
                showSelectedProduct(
                    container,
                    hiddenInput,
                    selectedProduct
                );
            } else {
                hiddenInput.value = "";

                button.innerHTML = `
                    <span class="selected-product">
                        Select a coffee product
                    </span>
                    <span class="dropdown-arrow">⌄</span>
                `;
            }
        });
    }

    function showSelectedProduct(container, hiddenInput, product) {
        hiddenInput.value = product.id;

        const button = container.querySelector(
            ".product-select-button"
        );

        button.innerHTML = `
            <span class="selected-product">
                <img
                    src="${esc(productImage(product))}"
                    alt=""
                    onerror="this.style.display='none'"
                >
                <span>${esc(product.product_name)}</span>
            </span>
            <span class="dropdown-arrow">⌄</span>
        `;

        container.classList.remove("open");
    }

    // OPEN AND SELECT DROPDOWN ITEMS
    ["stockInDropdown", "stockOutDropdown"].forEach(containerId => {
        const container = $(containerId);

        container.querySelector(".product-select-button").onclick = () => {
            const wasOpen = container.classList.contains("open");

            document.querySelectorAll(".custom-product-select").forEach(dropdown => {
                dropdown.classList.remove("open");
            });

            if (!wasOpen) {
                container.classList.add("open");
            }
        };

        container.querySelector(".product-select-options").onclick = event => {
            const option = event.target.closest("[data-product-id]");

            if (!option) return;

            const product = products.find(
                item => String(item.id) === option.dataset.productId
            );

            if (product) {
                const inputId = containerId === "stockInDropdown"
                    ? "stockInProduct"
                    : "stockOutProduct";

                showSelectedProduct(
                    container,
                    $(inputId),
                    product
                );
            }
        };
    });

    // CLOSE DROPDOWNS WHEN CLICKING OUTSIDE
    document.addEventListener("click", event => {
        if (!event.target.closest(".custom-product-select")) {
            document.querySelectorAll(".custom-product-select").forEach(dropdown => {
                dropdown.classList.remove("open");
            });
        }
    });

    // LOAD PRODUCTS
    async function loadProducts() {
        const data = await api("/api/products");

        products = data.products || [];

        renderRows(products);
        dashboard();
        fillSelects();
        renderStock();
    }

    // PAGE LOADING
    async function loadPage(page) {
        try {
            if ([
                "dashboard",
                "products",
                "stock",
                "stock-in",
                "stock-out"
            ].includes(page)) {
                await loadProducts();
            }

            if (page === "history") await loadHistory();
            if (page === "categories") await loadCategories();
            if (page === "orders") await loadOrders();
            if (page === "notifications") await loadNotifications();
            if (page === "settings") await loadSettings();
            if (page === "reports") await loadReports();

        } catch (error) {
            toast(error.message);
        }
    }

    // STOCK TABLE
    function renderStock() {
        const query = ($("stockSearch").value || "").toLowerCase();

        $("stockTableBody").innerHTML = products
            .filter(product =>
                product.product_name.toLowerCase().includes(query)
            )
            .map(product => {
                const [state, color] = status(product);

                return `
                    <tr>
                        <td>${esc(product.product_name)}</td>
                        <td>${product.quantity}</td>
                        <td>${product.min_stock}</td>
                        <td>
                            <span class="status ${color}">${state}</span>
                        </td>
                    </tr>
                `;
            }).join("");
    }

    $("stockSearch").addEventListener("input", renderStock);

    // ADD / EDIT PRODUCT MODAL
    function modal(product) {
        $("productForm").reset();

        $("productId").value = product?.id || "";

        $("productModalTitle").textContent = product
            ? "Edit Coffee Product"
            : "Add Coffee Product";

        $("productName").value = product?.product_name || "";
        $("productFlavor").value = product?.flavor || "";
        $("productSize").value = product?.size || "Regular";
        $("productDescription").value = product?.description || "";

        $("productCost").value = product?.cost_price ?? 0;
        $("productPrice").value = product?.selling_price ?? 149;
        $("productQuantity").value = product?.quantity ?? 0;
        $("productMinStock").value = product?.min_stock ?? 5;

        $("imagePreview").src = product?.image || "";
        $("imagePreview").style.display = product?.image
            ? "block"
            : "none";

        $("productModal").classList.add("show");
    }

    function closeModal() {
        $("productModal").classList.remove("show");
    }

    $("addProductButton").onclick = () => modal();

    $("closeProductModal").onclick = closeModal;
    $("cancelProductButton").onclick = closeModal;

    $("productImage").onchange = () => {
        const file = $("productImage").files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast("Select an image file.");
            return;
        }

        $("imagePreview").src = URL.createObjectURL(file);
        $("imagePreview").style.display = "block";
    };

    $("productForm").onsubmit = async event => {
        event.preventDefault();

        const id = $("productId").value;
        const formData = new FormData();

        const fields = {
            productName: "product_name",
            productFlavor: "flavor",
            productSize: "size",
            productDescription: "description",
            productCost: "cost_price",
            productPrice: "selling_price",
            productQuantity: "quantity",
            productMinStock: "min_stock"
        };

        Object.entries(fields).forEach(([key, value]) => {
            formData.append(value, $(key).value);
        });

        if ($("productImage").files[0]) {
            formData.append("image", $("productImage").files[0]);
        }

        try {
            await api(
                id ? "/api/products/" + id : "/api/products",
                {
                    method: id ? "PUT" : "POST",
                    body: formData
                }
            );

            closeModal();

            await loadProducts();

            toast("Product saved.");

        } catch (error) {
            toast(error.message);
        }
    };

    // EDIT AND DELETE
    $("productTableBody").onclick = async event => {
        const edit = event.target.closest("[data-edit]");
        const remove = event.target.closest("[data-delete]");

        if (edit) {
            modal(
                products.find(
                    product => product.id === Number(edit.dataset.edit)
                )
            );
        }

        if (remove && confirm("Delete this product?")) {
            try {
                await api(
                    "/api/products/" + remove.dataset.delete,
                    { method: "DELETE" }
                );

                await loadProducts();

                toast("Product deleted.");

            } catch (error) {
                toast(error.message);
            }
        }
    };

    // PRODUCT SEARCH AND FILTER
    function filterProducts() {
        const query = $("productSearch").value.toLowerCase();
        const filter = $("productFilter").value;

        renderRows(
            products
                .filter(product =>
                    product.product_name.toLowerCase().includes(query) ||
                    (product.flavor || "").toLowerCase().includes(query)
                )
                .filter(product =>
                    filter === "all" || status(product)[1] === filter
                )
        );
    }

    $("productSearch").oninput = filterProducts;
    $("productFilter").onchange = filterProducts;

    // STOCK IN AND STOCK OUT
    async function stockSubmit(type) {
        const prefix = type === "stock-in" ? "stockIn" : "stockOut";

        const id = $(prefix + "Product").value;
        const quantity = Number($(prefix + "Quantity").value);
        const note = $(prefix + "Note").value;

        if (!id) {
            toast("Please select a coffee product.");
            return;
        }

        if (!Number.isInteger(quantity) || quantity < 1) {
            toast("Enter a whole quantity greater than zero.");
            return;
        }

        try {
            const data = await api("/api/" + type, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    productId: Number(id),
                    quantity,
                    note
                })
            });

            $(type === "stock-in" ? "stockInForm" : "stockOutForm").reset();

            await loadProducts();

            toast(
                `${data.message} ${data.product.product_name}: ${data.product.quantity} units.`
            );

        } catch (error) {
            toast(error.message);
        }
    }

    $("stockInForm").onsubmit = event => {
        event.preventDefault();
        stockSubmit("stock-in");
    };

    $("stockOutForm").onsubmit = event => {
        event.preventDefault();
        stockSubmit("stock-out");
    };

    // INVENTORY HISTORY
    async function loadHistory() {
        const data = await api("/api/history");

        $("historyTableBody").innerHTML = data.history.map(item => `
            <tr>
                <td>${esc(item.transaction_date || item.created_at)}</td>
                <td>${esc(item.product_name)}</td>
                <td>${esc(item.transaction_type)}</td>
                <td>${item.quantity}</td>
                <td>${esc(item.note || "-")}</td>
            </tr>
        `).join("") || '<tr><td colspan="5">No transactions.</td></tr>';
    }

    // CATEGORIES
    async function loadCategories() {
        const data = await api("/api/categories");

        $("categoryList").innerHTML = data.categories.map(category => `
            <div class="category-chip">
                ${esc(category.name)}
                <button data-catdel="${category.id}">×</button>
            </div>
        `).join("");
    }

    $("addCategoryButton").onclick = async () => {
        const name = prompt("Category name?");

        if (!name) return;

        try {
            await api("/api/categories", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name })
            });

            await loadCategories();

            toast("Category added.");

        } catch (error) {
            toast(error.message);
        }
    };

    $("categoryList").onclick = async event => {
        const button = event.target.closest("[data-catdel]");

        if (button && confirm("Delete category?")) {
            try {
                await api(
                    "/api/categories/" + button.dataset.catdel,
                    { method: "DELETE" }
                );

                await loadCategories();

            } catch (error) {
                toast(error.message);
            }
        }
    };

    // ORDERS
    async function loadOrders() {
        const data = await api("/api/orders");

        $("orderTableBody").innerHTML = data.orders.map(order => `
            <tr>
                <td>#${order.id}</td>
                <td>${esc(order.created_at)}</td>
                <td>${esc(order.order_type)}</td>
                <td>${esc(order.items || "-")}</td>
                <td>${money(order.total)}</td>
                <td>${order.status || "Completed"}</td>
            </tr>
        `).join("") || '<tr><td colspan="6">No orders yet.</td></tr>';
    }

    $("addOrderButton").onclick = async () => {
        try {
            const choices = products.map(product =>
                `${product.id}: ${product.product_name} (stock ${product.quantity})`
            ).join("\n");

            const id = prompt("Enter product ID:\n" + choices);

            if (!id) return;

            const quantity = prompt("Quantity?");

            if (!quantity) return;

            const type = prompt("Dine-in or Takeout?", "Takeout") || "Takeout";

            await api("/api/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    orderType: type,
                    items: [{
                        productId: Number(id),
                        quantity: Number(quantity)
                    }]
                })
            });

            await loadProducts();
            await loadOrders();

            toast("Order saved and stock deducted.");

        } catch (error) {
            toast(error.message);
        }
    };

    // NOTIFICATIONS
    async function loadNotifications() {
        const data = await api("/api/notifications");

        const unread = data.notifications.filter(
            notification => !notification.is_read
        ).length;

        $("notificationCount").textContent = unread;

        $("notificationList").innerHTML = data.notifications.map(notification => `
            <div class="notice ${notification.is_read ? "" : "unread"}">
                ${esc(notification.message)}
                <small>${esc(notification.created_at)}</small>
            </div>
        `).join("") || '<div class="empty">No notifications.</div>';
    }

    $("notificationButton").onclick = () => go("notifications");

    $("markNotificationsRead").onclick = async () => {
        try {
            await api("/api/notifications/read", {
                method: "POST"
            });

            await loadNotifications();

            toast("Marked as read.");

        } catch (error) {
            toast(error.message);
        }
    };

    // SETTINGS
    async function loadSettings() {
        const data = await api("/api/settings");
        const settings = data.settings;

        $("shopName").value = settings.shop_name;
        $("shopDescription").value = settings.shop_information || "";
        $("minimumStock").value = settings.low_stock_threshold;
    }

    $("settingsForm").onsubmit = async event => {
        event.preventDefault();

        try {
            await api("/api/settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    shop_name: $("shopName").value,
                    shop_information: $("shopDescription").value,
                    low_stock_threshold: Number($("minimumStock").value)
                })
            });

            toast("Settings saved.");

        } catch (error) {
            toast(error.message);
        }
    };

    // REPORTS
    async function loadReports() {
        const data = await api("/api/reports/summary");
        const summary = data.summary;

        $("todayOrders").textContent = summary.todayOrders;

        $("reportContent").innerHTML = `
            <div class="overview">
                ${[
                    ["Products", summary.count],
                    ["Units", summary.units],
                    ["Low Stock", summary.low],
                    ["Out of Stock", summary.out],
                    ["Today's Orders", summary.todayOrders],
                    ["Today's Sales", money(summary.todaySales)]
                ].map(([label, value]) => `
                    <div>
                        <b>${label}</b>
                        <strong>${value}</strong>
                    </div>
                `).join("")}
            </div>
        `;
    }

    $("printReportButton").onclick = () => window.print();

    // CLOSE MODAL WITH ESCAPE
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeModal();

            document.querySelectorAll(".custom-product-select").forEach(dropdown => {
                dropdown.classList.remove("open");
            });
        }
    });

    // INITIAL PAGE
    go(
        document.getElementById(location.hash.slice(1))
            ? location.hash.slice(1)
            : "dashboard"
    );
});
