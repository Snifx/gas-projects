/**
 * Service_Tagihan.js
 * Business logic for Tagihan Bulanan and Tunggakan
 * Version: 2.0
 * Last Updated: 2026-03-10
 */

const Service_Tagihan = {

    getByRumahId(rumahId, tahun, namaJalan, nomorRumah) {
        try {
            let result = Model_Tagihan.getByRumahId(rumahId, tahun);

            // Fallback
            if (result.length === 0 && namaJalan && nomorRumah) {
                const tagihanList = Model_Tagihan.getAll();
                result = tagihanList.filter(t =>
                    t.namaJalan.toLowerCase() === String(namaJalan).toLowerCase() &&
                    String(t.nomorRumah) === String(nomorRumah) &&
                    (!tahun || t.tahun == tahun)
                );
            }

            // Sort by bulan (month order: Januari -> Desember)
            const monthOrder = {
                'Januari': 1, 'Februari': 2, 'Maret': 3, 'April': 4,
                'Mei': 5, 'Juni': 6, 'Juli': 7, 'Agustus': 8,
                'September': 9, 'Oktober': 10, 'November': 11, 'Desember': 12
            };

            result.sort((a, b) => {
                const monthA = monthOrder[a.bulan] || 0;
                const monthB = monthOrder[b.bulan] || 0;
                return monthA - monthB;
            });

            return { success: true, data: result };
        } catch (error) {
            console.error('Service_Tagihan.getByRumahId error:', error);
            return { success: false, message: error.message, data: [] };
        }
    },

    generateTahunan(rumahId, tahun) {
        try {
            const rumah = Model_Rumah.getById(rumahId);
            if (!rumah) return { success: false, message: 'Rumah tidak ditemukan' };

            const iuranResult = Service_Iuran.getIuranForRumah(rumahId);
            if (!iuranResult || iuranResult.length === 0) return { success: false, message: 'Gagal mendapatkan data iuran komponen' };

            let totalIuran = iuranResult.reduce((sum, i) => sum + i.total, 0);
            if (totalIuran <= 0) return { success: false, message: 'Total iuran harus lebih dari 0. Pastikan komponen iuran sudah ditambahkan.' };

            const existing = this.getByRumahId(rumahId, tahun);
            const existingIuran = existing.data.filter(t => t.tipe === 'Iuran');

            if (existingIuran.length >= 12) {
                return { success: false, message: 'Tagihan tahun ' + tahun + ' sudah lengkap (' + existingIuran.length + ' record)' };
            }

            const bulanList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const existingPeriodes = existingIuran.map(t => t.periode);
            let generatedCount = 0;
            const now = new Date();

            for (let m = 0; m < 12; m++) {
                const bulan = bulanList[m];
                const periode = tahun + '-' + String(m + 1).padStart(2, '0');
                if (existingPeriodes.includes(periode)) continue;

                const tagihanId = Model_Tagihan.generateId();
                const namaTagihan = 'Iuran RT - ' + rumah.namaJalan + ' ' + rumah.nomorRumah + ' - ' + bulan + ' ' + tahun;

                const rowData = [
                    tagihanId, rumahId, rumah.namaJalan, rumah.nomorRumah, 'Iuran', periode, bulan, tahun,
                    namaTagihan, totalIuran, 0, totalIuran, 'Belum Lunas', '', '', DateUtils.formatDateTime(now)
                ];

                const res = Model_Tagihan.create(rowData);
                if (res.success) generatedCount++;
            }

            return { success: true, message: 'Berhasil generate ' + generatedCount + ' tagihan untuk tahun ' + tahun, count: generatedCount };
        } catch (error) {
            console.error('Service_Tagihan.generateTahunan error:', error);
            return { success: false, message: error.message };
        }
    },

    importTunggakan(rumahId, nominalTunggakan, keterangan) {
        try {
            const rumah = Model_Rumah.getById(rumahId);
            if (!rumah) return { success: false, message: 'Rumah tidak ditemukan' };

            const nominal = NumberUtils.toNumber(nominalTunggakan);
            if (nominal <= 0) return { success: false, message: 'Nominal tunggakan harus lebih dari 0' };

            const tagihanId = Model_Tagihan.generateId();
            const now = new Date();
            const namaTagihan = 'Tunggakan Sebelumnya - ' + rumah.namaJalan + ' ' + rumah.nomorRumah;

            const rowData = [
                tagihanId, rumahId, rumah.namaJalan, rumah.nomorRumah, 'Tunggakan', 'TUNGGAKAN', 'Tunggakan',
                now.getFullYear(), namaTagihan, nominal, 0, nominal, 'Belum Lunas', '', keterangan || 'Import tunggakan dari data existing', DateUtils.formatDateTime(now)
            ];

            Model_Tagihan.create(rowData);

            // Reset tunggakan in Rumah
            Model_Rumah.update(rumahId, { tunggakanIuran: 0 });

            return { success: true, tagihanId: tagihanId, message: 'Tunggakan berhasil diimport' };
        } catch (error) {
            console.error('Service_Tagihan.importTunggakan error:', error);
            return { success: false, message: error.message };
        }
    },

    updateKeterangan(tagihanId, keterangan) {
        try {
            const tagihan = Model_Tagihan.getById(tagihanId);
            if (!tagihan) return { success: false, message: 'Tagihan tidak ditemukan' };

            return Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.KETERANGAN, keterangan || '');
        } catch (error) {
            console.error('Service_Tagihan.updateKeterangan error:', error);
            return { success: false, message: error.message };
        }
    },

    updateTunggakanData(tagihanId, updateData) {
        try {
            const tagihan = Model_Tagihan.getById(tagihanId);
            if (!tagihan) return { success: false, message: 'Tagihan tidak ditemukan' };

            if (tagihan.tipe !== 'Tunggakan') {
                return { success: false, message: 'Hanya tunggakan sebelumnya yang bisa diedit nominal-nya' };
            }

            const terbayar = tagihan.totalTerbayar;

            if (updateData.namaTagihan !== undefined) {
                Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.NAMA_TAGIHAN, updateData.namaTagihan);
            }

            if (updateData.nominal !== undefined) {
                const newNominal = NumberUtils.toNumber(updateData.nominal);
                if (newNominal < terbayar) {
                    return { success: false, message: 'Nominal tidak boleh lebih kecil dari jumlah yang sudah dibayar (Rp ' + terbayar.toLocaleString('id-ID') + ')' };
                }
                const newSisa = newNominal - terbayar;
                Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.TOTAL_TAGIHAN, newNominal);
                Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.SISA_TAGIHAN, newSisa);

                if (newSisa <= 0) {
                    Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.STATUS, 'Lunas');
                } else {
                    Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.STATUS, 'Belum Lunas');
                    Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.TANGGAL_LUNAS, '');
                }
            }

            if (updateData.keterangan !== undefined) {
                Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.KETERANGAN, updateData.keterangan);
            }

            return { success: true, message: 'Tunggakan berhasil diupdate' };
        } catch (error) {
            console.error('Service_Tagihan.updateTunggakanData error:', error);
            return { success: false, message: error.message };
        }
    },

    deleteTunggakan(tagihanId) {
        try {
            const tagihan = Model_Tagihan.getById(tagihanId);
            if (!tagihan) return { success: false, message: 'Tagihan tidak ditemukan' };
            if (tagihan.tipe !== 'Tunggakan') return { success: false, message: 'Hanya tunggakan sebelumnya yang bisa dihapus dari sini' };
            if (tagihan.totalTerbayar > 0) return { success: false, message: 'Tidak bisa menghapus tunggakan yang sudah ada pembayaran. Hapus dulu pembayarannya di Kas RT.' };

            return Model_Tagihan.deleteRow(tagihan.rowIndex);
        } catch (error) {
            console.error('Service_Tagihan.deleteTunggakan error:', error);
            return { success: false, message: error.message };
        }
    },

    getAllRumahTunggakanMap() {
        try {
            const tagihanList = Model_Tagihan.getAll();
            const tunggakanMap = {};

            for (const tagihan of tagihanList) {
                if (tagihan.tipe.toLowerCase() === 'tunggakan' && tagihan.status.toLowerCase() !== 'lunas') {
                    if (!tunggakanMap[tagihan.rumahId]) tunggakanMap[tagihan.rumahId] = 0;
                    tunggakanMap[tagihan.rumahId] += tagihan.sisaTagihan;
                }
            }
            return { success: true, data: tunggakanMap };

        } catch (error) {
            console.error('Service_Tagihan.getAllRumahTunggakanMap error:', error);
            return { success: false, message: error.message, data: {} };
        }
    },

    deleteTagihan(tagihanId) {
        try {
            const tagihan = Model_Tagihan.getById(tagihanId);
            if (!tagihan) return { success: false, message: 'Tagihan tidak ditemukan' };
            return Model_Tagihan.deleteRow(tagihan.rowIndex);
        } catch (error) {
            console.error('Service_Tagihan.deleteTagihan error:', error);
            return { success: false, message: error.message };
        }
    },

    deleteAllByRumahTahun(rumahId, tahun) {
        try {
            const tagihanList = Model_Tagihan.getAll().filter(t =>
                t.rumahId === rumahId && t.tahun == tahun
            );

            // Delete in reverse order to preserve row indices
            tagihanList.sort((a, b) => b.rowIndex - a.rowIndex);
            let deletedCount = 0;
            for (const t of tagihanList) {
                const res = Model_Tagihan.deleteRow(t.rowIndex);
                if (res.success) deletedCount++;
            }

            return { success: true, message: deletedCount + ' tagihan berhasil dihapus', count: deletedCount };
        } catch (error) {
            console.error('Service_Tagihan.deleteAllByRumahTahun error:', error);
            return { success: false, message: error.message };
        }
    },

    recalculateAllTerbayar() {
        try {
            const allTagihan = Model_Tagihan.getAll();
            const allTransaksi = Model_Transaksi.getAll();

            let updatedCount = 0;
            for (const tagihan of allTagihan) {
                const transactions = allTransaksi.filter(t => t.tagihanId === tagihan.tagihanId);
                let totalTerbayar = 0;
                let latestTanggal = '';

                for (const tx of transactions) {
                    totalTerbayar += tx.nominal;
                    if (tx.tanggal > latestTanggal) latestTanggal = tx.tanggal;
                }

                const sisaTagihan = tagihan.totalTagihan - totalTerbayar;
                Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.TOTAL_TERBAYAR, totalTerbayar);
                Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.SISA_TAGIHAN, Math.max(0, sisaTagihan));

                if (sisaTagihan <= 0) {
                    Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.STATUS, 'Lunas');
                    if (!tagihan.tanggalLunas && latestTanggal) {
                        Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.TANGGAL_LUNAS, latestTanggal);
                    }
                } else {
                    Model_Tagihan.update(tagihan.rowIndex, COLUMNS.TAGIHAN.STATUS, 'Belum Lunas');
                }
                updatedCount++;
            }

            return { success: true, message: updatedCount + ' tagihan berhasil direcalculate', count: updatedCount };
        } catch (error) {
            console.error('Service_Tagihan.recalculateAllTerbayar error:', error);
            return { success: false, message: error.message };
        }
    }

};
