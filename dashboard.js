
/* =========================================
   EROTICASECRETS DASHBOARD
   Authentication, Navigation & Overview
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

    window.setTimeout(() => {
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

  // -----------------------------------------
  // ADMIN SECURITY CHECK
  // -----------------------------------------

  async function verifyAdminAccess() {

    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const session = sessionData.session;

    if (!session) {
      window.location.replace("admin.html");
      return null;
    }

    const { data: isAdmin, error: adminError } =
      await supabaseClient.rpc("is_active_admin");

    if (adminError) {
      throw adminError;
    }

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
      .select("*");

    if (error) {
      console.error("Products loading error:", error);
      throw error;
    }

    currentProducts = data || [];

    updateProductStatistics();
    renderProductOverview();

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

      // Do not prevent the rest of the dashboard from loading.
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
      review => review.approved === false
    ).length;

    document.getElementById("stat-reviews").textContent = pending;
  }

  // -----------------------------------------
  // PRODUCT OVERVIEW
  // -----------------------------------------

  function renderProductOverview() {

    const container = document.getElementById("products-container");

    if (!currentProducts.length) {
      container.innerHTML = `
        <div class="dashboard-panel">
          <p>No products were found in your database.</p>
        </div>
      `;
      return;
    }

    const rows = currentProducts.map(product => {

      const status = product.status === "available"
        ? "Available"
        : "Sold Out";

      const statusClass = product.status === "available"
        ? "available"
        : "soldout";

      return `
        <tr>
          <td>
            <strong>${escapeHTML(product.name)}</strong>
            <small>${escapeHTML(product.id)}</small>
          </td>
          <td>${escapeHTML(product.category)}</td>
          <td>${escapeHTML(formatMoney(product.price))}</td>
          <td>
            <span class="product-status ${statusClass}">
              ${status}
            </span>
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
                <th>Status</th>
              </tr>
            </thead>

            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // -----------------------------------------
  // DASHBOARD NAVIGATION
  // -----------------------------------------

  function openSection(sectionName) {

    const sections = [
      "overview",
      "products",
      "reviews",
      "settings"
    ];

    if (!sections.includes(sectionName)) {
      return;
    }

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

    if (!confirmed) {
      return;
    }

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

      if (!user) {
        return;
      }

      adminEmailDisplay.textContent = user.email || "Administrator";

      showDashboard();

      // Load products and reviews independently.
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
