/**
 * MODUL: DASHBOARD ENGINE
 * v2.0: getDashboardData() sekarang menyertakan data Budget vs Realisasi
 *       menggunakan Metode 50/30/20.
 */

/**
 * Mengambil ringkasan data keuangan untuk dashboard.
 * @param  {string} bulan - Format "YYYY-MM", contoh "2026-02"
 * @return {Object} Result JSON
 */
function getDashboardData(bulan) {
  try {
    // ── 1. BATCH READ: Transaksi ────────────────────────────────────────────
    const sheetTrx  = getSheet(APP_CONFIG.SHEETS.TRANSAKSI);
    const headerTrx = getHeaderMap(APP_CONFIG.SHEETS.TRANSAKSI);
    const dataTrx   = sheetTrx.getDataRange().getValues();
    dataTrx.shift();

    // ── 2. Load Master (Cached) ─────────────────────────────────────────────
    const katResult  = getMasterKategori();
    if (!katResult.success) throw new Error('Gagal load Master Kategori: ' + katResult.message);

    // v2.2 FIX: Jika Saldo_Akun kosong, hitung saldo dari Master_Akun + Transaksi
    const saldoResult = getMasterSaldoAkun();
    let saldoData = (saldoResult.success && saldoResult.data.length > 0)
      ? saldoResult.data
      : _computeSaldoFromTransaksi(); // fallback dinamis

    // ── 3. Load Budget bulan ini ────────────────────────────────────────────
    const budgetResult = getBudgetByMonth(bulan);
    const budgetData   = budgetResult.success ? budgetResult.data : [];

    // ── 4. Build lookup map ──────────────────────────────────────────────────
    const katMap = {};
    katResult.data.forEach(k => { katMap[k.id_kategori] = k; });

    // ── 5. Agregasi Budget per Pos ───────────────────────────────────────────
    let budgetKebutuhan = 0, budgetKeinginan = 0, budgetTabungan = 0;
    budgetData.forEach(b => {
      const pos = (b.pos || '').toUpperCase();
      const nom = parseFloat(b.budget) || 0;
      if (pos.includes('KEBUTUHAN'))                              budgetKebutuhan += nom;
      else if (pos.includes('KEINGINAN'))                         budgetKeinginan += nom;
      else if (pos.includes('TABUNGAN') || pos.includes('INVESTASI')) budgetTabungan  += nom;
    });

    // ── 6. In-Memory Single-Pass Aggregation (Transaksi) ───────────────────
    let totalPendapatan      = 0;
    let totalPengeluaran     = 0;
    let totalArisanIuran     = 0;
    let realisasiKebutuhan   = 0;
    let realisasiKeinginan   = 0;
    let realisasiTabungan    = 0;

    dataTrx.forEach(row => {
      const trx = mapRowToObject(row, headerTrx);

      const trxBulan = trx.bulan ? trx.bulan.toString().substring(0, 7) : '';
      if (trxBulan !== bulan)        return;
      if (trx.status_hapus === APP_CONFIG.STATUS.HAPUS) return;

      const nominal = parseFloat(trx.jumlah) || 0;

      // v2.2: Skip transaksi Transfer dari laporan pendapatan/pengeluaran
      const isTransfer = trx.id_kategori === APP_CONFIG.CATEGORY.TRANSFER_ID;

      if (trx.tipe === APP_CONFIG.TIPE.PENDAPATAN) {
        if (!isTransfer) totalPendapatan += nominal;

      } else if (trx.tipe === APP_CONFIG.TIPE.PENGELUARAN) {
        if (!isTransfer) totalPengeluaran += nominal;

        const katInfo = katMap[trx.id_kategori];
        if (!isTransfer && katInfo) {
          const pos = (katInfo.pos || '').toUpperCase();
          if (pos.includes('KEBUTUHAN'))                              realisasiKebutuhan += nominal;
          else if (pos.includes('KEINGINAN'))                         realisasiKeinginan += nominal;
          else if (pos.includes('TABUNGAN') || pos.includes('INVESTASI')) realisasiTabungan  += nominal;
        }

        if (!isTransfer && trx.id_kategori === APP_CONFIG.CATEGORY.ARISAN_OUT) {
          totalArisanIuran += nominal;
        }
      }
    });

    // ── 7. Kalkulasi 50/30/20 ───────────────────────────────────────────────
    const surplusDefisit  = totalPendapatan - totalPengeluaran;
    const targetKebutuhan = totalPendapatan * (APP_CONFIG.BUDGET_TARGET.KEBUTUHAN / 100);
    const targetKeinginan = totalPendapatan * (APP_CONFIG.BUDGET_TARGET.KEINGINAN / 100);
    const targetTabungan  = totalPendapatan * (APP_CONFIG.BUDGET_TARGET.TABUNGAN  / 100);

    const persen = (part, total) =>
      total > 0 ? parseFloat(((part / total) * 100).toFixed(1)) : 0;

    // ── 8. Format Saldo Akun ─────────────────────────────────────────────────
    const ringkasanSaldo = saldoData.map(akun => ({
      id_akun     : akun.id_akun,
      nama_akun   : akun.nama_akun,
      tipe_akun   : akun.tipe_akun,
      saldo_awal  : parseFloat(akun.saldo_awal)   || 0,
      total_masuk : parseFloat(akun.total_masuk)  || 0,
      total_keluar: parseFloat(akun.total_keluar) || 0,
      saldo_akhir : parseFloat(akun.saldo_akhir)  || 0
    }));

    const totalSaldo = ringkasanSaldo.reduce((sum, a) => sum + a.saldo_akhir, 0);

    return {
      success: true,
      data: {
        bulan        : bulan,
        bulan_display: bulanToDisplay(bulan),
        statistik: {
          total_pendapatan : totalPendapatan,
          total_pengeluaran: totalPengeluaran,
          surplus_defisit  : surplusDefisit,
          total_arisan     : totalArisanIuran,
          total_saldo      : totalSaldo
        },
        // Data lama (rasio distribusi pengeluaran) — DIGANTI oleh budget5020 di UI
        rasio: {
          kebutuhan_persen : persen(realisasiKebutuhan, totalPengeluaran),
          keinginan_persen : persen(realisasiKeinginan, totalPengeluaran),
          tabungan_persen  : persen(realisasiTabungan,  totalPengeluaran),
          kebutuhan_nominal: realisasiKebutuhan,
          keinginan_nominal: realisasiKeinginan,
          tabungan_nominal : realisasiTabungan
        },
        // NEW: Data 50/30/20 Budget vs Realisasi
        budget5020: {
          kebutuhan: {
            target_pct : APP_CONFIG.BUDGET_TARGET.KEBUTUHAN,
            target_nom : targetKebutuhan,
            budget     : budgetKebutuhan,
            realisasi  : realisasiKebutuhan,
            aktual_pct : persen(realisasiKebutuhan, totalPendapatan)
          },
          keinginan: {
            target_pct : APP_CONFIG.BUDGET_TARGET.KEINGINAN,
            target_nom : targetKeinginan,
            budget     : budgetKeinginan,
            realisasi  : realisasiKeinginan,
            aktual_pct : persen(realisasiKeinginan, totalPendapatan)
          },
          tabungan: {
            target_pct : APP_CONFIG.BUDGET_TARGET.TABUNGAN,
            target_nom : targetTabungan,
            budget     : budgetTabungan,
            realisasi  : realisasiTabungan,
            aktual_pct : persen(realisasiTabungan, totalPendapatan)
          }
        },
        akun: ringkasanSaldo
      }
    };

  } catch (e) {
    console.error('getDashboardData error:', e.message, e.stack);
    return { success: false, message: e.message };
  }
}

/**
 * Mendapatkan daftar bulan yang tersedia di data transaksi.
 */
function getAvailableMonths() {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.TRANSAKSI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.TRANSAKSI);
    const data      = sheet.getDataRange().getValues();
    data.shift();

    const bulanSet = new Set();
    bulanSet.add(getCurrentBulanISO());

    data.forEach(row => {
      const trx = mapRowToObject(row, headerMap);
      if (trx.status_hapus === APP_CONFIG.STATUS.HAPUS) return;
      if (!trx.bulan) return;

      const b = trx.bulan.toString().trim().substring(0, 7);
      if (/^\d{4}-\d{2}$/.test(b)) bulanSet.add(b);
    });

    const sorted = Array.from(bulanSet).sort().reverse();

    return {
      success: true,
      data   : sorted.map(iso => ({ iso, display: bulanToDisplay(iso) }))
    };

  } catch (e) {
    console.error('getAvailableMonths error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  SANKEY DIAGRAM DATA  (v2.2 NEW)
// ══════════════════════════════════════════════════════════════

/**
 * Menyiapkan data aliran dana 3-level untuk Google Charts Sankey Diagram.
 *
 * Flow: [Kategori Pendapatan] → [Nama Akun] → [Kategori Pengeluaran]
 *
 *   Level 1 (Hulu)  : Sumber pendapatan (Gaji Pokok, Gaji Tambahan, dst)
 *   Level 2 (Tengah): Akun penerima (BCA-Ayah, GoPay, dst)
 *   Level 3 (Hilir) : Pos pengeluaran (Makanan, Transportasi, dst)
 *
 * Catatan:
 *   - Transaksi dengan id_kategori = "_TRANSFER_" DIKECUALIKAN dari Sankey
 *     agar tidak terjadi loop (uang masuk dari transfer dihitung ulang)
 *   - Pendapatan dialirkan ke akun secara proporsional berdasarkan rasio
 *     dari total pendapatan bulan itu
 *   - Pengeluaran dialirkan dari akun berdasarkan id_akun transaksi
 *
 * @param  {string} bulan - Format "YYYY-MM"
 * @return {Object} { success, data: [[from, to, weight], ...], meta: {...} }
 */
function getSankeyData(bulan) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.TRANSAKSI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.TRANSAKSI);
    const rawData   = sheet.getDataRange().getValues();
    rawData.shift();

    // Load master untuk nama tampilan
    const katResult  = getMasterKategori();
    const akunResult = getMasterAkun();
    if (!katResult.success)  throw new Error('Gagal load Master Kategori.');
    if (!akunResult.success) throw new Error('Gagal load Master Akun.');

    const katMap  = {};
    const akunMap = {};
    katResult.data.forEach(k  => { katMap[k.id_kategori] = k.nama_kategori || k.id_kategori; });
    akunResult.data.forEach(a => { akunMap[a.id_akun]    = a.nama_akun    || a.id_akun;    });

    const TRANSFER_ID = APP_CONFIG.CATEGORY.TRANSFER_ID;

    // Agregasi: pendapatan per kategori per akun, pengeluaran per akun per kategori
    const pendAkun    = {};   // { "Gaji Pokok|BCA-Ayah": 10000000, ... }
    const akunKeluar  = {};   // { "BCA-Ayah|Makanan": 1500000, ... }

    rawData.forEach(row => {
      const trx = mapRowToObject(row, headerMap);
      const trxBulan = trx.bulan ? trx.bulan.toString().substring(0, 7) : '';

      if (trxBulan !== bulan)        return;
      if (trx.status_hapus === APP_CONFIG.STATUS.HAPUS) return;
      if (trx.id_kategori  === TRANSFER_ID)             return; // Skip transfer

      const jumlah    = parseFloat(trx.jumlah) || 0;
      const namaAkun  = akunMap[trx.id_akun]      || trx.id_akun    || 'Akun Lain';
      const namaKat   = katMap[trx.id_kategori]    || trx.id_kategori || 'Lainnya';

      if (trx.tipe === APP_CONFIG.TIPE.PENDAPATAN) {
        // Level 1 → Level 2: Sumber Pendapatan → Akun
        const key = namaKat + '|' + namaAkun;
        pendAkun[key] = (pendAkun[key] || 0) + jumlah;

      } else if (trx.tipe === APP_CONFIG.TIPE.PENGELUARAN) {
        // Level 2 → Level 3: Akun → Kategori Pengeluaran
        const key = namaAkun + '|' + namaKat;
        akunKeluar[key] = (akunKeluar[key] || 0) + jumlah;
      }
    });

    // Bangun array rows untuk Google Charts DataTable
    const rows = [];

    Object.entries(pendAkun).forEach(([key, weight]) => {
      if (weight <= 0) return;
      const [from, to] = key.split('|');
      rows.push([from, to, weight]);
    });

    Object.entries(akunKeluar).forEach(([key, weight]) => {
      if (weight <= 0) return;
      const [from, to] = key.split('|');
      rows.push([from, to, weight]);
    });

    // Kalkulasi meta untuk info tooltip
    const totalPendapatan  = rows.filter(r => Object.keys(pendAkun).includes(r[0] + '|' + r[1]))
                                 .reduce((s, r) => s + r[2], 0);
    const totalPengeluaran = rows.filter(r => Object.keys(akunKeluar).includes(r[0] + '|' + r[1]))
                                 .reduce((s, r) => s + r[2], 0);

    return {
      success: true,
      data   : rows,
      meta   : {
        total_pendapatan : totalPendapatan,
        total_pengeluaran: totalPengeluaran,
        bulan_display    : bulanToDisplay(bulan),
        node_count       : new Set(rows.flatMap(r => [r[0], r[1]])).size,
        link_count       : rows.length
      }
    };

  } catch (e) {
    console.error('getSankeyData error:', e.message, e.stack);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  PRIVATE HELPER: Hitung Saldo Dinamis  (v2.2 FIX)
// ══════════════════════════════════════════════════════════════

/**
 * Menghitung saldo setiap akun langsung dari sheet Master_Akun + Transaksi.
 * Digunakan sebagai fallback ketika sheet Saldo_Akun masih kosong.
 *
 * Logika:
 *   saldo_akhir = saldo_awal
 *               + Σ transaksi PENDAPATAN akun ini  (exclude TRANSFER)
 *               - Σ transaksi PENGELUARAN akun ini (exclude TRANSFER)
 *               + Σ transfer MASUK  ke akun ini
 *               - Σ transfer KELUAR dari akun ini
 *
 * @return {Array} Array objek saldo (sama format dengan getMasterSaldoAkun)
 */
function _computeSaldoFromTransaksi() {
  try {
    const akunResult = getMasterAkun();
    if (!akunResult.success || !akunResult.data.length) return [];

    // Baca semua transaksi
    const sheetTrx  = getSheet(APP_CONFIG.SHEETS.TRANSAKSI);
    const headerTrx = getHeaderMap(APP_CONFIG.SHEETS.TRANSAKSI);
    const rawTrx    = sheetTrx.getDataRange().getValues();
    rawTrx.shift();

    const TRANSFER_ID = APP_CONFIG.CATEGORY.TRANSFER_ID;

    // Akumulasi per akun: { id_akun: { masuk, keluar } }
    const acc = {};
    akunResult.data.forEach(a => {
      acc[a.id_akun] = { masuk: 0, keluar: 0 };
    });

    rawTrx.forEach(row => {
      const trx = mapRowToObject(row, headerTrx);
      if (trx.status_hapus === APP_CONFIG.STATUS.HAPUS) return;
      if (!trx.id_akun) return;

      const nominal    = parseFloat(trx.jumlah) || 0;
      const isTransfer = trx.id_kategori === TRANSFER_ID;

      if (!acc[trx.id_akun]) return; // akun tidak dikenal, skip

      if (trx.tipe === APP_CONFIG.TIPE.PENDAPATAN) {
        // Masuk normal + transfer masuk ke akun ini
        acc[trx.id_akun].masuk += nominal;

      } else if (trx.tipe === APP_CONFIG.TIPE.PENGELUARAN) {
        // Keluar normal + transfer keluar dari akun ini
        acc[trx.id_akun].keluar += nominal;
      }
    });

    const now = new Date().toISOString();
    return akunResult.data.map(a => {
      const saldoAwal  = parseFloat(a.saldo_awal) || 0;
      const masuk      = acc[a.id_akun] ? acc[a.id_akun].masuk  : 0;
      const keluar     = acc[a.id_akun] ? acc[a.id_akun].keluar : 0;
      return {
        id_akun         : a.id_akun,
        nama_akun       : a.nama_akun,
        tipe_akun       : a.tipe_akun,
        saldo_awal      : saldoAwal,
        total_masuk     : masuk,
        total_keluar    : keluar,
        saldo_akhir     : saldoAwal + masuk - keluar,
        terakhir_update : now
      };
    });

  } catch (e) {
    console.error('_computeSaldoFromTransaksi error:', e.message);
    return [];
  }
}
