/**
 * Service_Transaksi.js
 * Business logic for Transaksi Kas API
 * Version: 2.0
 * Last Updated: 2026-03-10
 */

const Service_Transaksi = {

    getAll(filters) {
        try {
            const allData = Model_Transaksi.getAll();
            let result = [];
            let totalPemasukan = 0;
            let totalPengeluaran = 0;

            for (const t of allData) {
                if (t.jenis === 'Pemasukan') totalPemasukan += t.nominal;
                else totalPengeluaran += t.nominal;

                if (filters) {
                    if (filters.kategoriId && t.kategoriId !== filters.kategoriId) continue;
                    if (filters.rumahId && t.rumahId !== filters.rumahId) continue;
                    if (filters.jenis && t.jenis !== filters.jenis) continue;
                    if (filters.tanggalDari && t.tanggal < filters.tanggalDari) continue;
                    if (filters.tanggalSampai && t.tanggal > filters.tanggalSampai) continue;
                }
                result.push(t);
            }

            result.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
            const saldo = totalPemasukan - totalPengeluaran;

            return {
                success: true,
                data: result,
                summary: {
                    totalPemasukan: totalPemasukan,
                    totalPemasukanFormatted: 'Rp ' + totalPemasukan.toLocaleString('id-ID'),
                    totalPengeluaran: totalPengeluaran,
                    totalPengeluaranFormatted: 'Rp ' + totalPengeluaran.toLocaleString('id-ID'),
                    saldo: saldo,
                    saldoFormatted: 'Rp ' + saldo.toLocaleString('id-ID')
                }
            };

        } catch (error) {
            console.error('Service_Transaksi.getAll error:', error);
            return { success: false, message: error.message, data: [], summary: { saldo: 0, saldoFormatted: 'Rp 0', totalPemasukanFormatted: 'Rp 0', totalPengeluaranFormatted: 'Rp 0' } };
        }
    },

    getByRumahId(rumahId) {
        try {
            const result = Model_Transaksi.getByRumahId(rumahId);
            result.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
            return { success: true, data: result };
        } catch (error) {
            console.error('Service_Transaksi.getByRumahId error:', error);
            return { success: false, message: error.message, data: [] };
        }
    },

    createPembayaran(data) {
        try {
            const nominal = NumberUtils.toNumber(data.nominal);
            if (nominal <= 0) return { success: false, message: 'Nominal harus lebih dari 0' };

            let namaKategori = 'Iuran RT';
            if (data.kategoriId) {
                const kategoriList = Model_Kategori.getAll(); // Assuming Model_Kategori has getAll or use from Main/Service
                const kategori = kategoriList.find(k => k.kategoriId === data.kategoriId);
                if (kategori) namaKategori = kategori.namaKategori;
            }

            const transaksiId = Model_Transaksi.generateId();
            const now = new Date();
            const tanggalStr = data.tanggal || DateUtils.formatDate(now);

            const rowData = [
                transaksiId, tanggalStr, 'Pemasukan', data.kategoriId || '', namaKategori, nominal,
                data.keterangan || '', data.tagihanId || '', data.rumahId || '', data.userInput || 'admin',
                DateUtils.formatDateTime(now), data.metodePembayaran || "Transfer Bank"
            ];

            const res = Model_Transaksi.create(rowData);

            if (res.success && data.tagihanId) {
                this.recalculateTagihanTerbayar(data.tagihanId, nominal, tanggalStr);
            }

            return { success: true, transaksiId: transaksiId, message: 'Pembayaran berhasil dicatat' };
        } catch (error) {
            console.error('Service_Transaksi.createPembayaran error:', error);
            return { success: false, message: error.message };
        }
    },

    createMultiPembayaran(payments) {
        try {
            if (!Array.isArray(payments) || payments.length === 0) return { success: false, message: 'Data pembayaran tidak valid' };

            let namaKategori = 'Iuran RT';
            if (payments[0].kategoriId) {
                // Assume available in context
            }

            let successCount = 0;
            const errors = [];
            const now = new Date();

            for (let i = 0; i < payments.length; i++) {
                const data = payments[i];
                const nominal = NumberUtils.toNumber(data.nominal);
                if (nominal <= 0) {
                    errors.push('Pembayaran ' + (i + 1) + ': Nominal harus lebih dari 0');
                    continue;
                }

                const transaksiId = Model_Transaksi.generateId();
                const tanggalStr = data.tanggal || DateUtils.formatDate(now);

                const rowData = [
                    transaksiId, tanggalStr, 'Pemasukan', data.kategoriId || '', namaKategori, nominal,
                    data.keterangan || '', data.tagihanId || '', data.rumahId || '', data.userInput || 'admin',
                    DateUtils.formatDateTime(now), data.metodePembayaran || "Transfer Bank"
                ];

                const res = Model_Transaksi.create(rowData);
                if (res.success) {
                    successCount++;
                    if (data.tagihanId) {
                        this.recalculateTagihanTerbayar(data.tagihanId, nominal, tanggalStr);
                    }
                }
            }

            if (successCount === 0) return { success: false, message: errors.join(', ') };
            return { success: true, count: successCount, message: successCount + ' pembayaran berhasil dicatat' };

        } catch (error) {
            console.error('Service_Transaksi.createMultiPembayaran error:', error);
            return { success: false, message: error.message };
        }
    },

    createPengeluaran(data) {
        try {
            const nominal = NumberUtils.toNumber(data.nominal);
            if (nominal <= 0) return { success: false, message: 'Nominal harus lebih dari 0' };

            let namaKategori = '';
            const transaksiId = Model_Transaksi.generateId();
            const now = new Date();

            const rowData = [
                transaksiId, data.tanggal || DateUtils.formatDate(now), 'Pengeluaran', data.kategoriId || '',
                namaKategori, nominal, data.keterangan || '', '', '', data.userInput || 'admin',
                DateUtils.formatDateTime(now), data.metodePembayaran || "Transfer Bank"
            ];

            return Model_Transaksi.create(rowData);
        } catch (error) {
            console.error('Service_Transaksi.createPengeluaran error:', error);
            return { success: false, message: error.message };
        }
    },

    createManual(data) {
        try {
            const jenis = data.jenis || 'Pengeluaran';
            if (jenis !== 'Pemasukan' && jenis !== 'Pengeluaran') return { success: false, message: 'Jenis harus Pemasukan atau Pengeluaran' };

            const nominal = NumberUtils.toNumber(data.nominal);
            if (nominal <= 0) return { success: false, message: 'Nominal harus lebih dari 0' };

            const transaksiId = Model_Transaksi.generateId();
            const now = new Date();
            const rowData = [
                transaksiId, data.tanggal || DateUtils.formatDate(now), jenis, data.kategoriId || '',
                '', nominal, data.keterangan || '', '', '', data.userInput || 'admin',
                DateUtils.formatDateTime(now), data.metodePembayaran || ''
            ];

            const res = Model_Transaksi.create(rowData);
            return { success: true, transaksiId: transaksiId, message: jenis + ' berhasil dicatat' };
        } catch (error) {
            console.error('Service_Transaksi.createManual error:', error);
            return { success: false, message: error.message };
        }
    },

    update(transaksiId, data) {
        try {
            const transaksi = Model_Transaksi.getById(transaksiId);
            if (!transaksi) return { success: false, message: 'Transaksi tidak ditemukan' };

            const oldNominal = transaksi.nominal;
            const oldTagihanId = transaksi.tagihanId;

            if (data.tanggal) Model_Transaksi.update(transaksi.rowIndex, COLUMNS.TRANSAKSI.TANGGAL, data.tanggal);
            if (data.jenis) Model_Transaksi.update(transaksi.rowIndex, COLUMNS.TRANSAKSI.JENIS, data.jenis);

            const nominal = NumberUtils.toNumber(data.nominal);
            Model_Transaksi.update(transaksi.rowIndex, COLUMNS.TRANSAKSI.NOMINAL, nominal);

            if (data.keterangan !== undefined) Model_Transaksi.update(transaksi.rowIndex, COLUMNS.TRANSAKSI.KETERANGAN, data.keterangan || '');
            if (data.metodePembayaran !== undefined) Model_Transaksi.update(transaksi.rowIndex, COLUMNS.TRANSAKSI.METODE_PEMBAYARAN, data.metodePembayaran || '');

            if (oldTagihanId && (oldNominal !== nominal || data.tanggal)) {
                this.recalculateTagihanTerbayar(oldTagihanId);
            }

            return { success: true, message: 'Transaksi berhasil diperbarui' };
        } catch (error) {
            console.error('Service_Transaksi.update error:', error);
            return { success: false, message: error.message };
        }
    },

    delete(transaksiId) {
        try {
            const transaksi = Model_Transaksi.getById(transaksiId);
            if (!transaksi) return { success: false, message: 'Transaksi tidak ditemukan' };

            const oldTagihanId = transaksi.tagihanId;
            Model_Transaksi.deleteRow(transaksi.rowIndex);

            if (oldTagihanId) {
                this.recalculateTagihanTerbayar(oldTagihanId);
            }

            return { success: true, message: 'Transaksi berhasil dihapus' };
        } catch (error) {
            console.error('Service_Transaksi.delete error:', error);
            return { success: false, message: error.message };
        }
    },

    recalculateTagihan(tagihanId) {
        this.recalculateTagihanTerbayar(tagihanId);
        return { success: true };
    },

    getSummaryByMonth(tahun) {
        try {
            const allData = Model_Transaksi.getAll();

            const months = [];
            for (let m = 1; m <= 12; m++) {
                months.push({
                    bulan: m,
                    namaBulan: DateUtils.getMonthName(m),
                    pemasukan: 0,
                    pengeluaran: 0
                });
            }

            for (const t of allData) {
                if (!t.tanggal) continue;
                const d = new Date(t.tanggal);
                if (isNaN(d.getTime())) continue;
                if (d.getFullYear() !== tahun) continue;

                const bulanIdx = d.getMonth();
                if (t.jenis === 'Pemasukan') {
                    months[bulanIdx].pemasukan += t.nominal;
                } else if (t.jenis === 'Pengeluaran') {
                    months[bulanIdx].pengeluaran += t.nominal;
                }
            }

            return { success: true, data: months };
        } catch (error) {
            console.error('Service_Transaksi.getSummaryByMonth error:', error);
            return { success: false, message: error.message };
        }
    },

    // INTERNAL HELPER TO SYNC TAGIHAN
    recalculateTagihanTerbayar(tagihanId, incrementalBayar = null, tanggalBayar = null) {
        if (incrementalBayar) {
            // Fast-path to update tagihan using explicit added amount
            const tagihan = Model_Tagihan.getById(tagihanId);
            if (tagihan) {
                const newTotalTerbayar = tagihan.totalTerbayar + incrementalBayar;
                const sisaTagihan = tagihan.totalTagihan - newTotalTerbayar;

                Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.TOTAL_TERBAYAR, newTotalTerbayar);
                Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.SISA_TAGIHAN, Math.max(0, sisaTagihan));

                if (sisaTagihan <= 0) {
                    Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.STATUS, 'Lunas');
                    Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.TANGGAL_LUNAS, tanggalBayar || DateUtils.formatDate(new Date()));
                }
            }
        } else {
            // Full recalculation loop from transactions
            const transactions = Model_Transaksi.getAll().filter(t => t.tagihanId === tagihanId);
            let totalTerbayar = 0;
            let latestTanggal = '';

            for (const tx of transactions) {
                totalTerbayar += tx.nominal;
                if (tx.tanggal > latestTanggal) latestTanggal = tx.tanggal;
            }

            const tagihan = Model_Tagihan.getById(tagihanId);
            if (tagihan) {
                const sisaTagihan = tagihan.totalTagihan - totalTerbayar;
                Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.TOTAL_TERBAYAR, totalTerbayar);
                Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.SISA_TAGIHAN, Math.max(0, sisaTagihan));

                if (sisaTagihan <= 0) {
                    Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.STATUS, 'Lunas');
                    Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.TANGGAL_LUNAS, latestTanggal || DateUtils.formatDate(new Date()));
                } else {
                    Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.STATUS, 'Belum Lunas');
                    Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.TANGGAL_LUNAS, '');
                }
            }
        }
    }

};
