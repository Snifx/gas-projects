/**
 * WEB APP ENTRY POINT (Opsional)
 *
 * File ini digunakan jika Anda men-deploy script sebagai Web App
 * (Deploy → New Deployment → Web App).
 * Jika hanya digunakan sebagai Bound Script (menu di Spreadsheet),
 * file ini tidak perlu dijalankan, tapi tidak mengganggu jika ada.
 */

function doGet() {
  const template    = HtmlService.createTemplateFromFile('ui_Index');
  template.APP_NAME = APP_CONFIG.APP_NAME;

  return template.evaluate()
    .setTitle(APP_CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Fungsi include untuk memuat file CSS/JS terpisah ke dalam template HTML.
 * Dipanggil dari ui_Index.html dengan syntax: <?!= include('ui_CSS'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
