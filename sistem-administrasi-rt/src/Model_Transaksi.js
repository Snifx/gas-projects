/**
 * Model_Transaksi.js
 * Database access logic for Transaksi_Kas
 * Version: 2.0
 * Last Updated: 2026-03-10
 */

const Model_Transaksi = {

    getSheet() {
        return SS.getSheetByName(CONFIG.SHEET_NAMES.TRANSAKSI_KAS);
    },

    getAll() {
        try {
            const sheet = this.getSheet();
            if (!sheet) return [];

            const data = sheet.getDataRange().getValues();
            const result = [];
            for (let i = 1; i < data.length; i++) {
                if (data[i][COLUMNS.TRANSAKSI.ID]) {
                    result.push(this.mapRowToTransaksi(data[i], i + 1));
                }
            }
            return result;
        } catch (error) {
            console.error('Model_Transaksi.getAll error:', error);
            return [];
        }
    },

    getByRumahId(rumahId) {
        try {
            const list = this.getAll();
            return list.filter(t => t.rumahId === rumahId);
        } catch (error) {
            console.error('Model_Transaksi.getByRumahId error:', error);
            return [];
        }
    },

    getById(transaksiId) {
        try {
            const list = this.getAll();
            return list.find(t => t.transaksiId === transaksiId) || null;
        } catch (error) {
            console.error('Model_Transaksi.getById error:', error);
            return null;
        }
    },

    generateId() {
        const sheetData = this.getSheet().getDataRange().getValues();
        let maxNum = 0;
        for (let i = 1; i < sheetData.length; i++) {
            const id = String(sheetData[i][COLUMNS.TRANSAKSI.ID] || '');
            const num = parseInt(id.replace('TR', ''));
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
        return 'TR' + String(maxNum + 1).padStart(9, '0');
    },

    create(rowData) {
        try {
            const sheet = this.getSheet();
            if (!sheet) return { success: false, message: 'Sheet not found' };

            sheet.appendRow(rowData);
            return { success: true, transaksiId: rowData[0] };
        } catch (error) {
            console.error('Model_Transaksi.create error:', error);
            return { success: false, message: error.message };
        }
    },

    update(rowIndex, colIndex, value) {
        try {
            const sheet = this.getSheet();
            sheet.getRange(rowIndex, colIndex + 1).setValue(value);
            return { success: true };
        } catch (error) {
            console.error('Model_Transaksi.update error:', error);
            return { success: false, message: error.message };
        }
    },

    deleteRow(rowIndex) {
        try {
            const sheet = this.getSheet();
            sheet.deleteRow(rowIndex);
            return { success: true };
        } catch (error) {
            console.error('Model_Transaksi.deleteRow error:', error);
            return { success: false, message: error.message };
        }
    },

    mapRowToTransaksi(row, rowIndex) {
        const nominal = NumberUtils.toNumber(row[COLUMNS.TRANSAKSI.NOMINAL]);
        const tanggal = row[COLUMNS.TRANSAKSI.TANGGAL];

        let tanggalStr = '';
        let tanggalFormatted = '-';

        if (tanggal) {
            if (tanggal instanceof Date) {
                tanggalStr = Utilities.formatDate(tanggal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
                tanggalFormatted = Utilities.formatDate(tanggal, Session.getScriptTimeZone(), 'dd/MM/yyyy');
            } else {
                tanggalStr = String(tanggal);
                tanggalFormatted = tanggalStr;
            }
        }

        return {
            transaksiId: StringUtils.clean(row[COLUMNS.TRANSAKSI.ID]),
            tanggal: tanggalStr,
            tanggalFormatted: tanggalFormatted,
            jenis: StringUtils.clean(row[COLUMNS.TRANSAKSI.JENIS]),
            kategoriId: StringUtils.clean(row[COLUMNS.TRANSAKSI.KATEGORI_ID]),
            namaKategori: StringUtils.clean(row[COLUMNS.TRANSAKSI.NAMA_KATEGORI]),
            nominal: nominal,
            nominalFormatted: 'Rp ' + nominal.toLocaleString('id-ID'),
            keterangan: StringUtils.clean(row[COLUMNS.TRANSAKSI.KETERANGAN]),
            tagihanId: StringUtils.clean(row[COLUMNS.TRANSAKSI.TAGIHAN_ID]),
            rumahId: StringUtils.clean(row[COLUMNS.TRANSAKSI.RUMAH_ID]),
            userInput: StringUtils.clean(row[COLUMNS.TRANSAKSI.USER_INPUT]),
            metodePembayaran: StringUtils.clean(row[COLUMNS.TRANSAKSI.METODE_PEMBAYARAN] || ''),
            rowIndex: rowIndex
        };
    }
};
