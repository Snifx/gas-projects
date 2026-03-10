/**
 * Model_Tagihan.js
 * Database access logic for Tagihan_Bulanan
 * Version: 2.0
 * Last Updated: 2026-03-10
 */

const Model_Tagihan = {

    getSheet() {
        return SS.getSheetByName(CONFIG.SHEET_NAMES.TAGIHAN_BULANAN);
    },

    getAll() {
        try {
            const sheet = this.getSheet();
            if (!sheet) return [];

            const data = sheet.getDataRange().getValues();
            const result = [];
            for (let i = 1; i < data.length; i++) {
                if (data[i][COLUMNS.TAGIHAN.ID]) {
                    result.push(this.mapRowToTagihan(data[i], i + 1));
                }
            }
            return result;
        } catch (error) {
            console.error('Model_Tagihan.getAll error:', error);
            return [];
        }
    },

    getById(tagihanId) {
        try {
            const sheet = this.getSheet();
            if (!sheet) return null;

            const data = sheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (StringUtils.equals(data[i][COLUMNS.TAGIHAN.ID], tagihanId)) {
                    return this.mapRowToTagihan(data[i], i + 1);
                }
            }
            return null;
        } catch (error) {
            console.error('Model_Tagihan.getById error:', error);
            return null;
        }
    },

    getByRumahId(rumahId, tahun = null) {
        try {
            const tagihanList = this.getAll();
            return tagihanList.filter(t =>
                t.rumahId === rumahId && (!tahun || t.tahun == tahun)
            );
        } catch (error) {
            console.error('Model_Tagihan.getByRumahId error:', error);
            return [];
        }
    },

    generateId() {
        const sheetData = this.getSheet().getDataRange().getValues();
        let maxNum = 0;
        for (let i = 1; i < sheetData.length; i++) {
            const id = String(sheetData[i][COLUMNS.TAGIHAN.ID] || '');
            const num = parseInt(id.replace('TG', ''));
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
        return 'TG' + String(maxNum + 1).padStart(9, '0');
    },

    create(rowData) {
        try {
            const sheet = this.getSheet();
            if (!sheet) return { success: false, message: 'Sheet not found' };

            sheet.appendRow(rowData);
            return { success: true, tagihanId: rowData[0] };
        } catch (error) {
            console.error('Model_Tagihan.create error:', error);
            return { success: false, message: error.message };
        }
    },

    update(rowIndex, colIndex, value) {
        try {
            const sheet = this.getSheet();
            sheet.getRange(rowIndex, colIndex + 1).setValue(value);
            return { success: true };
        } catch (error) {
            console.error('Model_Tagihan.update error:', error);
            return { success: false, message: error.message };
        }
    },

    deleteRow(rowIndex) {
        try {
            const sheet = this.getSheet();
            sheet.deleteRow(rowIndex);
            return { success: true };
        } catch (error) {
            console.error('Model_Tagihan.deleteRow error:', error);
            return { success: false, message: error.message };
        }
    },

    mapRowToTagihan(row, rowIndex) {
        const totalTagihan = NumberUtils.toNumber(row[COLUMNS.TAGIHAN.TOTAL_TAGIHAN]);
        const totalTerbayar = NumberUtils.toNumber(row[COLUMNS.TAGIHAN.TOTAL_TERBAYAR]);
        const sisaTagihan = NumberUtils.toNumber(row[COLUMNS.TAGIHAN.SISA_TAGIHAN]);

        let periodeStr = '';
        const periodeRaw = row[COLUMNS.TAGIHAN.PERIODE];
        if (periodeRaw instanceof Date) {
            periodeStr = Utilities.formatDate(periodeRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (periodeRaw) {
            periodeStr = String(periodeRaw);
        }

        let tanggalLunasStr = '';
        const tanggalLunasRaw = row[COLUMNS.TAGIHAN.TANGGAL_LUNAS];
        if (tanggalLunasRaw instanceof Date) {
            tanggalLunasStr = Utilities.formatDate(tanggalLunasRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (tanggalLunasRaw) {
            tanggalLunasStr = String(tanggalLunasRaw);
        }

        return {
            tagihanId: StringUtils.clean(row[COLUMNS.TAGIHAN.ID]),
            rumahId: StringUtils.clean(row[COLUMNS.TAGIHAN.RUMAH_ID]),
            namaJalan: StringUtils.clean(row[COLUMNS.TAGIHAN.NAMA_JALAN]),
            nomorRumah: row[COLUMNS.TAGIHAN.NOMOR_RUMAH],
            tipe: StringUtils.clean(row[COLUMNS.TAGIHAN.TIPE]),
            periode: periodeStr,
            bulan: StringUtils.clean(row[COLUMNS.TAGIHAN.BULAN]),
            tahun: Number(row[COLUMNS.TAGIHAN.TAHUN]) || 0,
            namaTagihan: StringUtils.clean(row[COLUMNS.TAGIHAN.NAMA_TAGIHAN]),
            totalTagihan: totalTagihan,
            totalTagihanFormatted: 'Rp ' + totalTagihan.toLocaleString('id-ID'),
            totalTerbayar: totalTerbayar,
            totalTerbayarFormatted: 'Rp ' + totalTerbayar.toLocaleString('id-ID'),
            sisaTagihan: sisaTagihan,
            sisaTagihanFormatted: 'Rp ' + sisaTagihan.toLocaleString('id-ID'),
            status: StringUtils.clean(row[COLUMNS.TAGIHAN.STATUS]),
            tanggalLunas: tanggalLunasStr,
            keterangan: StringUtils.clean(row[COLUMNS.TAGIHAN.KETERANGAN]),
            rowIndex: rowIndex
        };
    }
};
