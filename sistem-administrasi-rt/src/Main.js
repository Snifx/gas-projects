/**
 * =====================================================
 * MAIN.GS - COMPLETE VERSION
 * Sistem Administrasi RT 005
 * =====================================================
 * Version: 2.0 - Full Featured
 * Last Updated: 2026-02-02
 * =====================================================
 */

// ============================================
// WEB APP ENTRY POINTS
// ============================================

/**
 * Serves the web application
 * @return {HtmlOutput} The HTML page
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(CONFIG.APP.NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Include HTML files for templating
 * @param {string} filename - Name of the HTML file to include
 * @return {string} The content of the HTML file
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================
// TEST & UTILITY FUNCTIONS
// ============================================

/**
 * Test connection from frontend
 */
function testConnection() {
  return {
    success: true,
    message: 'Connection OK',
    version: CONFIG.APP.VERSION,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get application configuration for frontend
 */
function getAppConfig() {
  return {
    appName: CONFIG.APP.NAME,
    version: CONFIG.APP.VERSION,
    rtName: CONFIG.APP.RT_NAME,
    rwName: CONFIG.APP.RW_NAME,
    kelurahan: CONFIG.APP.KELURAHAN,
    kecamatan: CONFIG.APP.KECAMATAN,
    kota: CONFIG.APP.KOTA
  };
}

// ============================================
// AUTHENTICATION API
// ============================================

/**
 * Authenticate user login
 * @param {string} username
 * @param {string} password
 * @return {Object} Authentication result
 */
function authenticateUser(username, password) {
  try {
    return Service_Auth.authenticate(username, password);
  } catch (error) {
    console.error('authenticateUser error:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan sistem: ' + error.message
    };
  }
}

/**
 * Change user password
 * @param {string} username
 * @param {string} oldPassword
 * @param {string} newPassword
 * @return {Object} Result
 */
function changePassword(username, oldPassword, newPassword) {
  try {
    return Service_Auth.changePassword(username, oldPassword, newPassword);
  } catch (error) {
    console.error('changePassword error:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan sistem: ' + error.message
    };
  }
}

// ============================================
// DASHBOARD API
// ============================================

/**
 * Get dashboard statistics
 * @return {Object} Dashboard data
 */
function getDashboardStats() {
  try {
    const allRumah = Service_Rumah.getAll();
    const allKK = Service_KK.getAll();

    // Calculate stats
    const totalRumah = allRumah.length;
    const rumahTerisi = allRumah.filter(r => r.statusHuni === 'Terisi').length;
    const rumahKosong = allRumah.filter(r => r.statusHuni === 'Kosong').length;

    const totalKK = allKK.length;
    const kkAktif = allKK.filter(kk => kk.statusTinggal === 'Tetap' || kk.statusTinggal === 'Kontrak').length;

    // Count by Jalan
    const rumahByJalan = {};
    const kkByJalan = {};

    allRumah.forEach(r => {
      const jalan = r.jalan || 'Unknown';
      rumahByJalan[jalan] = (rumahByJalan[jalan] || 0) + 1;
    });

    allKK.forEach(kk => {
      const jalan = kk.jalan || 'Unknown';
      kkByJalan[jalan] = (kkByJalan[jalan] || 0) + 1;
    });

    // Get iuran summary (current year)
    const currentYear = new Date().getFullYear();
    let totalIuranTerbayar = 0;
    let totalIuranBelumBayar = 0;

    allRumah.forEach(rumah => {
      if (rumah.iuranHistory && rumah.iuranHistory[currentYear]) {
        const yearData = rumah.iuranHistory[currentYear];
        Object.keys(yearData).forEach(bulan => {
          if (yearData[bulan].status === 'Lunas') {
            totalIuranTerbayar += yearData[bulan].nominal || 0;
          }
        });
      }
    });

    return {
      success: true,
      data: {
        rumah: {
          total: totalRumah,
          terisi: rumahTerisi,
          kosong: rumahKosong,
          byJalan: rumahByJalan
        },
        kk: {
          total: totalKK,
          aktif: kkAktif,
          byJalan: kkByJalan
        },
        iuran: {
          tahun: currentYear,
          terbayar: totalIuranTerbayar,
          belumBayar: totalIuranBelumBayar
        },
        lastUpdated: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('getDashboardStats error:', error);
    return {
      success: false,
      message: 'Gagal mengambil statistik: ' + error.message
    };
  }
}

// ============================================
// RUMAH API
// ============================================

/**
 * Get all rumah data
 * @return {Array} List of rumah
 */
function getAllRumah() {
  try {
    return Service_Rumah.getAll();
  } catch (error) {
    console.error('getAllRumah error:', error);
    return [];
  }
}

/**
 * Get rumah by ID
 * @param {string} rumahId
 * @return {Object|null} Rumah data
 */
function getRumahById(rumahId) {
  try {
    return Service_Rumah.getById(rumahId);
  } catch (error) {
    console.error('getRumahById error:', error);
    return null;
  }
}

/**
 * Get rumah detail with KK list
 * @param {string} rumahId
 * @return {Object} Rumah detail with KK
 */
function getRumahDetail(rumahId) {
  try {
    const rumah = Service_Rumah.getById(rumahId);
    if (!rumah) {
      return { success: false, message: 'Rumah tidak ditemukan' };
    }

    // Get KK yang tinggal di rumah ini
    const allKK = Service_KK.getAll();
    const kkList = allKK.filter(kk => kk.rumahId === rumahId);

    return {
      success: true,
      data: {
        rumah: rumah,
        kkList: kkList
      }
    };
  } catch (error) {
    console.error('getRumahDetail error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Create new rumah
 * @param {Object} rumahData
 * @return {Object} Result
 */
function createRumah(rumahData) {
  try {
    return Service_Rumah.create(rumahData);
  } catch (error) {
    console.error('createRumah error:', error);
    return {
      success: false,
      message: 'Gagal membuat rumah: ' + error.message
    };
  }
}

/**
 * Update existing rumah
 * @param {string} rumahId
 * @param {Object} rumahData
 * @return {Object} Result
 */
function updateRumah(rumahId, rumahData) {
  try {
    return Service_Rumah.update(rumahId, rumahData);
  } catch (error) {
    console.error('updateRumah error:', error);
    return {
      success: false,
      message: 'Gagal mengupdate rumah: ' + error.message
    };
  }
}

/**
 * Delete rumah
 * @param {string} rumahId
 * @return {Object} Result
 */
function deleteRumah(rumahId) {
  try {
    return Service_Rumah.delete(rumahId);
  } catch (error) {
    console.error('deleteRumah error:', error);
    return {
      success: false,
      message: 'Gagal menghapus rumah: ' + error.message
    };
  }
}

/**
 * Get filtered rumah
 * @param {Object} filters - {jalan, statusHuni, search}
 * @return {Array} Filtered list
 */
function getFilteredRumah(filters) {
  try {
    let data = Service_Rumah.getAll();

    if (filters.jalan && filters.jalan !== 'all') {
      data = data.filter(r => r.jalan === filters.jalan);
    }

    if (filters.statusHuni && filters.statusHuni !== 'all') {
      data = data.filter(r => r.statusHuni === filters.statusHuni);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      data = data.filter(r =>
        (r.nomorRumah && r.nomorRumah.toLowerCase().includes(searchLower)) ||
        (r.jalan && r.jalan.toLowerCase().includes(searchLower)) ||
        (r.namaPemilik && r.namaPemilik.toLowerCase().includes(searchLower))
      );
    }

    return data;
  } catch (error) {
    console.error('getFilteredRumah error:', error);
    return [];
  }
}

// ============================================
// KK (KARTU KELUARGA) API
// ============================================

/**
 * Get all KK data
 * @return {Array} List of KK
 */
function getAllKK() {
  try {
    return Service_KK.getAll();
  } catch (error) {
    console.error('getAllKK error:', error);
    return [];
  }
}

/**
 * Get KK by ID
 * @param {string} kkId
 * @return {Object|null} KK data
 */
function getKKById(kkId) {
  try {
    return Service_KK.getById(kkId);
  } catch (error) {
    console.error('getKKById error:', error);
    return null;
  }
}

/**
 * Get KK detail
 * @param {string} kkId
 * @return {Object} KK detail with rumah info
 */
function getKKDetail(kkId) {
  try {
    const kk = Service_KK.getById(kkId);
    if (!kk) {
      return { success: false, message: 'KK tidak ditemukan' };
    }

    // Get rumah info
    let rumahInfo = null;
    if (kk.rumahId) {
      rumahInfo = Service_Rumah.getById(kk.rumahId);
    }

    return {
      success: true,
      data: {
        kk: kk,
        rumah: rumahInfo
      }
    };
  } catch (error) {
    console.error('getKKDetail error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Create new KK
 * @param {Object} kkData
 * @return {Object} Result
 */
function createKK(kkData) {
  try {
    return Service_KK.create(kkData);
  } catch (error) {
    console.error('createKK error:', error);
    return {
      success: false,
      message: 'Gagal membuat KK: ' + error.message
    };
  }
}

/**
 * Update existing KK
 * @param {string} kkId
 * @param {Object} kkData
 * @return {Object} Result
 */
function updateKK(kkId, kkData) {
  try {
    return Service_KK.update(kkId, kkData);
  } catch (error) {
    console.error('updateKK error:', error);
    return {
      success: false,
      message: 'Gagal mengupdate KK: ' + error.message
    };
  }
}

/**
 * Delete KK
 * @param {string} kkId
 * @return {Object} Result
 */
function deleteKK(kkId) {
  try {
    return Service_KK.delete(kkId);
  } catch (error) {
    console.error('deleteKK error:', error);
    return {
      success: false,
      message: 'Gagal menghapus KK: ' + error.message
    };
  }
}

/**
 * Get filtered KK
 * @param {Object} filters - {jalan, statusTinggal, search}
 * @return {Array} Filtered list
 */
function getFilteredKK(filters) {
  try {
    let data = Service_KK.getAll();

    if (filters.jalan && filters.jalan !== 'all') {
      data = data.filter(kk => kk.jalan === filters.jalan);
    }

    if (filters.statusTinggal && filters.statusTinggal !== 'all') {
      data = data.filter(kk => kk.statusTinggal === filters.statusTinggal);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      data = data.filter(kk =>
        (kk.nomorKK && kk.nomorKK.toLowerCase().includes(searchLower)) ||
        (kk.namaKepalaKeluarga && kk.namaKepalaKeluarga.toLowerCase().includes(searchLower)) ||
        (kk.alamat && kk.alamat.toLowerCase().includes(searchLower))
      );
    }

    return data;
  } catch (error) {
    console.error('getFilteredKK error:', error);
    return [];
  }
}


// ============================================
// IURAN API
// ============================================

/**
 * Get iuran history for a rumah
 * @param {string} rumahId
 * @param {number} year (optional)
 * @return {Object} Iuran data
 */
function getIuranRumah(rumahId, year) {
  try {
    const rumah = Service_Rumah.getById(rumahId);
    if (!rumah) {
      return { success: false, message: 'Rumah tidak ditemukan' };
    }

    const targetYear = year || new Date().getFullYear();
    const iuranData = rumah.iuranHistory ? rumah.iuranHistory[targetYear] : null;

    // Get komponen iuran
    const komponenIuran = getKomponenIuran();

    return {
      success: true,
      data: {
        rumahId: rumahId,
        rumahInfo: {
          jalan: rumah.jalan,
          nomorRumah: rumah.nomorRumah,
          namaPemilik: rumah.namaPemilik
        },
        year: targetYear,
        iuran: iuranData || {},
        komponen: komponenIuran
      }
    };
  } catch (error) {
    console.error('getIuranRumah error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Update iuran payment
 * @param {string} rumahId
 * @param {number} year
 * @param {number} bulan (1-12)
 * @param {Object} paymentData
 * @return {Object} Result
 */
function updateIuranPayment(rumahId, year, bulan, paymentData) {
  try {
    return Service_Iuran.recordPayment(rumahId, year, bulan, paymentData);
  } catch (error) {
    console.error('updateIuranPayment error:', error);
    return {
      success: false,
      message: 'Gagal mengupdate iuran: ' + error.message
    };
  }
}

/**
 * Get iuran report for a period
 * @param {number} year
 * @param {number} bulan (optional, 1-12)
 * @return {Object} Report data
 */
function getIuranReport(year, bulan) {
  try {
    const allRumah = Service_Rumah.getAll();
    const report = [];

    allRumah.forEach(rumah => {
      if (rumah.statusHuni === 'Terisi') {
        const iuranData = rumah.iuranHistory ? rumah.iuranHistory[year] : {};

        let totalBayar = 0;
        let totalBulanBayar = 0;

        if (bulan) {
          // Specific month
          const bulanData = iuranData ? iuranData[bulan] : null;
          if (bulanData && bulanData.status === 'Lunas') {
            totalBayar = bulanData.nominal || 0;
            totalBulanBayar = 1;
          }
        } else {
          // Whole year
          for (let b = 1; b <= 12; b++) {
            const bulanData = iuranData ? iuranData[b] : null;
            if (bulanData && bulanData.status === 'Lunas') {
              totalBayar += bulanData.nominal || 0;
              totalBulanBayar++;
            }
          }
        }

        report.push({
          rumahId: rumah.rumahId,
          jalan: rumah.jalan,
          nomorRumah: rumah.nomorRumah,
          namaPemilik: rumah.namaPemilik,
          totalBayar: totalBayar,
          bulanBayar: totalBulanBayar,
          bulanTarget: bulan ? 1 : 12
        });
      }
    });

    return {
      success: true,
      data: {
        year: year,
        bulan: bulan || 'all',
        report: report,
        summary: {
          totalRumah: report.length,
          totalTerbayar: report.reduce((sum, r) => sum + r.totalBayar, 0),
          rumahLunas: report.filter(r => r.bulanBayar >= r.bulanTarget).length
        }
      }
    };
  } catch (error) {
    console.error('getIuranReport error:', error);
    return { success: false, message: error.message };
  }
}

// ============================================
// KONFIGURASI API
// ============================================

/**
 * Get komponen iuran
 * @return {Array} List of komponen
 */
function getKomponenIuran() {
  try {
    return Model_Konfigurasi.getKomponenIuran();
  } catch (error) {
    console.error('getKomponenIuran error:', error);
    return [];
  }
}

/**
 * Update komponen iuran
 * @param {Array} komponenList
 * @return {Object} Result
 */
function updateKomponenIuran(komponenList) {
  try {
    return Model_Konfigurasi.updateKomponenIuran(komponenList);
  } catch (error) {
    console.error('updateKomponenIuran error:', error);
    return {
      success: false,
      message: 'Gagal mengupdate komponen: ' + error.message
    };
  }
}

/**
 * Get list of jalan (for dropdowns)
 * @return {Array} List of jalan names
 */
function getJalanList() {
  try {
    const allRumah = Service_Rumah.getAll();
    const jalanSet = new Set();

    allRumah.forEach(r => {
      if (r.jalan) {
        jalanSet.add(r.jalan);
      }
    });

    return Array.from(jalanSet).sort();
  } catch (error) {
    console.error('getJalanList error:', error);
    return [];
  }
}

/**
 * Get available years for iuran
 * @return {Array} List of years
 */
function getAvailableYears() {
  try {
    const currentYear = new Date().getFullYear();
    const years = [];

    // Return last 3 years + current + next year
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      years.push(y);
    }

    return years;
  } catch (error) {
    console.error('getAvailableYears error:', error);
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }
}

// ============================================
// EXPORT DATA API
// ============================================

/**
 * Export rumah data to CSV format
 * @return {Object} CSV data
 */
function exportRumahToCSV() {
  try {
    const allRumah = Service_Rumah.getAll();

    // CSV Header
    const headers = ['ID', 'Jalan', 'Nomor Rumah', 'Status Huni', 'Nama Pemilik', 'No HP', 'Email'];

    // CSV Rows
    const rows = allRumah.map(r => [
      r.rumahId || '',
      r.jalan || '',
      r.nomorRumah || '',
      r.statusHuni || '',
      r.namaPemilik || '',
      r.noHpPemilik || '',
      r.emailPemilik || ''
    ]);

    return {
      success: true,
      data: {
        headers: headers,
        rows: rows,
        filename: 'data_rumah_' + new Date().toISOString().split('T')[0] + '.csv'
      }
    };
  } catch (error) {
    console.error('exportRumahToCSV error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Export KK data to CSV format
 * @return {Object} CSV data
 */
function exportKKToCSV() {
  try {
    const allKK = Service_KK.getAll();

    // CSV Header
    const headers = ['ID', 'Nomor KK', 'Nama Kepala Keluarga', 'Alamat', 'Status Tinggal', 'Jumlah ART', 'No HP'];

    // CSV Rows
    const rows = allKK.map(kk => [
      kk.kkId || '',
      kk.nomorKK || '',
      kk.namaKepalaKeluarga || '',
      kk.alamat || '',
      kk.statusTinggal || '',
      kk.jumlahART || '',
      kk.noHp || ''
    ]);

    return {
      success: true,
      data: {
        headers: headers,
        rows: rows,
        filename: 'data_kk_' + new Date().toISOString().split('T')[0] + '.csv'
      }
    };
  } catch (error) {
    console.error('exportKKToCSV error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * =====================================================
 * API FUNCTIONS - Komponen & Iuran
 * Tambahkan ke Main.gs (di bagian bawah file)
 * 
 * Functions ini menggunakan Model_Komponen dan Model_Iuran
 * yang sudah ada
 * =====================================================
 */

// ============================================
// KOMPONEN IURAN API
// ============================================

/**
 * Get all komponen iuran (termasuk yang tidak aktif)
 * @return {Array} List of komponen
 */
function getAllKomponen() {
  try {
    const sheet = SS.getSheetByName(CONFIG.SHEET_NAMES.KOMPONEN_IURAN);
    if (!sheet) {
      console.error('getAllKomponen: Sheet not found');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const result = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[COLUMNS.KOMPONEN.ID]) continue;

      const nominal = NumberUtils.toNumber(row[COLUMNS.KOMPONEN.NOMINAL]);

      result.push({
        komponenId: StringUtils.clean(row[COLUMNS.KOMPONEN.ID]),
        namaKomponen: StringUtils.clean(row[COLUMNS.KOMPONEN.NAMA]),
        satuan: StringUtils.clean(row[COLUMNS.KOMPONEN.SATUAN]),
        nominal: nominal,
        nominalFormatted: 'Rp ' + nominal.toLocaleString('id-ID'),
        status: StringUtils.clean(row[COLUMNS.KOMPONEN.STATUS]),
        rowIndex: i + 1
      });
    }

    console.log('getAllKomponen: Found ' + result.length + ' records');
    return result;

  } catch (error) {
    console.error('getAllKomponen error:', error);
    return [];
  }
}

/**
 * Create new komponen iuran
 * @param {Object} data - {namaKomponen, satuan, nominal, status}
 * @return {Object} Result
 */
function createKomponen(data) {
  try {
    // Use Model_Komponen but map field names
    const result = Model_Komponen.create({
      nama: data.namaKomponen,
      satuan: data.satuan,
      nominal: data.nominal
    });

    return result;

  } catch (error) {
    console.error('createKomponen error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Update komponen iuran
 * @param {string} komponenId
 * @param {Object} data - {namaKomponen, satuan, nominal, status}
 * @return {Object} Result
 */
function updateKomponen(komponenId, data) {
  try {
    // Map field names for Model_Komponen
    const updateData = {};
    if (data.namaKomponen !== undefined) updateData.nama = data.namaKomponen;
    if (data.satuan !== undefined) updateData.satuan = data.satuan;
    if (data.nominal !== undefined) updateData.nominal = data.nominal;
    if (data.status !== undefined) updateData.status = data.status;

    return Model_Komponen.update(komponenId, updateData);

  } catch (error) {
    console.error('updateKomponen error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Delete komponen iuran (soft delete)
 * @param {string} komponenId
 * @return {Object} Result
 */
function deleteKomponen(komponenId) {
  try {
    return Model_Komponen.delete(komponenId);
  } catch (error) {
    console.error('deleteKomponen error:', error);
    return { success: false, message: error.message };
  }
}

// ============================================
// IURAN RUMAH API
// ============================================

/**
 * Get iuran detail for a specific rumah
 * @param {string} rumahId
 * @return {Object} Iuran details with komponen breakdown
 */
function getIuranByRumahId(rumahId) {
  try {
    // Get rumah info using Model_Rumah
    const rumahInfo = Model_Rumah.getById(rumahId);

    if (!rumahInfo) {
      return { success: false, message: 'Rumah tidak ditemukan' };
    }

    // Get all komponen for lookup
    const allKomponen = getAllKomponen();
    const komponenMap = {};
    allKomponen.forEach(k => {
      komponenMap[k.komponenId] = k;
    });

    // Get iuran data using Model_Iuran
    const iuranList = Model_Iuran.getByRumahId(rumahId);

    // Transform data for frontend
    const transformedList = [];
    let totalIuran = 0;

    iuranList.forEach(iuran => {
      const komponen = komponenMap[iuran.komponenId] || {};

      const nominalDefault = iuran.nominalDefault || 0;
      const nominalOverride = iuran.nominalOverride !== null ? iuran.nominalOverride : nominalDefault;
      const qty = iuran.qty || 0;
      const total = iuran.total || 0;
      const keringanan = nominalDefault - nominalOverride;

      transformedList.push({
        komponenId: iuran.komponenId,
        namaKomponen: komponen.namaKomponen || 'Unknown',
        satuan: komponen.satuan || '-',
        nominalDefault: nominalDefault,
        nominalDefaultFormatted: 'Rp ' + nominalDefault.toLocaleString('id-ID'),
        nominalOverride: nominalOverride,
        nominalOverrideFormatted: 'Rp ' + nominalOverride.toLocaleString('id-ID'),
        keringanan: keringanan,
        keringananFormatted: keringanan > 0 ? 'Rp ' + keringanan.toLocaleString('id-ID') : '-',
        qty: qty,
        total: total,
        totalFormatted: 'Rp ' + total.toLocaleString('id-ID')
      });

      totalIuran += total;
    });

    return {
      success: true,
      data: {
        rumah: {
          rumahId: rumahInfo.rumahId,
          namaJalan: rumahInfo.namaJalan,
          nomorRumah: rumahInfo.nomorRumah,
          jumlahJiwa: rumahInfo.jumlahJiwa || 0,
          mobil: rumahInfo.mobil || 0,
          motor: rumahInfo.motor || 0,
          totalIuranPerbulan: rumahInfo.totalIuranPerbulan || 0,
          tunggakanIuran: rumahInfo.tunggakanIuran || 0
        },
        iuranList: transformedList,
        totalIuran: totalIuran,
        totalIuranFormatted: 'Rp ' + totalIuran.toLocaleString('id-ID')
      }
    };

  } catch (error) {
    console.error('getIuranByRumahId error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Add iuran komponen to a rumah
 * @param {string} rumahId
 * @param {Object} data - {komponenId, nominalOverride, qty}
 * @return {Object} Result
 */
function addIuranToRumah(rumahId, data) {
  try {
    // Get komponen info
    const komponen = Model_Komponen.getById(data.komponenId);
    if (!komponen) {
      return { success: false, message: 'Komponen tidak ditemukan' };
    }

    const nominalDefault = komponen.nominal;
    const nominalOverride = data.nominalOverride !== undefined ? data.nominalOverride : nominalDefault;
    const qty = data.qty || 1;
    const total = nominalOverride * qty;

    // Check if already exists
    const existingIuran = Model_Iuran.getByRumahId(rumahId);
    const exists = existingIuran.some(i => i.komponenId === data.komponenId);

    if (exists) {
      return { success: false, message: 'Komponen sudah ada untuk rumah ini' };
    }

    // Create iuran
    const result = Model_Iuran.create({
      rumahId: rumahId,
      komponenId: data.komponenId,
      nominalDefault: nominalDefault,
      nominalOverride: nominalOverride,
      qty: qty,
      total: total
    });

    if (result.success) {
      // Update total iuran on rumah
      updateRumahTotalIuran(rumahId);
    }

    return result;

  } catch (error) {
    console.error('addIuranToRumah error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Update iuran for a rumah
 * @param {string} rumahId
 * @param {string} komponenId
 * @param {Object} data - {nominalOverride, qty}
 * @return {Object} Result
 */
function updateIuranRumah(rumahId, komponenId, data) {
  try {
    // Calculate new total
    const existingIuran = Model_Iuran.getByRumahId(rumahId);
    const iuran = existingIuran.find(i => i.komponenId === komponenId);

    if (!iuran) {
      return { success: false, message: 'Data iuran tidak ditemukan' };
    }

    const nominalOverride = data.nominalOverride !== undefined ? data.nominalOverride : iuran.nominalOverride;
    const qty = data.qty !== undefined ? data.qty : iuran.qty;
    const total = nominalOverride * qty;

    const result = Model_Iuran.update(rumahId, komponenId, {
      nominalOverride: nominalOverride,
      qty: qty,
      total: total
    });

    if (result.success) {
      updateRumahTotalIuran(rumahId);
    }

    return result;

  } catch (error) {
    console.error('updateIuranRumah error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Delete iuran from rumah
 * @param {string} rumahId
 * @param {string} komponenId
 * @return {Object} Result
 */
function deleteIuranFromRumah(rumahId, komponenId) {
  try {
    const result = Model_Iuran.delete(rumahId, komponenId);

    if (result.success) {
      updateRumahTotalIuran(rumahId);
    }

    return result;

  } catch (error) {
    console.error('deleteIuranFromRumah error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Helper: Update total iuran on rumah
 * @param {string} rumahId
 */
function updateRumahTotalIuran(rumahId) {
  try {
    const sheet = SS.getSheetByName(CONFIG.SHEET_NAMES.DATA_RUMAH);
    if (!sheet) return;

    // Get all iuran for this rumah
    const iuranList = Model_Iuran.getByRumahId(rumahId);
    const total = iuranList.reduce((sum, iuran) => sum + (iuran.total || 0), 0);

    // Find rumah row and update
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (StringUtils.equals(data[i][COLUMNS.RUMAH.ID], rumahId)) {
        sheet.getRange(i + 1, COLUMNS.RUMAH.TOTAL_IURAN + 1).setValue(total);
        console.log('updateRumahTotalIuran: Updated ' + rumahId + ' to ' + total);
        break;
      }
    }

  } catch (error) {
    console.error('updateRumahTotalIuran error:', error);
  }
}

/**
 * Get available komponen for adding to rumah (excluding already added)
 * @param {string} rumahId
 * @return {Array} List of available komponen
 */
function getAvailableKomponenForRumah(rumahId) {
  try {
    const allKomponen = getAllKomponen();
    const iuranList = Model_Iuran.getByRumahId(rumahId);
    const usedKomponenIds = iuranList.map(i => i.komponenId);

    return allKomponen.filter(k =>
      k.status === 'Aktif' && !usedKomponenIds.includes(k.komponenId)
    );

  } catch (error) {
    console.error('getAvailableKomponenForRumah error:', error);
    return [];
  }
}

/**
 * =====================================================
 * FIXED API FUNCTION - Get KK by Rumah ID
 * Tambahkan ke Main.gs (GANTIKAN versi sebelumnya)
 * =====================================================
 */

/**
 * Get all KK members for a specific rumah
 * @param {string} rumahId - Rumah ID
 * @return {Object} Result with KK list as array
 */
function getKKByRumahId(rumahId) {
  try {
    const sheet = SS.getSheetByName(CONFIG.SHEET_NAMES.KARTU_KELUARGA);
    if (!sheet) {
      return { success: false, message: 'Sheet tidak ditemukan', data: [] };
    }

    const data = sheet.getDataRange().getValues();
    const kkList = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows
      if (!row[COLUMNS.KK.ID]) continue;

      // Check if this KK belongs to the rumah
      if (StringUtils.equals(row[COLUMNS.KK.RUMAH_ID], rumahId)) {
        // Calculate age from tanggal lahir
        let umur = '-';
        const tanggalLahir = row[COLUMNS.KK.TANGGAL_LAHIR];

        if (tanggalLahir) {
          try {
            const birthDate = new Date(tanggalLahir);
            if (!isNaN(birthDate.getTime())) {
              const today = new Date();
              let age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();

              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }

              if (age >= 0) {
                umur = age + ' tahun';
              }
            }
          } catch (e) {
            umur = '-';
          }
        }

        kkList.push({
          kkId: StringUtils.clean(row[COLUMNS.KK.ID]),
          rumahId: StringUtils.clean(row[COLUMNS.KK.RUMAH_ID]),
          namaJalan: StringUtils.clean(row[COLUMNS.KK.NAMA_JALAN]),
          nomorRumah: row[COLUMNS.KK.NO_RUMAH],
          noKK: StringUtils.clean(row[COLUMNS.KK.NO_KK]),
          nik: StringUtils.clean(row[COLUMNS.KK.NIK]),
          nama: StringUtils.clean(row[COLUMNS.KK.NAMA]),
          status: StringUtils.clean(row[COLUMNS.KK.STATUS]),
          jenisKelamin: StringUtils.clean(row[COLUMNS.KK.JENIS_KELAMIN]),
          tempatLahir: StringUtils.clean(row[COLUMNS.KK.TEMPAT_LAHIR]),
          tanggalLahir: tanggalLahir ? (tanggalLahir instanceof Date ? Utilities.formatDate(tanggalLahir, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(tanggalLahir)) : '',
          umur: umur
        });
      }
    }

    console.log('getKKByRumahId: Found ' + kkList.length + ' members for ' + rumahId);

    // Return data as array directly (not nested object)
    return {
      success: true,
      data: kkList
    };

  } catch (error) {
    console.error('getKKByRumahId error:', error);
    return { success: false, message: error.message, data: [] };
  }
}

/**
 * Count KK members for a rumah (lightweight version)
 * @param {string} rumahId - Rumah ID
 * @return {number} Count of KK members
 */
function countKKByRumahId(rumahId) {
  try {
    const sheet = SS.getSheetByName(CONFIG.SHEET_NAMES.KARTU_KELUARGA);
    if (!sheet) return 0;

    const data = sheet.getDataRange().getValues();
    let count = 0;

    for (let i = 1; i < data.length; i++) {
      if (data[i][COLUMNS.KK.ID] && StringUtils.equals(data[i][COLUMNS.KK.RUMAH_ID], rumahId)) {
        count++;
      }
    }

    return count;
  } catch (error) {
    console.error('countKKByRumahId error:', error);
    return 0;
  }
}

// ============================================
// KATEGORI PEMBUKUAN API
// ============================================

/**
 * Get all kategori pembukuan
 */
function getAllKategoriPembukuan() {
  try {
    const sheet = SS.getSheetByName(CONFIG.SHEET_NAMES.KATEGORI_PEMBUKUAN);
    if (!sheet) {
      console.error('getAllKategoriPembukuan: Sheet not found');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const result = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[COLUMNS.KATEGORI_PEMBUKUAN.ID]) continue;

      result.push({
        kategoriId: StringUtils.clean(row[COLUMNS.KATEGORI_PEMBUKUAN.ID]),
        namaKategori: StringUtils.clean(row[COLUMNS.KATEGORI_PEMBUKUAN.NAMA]),
        deskripsi: StringUtils.clean(row[COLUMNS.KATEGORI_PEMBUKUAN.DESKRIPSI]),
        tipe: StringUtils.clean(row[COLUMNS.KATEGORI_PEMBUKUAN.TIPE]),
        status: StringUtils.clean(row[COLUMNS.KATEGORI_PEMBUKUAN.STATUS]),
        rowIndex: i + 1
      });
    }

    console.log('getAllKategoriPembukuan: Found ' + result.length + ' records');
    return result;

  } catch (error) {
    console.error('getAllKategoriPembukuan error:', error);
    return [];
  }
}

/**
 * Get kategori by tipe (Pemasukan/Pengeluaran)
 */
function getKategoriByTipe(tipe) {
  try {
    const all = getAllKategoriPembukuan();
    return all.filter(k => k.tipe === tipe && k.status === 'Aktif');
  } catch (error) {
    console.error('getKategoriByTipe error:', error);
    return [];
  }
}

/**
 * Create kategori pembukuan
 */
function createKategoriPembukuan(data) {
  try {
    const sheet = SS.getSheetByName(CONFIG.SHEET_NAMES.KATEGORI_PEMBUKUAN);
    if (!sheet) return { success: false, message: 'Sheet not found' };

    // Generate ID
    const sheetData = sheet.getDataRange().getValues();
    let maxNum = 0;
    for (let i = 1; i < sheetData.length; i++) {
      const id = String(sheetData[i][COLUMNS.KATEGORI_PEMBUKUAN.ID] || '');
      const num = parseInt(id.replace('KAT', ''));
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    const kategoriId = 'KAT' + String(maxNum + 1).padStart(9, '0');

    const rowData = [
      kategoriId,
      StringUtils.clean(data.namaKategori),
      StringUtils.clean(data.deskripsi || ''),
      StringUtils.clean(data.tipe),
      'Aktif'
    ];

    sheet.appendRow(rowData);

    return { success: true, kategoriId: kategoriId, message: 'Kategori berhasil ditambahkan' };

  } catch (error) {
    console.error('createKategoriPembukuan error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Update kategori pembukuan
 */
function updateKategoriPembukuan(kategoriId, data) {
  try {
    const sheet = SS.getSheetByName(CONFIG.SHEET_NAMES.KATEGORI_PEMBUKUAN);
    if (!sheet) return { success: false, message: 'Sheet not found' };

    const sheetData = sheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < sheetData.length; i++) {
      if (StringUtils.equals(sheetData[i][COLUMNS.KATEGORI_PEMBUKUAN.ID], kategoriId)) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) return { success: false, message: 'Kategori tidak ditemukan' };

    if (data.namaKategori !== undefined) {
      sheet.getRange(rowIndex, COLUMNS.KATEGORI_PEMBUKUAN.NAMA + 1).setValue(StringUtils.clean(data.namaKategori));
    }
    if (data.deskripsi !== undefined) {
      sheet.getRange(rowIndex, COLUMNS.KATEGORI_PEMBUKUAN.DESKRIPSI + 1).setValue(StringUtils.clean(data.deskripsi));
    }
    if (data.tipe !== undefined) {
      sheet.getRange(rowIndex, COLUMNS.KATEGORI_PEMBUKUAN.TIPE + 1).setValue(StringUtils.clean(data.tipe));
    }
    if (data.status !== undefined) {
      sheet.getRange(rowIndex, COLUMNS.KATEGORI_PEMBUKUAN.STATUS + 1).setValue(StringUtils.clean(data.status));
    }

    return { success: true, message: 'Kategori berhasil diupdate' };

  } catch (error) {
    console.error('updateKategoriPembukuan error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Delete kategori pembukuan (soft delete)
 */
function deleteKategoriPembukuan(kategoriId) {
  return updateKategoriPembukuan(kategoriId, { status: 'Tidak Aktif' });
}

// ============================================
// TAGIHAN BULANAN API
// ============================================

function getTagihanByRumahId(rumahId, tahun, namaJalan, nomorRumah) {
  return Service_Tagihan.getByRumahId(rumahId, tahun, namaJalan, nomorRumah);
}


function generateTagihanTahunan(rumahId, tahun) {
  return Service_Tagihan.generateTahunan(rumahId, tahun);
}

function importTunggakanExisting(rumahId, nominalTunggakan, keterangan) {
  return Service_Tagihan.importTunggakan(rumahId, nominalTunggakan, keterangan);
}

/**
 * Update tunggakan value in Data_Rumah (for editing before import)
 */
function updateTunggakanRumah(rumahId, nominal) {
  try {
    const sheet = SS.getSheetByName(CONFIG.SHEET_NAMES.DATA_RUMAH);
    if (!sheet) return { success: false, message: 'Sheet not found' };

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (StringUtils.equals(data[i][COLUMNS.RUMAH.ID], rumahId)) {
        sheet.getRange(i + 1, COLUMNS.RUMAH.TUNGGAKAN + 1).setValue(NumberUtils.toNumber(nominal));
        return { success: true, message: 'Tunggakan berhasil diupdate' };
      }
    }

    return { success: false, message: 'Rumah tidak ditemukan' };

  } catch (error) {
    console.error('updateTunggakanRumah error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Get available years for dropdown
 */

// ============================================
// TRANSAKSI KAS API
// ============================================

function fetchAllTransaksi(filters) {
  return Service_Transaksi.getAll(filters);
}

function getAllTransaksi(filters) {
  return fetchAllTransaksi(filters);
}

/**
 * NEW: Fresh function name to bypass GAS deployment cache
 * Frontend harus memanggil function ini
 */
function loadKasTransaksi(filters) {
  return fetchAllTransaksi(filters);
}

function getTransaksiByRumahId(rumahId) {
  return Service_Transaksi.getByRumahId(rumahId);
}

function updateTagihanKeterangan(tagihanId, keterangan) {
  return Service_Tagihan.updateKeterangan(tagihanId, keterangan);
}

function updateTunggakan(tagihanId, updateData) {
  return Service_Tagihan.updateTunggakanData(tagihanId, updateData);
}

function deleteTunggakan(tagihanId) {
  return Service_Tagihan.deleteTunggakan(tagihanId);
}

function createTransaksiPembayaran(data) {
  return Service_Transaksi.createPembayaran(data);
}


function createMultiTransaksiPembayaran(payments) {
  return Service_Transaksi.createMultiPembayaran(payments);
}

function createTransaksiPengeluaran(data) {
  return Service_Transaksi.createPengeluaran(data);
}

function updateTagihanAfterPayment(tagihanId) {
  return Service_Transaksi.recalculateTagihan(tagihanId);
}

function deleteTransaksi(transaksiId) {
  return Service_Transaksi.delete(transaksiId);
}

function recalculateTagihanTerbayar(tagihanId) {
  return Service_Transaksi.recalculateTagihan(tagihanId);
}

function getAllRumahTunggakan() {
  return Service_Tagihan.getAllRumahTunggakanMap();
}

function deleteTagihan(tagihanId) {
  return Service_Tagihan.deleteTagihan(tagihanId);
}

function deleteAllTagihanByRumahTahun(rumahId, tahun) {
  return Service_Tagihan.deleteAllByRumahTahun(rumahId, tahun);
}

function recalculateAllTagihan() {
  return Service_Tagihan.recalculateAllTerbayar();
}

/**
 * =====================================================
 * TEST FUNCTIONS - Tambahkan di akhir Main.gs
 * Jalankan dari Apps Script Editor untuk verifikasi
 * =====================================================
 */

/**
 * TEST: Verifikasi getTransaksiByRumahId
 */
function testGetTransaksiByRumahId() {
  console.log('=== TEST getTransaksiByRumahId ===');

  // Test dengan Teratai 16 (RM000000008)
  const rumahId = 'RM000000008';
  console.log('Testing with rumahId:', rumahId);

  const result = getTransaksiByRumahId(rumahId);
  console.log('Result:', JSON.stringify(result, null, 2));

  if (result.success && result.data.length > 0) {
    console.log('✅ SUCCESS! Found', result.data.length, 'transactions');
    result.data.forEach(t => {
      console.log('  - ' + t.transaksiId + ': Rp ' + t.nominal + ' - ' + t.keterangan);
    });
  } else if (result.success && result.data.length === 0) {
    console.log('⚠️ Function works but no data found for this rumahId');
  } else {
    console.log('❌ FAILED:', result.message);
  }

  return result;
}

/**
 * TEST: Verifikasi COLUMNS.TRANSAKSI
 */
function testTransaksiColumns() {
  console.log('=== TEST COLUMNS.TRANSAKSI ===');
  console.log('RUMAH_ID index:', COLUMNS.TRANSAKSI.RUMAH_ID);

  const sheet = SS.getSheetByName(CONFIG.SHEET_NAMES.TRANSAKSI_KAS);
  if (!sheet) {
    console.log('❌ Sheet not found');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, 11).getValues()[0];
  console.log('Actual headers:', headers);
  console.log('Header at index 8:', headers[8]);

  // Check first data row
  const firstRow = sheet.getRange(2, 1, 1, 11).getValues()[0];
  console.log('First row data:', firstRow);
  console.log('Rumah_ID value at index 8:', firstRow[8]);
}

/**
 * TEST: List all unique Rumah_ID in Transaksi_Kas
 */
function testListRumahInTransaksi() {
  console.log('=== LIST RUMAH_ID in TRANSAKSI_KAS ===');

  const sheet = SS.getSheetByName(CONFIG.SHEET_NAMES.TRANSAKSI_KAS);
  if (!sheet) {
    console.log('❌ Sheet not found');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const rumahIds = new Set();

  for (let i = 1; i < data.length; i++) {
    const rumahId = StringUtils.clean(data[i][COLUMNS.TRANSAKSI.RUMAH_ID]);
    if (rumahId) rumahIds.add(rumahId);
  }

  console.log('Unique Rumah_IDs:', Array.from(rumahIds));
  console.log('Total:', rumahIds.size, 'rumah have transactions');
}
/**
 * =====================================================
 * BACKEND FASE 5 - Kas RT & Transaksi Management
 * =====================================================
 * Tambahkan fungsi-fungsi ini ke Main.gs
 * 
 * FUNGSI BARU:
 * 1. updateTransaksi(transaksiId, data) - Edit transaksi existing
 * 2. createTransaksiManual(data) - Tambah transaksi manual (Pemasukan/Pengeluaran)
 * 3. getTransaksiSummaryByMonth(tahun) - Ringkasan per bulan
 * 
 * Version: 1.0
 * Date: 2026-02-13
 */

// =====================================================
// 1. UPDATE TRANSAKSI (EDIT)
// =====================================================
function updateTransaksi(transaksiId, data) {
  return Service_Transaksi.update(transaksiId, data);
}


// =====================================================
// 2. CREATE TRANSAKSI MANUAL (Pemasukan / Pengeluaran)
// =====================================================
function createTransaksiManual(data) {
  return Service_Transaksi.createManual(data);
}


// =====================================================
// 3. GET TRANSAKSI SUMMARY BY MONTH
// =====================================================
function getTransaksiSummaryByMonth(tahun) {
  return Service_Transaksi.getSummaryByMonth(tahun);
}

/**
 * =====================================================
 * TEST: Verifikasi Metode Pembayaran
 * =====================================================
 * Jalankan function ini di Apps Script Console
 * untuk memastikan backend mengembalikan metodePembayaran
 */

function testMetodePembayaran() {
  console.log('=== Test Metode Pembayaran ===\n');

  // 1. Cek COLUMNS mapping
  console.log('COLUMNS.TRANSAKSI.METODE_PEMBAYARAN:', COLUMNS.TRANSAKSI.METODE_PEMBAYARAN);
  console.log('Expected: 11 (kolom L)\n');

  // 2. Cek raw data dari sheet
  var sheet = SS.getSheetByName('Transaksi_Kas');
  var data = sheet.getDataRange().getValues();
  console.log('Total columns in sheet:', data[0].length);
  console.log('Header row:', JSON.stringify(data[0]));
  console.log('Row 2 kolom L (index 11):', data[1][11]);
  console.log('');

  // 3. Cek via Model_Transaksi.mapRowToTransaksi
  var transaksi = Model_Transaksi.mapRowToTransaksi(data[1], 2);
  console.log('mapRowToTransaksi result:');
  console.log('  transaksiId:', transaksi.transaksiId);
  console.log('  keterangan:', transaksi.keterangan);
  console.log('  metodePembayaran:', transaksi.metodePembayaran);
  console.log('');

  // 4. Cek via getAllTransaksi
  var result = fetchAllTransaksi({});
  if (result.data && result.data.length > 0) {
    console.log('getAllTransaksi total:', result.data.length);
    console.log('  metodePembayaran:', result.data[0].metodePembayaran);
  }

  // 5. Cek semua metode
  result.data.forEach(function (t) {
    if (t.metodePembayaran) {
      console.log(t.transaksiId + ': ' + t.metodePembayaran);
    }
  });
  console.log('\n=== Test Complete ===');
}

function testMetode2() {
  var sheet = SS.getSheetByName('Transaksi_Kas');
  var data = sheet.getDataRange().getValues();
  var row = data[1];

  console.log('row.length:', row.length);
  console.log('row[11] direct:', row[11]);
  console.log('COLUMNS.TRANSAKSI.METODE_PEMBAYARAN:', COLUMNS.TRANSAKSI.METODE_PEMBAYARAN);
  console.log('row[COLUMNS.TRANSAKSI.METODE_PEMBAYARAN]:', row[COLUMNS.TRANSAKSI.METODE_PEMBAYARAN]);

  // Bypass StringUtils
  var metode = String(row[11] || '');
  console.log('String(row[11]):', metode);

  // Test StringUtils
  var metode2 = StringUtils.clean(row[11]);
  console.log('StringUtils.clean(row[11]):', metode2);
  console.log('typeof:', typeof metode2);
}
// =====================================================
// CONFIG RT & MONTHLY SUMMARY
// =====================================================

/**
 * Load Config_RT data (key-value pairs)
 */
function loadConfigRT() {
  try {
    var sheet = SS.getSheetByName('Config_RT');
    if (!sheet) {
      return { success: false, message: 'Sheet Config_RT not found' };
    }

    var data = sheet.getDataRange().getValues();
    var config = {};

    for (var i = 1; i < data.length; i++) {
      var key = String(data[i][0] || '').trim();
      var value = data[i][1];
      if (key) {
        config[key] = value !== null && value !== undefined ? String(value) : '';
      }
    }

    return { success: true, data: config };

  } catch (error) {
    console.error('loadConfigRT error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Load monthly pemasukan/pengeluaran summary for chart
 * @param {number} tahun - Year to summarize
 */
function loadMonthlySummary(tahun) {
  return Service_Transaksi.getSummaryByMonth(tahun);
}