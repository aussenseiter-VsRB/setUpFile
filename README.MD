# Hallo kawan!! ini setUp framework pribadi ku

Tujuan pembuatan dari repo ini adalah ribetnya mulai dari awal bikin folder, file, dll di Express — jadi saya research dan nemu cara otomisasi nya dengan Node. Semoga membantu!

---

## Set Up Express

Clone repo ini terlebih dahulu, pastikan kamu berada di direktori yang sama dengan file `setUp.js`, lalu jalankan:

```bash
node setUp.js
```

Setelah dijalankan, kamu akan diminta memilih ORM yang ingin digunakan:

```
🔧 Express Project Setup

Select an ORM:
  1. Prisma
  2. Sequelize
  3. Mongoose

Enter choice (1-3):
```

---

## Hasil Folder Structure

```
src/
├── config/
│   └── db.js
├── core/
│   ├── middleware/
│   └── utils/
├── features/
├── app.js
└── server.js
tools/
├── createModule.js
└── deleteModule.js
prisma/
└── schema.prisma        ← hanya jika memilih Prisma
.env
.env.example
.gitignore
package.json
setUp.js
```

---

## Command yang Tersedia

### Membuat feature module

```bash
npm run module <namaFile>             # membuat semua file sekaligus
npm run module <namaFile> controller  # hanya membuat controller
npm run module <namaFile> routes      # hanya membuat routes
npm run module <namaFile> model       # hanya membuat model (Sequelize & Mongoose saja)
```

> **Prisma:** tidak ada `model` file yang di-generate karena model didefinisikan langsung di `prisma/schema.prisma`. Setelah scaffold, tambahkan model ke schema lalu jalankan:
> ```bash
> npx prisma migrate dev --name add_<namaFile>
> ```

### Menghapus feature

```bash
npm run delete <namaFile>
```

### Menjalankan server

```bash
npm run dev
```

---

## Catatan per ORM

| ORM | Koneksi DB | Model |
|---|---|---|
| **Prisma** | `DATABASE_URL` di `.env` | Didefinisikan di `schema.prisma` |
| **Sequelize** | `DB_HOST`, `DB_NAME`, `DB_USER`, dll di `.env` | File `.model.js` di dalam feature |
| **Mongoose** | `MONGO_URI` di `.env` | File `.model.js` di dalam feature |

Sesuaikan isi `.env` dengan konfigurasi database kamu sebelum menjalankan server.