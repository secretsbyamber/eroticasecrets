
/* =====================================
   EROTICASECRETS ADMIN AUTHENTICATION
===================================== */

"use strict";

document.addEventListener("DOMContentLoaded", () => {

  const loginForm = document.getElementById("login-form");
  const emailInput = document.getElementById("admin-email");
  const passwordInput = document.getElementById("admin-password");
  const loginButton = document.getElementById("login-button");
  const loginMessage = document.getElementById("login-message");

  const DASHBOARD_URL = "dashboard.html";

  function showMessage(message, type = "error") {
    loginMessage.textContent = message;
    loginMessage.className = "login-message";

    if (type === "success") {
      loginMessage.classList.add("success");
    }
  }

  function setLoading(loading) {
    loginButton.disabled = loading;
    loginButton.textContent = loading ? "Signing in..." : "Sign In";
  }

  // Check whether the current account is an active administrator.
  async function verifyAdmin() {
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const session = sessionData.session;

    if (!session) {
      return false;
    }

    const { data, error } = await supabaseClient.rpc(
      "is_active_admin"
    );

    if (error) {
      throw error;
    }

    return data === true;
  }

  // Check an existing login when the page loads.
  async function checkExistingSession() {
    try {
      const isAdmin = await verifyAdmin();

      if (isAdmin) {
        window.location.replace(DASHBOARD_URL);
      } else {
        const { data } = await supabaseClient.auth.getSession();

        if (data.session) {
          await supabaseClient.auth.signOut();
          showMessage("This account is not authorised to access the admin dashboard.");
        }
      }
    } catch (error) {
      console.error("Session verification failed:", error);
      showMessage("Unable to verify your account. Please try again.");
    }
  }

  // Handle login form submission.
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);
    showMessage("");

    try {
      // Authenticate with Supabase.
      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error("Login session could not be created.");
      }

      // Confirm that this account is an active administrator.
      const isAdmin = await verifyAdmin();

      if (!isAdmin) {
        await supabaseClient.auth.signOut();

        showMessage(
          "Access denied. This account is not registered as an active administrator."
        );

        setLoading(false);
        return;
      }

      showMessage("Login successful. Opening your dashboard...", "success");

      window.location.replace(DASHBOARD_URL);

    } catch (error) {
      console.error("Admin login error:", error);

      showMessage(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : "Login failed. Please check your connection and try again."
      );

      setLoading(false);
    }
  });

  // Start by checking for an existing authenticated session.
  checkExistingSession();

});
