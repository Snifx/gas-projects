/**
 * MODUL: DASHBOARD ENGINE
 * v1.2.1 FIX:
 *   - _buildHPData(): return { list, reminders } — sesuai ekspektasi renderDashboardHP() di ui_JS
 *   - _buildHPData(): hapus pemanggilan getHPReminders() yg tidak ada (fungsinya: _getHPReminders, private)
 *   - _buildHPData(): hapus penggunaan h.sisa_tagihan yg tidak ada di schema
 *
 * v1.2 CHANGES:
 *   - getDashboardData(): tambah blok hutang_piutang
 *   - getDashboardData(): total_piutang_diterima sebagai stat terpisah
 *   - Semua agregasi budget sekarang exclude _BAYAR_HUTANG_, _PIUTANG_OUT_, _PIUTANG_IN_
 *   - getSankeyData(): exclude kategori HP dari diagram
 *   - _buildHPData(): helper baru untuk blok hutang_piutang
 *
 * v1.1 CHANGES:
 *   - getDashboardData(): tambah block utang_kredit (CC/Cicilan)
 *
 * STRUKTUR RETURN getDashboardData() v1.2:
 *   data.statistik          — total_pendapatan, total_pengeluaran, surplus,
 *                             saldo, total_piutang_diterima (NEW)
 *   data.budget5020         — kebutuhan, keinginan, tabungan
 *   data.akun               — saldo per akun
 *   data.utang_kredit       — DSR, future liability, bill reminders
 *   data.hutang_piutang ← NEW v1.2
 *     .list                 — semua record HP (ui_JS hitung total dari list)
 *     .reminders            — jatuh tempo dalam 7 hari
 */

function getDashboardData(bulan) {
  try {
    // ── 1. BATCH READ: Transaksi ────────────────────────────────────────────
    const sheetTrx  = getSheet(APP_CONFIG.SHEETS.TRANSAKSI);
    const headerTrx = getHeaderMap(APP_CONFIG.SHEETS.TRANSAKSI);
    const dataTrx   = sheetTrx.getDataRange().getValues();
    dataTrx.shift();

    // ── 2. Load Master ──────────────────────────────────────────────────────
    const katResult = getMasterKategori();
    if (!katResult.success) throw new Error('Gagal load Master Kategori: ' + katResult.message);

    const saldoResult = getMasterSaldoAkun();
    let saldoData = (saldoResult.success && saldoResult.data.length > 0)
      ? saldoResult.data
      : _computeSaldoFromTransaksi();

    // ── 3. Load Budget bulan ini ────────────────────────────────────────────
    const budgetResult = getBudgetByMonth(bulan);
    const budgetData   = budgetResult.success ? budgetResult.data : [];

    // ── 4. Build lookup maps ────────────────────────────────────────────────
    const katMap = {};
    katResult.data.forEach(k => { katMap[k.id_kategori] = k; });

    // ── 5. Agregasi Budget per Pos ──────────────────────────────────────────
    let budgetKebutuhan = 0, budgetKeinginan = 0, budgetTabungan = 0;
    budgetData.forEach(b => {
      const pos = (b.pos || '').toUpperCase();
      const nom = parseFloat(b.budget) || 0;
      if (pos.includes('KEBUTUHAN'))                                  budgetKebutuhan += nom;
      else if (pos.includes('KEINGINAN'))                             budgetKeinginan += nom;
      else if (pos.includes('TABUNGAN') || pos.includes('INVESTASI')) budgetTabungan  += nom;
    });

    // ── 6. Kategori yang dikecualikan dari budget 50/30/20 ──────────────────
    const EXCLUDE_CATS = new Set(APP_CONFIG.EXCLUDE_FROM_BUDGET || [
      APP_CONFIG.CATEGORY.TRANSFER_ID,
      APP_CONFIG.CATEGORY.BAYAR_TAGIHAN_ID,
      APP_CONFIG.CATEGORY.PIUTANG_OUT,
      APP_CONFIG.CATEGORY.PIUTANG_IN,
      APP_CONFIG.CATEGORY.BAYAR_HUTANG,
      APP_CONFIG.CATEGORY.NO_AKUN
    ]);

    // ── 7. Single-Pass Aggregation Transaksi ───────────────────────────────
    let totalPendapatan      = 0;
    let totalPengeluaran     = 0;
    let totalArisanIuran     = 0;
    let totalPiutangDiterima = 0;  // v1.2: pendapatan kembali piutang (terpisah)
    let realisasiKebutuhan   = 0;
    let realisasiKeinginan   = 0;
    let realisasiTabungan    = 0;

    dataTrx.forEach(row => {
      const trx      = mapRowToObject(row, headerTrx);
      const trxBulan = trx.bulan ? trx.bulan.toString().substring(0, 7) : '';
      if (trxBulan !== bulan)                            return;
      if (trx.status_hapus === APP_CONFIG.STATUS.HAPUS)  return;

      const nominal   = parseFloat(trx.jumlah) || 0;
      const isExclude = EXCLUDE_CATS.has(trx.id_kategori);

      if (trx.tipe === APP_CONFIG.TIPE.PENDAPATAN) {
        // _PIUTANG_IN_ masuk statistik terpisah, bukan totalPendapatan utama
        if (trx.id_kategori === APP_CONFIG.CATEGORY.PIUTANG_IN) {
          totalPiutangDiterima += nominal;
        } else if (!isExclude) {
          totalPendapatan += nominal;
        }

      } else if (trx.tipe === APP_CONFIG.TIPE.PENGELUARAN) {
        // Hanya hitung pengeluaran yang bukan kategori excluded
        if (!isExclude) {
          totalPengeluaran += nominal;

          const katInfo = katMap[trx.id_kategori];
          if (katInfo) {
            const pos = (katInfo.pos || '').toUpperCase();
            if (pos.includes('KEBUTUHAN'))                                  realisasiKebutuhan += nominal;
            else if (pos.includes('KEINGINAN'))                             realisasiKeinginan += nominal;
            else if (pos.includes('TABUNGAN') || pos.includes('INVESTASI')) realisasiTabungan  += nominal;
          }

          if (trx.id_kategori === APP_CONFIG.CATEGORY.ARISAN_OUT) {
            totalArisanIuran += nominal;
          }
        }
        // _NO_AKUN_ hutang: id_kategori = kategori asli user → sudah terhitung di atas ✓
      }
    });

    // ── 8. Kalkulasi 50/30/20 ───────────────────────────────────────────────
    const surplusDefisit  = totalPendapatan - totalPengeluaran;
    const targetKebutuhan = totalPendapatan * (APP_CONFIG.BUDGET_TARGET.KEBUTUHAN / 100);
    const targetKeinginan = totalPendapatan * (APP_CONFIG.BUDGET_TARGET.KEINGINAN / 100);
    const targetTabungan  = totalPendapatan * (APP_CONFIG.BUDGET_TARGET.TABUNGAN  / 100);

    const persen = (part, total) =>
      total > 0 ? parseFloat(((part / total) * 100).toFixed(1)) : 0;

    // ── 9. Format Saldo Akun ─────────────────────────────────────────────────
    const ringkasanSaldo = saldoData.map(akun => {
      const saldoAkhir = parseFloat(akun.saldo_akhir) || 0;
      const isUtang    = _isAkunUtang(akun.tipe_akun);
      return {
        id_akun        : akun.id_akun,
        nama_akun      : akun.nama_akun,
        tipe_akun      : akun.tipe_akun,
        saldo_awal     : parseFloat(akun.saldo_awal)  || 0,
        total_masuk    : parseFloat(akun.total_masuk) || 0,
        total_keluar   : parseFloat(akun.total_keluar)|| 0,
        saldo_akhir    : saldoAkhir,
        is_utang       : isUtang,
        limit_kredit   : parseFloat(akun.limit_kredit)|| 0,
        sisa_limit     : akun.sisa_limit  !== undefined ? akun.sisa_limit : null,
        tgl_jatuh_tempo: akun.tgl_jatuh_tempo || 0
      };
    });

    const totalSaldo = ringkasanSaldo.filter(a => !a.is_utang).reduce((s, a) => s + a.saldo_akhir, 0);
    const totalUtang = ringkasanSaldo.filter(a => a.is_utang) .reduce((s, a) => s + Math.abs(Math.min(a.saldo_akhir, 0)), 0);

    // ── 10. v1.1: Data Utang Kredit (CC/Cicilan) ────────────────────────────
    const utangKreditData = _buildUtangKreditData(totalPendapatan, totalUtang);

    // ── 11. v1.2: Data Hutang & Piutang Personal ────────────────────────────
    const hutangPiutangData = _buildHPData();

    return {
      success: true,
      data: {
        bulan        : bulan,
        bulan_display: bulanToDisplay(bulan),
        statistik: {
          total_pendapatan      : totalPendapatan,
          total_pengeluaran     : totalPengeluaran,
          surplus_defisit       : surplusDefisit,
          total_arisan          : totalArisanIuran,
          total_saldo           : totalSaldo,
          total_utang           : totalUtang,
          total_piutang_diterima: totalPiutangDiterima  // v1.2
        },
        rasio: {
          kebutuhan_persen : persen(realisasiKebutuhan, totalPengeluaran),
          keinginan_persen : persen(realisasiKeinginan, totalPengeluaran),
          tabungan_persen  : persen(realisasiTabungan,  totalPengeluaran),
          kebutuhan_nominal: realisasiKebutuhan,
          keinginan_nominal: realisasiKeinginan,
          tabungan_nominal : realisasiTabungan
        },
        budget5020: {
          kebutuhan: {
            target_pct: APP_CONFIG.BUDGET_TARGET.KEBUTUHAN,
            target_nom: targetKebutuhan,
            budget    : budgetKebutuhan,
            realisasi : realisasiKebutuhan,
            aktual_pct: persen(realisasiKebutuhan, totalPendapatan)
          },
          keinginan: {
            target_pct: APP_CONFIG.BUDGET_TARGET.KEINGINAN,
            target_nom: targetKeinginan,
            budget    : budgetKeinginan,
            realisasi : realisasiKeinginan,
            aktual_pct: persen(realisasiKeinginan, totalPendapatan)
          },
          tabungan: {
            target_pct: APP_CONFIG.BUDGET_TARGET.TABUNGAN,
            target_nom: targetTabungan,
            budget    : budgetTabungan,
            realisasi : realisasiTabungan,
            aktual_pct: persen(realisasiTabungan, totalPendapatan)
          }
        },
        akun           : ringkasanSaldo,
        utang_kredit   : utangKreditData,    // v1.1
        hutang_piutang : hutangPiutangData   // v1.2
      }
    };

  } catch (e) {
    console.error('getDashboardData error:', e.message, e.stack);
    return { success: false, message: e.message };
  }
}

/**
 * Membangun blok data utang_kredit (CC/Cicilan) untuk dashboard.
 * @private
 */
function _buildUtangKreditData(totalPendapatan, totalUtangCC) {
  try {
    const totalCicilanPerBulan = getTotalCicilanPerBulan();
    const dsrPersen = totalPendapatan > 0
      ? parseFloat(((totalCicilanPerBulan / totalPendapatan) * 100).toFixed(1))
      : 0;
    const dsrStatus = dsrPersen >= APP_CONFIG.DSR_THRESHOLD.DANGER  ? 'DANGER'  :
                      dsrPersen >= APP_CONFIG.DSR_THRESHOLD.WARNING ? 'WARNING' : 'AMAN';

    const futureLiabilityResult = getFutureLiability(6);
    const futureLiability = futureLiabilityResult.success ? futureLiabilityResult.data : [];

    const remindersResult = getBillReminders(7);
    const billReminders   = remindersResult.success ? remindersResult.data : [];

    return {
      total_utang_berjalan : totalUtangCC,
      dsr: {
        persen            : dsrPersen,
        status            : dsrStatus,
        cicilan_per_bulan : totalCicilanPerBulan,
        threshold_warning : APP_CONFIG.DSR_THRESHOLD.WARNING,
        threshold_danger  : APP_CONFIG.DSR_THRESHOLD.DANGER
      },
      future_liability: futureLiability,
      bill_reminders  : billReminders
    };

  } catch (e) {
    console.error('_buildUtangKreditData error:', e.message);
    return {
      total_utang_berjalan: 0,
      dsr             : { persen: 0, status: 'AMAN', cicilan_per_bulan: 0, threshold_warning: 25, threshold_danger: 30 },
      future_liability: [],
      bill_reminders  : []
    };
  }
}

/**
 * Membangun blok data hutang_piutang untuk dashboard.
 * Non-critical — mengembalikan struktur kosong jika error.
 *
 * FIX v1.2.1:
 *   - Return { list, reminders } agar cocok dengan renderDashboardHP() di ui_JS
 *   - getHutangPiutangList() sudah menghitung reminders secara internal via _getHPReminders()
 *   - Hapus pemanggilan getHPReminders() yang tidak ada (fungsi itu private: _getHPReminders)
 * @private
 */
function _buildHPData() {
  try {
    const result = getHutangPiutangList();
    if (!result.success) throw new Error(result.message);

    // ui_JS renderDashboardHP() menghitung total dari list secara langsung di frontend
    return {
      list     : result.data      || [],
      reminders: result.reminders || []
    };

  } catch (e) {
    console.error('_buildHPData error:', e.message);
    // Non-critical — kembalikan struktur kosong agar dashboard tetap render
    return { list: [], reminders: [] };
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
//  SANKEY DIAGRAM DATA
// ══════════════════════════════════════════════════════════════

function getSankeyData(bulan) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.TRANSAKSI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.TRANSAKSI);
    const rawData   = sheet.getDataRange().getValues();
    rawData.shift();

    const katResult  = getMasterKategori();
    const akunResult = getMasterAkun();
    if (!katResult.success)  throw new Error('Gagal load Master Kategori.');
    if (!akunResult.success) throw new Error('Gagal load Master Akun.');

    const katMap  = {};
    const akunMap = {};
    katResult.data.forEach(k  => { katMap[k.id_kategori] = k.nama_kategori || k.id_kategori; });
    akunResult.data.forEach(a => { akunMap[a.id_akun]    = a.nama_akun    || a.id_akun;    });

    // v1.2: Exclude semua kategori HP dari sankey (hanya tampilkan cashflow nyata)
    const EXCLUDE_CATS = new Set(APP_CONFIG.EXCLUDE_FROM_BUDGET || [
      APP_CONFIG.CATEGORY.TRANSFER_ID,
      APP_CONFIG.CATEGORY.BAYAR_TAGIHAN_ID,
      APP_CONFIG.CATEGORY.PIUTANG_OUT,
      APP_CONFIG.CATEGORY.PIUTANG_IN,
      APP_CONFIG.CATEGORY.BAYAR_HUTANG
    ]);

    const pendAkun   = {};
    const akunKeluar = {};

    rawData.forEach(row => {
      const trx = mapRowToObject(row, headerMap);
      const trxBulan = trx.bulan ? trx.bulan.toString().substring(0, 7) : '';
      if (trxBulan !== bulan)                            return;
      if (trx.status_hapus === APP_CONFIG.STATUS.HAPUS)  return;
      if (EXCLUDE_CATS.has(trx.id_kategori))             return;  // v1.2: exclude HP categories

      const jumlah   = parseFloat(trx.jumlah) || 0;
      // Untuk transaksi dengan _NO_AKUN_, tampilkan sebagai "Pinjaman"
      const namaAkun = trx.id_akun === APP_CONFIG.CATEGORY.NO_AKUN
        ? 'Pinjaman (Hutang)'
        : (akunMap[trx.id_akun] || trx.id_akun || 'Akun Lain');
      const namaKat  = katMap[trx.id_kategori] || trx.id_kategori || 'Lainnya';

      if (trx.tipe === APP_CONFIG.TIPE.PENDAPATAN) {
        const key = namaKat + '|' + namaAkun;
        pendAkun[key] = (pendAkun[key] || 0) + jumlah;
      } else if (trx.tipe === APP_CONFIG.TIPE.PENGELUARAN) {
        const key = namaAkun + '|' + namaKat;
        akunKeluar[key] = (akunKeluar[key] || 0) + jumlah;
      }
    });

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

    const totalPendapatan  = rows.filter(r => Object.keys(pendAkun).includes(r[0]+'|'+r[1])).reduce((s,r)=>s+r[2],0);
    const totalPengeluaran = rows.filter(r => Object.keys(akunKeluar).includes(r[0]+'|'+r[1])).reduce((s,r)=>s+r[2],0);

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
//  PRIVATE HELPER: Hitung Saldo Dinamis
// ══════════════════════════════════════════════════════════════

/**
 * Fallback: hitung saldo per akun dari Master_Akun + Transaksi.
 * v1.2: Transaksi dengan id_akun = _NO_AKUN_ diabaikan (tidak mempengaruhi saldo apapun).
 */
function _computeSaldoFromTransaksi() {
  try {
    const akunResult = getMasterAkun();
    if (!akunResult.success || !akunResult.data.length) return [];

    const sheetTrx  = getSheet(APP_CONFIG.SHEETS.TRANSAKSI);
    const headerTrx = getHeaderMap(APP_CONFIG.SHEETS.TRANSAKSI);
    const rawTrx    = sheetTrx.getDataRange().getValues();
    rawTrx.shift();

    const TRANSFER_ID = APP_CONFIG.CATEGORY.TRANSFER_ID;
    const acc = {};
    akunResult.data.forEach(a => { acc[a.id_akun] = { masuk: 0, keluar: 0 }; });

    rawTrx.forEach(row => {
      const trx = mapRowToObject(row, headerTrx);
      if (trx.status_hapus === APP_CONFIG.STATUS.HAPUS) return;
      if (!trx.id_akun) return;
      // v1.2: skip _NO_AKUN_ — tidak mempengaruhi saldo akun manapun
      if (trx.id_akun === APP_CONFIG.CATEGORY.NO_AKUN) return;
      if (!acc[trx.id_akun]) return;

      const nominal = parseFloat(trx.jumlah) || 0;

      if (trx.tipe === APP_CONFIG.TIPE.PENDAPATAN) {
        acc[trx.id_akun].masuk += nominal;
      } else if (trx.tipe === APP_CONFIG.TIPE.PENGELUARAN) {
        acc[trx.id_akun].keluar += nominal;
      }
    });

    const now = new Date().toISOString();
    return akunResult.data.map(a => {
      const saldoAwal = parseFloat(a.saldo_awal) || 0;
      const masuk     = acc[a.id_akun] ? acc[a.id_akun].masuk  : 0;
      const keluar    = acc[a.id_akun] ? acc[a.id_akun].keluar : 0;
      const isUtang   = _isAkunUtang(a.tipe_akun);
      const saldoAkhir = saldoAwal + masuk - keluar;

      return {
        id_akun        : a.id_akun,
        nama_akun      : a.nama_akun,
        tipe_akun      : a.tipe_akun,
        saldo_awal     : saldoAwal,
        total_masuk    : masuk,
        total_keluar   : keluar,
        saldo_akhir    : saldoAkhir,
        is_utang       : isUtang,
        limit_kredit   : parseFloat(a.limit_kredit)   || 0,
        sisa_limit     : isUtang
          ? Math.max(0, (parseFloat(a.limit_kredit) || 0) - Math.abs(Math.min(saldoAkhir, 0)))
          : null,
        tgl_jatuh_tempo: a.tgl_jatuh_tempo || 0,
        terakhir_update: now
      };
    });

  } catch (e) {
    console.error('_computeSaldoFromTransaksi error:', e.message);
    return [];
  }
}