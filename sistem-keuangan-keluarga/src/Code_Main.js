/**
 * UI & MENU HANDLER
 *
 * FIX: onOpen tidak lagi duplikat.
 * FIX: showMainApp() menggunakan createTemplateFromFile agar <?!= ?> bekerja.
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu(`💰 ${APP_CONFIG.APP_NAME}`)
    .addItem('🏠 Buka Aplikasi', 'showMainApp')
    .addSeparator()
    .addSubMenu(
      ui.createMenu('🛠️ Administrasi')
        .addItem('⚙️ Setup Schema (Jalankan Pertama Kali)', 'setupSchema')
        .addItem('🧹 Bersihkan Cache Manual', 'clearAllAppCache')
        .addItem('⏰ Pasang Auto-Trigger Harian', 'setupDailyTriggers')
    )
    .addSeparator()
    .addItem('🔄 Reset Status Arisan Bulanan', 'triggerResetArisanMonthly')
    .addToUi();
}

/**
 * Membuka aplikasi utama sebagai dialog modal.
 * Menggunakan createTemplateFromFile agar tag <?!= ?> dan <?= ?> berfungsi.
 */
function showMainApp() {
  const template  = HtmlService.createTemplateFromFile('ui_Index');
  template.APP_NAME = APP_CONFIG.APP_NAME;

  const html = template.evaluate()
    .setWidth(1020)
    .setHeight(740)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  SpreadsheetApp.getUi().showModalDialog(html, `💰 ${APP_CONFIG.APP_NAME}`);
}

/**
 * Wrapper menu untuk reset arisan dengan dialog konfirmasi.
 */
function triggerResetArisanMonthly() {
  const ui       = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Konfirmasi Reset Arisan',
    'Apakah Anda yakin ingin mereset status bayar arisan semua kelompok ke "BELUM" untuk bulan ini?\n\nAksi ini tidak dapat dibatalkan.',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    const result = resetArisanMonthly();
    if (result.success) {
      ui.alert('✅ Berhasil', result.message, ui.ButtonSet.OK);
    } else {
      ui.alert('❌ Gagal', result.message, ui.ButtonSet.OK);
    }
  }
}
