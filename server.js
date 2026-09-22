const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 1. KONFIGURASI CLOUDINARY
// ==========================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function uploadToCloudinary(base64Data, folderName) {
    if (!base64Data) return null;
    if (base64Data.startsWith('http')) return base64Data; 
    try {
        const res = await cloudinary.uploader.upload(base64Data, {
            folder: `sipena/${folderName}`,
            resource_type: 'auto' 
        });
        return res.secure_url;
    } catch (err) {
        console.error("Gagal Upload ke Cloudinary:", err);
        return null;
    }
}

// ==========================================
// 2. KONEKSI MONGODB
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sipena";

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("MongoDB Berhasil Terhubung");
    } catch (error) {
        console.error("Gagal konek MongoDB:", error);
    }
};

app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// ==========================================
// 3. SCHEMA MONGODB
// ==========================================
const transform = (doc, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; };

const SystemSchema = new mongoose.Schema({
    tema: { type: String, default: 'default' }, font: { type: String, default: "'Poppins', sans-serif" },
    tahunAjaran: { type: String, default: '2026/2027' }, semester: { type: String, default: 'Ganjil' },
    logo: { type: String, default: '' }, bgLogin: { type: String, default: '' }, teksLogin: { type: String, default: 'tampil' },
    logoLembaga: { type: String, default: '' }, adminEmail: { type: String, default: 'admin@sipena.com' },
    adminPass: { type: String, default: '123' }, adminWA: { type: String, default: '6281234567890' },
    waTemplate: { type: String, default: 'Salam admin SIPENA, saya ingin mendaftarkan akun orang tua dengan data berikut:\nNama Murid: \nNISN: \nKelas: \nNo HP Orang Tua: ' },
    adminAvatar: { type: String, default: '' }, kelas: [String], mapel: [String]
});
SystemSchema.set('toJSON', { transform });
const System = mongoose.models.System || mongoose.model('System', SystemSchema);

const PegawaiSchema = new mongoose.Schema({
    email: String, password: { type: String, default: "123" }, role: { type: String, default: "guru" },
    nama: String, avatar: { type: String, default: "" },
    mengajar: [{ kelas: String, mapel: String }]
});
PegawaiSchema.set('toJSON', { transform });
const Pegawai = mongoose.models.Pegawai || mongoose.model('Pegawai', PegawaiSchema);

const SiswaSchema = new mongoose.Schema({
    nisn: { type: String, unique: true }, nama_siswa: String, jk: String, kelas: String, no_hp_ortu: String, avatar: { type: String, default: "" }
});
SiswaSchema.set('toJSON', { transform });
const Siswa = mongoose.models.Siswa || mongoose.model('Siswa', SiswaSchema);

const NilaiSchema = new mongoose.Schema({
    tahunAjaran: String, semester: String,
    nisn: String, nama_siswa: String, nama_guru: String, mapel: String, kelas: String,
    jenis: String, urutan: String, topik: String, kktp: Number, skor: Number, catatan: String, waktu_pelaksanaan: String,
    lampiran_link: String, lampiran_file: String, status_tuntas: String, tanggal_input: String,
    guru_sudah_baca: { type: Boolean, default: true },
    dilihat_ortu: { type: Boolean, default: false }, waktu_dilihat: String, feedback_ortu: { type: String, default: "" },
    remedial_1: Number, dilihat_ortu_rem1: { type: Boolean, default: false }, waktu_dilihat_rem1: String, feedback_rem1: { type: String, default: "" },
    remedial_2: Number, dilihat_ortu_rem2: { type: Boolean, default: false }, waktu_dilihat_rem2: String, feedback_rem2: { type: String, default: "" },
    remedial_3: Number, dilihat_ortu_rem3: { type: Boolean, default: false }, waktu_dilihat_rem3: String, feedback_rem3: { type: String, default: "" },
    catatan_rem1: String, lampiran_link_rem1: String, lampiran_file_rem1: String,
    catatan_rem2: String, lampiran_link_rem2: String, lampiran_file_rem2: String,
    catatan_rem3: String, lampiran_link_rem3: String, lampiran_file_rem3: String,
});
NilaiSchema.set('toJSON', { transform });
const Nilai = mongoose.models.Nilai || mongoose.model('Nilai', NilaiSchema);

// FITUR BARU: SCHEMA PENGUMUMAN KELAS
const PengumumanSchema = new mongoose.Schema({
    kelas: String, mapel: String, nama_guru: String, email_guru: String,
    isi_pesan: String, lampiran_file: String, nama_file: String, waktu_kirim: String,
    dibaca_oleh: { type: [String], default: [] } // Array NISN yang sudah baca
});
PengumumanSchema.set('toJSON', { transform });
const Pengumuman = mongoose.models.Pengumuman || mongoose.model('Pengumuman', PengumumanSchema);

const initDB = async () => {
    try {
        let sys = await System.findOne();
        if (!sys) {
            await System.create({
                kelas: ["7.1", "7.2", "7.3", "8.1", "8.2", "9.1"],
                mapel: ["Akidah Akhlak", "Alquran Hadis", "Bahasa Arab", "Bahasa Indonesia", "Bahasa Inggris", "Fikih", "Informatika", "IPA", "IPS", "Matematika", "Pendidikan Pancasila", "PJOK", "Seni Budaya"]
            });
        }
        let guru = await Pegawai.findOne();
        if (!guru) {
            await Pegawai.create({ email: "guru@sipena.com", password: "123", role: "guru", nama: "Bapak Ahmad", mengajar: [{ kelas: "7.1", mapel: "Matematika" }, { kelas: "7.2", mapel: "Matematika" }, { kelas: "7.1", mapel: "Informatika" }] });
        }
        let siswa = await Siswa.findOne();
        if (!siswa) {
            await Siswa.insertMany([
                { nisn: "111222", nama_siswa: "Agus Pratama", jk: "Laki-laki", kelas: "7.1", no_hp_ortu: "08112233" },
                { nisn: "333444", nama_siswa: "Siti Aisyah", jk: "Perempuan", kelas: "7.2", no_hp_ortu: "08998877" }
            ]);
        }
    } catch (err) { console.log("DB Init:", err.message); }
};

// ==========================================
// 4. API ROUTES
// ==========================================
app.get('/api/system', async (req, res) => {
    await initDB(); const sys = await System.findOne(); res.json({ success: true, data: sys });
});
app.put('/api/system', async (req, res) => {
    const dataUpdate = { ...req.body };
    if(dataUpdate.logo && dataUpdate.logo.startsWith('data:')) dataUpdate.logo = await uploadToCloudinary(dataUpdate.logo, 'branding');
    if(dataUpdate.bgLogin && dataUpdate.bgLogin.startsWith('data:')) dataUpdate.bgLogin = await uploadToCloudinary(dataUpdate.bgLogin, 'branding');
    if(dataUpdate.logoLembaga && dataUpdate.logoLembaga.startsWith('data:')) dataUpdate.logoLembaga = await uploadToCloudinary(dataUpdate.logoLembaga, 'branding');
    await System.findOneAndUpdate({}, dataUpdate, { upsert: true, new: true }); res.json({ success: true, message: "Pengaturan Sistem Berhasil Diperbarui!" });
});
app.post('/api/login-pegawai', async (req, res) => {
    const { email, password } = req.body; await initDB(); const sys = await System.findOne();
    if (sys && email === sys.adminEmail && password === sys.adminPass) return res.json({ success: true, data: { role: 'admin', nama: 'Super Admin SIPENA', email: sys.adminEmail, avatar: sys.adminAvatar }});
    const user = await Pegawai.findOne({ email, password, role: 'guru' });
    if (user) res.json({ success: true, data: user }); else res.json({ success: false, message: "Email atau Password Salah!" });
});
app.post('/api/login-ortu', async (req, res) => {
    const { nisn, no_hp } = req.body; const siswa = await Siswa.findOne({ nisn, no_hp_ortu: no_hp }).lean();
    if (siswa) res.json({ success: true, data: { ...siswa, role: "ortu", id: siswa._id } }); else res.json({ success: false, message: "NISN atau No HP Orangtua Salah!" });
});
app.put('/api/user/avatar', async (req, res) => {
    const { role, identifier, avatar } = req.body; const avatarUrl = await uploadToCloudinary(avatar, 'avatars'); 
    if (role === 'admin') { await System.findOneAndUpdate({}, { adminAvatar: avatarUrl }); res.json({ success: true }); } 
    else if (role === 'guru') { const up = await Pegawai.findOneAndUpdate({ email: identifier }, { avatar: avatarUrl }); res.json({ success: !!up }); } 
    else if (role === 'ortu') { const up = await Siswa.findOneAndUpdate({ nisn: identifier }, { avatar: avatarUrl }); res.json({ success: !!up }); } 
    else { res.json({ success: false }); }
});
app.get('/api/guru', async (req, res) => { const gurus = await Pegawai.find({ role: 'guru' }); res.json({ success: true, data: gurus }); });
app.post('/api/guru', async (req, res) => { await Pegawai.create({ ...req.body, role: "guru", avatar: "" }); res.json({ success: true, message: "Guru berhasil ditambahkan!" }); });
app.post('/api/import-guru', async (req, res) => {
    const dataArray = req.body;
    for (let row of dataArray) {
        if(!row.nama || !row.email || !row.kelas || !row.mapel) continue;
        let guruExist = await Pegawai.findOne({ email: row.email, role: 'guru' });
        if(guruExist) { const cekDuplikat = guruExist.mengajar.find(m => m.kelas == row.kelas && m.mapel == row.mapel); if(!cekDuplikat) { guruExist.mengajar.push({ kelas: String(row.kelas), mapel: String(row.mapel) }); await guruExist.save(); } } 
        else { await Pegawai.create({ nama: row.nama, email: row.email, password: String(row.password || "123"), role: "guru", avatar: "", mengajar: [{ kelas: String(row.kelas), mapel: String(row.mapel) }] }); }
    } res.json({ success: true, message: "Data guru berhasil diimport!" });
});
app.put('/api/guru/:id', async (req, res) => { const up = await Pegawai.findByIdAndUpdate(req.params.id, req.body); if (up) res.json({ success: true, message: "Data Guru diupdate!" }); else res.json({ success: false, message: "Guru tidak ditemukan" }); });
app.delete('/api/guru/:id', async (req, res) => { await Pegawai.findByIdAndDelete(req.params.id); res.json({ success: true, message: "Data Guru dihapus!" }); });
app.get('/api/siswa', async (req, res) => { const siswas = await Siswa.find(); res.json({ success: true, data: siswas }); });
app.post('/api/siswa', async (req, res) => { await Siswa.create({...req.body, avatar: ""}); res.json({ success: true, message: "Murid ditambahkan!" }); });
app.post('/api/import-siswa', async (req, res) => {
    const importData = req.body.map(s => ({...s, avatar: ""})); try { await Siswa.insertMany(importData, { ordered: false }); } catch(e) {} res.json({ success: true, message: "Data murid diimport!" });
});
app.put('/api/siswa/:nisn', async (req, res) => { const up = await Siswa.findOneAndUpdate({ nisn: req.params.nisn }, req.body); if (up) res.json({ success: true, message: "Data Murid diupdate!" }); else res.json({ success: false, message: "Murid tidak ditemukan" }); });
app.delete('/api/siswa/:nisn', async (req, res) => { await Siswa.findOneAndDelete({ nisn: req.params.nisn }); await Nilai.deleteMany({ nisn: req.params.nisn }); res.json({ success: true, message: "Data Murid dihapus permanen!" }); });

// API PENGUMUMAN
app.get('/api/pengumuman', async (req, res) => {
    const p = await Pengumuman.find().sort({ _id: -1 }); // Sorting dari terbaru
    res.json({ success: true, data: p });
});
app.post('/api/pengumuman', async (req, res) => {
    const { kelas, mapel, nama_guru, email_guru, isi_pesan, lampiran_file, nama_file, waktu_kirim } = req.body;
    let urlLampiran = null;
    if (lampiran_file && lampiran_file.startsWith('data:')) {
        urlLampiran = await uploadToCloudinary(lampiran_file, 'pengumuman');
    }
    await Pengumuman.create({ kelas, mapel, nama_guru, email_guru, isi_pesan, lampiran_file: urlLampiran, nama_file, waktu_kirim });
    res.json({ success: true, message: "Pengumuman berhasil dikirim!" });
});
app.delete('/api/pengumuman/:id', async (req, res) => {
    await Pengumuman.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Pengumuman dihapus!" });
});
app.put('/api/pengumuman/baca', async (req, res) => {
    const { nisn, id_pengumuman } = req.body; 
    await Pengumuman.updateMany(
        { _id: { $in: id_pengumuman }, dibaca_oleh: { $ne: nisn } },
        { $push: { dibaca_oleh: nisn } }
    );
    res.json({ success: true });
});

app.post('/api/input-nilai-bulk', async (req, res) => {
    const dataArray = req.body; const sys = await System.findOne(); const payload = [];
    for (let item of dataArray) {
        let urlLampiran = null; if (item.lampiran_file && item.lampiran_file.startsWith('data:')) { urlLampiran = await uploadToCloudinary(item.lampiran_file, 'lampiran_tugas'); }
        const dataBaru = { tanggal_input: new Date().toLocaleDateString('id-ID'), tahunAjaran: sys.tahunAjaran, semester: sys.semester, guru_sudah_baca: true, dilihat_ortu: false, waktu_dilihat: null, feedback_ortu: "", dilihat_ortu_rem1: false, dilihat_ortu_rem2: false, dilihat_ortu_rem3: false, ...item, lampiran_file: urlLampiran };
        if (dataBaru.kktp) dataBaru.status_tuntas = Number(dataBaru.skor) >= Number(dataBaru.kktp) ? "TUNTAS" : "TIDAK TUNTAS"; payload.push(dataBaru);
    }
    await Nilai.insertMany(payload); res.json({ success: true, message: `Berhasil menyimpan ${dataArray.length} data nilai!` });
});
app.get('/api/nilai', async (req, res) => { const nilais = await Nilai.find(); res.json({ success: true, data: nilais }); });
app.get('/api/nilai/:nisn', async (req, res) => { const nilais = await Nilai.find({ nisn: req.params.nisn }); res.json({ success: true, data: nilais }); });

app.put('/api/nilai/bulk-edit-meta', async (req, res) => {
    const { tahunAjaran, semester, kelas, mapel, jenis, urutan, topik, kktp, waktu_pelaksanaan } = req.body;
    try {
        const records = await Nilai.find({ tahunAjaran, semester, kelas, mapel, jenis, urutan });
        for (let n of records) {
            n.topik = topik; n.kktp = Number(kktp); n.waktu_pelaksanaan = waktu_pelaksanaan;
            let skorTertinggi = n.remedial_3 !== null && n.remedial_3 !== undefined ? n.remedial_3 : (n.remedial_2 !== null && n.remedial_2 !== undefined ? n.remedial_2 : (n.remedial_1 !== null && n.remedial_1 !== undefined ? n.remedial_1 : n.skor));
            n.status_tuntas = skorTertinggi >= n.kktp ? "TUNTAS" : "TIDAK TUNTAS"; await n.save();
        }
        res.json({ success: true, message: "Pengaturan kolom nilai berhasil diperbarui untuk semua murid!" });
    } catch (err) { res.json({ success: false, message: err.message }); }
});

app.delete('/api/nilai/bulk-delete-column', async (req, res) => {
    const { tahunAjaran, semester, kelas, mapel, jenis, urutan } = req.body;
    try { await Nilai.deleteMany({ tahunAjaran, semester, kelas, mapel, jenis, urutan }); res.json({ success: true, message: "Seluruh data murid pada kolom penilaian tersebut berhasil dihapus!" }); } catch (err) { res.json({ success: false, message: err.message }); }
});

app.put('/api/nilai/:id/edit', async (req, res) => {
    const b = req.body; let n = await Nilai.findById(req.params.id); if(!n) return res.json({ success: false, message: "Data tidak ditemukan!" });
    if (b.skor !== undefined && n.skor !== Number(b.skor)) { n.skor = Number(b.skor); n.dilihat_ortu = false; }
    if (b.catatan !== undefined) n.catatan = b.catatan; if (b.lampiran_link !== undefined) n.lampiran_link = b.lampiran_link;
    if (b.lampiran_file !== undefined) { if (b.lampiran_file && b.lampiran_file.startsWith('data:')) n.lampiran_file = await uploadToCloudinary(b.lampiran_file, 'lampiran_tugas'); else if (b.lampiran_file === "") n.lampiran_file = null; }
    if (b.remedial_1 !== undefined) { let val = (b.remedial_1 === "" || b.remedial_1 === null) ? null : Number(b.remedial_1); if (n.remedial_1 !== val) { n.remedial_1 = val; n.dilihat_ortu_rem1 = false; } }
    if (b.catatan_rem1 !== undefined) n.catatan_rem1 = b.catatan_rem1; if (b.lampiran_link_rem1 !== undefined) n.lampiran_link_rem1 = b.lampiran_link_rem1;
    if (b.lampiran_file_rem1 !== undefined) { if (b.lampiran_file_rem1 && b.lampiran_file_rem1.startsWith('data:')) n.lampiran_file_rem1 = await uploadToCloudinary(b.lampiran_file_rem1, 'lampiran_tugas'); else if (b.lampiran_file_rem1 === "") n.lampiran_file_rem1 = null; }
    if (b.remedial_2 !== undefined) { let val = (b.remedial_2 === "" || b.remedial_2 === null) ? null : Number(b.remedial_2); if (n.remedial_2 !== val) { n.remedial_2 = val; n.dilihat_ortu_rem2 = false; } }
    if (b.catatan_rem2 !== undefined) n.catatan_rem2 = b.catatan_rem2; if (b.lampiran_link_rem2 !== undefined) n.lampiran_link_rem2 = b.lampiran_link_rem2;
    if (b.lampiran_file_rem2 !== undefined) { if (b.lampiran_file_rem2 && b.lampiran_file_rem2.startsWith('data:')) n.lampiran_file_rem2 = await uploadToCloudinary(b.lampiran_file_rem2, 'lampiran_tugas'); else if (b.lampiran_file_rem2 === "") n.lampiran_file_rem2 = null; }
    if (b.remedial_3 !== undefined) { let val = (b.remedial_3 === "" || b.remedial_3 === null) ? null : Number(b.remedial_3); if (n.remedial_3 !== val) { n.remedial_3 = val; n.dilihat_ortu_rem3 = false; } }
    if (b.catatan_rem3 !== undefined) n.catatan_rem3 = b.catatan_rem3; if (b.lampiran_link_rem3 !== undefined) n.lampiran_link_rem3 = b.lampiran_link_rem3;
    if (b.lampiran_file_rem3 !== undefined) { if (b.lampiran_file_rem3 && b.lampiran_file_rem3.startsWith('data:')) n.lampiran_file_rem3 = await uploadToCloudinary(b.lampiran_file_rem3, 'lampiran_tugas'); else if (b.lampiran_file_rem3 === "") n.lampiran_file_rem3 = null; }
    if (b.kktp) n.kktp = Number(b.kktp);
    if (n.kktp) { let skorTertinggi = n.remedial_3 !== null && n.remedial_3 !== undefined ? n.remedial_3 : (n.remedial_2 !== null && n.remedial_2 !== undefined ? n.remedial_2 : (n.remedial_1 !== null && n.remedial_1 !== undefined ? n.remedial_1 : n.skor)); n.status_tuntas = skorTertinggi >= n.kktp ? "TUNTAS" : "TIDAK TUNTAS"; }
    await n.save(); res.json({ success: true, message: "Data Nilai berhasil diperbarui!" });
});
app.delete('/api/nilai/:id', async (req, res) => { await Nilai.findByIdAndDelete(req.params.id); res.json({ success: true, message: "Data Nilai berhasil dihapus!" }); });
app.put('/api/nilai/:id/feedback', async (req, res) => {
    let n = await Nilai.findById(req.params.id); if(!n) return res.json({ success: false, message: "Data tidak ditemukan!" });
    const tahap = req.body.tahap || 'utama'; const hariArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']; const now = new Date();
    const timestamp = `${hariArr[now.getDay()]}, ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}, pukul ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;
    if (tahap === 'rem3') { n.dilihat_ortu_rem3 = true; n.feedback_rem3 = req.body.feedback; n.waktu_dilihat_rem3 = timestamp; } else if (tahap === 'rem2') { n.dilihat_ortu_rem2 = true; n.feedback_rem2 = req.body.feedback; n.waktu_dilihat_rem2 = timestamp; } else if (tahap === 'rem1') { n.dilihat_ortu_rem1 = true; n.feedback_rem1 = req.body.feedback; n.waktu_dilihat_rem1 = timestamp; } else { n.dilihat_ortu = true; n.feedback_ortu = req.body.feedback; n.waktu_dilihat = timestamp; }
    n.guru_sudah_baca = false; await n.save(); res.json({ success: true, message: "Feedback terkirim!" });
});
app.put('/api/guru/baca-notif', async (req, res) => { await Nilai.updateMany({ guru_sudah_baca: false }, { guru_sudah_baca: true }); res.json({ success: true }); });

module.exports = app;