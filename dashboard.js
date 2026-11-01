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
      .select("*");

    if (error) {
      console.error("Reviews loading error:", error);
      currentReviews = [];
      document.getElementById("stat-reviews").textContent = "—";
      return;
    }

    currentReviews = data || [];
    updateReviewStatistics();
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
