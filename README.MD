# Hallo kawan!! ini setUp framework pribadi ku

Tujuan pembuatan dari repo ini adalah ribetnya mulai dari awal bikin folder, file, dll di Express — jadi saya research dan nemu cara otomisasi nya dengan Node. Semoga membantu!

---

## Set Up Express

Clone repo ini terlebih dahulu, pastikan kamu berada di direktori yang sama dengan file `setUp.js`, lalu jalankan:

```bash
node setUp.js
```

Setelah dijalankan, kamu akan diminta memilih:

1. **ORM** yang ingin digunakan:

```
🔧 Express Project Setup

Select an ORM:
  1. Prisma
  2. Sequelize
  3. Mongoose

Enter choice (1-3):
```

2. **Docker support** (opsional):

```
Do you want to include a Dockerfile? (y/n):
```

Jika memilih `y`, akan dibuatkan `Dockerfile`, `docker-compose.yml`, dan `.dockerignore`.

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
Dockerfile              ← hanya jika memilih Docker
docker-compose.yml      ← hanya jika memilih Docker
.dockerignore           ← hanya jika memilih Docker
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

---

## Docker Support

Jika kamu memilih untuk menyertakan Docker saat setup, file berikut akan dibuat:

```
Dockerfile
docker-compose.yml
.dockerignore
```

### Database Services via Docker Compose

Docker Compose sudah dikonfigurasi dengan service database sesuai ORM yang dipilih:

| ORM | Service | Port |
|---|---|---|
| **Prisma** | PostgreSQL | 5432 |
| **Sequelize** | PostgreSQL | 5432 |
| **Mongoose** | MongoDB | 27017 |

### Command Docker

```bash
npm run docker         # build Docker image
npm run docker:up      # start containers
npm run docker:down   # stop containers
```

### Manual Docker Commands

```bash
# Build image
docker build -t myapp .

# Run container
docker run -p 5000:5000 myapp

# Start database only
docker compose up -d postgres   # untuk Prisma/Sequelize
docker compose up -d mongodb    # untuk Mongoose

# Stop database
docker compose down
```

> **Catatan:** Sesuaikan `DATABASE_URL` atau `DB_HOST` di `.env` ke `localhost` jika database berjalan di container terpisah, atau ke nama service Docker (`postgres`, `mongodb`) jika keduanya berjalan di docker-compose.