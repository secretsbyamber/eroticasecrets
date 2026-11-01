/* =========================================
   EROTICASECRETS DASHBOARD
   Authentication, Products, Stock & Navigation
========================================= */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const loadingScreen = document.getElementById("dashboard-loading");
  const dashboardApp = document.getElementById("dashboard-app");
  const adminEmailDisplay = document.getElementById("admin-email-display");
  const logoutButton = document.getElementById("logout-button");
  const notice = document.getElementById("dashboard-notice");
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menu-toggle");
  const pageTitle = document.getElementById("page-title");

  let currentProducts = [];
  let currentReviews = [];

  const IMAGE_BUCKET = "product-images";

  // -----------------------------------------
  // HELPERS
  // -----------------------------------------

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function showNotice(message, isError = false) {
    notice.textContent = message;
    notice.style.background = isError ? "#fdf0e9" : "#edf7f0";
    notice.style.color = isError ? "#b42318" : "#16804a";

    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => {
      notice.textContent = "";
    }, 5000);
  }

  function formatMoney(amount) {
    if (amount === null || amount === undefined || amount === "") {
      return "Price on request";
    }

    return "KSh " + Number(amount).toLocaleString("en-KE");
  }

  function showDashboard() {
    loadingScreen.hidden = true;
    dashboardApp.hidden = false;
  }

  function getProductImages(product) {
    if (Array.isArray(product.images)) {
      return product.images.filter(image => typeof image === "string");
    }

    return [];
  }

  function normaliseStatus(status) {
    return status === "soldout" ? "soldout" : "available";
  }

  // -----------------------------------------
  // ADMIN SECURITY CHECK
  // -----------------------------------------

  async function verifyAdminAccess() {
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    const session = sessionData.session;

    if (!session) {
      window.location.replace("admin.html");
      return null;
    }

    const { data: isAdmin, error: adminError } =
      await supabaseClient.rpc("is_active_admin");

    if (adminError) throw adminError;

    if (isAdmin !== true) {
      await supabaseClient.auth.signOut();
      window.location.replace("admin.html");
      return null;
    }

    return session.user;
  }

  // -----------------------------------------
  // LOAD PRODUCTS
  // -----------------------------------------

  async function loadProducts() {
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Products loading error:", error);
      throw error;
    }

    currentProducts = data || [];

    updateProductStatistics();
    renderProducts();

    return currentProducts;
  }

  // -----------------------------------------
  // LOAD REVIEWS
  // -----------------------------------------

 async function loadReviews() {
    const { data, error } = await supabaseClient
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Reviews loading error:", error);
      currentReviews = [];
      document.getElementById("stat-reviews").textContent = "—";
      showNotice("Unable to load customer reviews.", true);
      return;
    }

    currentReviews = data || [];

    updateReviewStatistics();
    renderReviews();
  }

  // -----------------------------------------
  // PRODUCT STATISTICS
  // -----------------------------------------

  function updateProductStatistics() {
    const total = currentProducts.length;

    const available = currentProducts.filter(
      product => product.status === "available"
    ).length;

    const soldout = currentProducts.filter(
      product => product.status === "soldout"
    ).length;

    document.getElementById("stat-products").textContent = total;
    document.getElementById("stat-available").textContent = available;
    document.getElementById("stat-soldout").textContent = soldout;
  }

  // -----------------------------------------
  // REVIEW STATISTICS
  // -----------------------------------------

  function updateReviewStatistics() {
    const pending = currentReviews.filter(
      review => review.status === "pending"
    ).length;

    document.getElementById("stat-reviews").textContent = pending;
  }
   
  // -----------------------------------------
  // REVIEW MANAGEMENT
  // -----------------------------------------

  let activeReviewFilter = "pending";

  function renderReviews() {
    const container = document.getElementById("reviews-container");
     addReviewStyles();

    const counts = {
      pending: currentReviews.filter(review => review.status === "pending").length,
      approved: currentReviews.filter(review => review.status === "approved").length,
      rejected: currentReviews.filter(review => review.status === "rejected").length
    };

    const filteredReviews = currentReviews.filter(
      review => review.status === activeReviewFilter
    );

    const tabs = `
      <div class="review-filter-tabs">
        ${["pending", "approved", "rejected"].map(status => `
          <button type="button"
            class="review-filter ${activeReviewFilter === status ? "active" : ""}"
            data-review-filter="${status}">
            ${status.charAt(0).toUpperCase() + status.slice(1)}
            <span>${counts[status]}</span>
          </button>
        `).join("")}
      </div>
    `;

    if (!filteredReviews.length) {
      container.innerHTML = `
        ${tabs}
        <div class="dashboard-panel review-empty">
          <h3>No ${activeReviewFilter} reviews</h3>
          <p>Customer reviews with this status will appear here.</p>
        </div>
      `;
      return;
    }

    const cards = filteredReviews.map(review => {
      const product = currentProducts.find(
        item => String(item.id) === String(review.product_id)
      );

      const customerName = review.customer_nam || "Anonymous customer";
      const productName = product ? product.name : "Product unavailable";
      const rating = Math.min(5, Math.max(0, Number(review.rating) || 0));
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      const date = review.created_at
        ? new Date(review.created_at).toLocaleString("en-KE", {
            dateStyle: "medium",
            timeStyle: "short"
          })
        : "Date unavailable";

      return `
        <article class="review-card">
          <div class="review-card-top">
            <div>
              <h3>${escapeHTML(customerName)}</h3>
              <p>${escapeHTML(productName)}</p>
            </div>
            <span class="review-status ${escapeHTML(review.status)}">
              ${escapeHTML(review.status)}
            </span>
          </div>

          <div class="review-rating" aria-label="${rating} out of 5 stars">
            ${stars}
          </div>

          <p class="review-message">${escapeHTML(review.review_text)}</p>

          <small class="review-date">Submitted: ${escapeHTML(date)}</small>

          <div class="review-actions">
            ${review.status !== "approved" ? `
              <button type="button" class="review-approve"
                data-review-action="approved"
                data-review-id="${escapeHTML(review.id)}">
                Approve
              </button>
            ` : ""}

            ${review.status !== "rejected" ? `
              <button type="button" class="review-reject"
                data-review-action="rejected"
                data-review-id="${escapeHTML(review.id)}">
                Reject
              </button>
            ` : ""}

            <button type="button" class="review-delete"
              data-review-action="delete"
              data-review-id="${escapeHTML(review.id)}">
              Delete
            </button>
          </div>
        </article>
      `;
    }).join("");

    container.innerHTML = `${tabs}<div class="review-card-list">${cards}</div>`;
  }

  async function updateReviewStatus(reviewId, newStatus) {
    try {
      const { error } = await supabaseClient
        .from("reviews")
        .update({ status: newStatus })
        .eq("id", reviewId);

      if (error) throw error;

      await loadReviews();

      showNotice(`Review ${newStatus} successfully.`);
    } catch (error) {
      console.error("Review update error:", error);
      showNotice(error.message || "Unable to update review.", true);
    }
  }

  async function deleteReview(reviewId) {
    const confirmed = window.confirm(
      "Permanently delete this customer review? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      const { error } = await supabaseClient
        .from("reviews")
        .delete()
        .eq("id", reviewId);

      if (error) throw error;

      await loadReviews();
      showNotice("Review deleted successfully.");
    } catch (error) {
      console.error("Review deletion error:", error);
      showNotice(error.message || "Unable to delete review.", true);
    }
  }

  document.getElementById("reviews-container")
    .addEventListener("click", event => {
      const filterButton = event.target.closest("[data-review-filter]");

      if (filterButton) {
        activeReviewFilter = filterButton.dataset.reviewFilter;
        renderReviews();
        return;
      }

      const actionButton = event.target.closest("[data-review-action]");
      if (!actionButton) return;

      const reviewId = actionButton.dataset.reviewId;
      const action = actionButton.dataset.reviewAction;

      if (action === "approved" || action === "rejected") {
        updateReviewStatus(reviewId, action);
      }

      if (action === "delete") {
        deleteReview(reviewId);
      }
    });


  // -----------------------------------------
  // PRODUCT TABLE
  // -----------------------------------------

  function renderProducts() {
    const container = document.getElementById("products-container");

    if (!currentProducts.length) {
      container.innerHTML = `
        <div class="dashboard-panel">
          <p>No products were found in your database.</p>
          <p>Use Add Product to create your first product.</p>
        </div>
      `;
      return;
    }

    const rows = currentProducts.map(product => {
      const status = normaliseStatus(product.status);
      const images = getProductImages(product);
      const firstImage = images[0];
      const stock = product.stock_quantity ?? 0;

      const imageHTML = firstImage
        ? `<img src="${escapeHTML(firstImage)}"
                alt=""
                class="product-admin-image"
                loading="lazy">`
        : `<div class="product-admin-placeholder">ES</div>`;

      return `
        <tr>
          <td>
            <div class="product-admin-info">
              ${imageHTML}
              <div>
                <strong>${escapeHTML(product.name)}</strong>
                <small>${escapeHTML(product.id)}</small>
              </div>
            </div>
          </td>

          <td>${escapeHTML(product.category)}</td>
          <td>${escapeHTML(formatMoney(product.price))}</td>

          <td>
            <div class="stock-controls">
              <button type="button"
                class="stock-button stock-minus"
                data-action="stock-minus"
                data-id="${escapeHTML(product.id)}"
                aria-label="Decrease stock"
                ${stock <= 0 ? "disabled" : ""}>−</button>

              <strong class="stock-number">${stock}</strong>

              <button type="button"
                class="stock-button stock-plus"
                data-action="stock-plus"
                data-id="${escapeHTML(product.id)}"
                aria-label="Increase stock">+</button>
            </div>
          </td>

          <td>
            <span class="product-status ${status}">
              ${status === "available" ? "Available" : "Sold Out"}
            </span>
          </td>

          <td>
            <div class="product-admin-actions">
              <button type="button"
                class="secondary-button"
                data-action="edit"
                data-id="${escapeHTML(product.id)}">
                Edit
              </button>

              <button type="button"
                class="danger-button"
                data-action="delete"
                data-id="${escapeHTML(product.id)}">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    container.innerHTML = `
      <div class="dashboard-panel">
        <h3>Your Product Catalogue</h3>

        <div class="table-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }



  // -----------------------------------------
  // STOCK MANAGEMENT STYLES
  // -----------------------------------------

  function addProductFormStyles() {
    if (document.getElementById("product-form-styles")) return;

    const style = document.createElement("style");
    style.id = "product-form-styles";

    style.textContent = `
      .stock-controls {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .stock-button {
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 7px;
        font-size: 20px;
        font-weight: bold;
        cursor: pointer;
      }

      .stock-minus {
        background: #fbe8e7;
        color: #b42318;
      }

      .stock-plus {
        background: #e5f4e9;
        color: #16804a;
      }

      .stock-button:disabled {
        opacity: .4;
        cursor: not-allowed;
      }

      .stock-number {
        min-width: 20px;
        text-align: center;
      }

      .product-status.available {
        background: #e5f4e9;
        color: #16804a;
        padding: 5px 10px;
        border-radius: 20px;
      }

      .product-status.soldout {
        background: #fbe8e7;
        color: #b42318;
        padding: 5px 10px;
        border-radius: 20px;
      }

      .product-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(25, 12, 20, .72);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        overflow-y: auto;
      }

      .product-modal {
        width: 100%;
        max-width: 680px;
        max-height: 92vh;
        overflow-y: auto;
        background: #fffaf6;
        color: #35212c;
        border-radius: 15px;
        padding: 25px;
        box-shadow: 0 20px 70px rgba(0,0,0,.25);
      }

      .product-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 22px;
      }

      .product-modal-header h2 {
        margin: 0;
        font-family: Georgia, serif;
      }

      .product-modal-close {
        border: 0;
        background: transparent;
        font-size: 27px;
        cursor: pointer;
        color: #563044;
      }

      .product-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .product-form-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .product-form-field.full {
        grid-column: 1 / -1;
      }

      .product-form-field label {
        font-size: 13px;
        font-weight: 700;
      }

      .product-form-field input,
      .product-form-field select,
      .product-form-field textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dfd0d5;
        border-radius: 8px;
        padding: 11px;
        background: white;
        color: #35212c;
        font: inherit;
      }

      .product-form-field textarea {
        min-height: 100px;
        resize: vertical;
      }

      .product-existing-images {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .product-existing-image {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 12px;
      }

      .product-existing-image img {
        width: 75px;
        height: 75px;
        object-fit: cover;
        border-radius: 8px;
      }

      .product-form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 22px;
      }

      .product-admin-info {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 180px;
      }

      .product-admin-info small {
        display: block;
        margin-top: 4px;
        opacity: .65;
      }

      .product-admin-image,
      .product-admin-placeholder {
        width: 48px;
        height: 48px;
        border-radius: 7px;
        object-fit: cover;
      }

      .product-admin-placeholder {
        display: grid;
        place-items: center;
        background: #f1e4e9;
        color: #713d55;
        font-weight: bold;
      }

      .product-admin-actions {
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
      }

      .product-admin-actions button,
      .product-form-actions button {
        border: 0;
        border-radius: 7px;
        padding: 9px 12px;
        cursor: pointer;
        font: inherit;
      }

      .secondary-button {
        background: #eee3e8;
        color: #563044;
      }

      .danger-button {
        background: #fbe8e7;
        color: #b42318;
      }

      .product-form-actions .primary-button {
        background: #713d55;
        color: white;
      }

      .product-form-actions .cancel-button {
        background: #eee3e8;
        color: #563044;
      }

      .product-form-actions button:disabled {
        opacity: .6;
        cursor: wait;
      }

      @media (max-width: 560px) {
        .product-form-grid {
          grid-template-columns: 1fr;
        }

        .product-form-field.full {
          grid-column: auto;
        }

        .product-modal {
          padding: 18px;
        }
      }
    `;

    document.head.appendChild(style);
  }
   
  // -----------------------------------------
  // REVIEW SECTION STYLES
  // -----------------------------------------

  function addReviewStyles() {
    if (document.getElementById("review-styles")) return;

    const style = document.createElement("style");
    style.id = "review-styles";

    style.textContent = `
      .review-filter-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 20px 0;
      }

      .review-filter {
        border: 1px solid #e5d8d2;
        background: #fffaf7;
        color: #54283d;
        padding: 10px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
      }

      .review-filter.active {
        background: #54283d;
        color: #ffffff;
        border-color: #54283d;
      }

      .review-filter span {
        display: inline-block;
        margin-left: 6px;
        padding: 2px 7px;
        border-radius: 20px;
        background: rgba(190, 151, 83, 0.2);
      }

      .review-card-list {
        display: grid;
        gap: 16px;
      }

      .review-card {
        background: #fffaf7;
        border: 1px solid #eaded8;
        border-radius: 12px;
        padding: 20px;
      }

      .review-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .review-card-top h3 {
        margin: 0 0 5px;
        color: #54283d;
      }

      .review-card-top p {
        margin: 0;
        color: #786b70;
      }

      .review-status {
        padding: 5px 10px;
        border-radius: 20px;
        font-size: 12px;
        text-transform: capitalize;
        font-weight: 700;
      }

      .review-status.pending {
        background: #fff0cf;
        color: #805600;
      }

      .review-status.approved {
        background: #e1f3e5;
        color: #236b36;
      }

      .review-status.rejected {
        background: #fbe4e4;
        color: #9a2929;
      }

      .review-rating {
        color: #bd9145;
        letter-spacing: 3px;
        font-size: 19px;
        margin: 14px 0;
      }

      .review-message {
        color: #463c40;
        line-height: 1.6;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .review-date {
        display: block;
        color: #8a7d82;
        margin-top: 12px;
      }

      .review-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 18px;
      }

      .review-actions button {
        border: 0;
        border-radius: 7px;
        padding: 9px 14px;
        cursor: pointer;
        font-weight: 600;
      }

      .review-approve {
        background: #e1f3e5;
        color: #236b36;
      }

      .review-reject {
        background: #fbe4e4;
        color: #9a2929;
      }

      .review-delete {
        background: #eee9e7;
        color: #55484d;
      }

      .review-empty {
        padding: 28px;
        text-align: center;
        border: 1px solid #eaded8;
        border-radius: 12px;
        background: #fffaf7;
      }

      @media (max-width: 600px) {
        .review-card {
          padding: 15px;
        }

        .review-card-top {
          flex-direction: column;
        }
      }
    `;

    document.head.appendChild(style);
  }


  // -----------------------------------------
  // STOCK ADJUSTMENT
  // -----------------------------------------

  async function adjustStock(productId, change) {
    const product = currentProducts.find(
      item => String(item.id) === String(productId)
    );

    if (!product) return;

    const currentStock = Number(product.stock_quantity ?? 0);
    const newStock = currentStock + change;

    if (newStock < 0) return;

    const newStatus = newStock === 0 ? "soldout" : "available";

    try {
      const { error } = await supabaseClient
        .from("products")
        .update({
          stock_quantity: newStock,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", productId);

      if (error) throw error;

      await loadProducts();

      showNotice(
        `${product.name} stock updated to ${newStock}.`
      );

    } catch (error) {
      console.error("Stock adjustment error:", error);
      showNotice(error.message || "Unable to update stock.", true);
    }
  }

  // -----------------------------------------
  // OPEN PRODUCT FORM
  // -----------------------------------------

  function openProductForm(product = null) {
    addProductFormStyles();

    closeProductForm();

    const editing = Boolean(product);
    const images = product ? getProductImages(product) : [];

    const existingImagesHTML = images.map((image, index) => `
      <label class="product-existing-image">
        <img src="${escapeHTML(image)}" alt="Existing product image">
        <span>
          <input type="checkbox"
            name="keep-image"
            value="${index}"
            checked>
          Keep image
        </span>
      </label>
    `).join("");

    const overlay = document.createElement("div");
    overlay.className = "product-modal-overlay";
    overlay.id = "product-modal-overlay";

    overlay.innerHTML = `
      <div class="product-modal" role="dialog" aria-modal="true"
        aria-labelledby="product-form-title">

        <div class="product-modal-header">
          <h2 id="product-form-title">
            ${editing ? "Edit Product" : "Add New Product"}
          </h2>
          <button type="button" class="product-modal-close"
            id="close-product-modal" aria-label="Close">&times;</button>
        </div>

        <form id="product-form">
          <div class="product-form-grid">

            <div class="product-form-field">
              <label for="product-id">Product ID *</label>
              <input id="product-id" name="id" required
                maxlength="80"
                ${editing ? "readonly" : ""}
                value="${escapeHTML(product?.id || "")}"
                placeholder="e.g. rose-005">
            </div>

            <div class="product-form-field">
              <label for="product-name">Product Name *</label>
              <input id="product-name" name="name" required
                maxlength="150"
                value="${escapeHTML(product?.name || "")}">
            </div>

            <div class="product-form-field">
              <label for="product-category">Category *</label>
              <input id="product-category" name="category" required
                maxlength="100"
                value="${escapeHTML(product?.category || "")}"
                placeholder="e.g. Intimate Wellness">
            </div>

            <div class="product-form-field">
              <label for="product-price">Price (KSh) *</label>
              <input id="product-price" name="price" type="number"
                min="0" step="0.01" required
                value="${escapeHTML(product?.price ?? "")}">
            </div>

            <div class="product-form-field">
              <label for="product-stock">Stock Quantity</label>
              <input id="product-stock" name="stock_quantity"
                type="number" min="0" step="1"
                value="${escapeHTML(product?.stock_quantity ?? 0)}">
            </div>

            <div class="product-form-field">
              <label for="product-status">Availability *</label>
              <select id="product-status" name="status" required>
                <option value="available"
                  ${normaliseStatus(product?.status) === "available" ? "selected" : ""}>
                  Available
                </option>
                <option value="soldout"
                  ${product?.status === "soldout" ? "selected" : ""}>
                  Sold Out
                </option>
              </select>
            </div>

            <div class="product-form-field full">
              <label for="product-description">Description</label>
              <textarea id="product-description" name="description"
                maxlength="3000"
                placeholder="Write a product description...">${escapeHTML(product?.description || "")}</textarea>
            </div>

            <div class="product-form-field full">
              <label>
                <input type="checkbox" name="is_new"
                  ${product?.is_new ? "checked" : ""}>
                Mark as a new product
              </label>
            </div>

            ${editing && images.length ? `
              <div class="product-form-field full">
                <label>Existing Images — untick any you want to remove</label>
                <div class="product-existing-images">
                  ${existingImagesHTML}
                </div>
              </div>
            ` : ""}

            <div class="product-form-field full">
              <label for="product-images">
                ${editing ? "Upload Additional Images" : "Product Images"}
              </label>
              <input id="product-images" name="images"
                type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                multiple>
              <small>JPEG, PNG, WebP or GIF. Maximum 10 MB per image.</small>
            </div>

          </div>

          <div class="product-form-actions">
            <button type="button" class="cancel-button"
              id="cancel-product-form">Cancel</button>
            <button type="submit" class="primary-button"
              id="save-product-button">
              ${editing ? "Save Changes" : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("close-product-modal")
      .addEventListener("click", closeProductForm);

    document.getElementById("cancel-product-form")
      .addEventListener("click", closeProductForm);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeProductForm();
    });

    document.getElementById("product-form")
      .addEventListener("submit", event => {
        saveProduct(event, product);
      });
  }

  function closeProductForm() {
    document.getElementById("product-modal-overlay")?.remove();
  }

  // -----------------------------------------
  // UPLOAD PRODUCT IMAGES
  // -----------------------------------------

  async function uploadProductImages(files, productId) {
    const uploadedURLs = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please select image files only.");
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error(`"${file.name}" exceeds the 10 MB limit.`);
      }

      const safeName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-");

      const filePath =
        `${productId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from(IMAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabaseClient.storage
        .from(IMAGE_BUCKET)
        .getPublicUrl(filePath);

      uploadedURLs.push(data.publicUrl);
    }

    return uploadedURLs;
  }

  // -----------------------------------------
  // SAVE PRODUCT
  // -----------------------------------------

  async function saveProduct(event, existingProduct) {
    event.preventDefault();

    const form = event.currentTarget;
    const saveButton = document.getElementById("save-product-button");
    const formData = new FormData(form);

    const id = String(formData.get("id") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const price = Number(formData.get("price"));
    const stockValue = formData.get("stock_quantity");
    const stockQuantity = stockValue === "" ? null : Number(stockValue);
    const status = normaliseStatus(formData.get("status"));
    const isNew = form.querySelector('[name="is_new"]').checked;
    const selectedFiles = Array.from(
      document.getElementById("product-images").files
    );

    if (!id || !name || !category || !Number.isFinite(price) || price < 0) {
      showNotice("Please complete the required product details.", true);
      return;
    }

    if (
      stockQuantity !== null &&
      (!Number.isInteger(stockQuantity) || stockQuantity < 0)
    ) {
      showNotice("Stock quantity must be a whole number of zero or more.", true);
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      let productImages = [];

      if (existingProduct) {
        const keepIndexes = Array.from(
          form.querySelectorAll('[name="keep-image"]:checked')
        ).map(input => Number(input.value));

        productImages = getProductImages(existingProduct)
          .filter((image, index) => keepIndexes.includes(index));
      }

      if (selectedFiles.length) {
        const uploadedURLs = await uploadProductImages(selectedFiles, id);
        productImages = productImages.concat(uploadedURLs);
      }

      const productData = {
        id,
        name,
        category,
        price,
        description: description || null,
        status,
        is_new: isNew,
        stock_quantity: stockQuantity,
        images: productImages,
        updated_at: new Date().toISOString()
      };

      let result;

      if (existingProduct) {
        result = await supabaseClient
          .from("products")
          .update(productData)
          .eq("id", id);
      } else {
        result = await supabaseClient
          .from("products")
          .insert(productData);
      }

      if (result.error) throw result.error;

      closeProductForm();
      await loadProducts();

      showNotice(
        existingProduct
          ? "Product updated successfully."
          : "Product added successfully."
      );

    } catch (error) {
      console.error("Product save error:", error);
      showNotice(error.message || "Unable to save product.", true);

      saveButton.disabled = false;
      saveButton.textContent = existingProduct
        ? "Save Changes"
        : "Add Product";
    }
  }

  // -----------------------------------------
  // DELETE PRODUCT
  // -----------------------------------------

  async function deleteProduct(productId) {
    const product = currentProducts.find(
      item => String(item.id) === String(productId)
    );

    if (!product) return;

    const confirmed = window.confirm(
      `Delete "${product.name}" from your catalogue?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabaseClient
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) throw error;

      await loadProducts();
      showNotice("Product deleted successfully.");

    } catch (error) {
      console.error("Product deletion error:", error);
      showNotice(error.message || "Unable to delete product.", true);
    }
  }

  // -----------------------------------------
  // PRODUCT BUTTONS
  // -----------------------------------------

  document.getElementById("add-product-button")
    .addEventListener("click", () => openProductForm());

  document.getElementById("products-container")
    .addEventListener("click", event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const productId = button.dataset.id;

      if (button.dataset.action === "edit") {
        const product = currentProducts.find(
          item => String(item.id) === String(productId)
        );

        if (product) openProductForm(product);
      }

      if (button.dataset.action === "delete") {
        deleteProduct(productId);
      }

      if (button.dataset.action === "stock-plus") {
        adjustStock(productId, 1);
      }

      if (button.dataset.action === "stock-minus") {
        adjustStock(productId, -1);
      }
    });

  // -----------------------------------------
  // DASHBOARD NAVIGATION
  // -----------------------------------------

  function openSection(sectionName) {
    const sections = ["overview", "products", "reviews", "settings"];

    if (!sections.includes(sectionName)) return;

    document.querySelectorAll(".dashboard-section").forEach(section => {
      section.hidden = section.id !== `section-${sectionName}`;
    });

    document.querySelectorAll(".nav-link[data-section]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.section === sectionName
      );
    });

    const titles = {
      overview: "Overview",
      products: "Products",
      reviews: "Customer Reviews",
      settings: "Store Settings"
    };

    pageTitle.textContent = titles[sectionName];

    if (window.innerWidth <= 760) {
      sidebar.classList.remove("open");
    }
  }

  document.querySelectorAll("[data-section]").forEach(button => {
    button.addEventListener("click", () => {
      openSection(button.dataset.section);
    });
  });

  // -----------------------------------------
  // MOBILE SIDEBAR
  // -----------------------------------------

  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  // -----------------------------------------
  // SIGN OUT
  // -----------------------------------------

  logoutButton.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Are you sure you want to sign out?"
    );

    if (!confirmed) return;

    logoutButton.disabled = true;
    logoutButton.textContent = "Signing out...";

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error("Sign out error:", error);
      showNotice("Unable to sign out. Please try again.", true);

      logoutButton.disabled = false;
      logoutButton.textContent = "Sign Out";
      return;
    }

    window.location.replace("admin.html");
  });

  // -----------------------------------------
  // INITIALISE DASHBOARD
  // -----------------------------------------

  async function initialiseDashboard() {
    try {
      const user = await verifyAdminAccess();

      if (!user) return;

      adminEmailDisplay.textContent = user.email || "Administrator";
      showDashboard();

      try {
        await loadProducts();
      } catch (error) {
        showNotice(
          "Could not load products. Please check your database permissions.",
          true
        );
      }

      await loadReviews();

    } catch (error) {
      console.error("Dashboard initialisation error:", error);

      loadingScreen.innerHTML = `
        <p>Unable to verify administrator access.</p>
        <p>Please return to the login page and try again.</p>
        <a href="admin.html">Return to Admin Login</a>
      `;
    }
  }

  initialiseDashboard();
});
