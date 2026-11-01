
(() => {
  "use strict";

  // ==========================================
  // 1. CONFIGURATION
  // ==========================================

  const cfg = window.EROTICA_CONFIG || {};
  let products = window.EROTICA_PRODUCTS || [];
  const localProducts = [...products];

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const waNumber = String(cfg.whatsappNumber || "").replace(/\D/g, "");

  // ==========================================
  // 2. APPLICATION STATE
  // ==========================================

  let activeCategory = "All";
  let searchTerm = "";
  let currentProduct = null;
  let bag = [];

  try {
    const savedBag = JSON.parse(localStorage.getItem("es-bag") || "[]");
    bag = Array.isArray(savedBag) ? savedBag : [];
  } catch (error) {
    console.warn("Saved shopping bag could not be read:", error);
    bag = [];
  }

  // ==========================================
  // 3. GENERAL HELPERS
  // ==========================================

  const money = n => {
    if (n == null || !Number.isFinite(Number(n))) {
      return "Price on request";
    }

    return `${cfg.currency || "KSh"} ${Number(n).toLocaleString("en-KE")}`;
  };

  const escapeHTML = s =>
    String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  const toast = msg => {
    const el = $("#toast");
    if (!el) return;

    el.textContent = msg;
    el.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      el.classList.remove("show");
    }, 2600);
  };

  const waLink = message =>
    waNumber && !waNumber.includes("XXXXXXXX")
      ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
      : "";

  const openWhatsApp = message => {
    const url = waLink(message);

    if (!url) {
      toast("Add your WhatsApp number in products.js first.");
      return;
    }

    window.open(url, "_blank", "noopener");
  };

  // ==========================================
  // 4. WHATSAPP CUSTOMER REVIEWS
  // ==========================================

  function requestProductReview(product) {
    const message = [
      `Hello ${cfg.storeName || "EroticaSecrets"}!`,
      "",
      "I'd like to share my experience with a product.",
      "",
      `Product: ${product.name}`,
      "",
      "Please find my review below:",
      "",
      "Name:",
      "Rating (1–5 stars):",
      "Review:",
      "",
      "I confirm that I have purchased, used and loved 💗 this product.",
      "",
      "Thank you!"
    ].join("\n");

    openWhatsApp(message);
  }

  // ==========================================
  // 5. PRODUCT HELPERS
  // ==========================================

  const findProduct = id =>
    products.find(p => String(p.id) === String(id));

  const isAvailable = p =>
    p && p.status === "available";

  // ==========================================
  // 5A. SUPABASE STOREFRONT CONNECTION
  // ==========================================

  function mapDatabaseProduct(row) {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      price: row.price == null ? null : Number(row.price),
      status: row.status || "available",
      isNew: row.is_new === true,
      description: row.description || "",
      images: Array.isArray(row.images) ? row.images : [],
      stockQuantity: row.stock_quantity ?? null,
      reviews: []
    };
  }

  async function loadSupabaseProducts() {
    if (!window.supabaseClient) {
      console.warn("Supabase client is unavailable. Using local products.");
      return;
    }

    try {
      const { data, error } = await window.supabaseClient
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Keep the local catalogue if the database is empty.
      if (!data || data.length === 0) {
        console.warn("No database products found. Using local catalogue.");
        return;
      }

      products = data.map(mapDatabaseProduct);

      await loadApprovedReviews();

      renderCategories();
      renderProducts();
      renderBag();

      // Refresh an open product modal if its product still exists.
      if (currentProduct) {
        const updatedProduct = findProduct(currentProduct.id);

        if (updatedProduct) {
          showProduct(updatedProduct.id);
        } else {
          closeProduct();
        }
      }

      console.log("Storefront products loaded from Supabase.");

    } catch (error) {
      console.error(
        "Could not load products from Supabase. Using local fallback:",
        error
      );

      // Restore the local catalogue if this was the first load.
      if (products !== localProducts && products.length === 0) {
        products = localProducts;
        renderCategories();
        renderProducts();
        renderBag();
      }
    }
  }

  // ==========================================
  // 5B. APPROVED CUSTOMER REVIEWS
  // ==========================================

  async function loadApprovedReviews() {
    try {
      const { data, error } = await window.supabaseClient
        .from("reviews")
        .select("*")
        .eq("status", "approved");

      if (error) throw error;

      products.forEach(product => {
        product.reviews = (data || [])
          .filter(review =>
            String(review.product_id) === String(product.id)
          )
          .map(review => ({
            approved: true,
            name: review.customer_nam || "Customer",
            rating: review.rating,
            text: review.review_text || "",
            date: review.created_at
              ? new Date(review.created_at).toLocaleDateString("en-KE")
              : ""
          }));
      });

    } catch (error) {
      console.warn("Approved reviews could not be loaded:", error);
    }
  }

  // ==========================================
  // 6. SHOPPING BAG
  // ==========================================

  function cleanBag() {
    const cleaned = [];

    bag.forEach(item => {
      if (!item || typeof item !== "object") return;

      const product = findProduct(item.id);

      if (!product || !isAvailable(product)) return;

      const qty = Math.max(
        1,
        Math.min(99, Math.floor(Number(item.qty) || 1))
      );

      const existing = cleaned.find(x => x.id === item.id);

      if (existing) {
        existing.qty = Math.min(99, existing.qty + qty);
      } else {
        cleaned.push({
          id: item.id,
          qty
        });
      }
    });

    bag = cleaned;
  }

  const saveBag = () => {
    cleanBag();

    try {
      localStorage.setItem("es-bag", JSON.stringify(bag));
    } catch (error) {
      console.warn("Shopping bag could not be saved:", error);
      toast("Your bag could not be saved on this device.");
    }

    renderBag();
  };

  function addToBag(id, quantity = 1) {
    const p = findProduct(id);

    if (!p || !isAvailable(p)) {
      toast("This product is currently unavailable.");
      return false;
    }

    const qty = Math.max(
      1,
      Math.min(99, Math.floor(Number(quantity) || 1))
    );

    const existing = bag.find(x => x.id === id);

    if (existing) {
      if (existing.qty + qty > 99) {
        toast("Maximum quantity is 99.");
        return false;
      }

      existing.qty += qty;
    } else {
      bag.push({ id, qty });
    }

    saveBag();
    toast(`${p.name} added to your bag.`);

    return true;
  }

  function renderBag() {
    cleanBag();

    try {
      localStorage.setItem("es-bag", JSON.stringify(bag));
    } catch (error) {
      console.warn("Shopping bag could not be saved:", error);
    }

    const count = bag.reduce(
      (total, item) => total + item.qty,
      0
    );

    const bagCount = $("#bag-count");
    const drawerCount = $("#drawer-count");

    if (bagCount) bagCount.textContent = count;
    if (drawerCount) drawerCount.textContent = `(${count})`;

    const items = bag.map(item => ({
      ...item,
      p: findProduct(item.id)
    }));

    const container = $("#bag-items");

    if (container) {
      container.innerHTML = items.length
        ? items.map(({ id, qty, p }) => `
            <div class="bag-item">

              <div class="bag-thumb">
                ${
                  p.images?.[0]
                    ? `<img
                        src="${escapeHTML(p.images[0])}"
                        alt="${escapeHTML(p.name)}"
                      >`
                    : "ES"
                }
              </div>

              <div class="bag-product-details">

                <h4>${escapeHTML(p.name)}</h4>

                <small>
                  Unit price: ${money(p.price)}
                </small>

                <small class="bag-subtotal">
                  Subtotal:
                  ${
                    p.price == null
                      ? "Price on request"
                      : money(Number(p.price) * qty)
                  }
                </small>

                <div class="qty-controls">

                  <button
                    type="button"
                    data-qty="${escapeHTML(id)}"
                    data-step="-1"
                    aria-label="Decrease quantity"
                  >−</button>

                  <span>${qty}</span>

                  <button
                    type="button"
                    data-qty="${escapeHTML(id)}"
                    data-step="1"
                    aria-label="Increase quantity"
                  >＋</button>

                </div>

              </div>

              <button
                type="button"
                class="remove-item"
                data-remove="${escapeHTML(id)}"
                aria-label="Remove ${escapeHTML(p.name)}"
              >×</button>

            </div>
          `).join("")
        : '<div class="bag-empty">Your bag is waiting for something lovely.</div>';
    }

    const total = items.reduce((sum, item) => {
      return sum + (Number(item.p.price) || 0) * item.qty;
    }, 0);

    const hasUnpricedItems = items.some(
      item => item.p.price == null
    );

    const totalElement = $("#bag-total");

    if (totalElement) {
      totalElement.textContent = hasUnpricedItems
        ? `${money(total)} + price on request`
        : money(total);
    }

    $$("[data-qty]").forEach(button => {
      button.addEventListener("click", () => {
        const item = bag.find(
          x => x.id === button.dataset.qty
        );

        if (!item) return;

        const nextQty = item.qty + Number(button.dataset.step);

        if (nextQty <= 0) {
          bag = bag.filter(x => x.id !== item.id);
        } else if (nextQty <= 99) {
          item.qty = nextQty;
        } else {
          toast("Maximum quantity is 99.");
          return;
        }

        saveBag();
      });
    });

    $$("[data-remove]").forEach(button => {
      button.addEventListener("click", () => {
        bag = bag.filter(
          x => x.id !== button.dataset.remove
        );

        saveBag();
        toast("Product removed from your bag.");
      });
    });
  }

  // ==========================================
  // 7. PRODUCT DISCOVERY
  // ==========================================

  const visibleProducts = () =>
    products
      .filter(p => {
        const matchesCategory =
          activeCategory === "All" ||
          p.category === activeCategory;

        const searchableText =
          `${p.name} ${p.category} ${p.description || ""}`
            .toLowerCase();

        return matchesCategory &&
          searchableText.includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => {
        const sort = $("#sort-select")?.value || "default";

        if (sort === "newest") {
          return Number(b.isNew) - Number(a.isNew);
        }

        if (sort === "price-low") {
          return (a.price ?? Infinity) - (b.price ?? Infinity);
        }

        if (sort === "price-high") {
          return (b.price ?? -1) - (a.price ?? -1);
        }

        return 0;
      });

  // ==========================================
  // 8. PRODUCT CATEGORIES
  // ==========================================

  function renderCategories() {
    const cats = [
      "All",
      ...new Set(products.map(p => p.category).filter(Boolean))
    ];

    const tabs = $("#category-tabs");

    if (!tabs) return;

    tabs.innerHTML = cats.map(c => `
      <button
        class="category-tab ${c === activeCategory ? "active" : ""}"
        data-category="${escapeHTML(c)}"
      >
        ${c === "All" ? "All pieces" : escapeHTML(c)}
      </button>
    `).join("");

    $$("#category-tabs button").forEach(button => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.category;
        renderCategories();
        renderProducts();
      });
    });
  }

  // ==========================================
  // 9. PRODUCT DISPLAY
  // ==========================================

  const productVisual = (p, cls = "product-visual") => {
    const image = p.images?.[0];

    return image
      ? `<div class="${cls}">
           <img src="${escapeHTML(image)}"
                alt="${escapeHTML(p.name)}"
                loading="lazy">
         </div>`
      : `<div class="${cls}">
           <span class="product-placeholder">
             ${escapeHTML(p.name || "A little discovery")}
             <br><small>PRODUCT PHOTOGRAPH</small>
           </span>
         </div>`;
  };

  function renderProducts() {
    const list = visibleProducts();

    const count = $("#collection-count");
    const grid = $("#product-grid");
    const empty = $("#empty-state");

    if (!grid || !empty || !count) return;

    count.textContent =
      `${list.length} ${list.length === 1 ? "PIECE" : "PIECES"}`;

    grid.innerHTML = list.map(p => {
      const dismissed =
        localStorage.getItem(`es-new-${p.id}`) === "1";

      const badge =
        p.status === "soldout"
          ? '<span class="product-badge sold">SOLD OUT</span>'
          : p.isNew && !dismissed
            ? `<span class="product-badge">NEW</span>
               <button class="dismiss-new"
                 data-dismiss="${escapeHTML(p.id)}"
                 aria-label="Dismiss new badge"
                 title="Dismiss badge">×</button>`
            : "";

      return `
        <article
          class="product-card"
          data-product="${escapeHTML(p.id)}"
          tabindex="0"
          role="button"
          aria-label="View ${escapeHTML(p.name)}"
        >

          <div class="product-visual">

            ${
              p.images?.[0]
                ? `<img
                    src="${escapeHTML(p.images[0])}"
                    alt="${escapeHTML(p.name)}"
                    loading="lazy"
                  >`
                : `<span class="product-placeholder">
                    ${escapeHTML(p.name)}
                    <br><small>ADD PRODUCT PHOTO</small>
                  </span>`
            }

            ${badge}

          </div>

          <div class="product-card-info">

            <span class="category">
              ${escapeHTML(p.category || "Collection")}
            </span>

            <h3>${escapeHTML(p.name)}</h3>

            <span class="price">${money(p.price)}</span>

            <div class="card-foot">
              <span class="quick-view">Discover piece ↗</span>
              <span class="stock-label">
                ${p.status === "soldout" ? "Unavailable" : "View details"}
              </span>
            </div>

          </div>

        </article>
      `;
    }).join("");

    empty.hidden = list.length > 0;
    grid.hidden = list.length === 0;

    $$(".product-card").forEach(card => {
      card.addEventListener("click", e => {
        if (e.target.closest("[data-dismiss]")) return;
        showProduct(card.dataset.product);
      });

      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          showProduct(card.dataset.product);
        }
      });
    });

    $$("[data-dismiss]").forEach(button => {
      button.addEventListener("click", e => {
        e.stopPropagation();

        localStorage.setItem(
          `es-new-${button.dataset.dismiss}`,
          "1"
        );

        renderProducts();
        toast("New label hidden on this device.");
      });
    });
  }

  // ==========================================
  // 10. PRODUCT PREVIEW
  // ==========================================

  function showProduct(id) {
    const p = findProduct(id);

    if (!p) return;

    currentProduct = p;

    const imgs = (p.images || []).map((src, i) => `
      <button
        type="button"
        data-image="${escapeHTML(src)}"
        aria-label="View image ${i + 1}"
      >
        <img src="${escapeHTML(src)}" alt="">
      </button>
    `).join("");

    // Only explicitly approved reviews are displayed.

    const reviews = (p.reviews || [])
      .filter(r => r && r.approved === true)
      .map(r => `
        <div class="review">
          <b>${escapeHTML(r.name || "Customer")}</b>

          <span>
            ${"★".repeat(Math.max(0, Math.min(5, Number(r.rating) || 5)))}
          </span>

          <p>${escapeHTML(r.text)}</p>

          <small>${escapeHTML(r.date || "")}</small>
        </div>
      `).join("");

    const soldOut = p.status === "soldout";

    $("#modal-content").innerHTML = `
      <div>

        <div class="modal-gallery">

          ${
            p.images?.[0]
              ? `<img
                  id="modal-main-image"
                  src="${escapeHTML(p.images[0])}"
                  alt="${escapeHTML(p.name)}"
                >`
              : `<span class="product-placeholder">
                  ${escapeHTML(p.name)}
                  <br><small>PRODUCT PHOTOGRAPH</small>
                </span>`
          }

        </div>

        <div class="modal-thumbs">${imgs}</div>

      </div>

      <div class="modal-info">

        <p class="eyebrow dark-eyebrow">
          ${escapeHTML(p.category || "THE COLLECTION")}
        </p>

        <h2>${escapeHTML(p.name)}</h2>

        <div class="modal-price">${money(p.price)}</div>

        <p>
          ${escapeHTML(
            p.description || "Ask us for more details about this piece."
          )}
        </p>

        ${
          soldOut
            ? `
              <span class="product-badge sold">
                CURRENTLY SOLD OUT
              </span>

              <button
                class="button button-dark full-button"
                id="restock-button"
                type="button"
              >
                Notify me when available ↗
              </button>
            `
            : `
              <div class="order-quantity">

                <label for="product-quantity">QUANTITY</label>

                <div class="quantity-picker">

                  <button
                    type="button"
                    id="qty-minus"
                    aria-label="Decrease quantity"
                  >−</button>

                  <input
                    type="number"
                    id="product-quantity"
                    value="1"
                    min="1"
                    max="99"
                  >

                  <button
                    type="button"
                    id="qty-plus"
                    aria-label="Increase quantity"
                  >＋</button>

                </div>

              </div>

              <button
                class="button button-dark full-button"
                id="add-to-bag"
                type="button"
              >
                Add to bag <span>＋</span>
              </button>

              <button
                class="button whatsapp-order full-button"
                id="direct-order"
                type="button"
              >
                <span>Order this product on WhatsApp ↗</span>
              </button>

              <p class="order-note">
                Your order will be confirmed personally on WhatsApp.
                Packaging and delivery arrangements are discussed privately.
              </p>
            `
        }

        <div class="reviews-block">

          ${
            reviews
              ? `<h3>Customer notes</h3>${reviews}`
              : `
                <h3>Be the first to share your experience</h3>

                <p class="review-intro">
                  Your feedback helps us improve and helps other
                  customers make informed choices.
                </p>
              `
          }

          <button
            class="button button-outline full-button"
            id="review-button"
            type="button"
          >
            Share your experience on WhatsApp ↗
          </button>

          <p class="review-note">
            Reviews are submitted privately and published only after approval.
          </p>

        </div>

      </div>
    `;

    // IMAGE GALLERY

    $$("#modal-content [data-image]").forEach(button => {
      button.addEventListener("click", () => {
        const mainImage = $("#modal-main-image");

        if (mainImage) {
          mainImage.src = button.dataset.image;
        }
      });
    });

    // QUANTITY CONTROLS

    const quantityInput = $("#product-quantity");

    $("#qty-minus")?.addEventListener("click", () => {
      if (!quantityInput) return;

      quantityInput.value = Math.max(
        1,
        Number(quantityInput.value || 1) - 1
      );
    });

    $("#qty-plus")?.addEventListener("click", () => {
      if (!quantityInput) return;

      quantityInput.value = Math.min(
        99,
        Number(quantityInput.value || 1) + 1
      );
    });

    quantityInput?.addEventListener("change", () => {
      quantityInput.value = Math.max(
        1,
        Math.min(99, Math.floor(Number(quantityInput.value) || 1))
      );
    });

    // ADD SELECTED QUANTITY

    $("#add-to-bag")?.addEventListener("click", () => {
      const qty = Math.max(
        1,
        Math.min(99, Math.floor(Number(quantityInput.value) || 1))
      );

      const added = addToBag(p.id, qty);

      if (added) closeProduct();
    });

    // DIRECT WHATSAPP ORDER

    $("#direct-order")?.addEventListener("click", () => {
      const qty = Math.max(
        1,
        Math.min(99, Math.floor(Number(quantityInput.value) || 1))
      );

      if (p.price == null) {
        openWhatsApp(
          `Hello EroticaSecrets!\n\nI am interested in ${p.name}.\nQuantity: ${qty}\n\nPlease confirm the price and availability.`
        );

        return;
      }

      const subtotal = Number(p.price) * qty;

      const message =
`Hello EroticaSecrets!

I would like to order the following product:

Product: ${p.name}
Unit price: ${money(p.price)}
Quantity: ${qty}
Subtotal: ${money(subtotal)}

Please confirm availability and advise me on payment arrangements.

I understand that packaging and delivery arrangements will be discussed privately on WhatsApp.

Thank you!`;

      openWhatsApp(message);
    });

    // SOLD-OUT RESTOCK ENQUIRY

    $("#restock-button")?.addEventListener("click", () => {
      openWhatsApp(
        `Hello EroticaSecrets!\n\nI am interested in "${p.name}".\n\nPlease notify me when this product is available again.\n\nThank you!`
      );
    });

    // WHATSAPP REVIEW SUBMISSION

    $("#review-button")?.addEventListener("click", () => {
      requestProductReview(p);
    });

    $("#product-modal-backdrop").classList.add("open");
    document.body.classList.add("locked");
  }

  function closeProduct() {
    $("#product-modal-backdrop").classList.remove("open");
    document.body.classList.remove("locked");
    currentProduct = null;
  }

  // ==========================================
  // 11. PRODUCT MODAL EVENTS
  // ==========================================

  $("#modal-close").addEventListener("click", closeProduct);

  $("#product-modal-backdrop").addEventListener("click", e => {
    if (e.target.id === "product-modal-backdrop") {
      closeProduct();
    }
  });

  // ==========================================
  // 12. BAG DRAWER
  // ==========================================

  function openBag() {
    $("#bag-drawer").classList.add("open");
    $("#drawer-backdrop").classList.add("open");
    $("#bag-drawer").setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
  }

  function closeBag() {
    $("#bag-drawer").classList.remove("open");
    $("#drawer-backdrop").classList.remove("open");
    $("#bag-drawer").setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
  }

  $("#bag-open").addEventListener("click", openBag);
  $("#bag-close").addEventListener("click", closeBag);
  $("#drawer-backdrop").addEventListener("click", closeBag);

  // ==========================================
  // 13. WHATSAPP CHECKOUT
  // ==========================================

  $("#checkout-button").addEventListener("click", () => {
    cleanBag();

    try {
      localStorage.setItem("es-bag", JSON.stringify(bag));
    } catch (error) {
      console.warn("Shopping bag could not be saved:", error);
    }

    if (!bag.length) {
      renderBag();
      toast("Your bag is empty.");
      return;
    }

    const orderItems = bag.map(item => {
      const p = findProduct(item.id);

      return {
        p,
        qty: item.qty,
        subtotal: p.price == null
          ? null
          : Number(p.price) * item.qty
      };
    });

    if (orderItems.some(item => item.subtotal === null)) {
      toast("Please contact us to confirm an item price.");
      return;
    }

    const total = orderItems.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    const lines = orderItems.map(item =>
      `• ${item.p.name}\n` +
      `   Quantity: ${item.qty}\n` +
      `   Unit price: ${money(item.p.price)}\n` +
      `   Subtotal: ${money(item.subtotal)}`
    );

    const message =
`Hello ${cfg.storeName || "EroticaSecrets"}!

I would like to place an order:

${lines.join("\n\n")}

--------------------------------
ORDER TOTAL: ${money(total)}
--------------------------------

Please confirm product availability and advise me on payment arrangements.

I understand that packaging and delivery arrangements will be discussed privately on WhatsApp.

Thank you!`;

    openWhatsApp(message);
  });

  // ==========================================
  // 14. SEARCH
  // ==========================================

  $("#search-toggle").addEventListener("click", () => {
    $("#search-panel").hidden = false;
    $("#search-input").focus();
  });

  $("#search-close").addEventListener("click", () => {
    $("#search-panel").hidden = true;
    searchTerm = "";
    $("#search-input").value = "";
    renderProducts();
  });

  $("#search-input").addEventListener("input", e => {
    searchTerm = e.target.value;
    renderProducts();
  });

  // ==========================================
  // 15. SORTING
  // ==========================================

  $("#sort-select").addEventListener("change", renderProducts);

  // ==========================================
  // 16. MOBILE MENU
  // ==========================================

  $("#menu-toggle").addEventListener("click", () => {
    $("#mobile-menu").hidden = !$("#mobile-menu").hidden;
  });

  $$("#mobile-menu a").forEach(a => {
    a.addEventListener("click", () => {
      $("#mobile-menu").hidden = true;
    });
  });

  // ==========================================
  // 17. WHATSAPP LINKS
  // ==========================================

  $("#empty-whatsapp").href =
    waLink("Hello EroticaSecrets, I'd love to know what products are currently available.") || "#";

  $("#newsletter-whatsapp").href =
    waLink("Hello EroticaSecrets, please keep me updated about new arrivals and restocks.") || "#";

  $("#footer-whatsapp").href =
    waLink("Hello EroticaSecrets, I have an enquiry.") || "#";

  // ==========================================
  // 18. FOOTER YEAR
  // ==========================================

  $("#year").textContent = new Date().getFullYear();

  // ==========================================
  // 19. AGE VERIFICATION
  // ==========================================

  const age = $("#age-overlay");

  if (sessionStorage.getItem("es-age-confirmed") === "yes") {
    age.classList.add("hidden");
  }

  $("#age-yes").addEventListener("click", () => {
    sessionStorage.setItem("es-age-confirmed", "yes");
    age.classList.add("hidden");
  });

  $("#age-no").addEventListener("click", () => {
    age.innerHTML = `
      <div class="age-card">
        <h2>Thank you for checking.</h2>
        <p>This store is intended for adults aged 18 and over.</p>
      </div>
    `;
  });

  // ==========================================
  // 20. INITIALISE WEBSITE
  // ==========================================

  renderCategories();
  renderProducts();
  renderBag();

  // Load the live catalogue from Supabase.
  loadSupabaseProducts();

  // Refresh products periodically while the page remains open.
  setInterval(loadSupabaseProducts, 60000);

})();
