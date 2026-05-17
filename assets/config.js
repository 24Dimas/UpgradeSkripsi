/* ============================================================
   Si-Reino — Central Configuration
   Ubah API URL di SATU tempat ini saat redeploy Apps Script.
   ============================================================ */
(function () {
  'use strict';

  window.SIREINO_CONFIG = {
    // Google Apps Script endpoint (deploy → web app)
    API_URL: "https://script.google.com/macros/s/AKfycbwyZ5WJGmg1qkPgjuiHGJrGzAIFNQWumpw92FBoun7S60oTYriJQ_6yxgcDFBBOqYdQ/exec",

    // Session timeout admin (ms) — 30 menit
    ADMIN_IDLE_TIMEOUT_MS: 30 * 60 * 1000,

    // Maks ukuran file upload (MB)
    MAX_FILE_SIZE_MB: 20,

    // Lockout login admin
    LOGIN_MAX_ATTEMPTS: 3,
    LOGIN_LOCKOUT_SEC: 30,

    // Versi (untuk debug)
    VERSION: "8.0"
  };
})();
