import fs from "fs"
import path from "path"
import { execSync } from "child_process"
import readline from "readline"

const projectDir = process.cwd()
const srcDir = path.join(projectDir, "src")
const toolsDir = path.join(projectDir, "tools")

const run = (cmd) => {
  console.log(`  → ${cmd}`)
  execSync(cmd, { cwd: projectDir, stdio: "inherit" })
}

const writeIfMissing = (filePath, content) => {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
    console.log(`  Created: ${path.relative(projectDir, filePath)}`)
  }
}

const ask = (rl, question) =>
  new Promise((resolve) => rl.question(question, resolve))

// ─── ORM definitions ────────────────────────────────────────────────────────

const ORMS = { 1: "Prisma", 2: "Sequelize", 3: "Mongoose" }

const ormPackages = {
  Prisma:    "prisma @prisma/client",
  Sequelize: "sequelize",
  Mongoose:  "mongoose",
}

const ormEnvAdditions = {
  Prisma:    `DATABASE_URL="postgresql://user:password@localhost:5432/mydb"`,
  Sequelize: `DB_HOST=localhost\nDB_PORT=5432\nDB_NAME=mydb\nDB_USER=user\nDB_PASS=password\nDB_DIALECT=postgres`,
  Mongoose:  `MONGO_URI=mongodb://localhost:27017/mydb`,
}

const dockerComposeServices = {
  Prisma:    "postgres",
  Sequelize: "postgres",
  Mongoose:  "mongodb",
}

const dockerComposeYml = {
  postgres:
`version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`,
  mongodb:
`version: "3.8"

services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
`,
}

const dockerfileContent = (orm) => `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY .env.example .env

EXPOSE 5000

CMD ["npm", "run", "dev"]
`

const ormDbFile = {
  Prisma:
`import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
export default prisma
`,
  Sequelize:
`import Sequelize from "sequelize"
import dotenv from "dotenv"
dotenv.config()

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT || "postgres",
    logging: false,
  }
)

export const connectDB = async () => {
  await sequelize.authenticate()
  await sequelize.sync({ alter: true })
  console.log("Database connected (Sequelize)")
}

export default sequelize
`,
  Mongoose:
`import mongoose from "mongoose"

export const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI)
  console.log("MongoDB connected")
}

export default mongoose
`,
}

const ormAppJs = {
  Prisma:
`import express from "express"

const app = express()
app.use(express.json())

app.get("/", (req, res) => res.json({ message: "Server is running" }))

export default app
`,
  Sequelize:
`import express from "express"
import { connectDB } from "./config/db.js"

const app = express()
app.use(express.json())

connectDB()

app.get("/", (req, res) => res.json({ message: "Server is running" }))

export default app
`,
  Mongoose:
`import express from "express"
import { connectDB } from "./config/db.js"

const app = express()
app.use(express.json())

connectDB()

app.get("/", (req, res) => res.json({ message: "Server is running" }))

export default app
`,
}

// ─── Service Layer Templates ───────────────────────────────────────────────────

const serviceContent = {
  Prisma: (cap, name) =>
`import prisma from "../../config/db.js"

export const getAll${cap} = async () => {
  return await prisma.${name}.findMany()
}

export const get${cap}ById = async (id) => {
  return await prisma.${name}.findUnique({ where: { id: Number(id) } })
}

export const create${cap} = async (data) => {
  return await prisma.${name}.create({ data })
}

export const update${cap} = async (id, data) => {
  return await prisma.${name}.update({
    where: { id: Number(id) },
    data,
  })
}

export const delete${cap} = async (id) => {
  return await prisma.${name}.delete({ where: { id: Number(id) } })
}
`,

  Sequelize: (cap, name) =>
`import ${cap} from "./${name}.model.js"

export const getAll${cap} = async () => {
  return await ${cap}.findAll()
}

export const get${cap}ById = async (id) => {
  return await ${cap}.findByPk(id)
}

export const create${cap} = async (data) => {
  return await ${cap}.create(data)
}

export const update${cap} = async (id, data) => {
  const [updated] = await ${cap}.update(data, { where: { id } })
  if (!updated) return null
  return await ${cap}.findByPk(id)
}

export const delete${cap} = async (id) => {
  const deleted = await ${cap}.destroy({ where: { id } })
  return deleted > 0
}
`,

  Mongoose: (cap, name) =>
`import ${cap} from "./${name}.model.js"

export const getAll${cap} = async () => {
  return await ${cap}.find()
}

export const get${cap}ById = async (id) => {
  return await ${cap}.findById(id)
}

export const create${cap} = async (data) => {
  return await ${cap}.create(data)
}

export const update${cap} = async (id, data) => {
  return await ${cap}.findByIdAndUpdate(id, data, { new: true, runValidators: true })
}

export const delete${cap} = async (id) => {
  return await ${cap}.findByIdAndDelete(id)
}
`,
}

// ─── Controller Templates ─────────────────────────────────────────────────────

const controllerContent = {
  Prisma: (cap, name) =>
`import * as ${name}Service from "./${name}.service.js"

export const getAll${cap} = async (req, res) => {
  try {
    const items = await ${name}Service.getAll${cap}()
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const get${cap}ById = async (req, res) => {
  try {
    const item = await ${name}Service.get${cap}ById(req.params.id)
    if (!item) return res.status(404).json({ error: "${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const create${cap} = async (req, res) => {
  try {
    const item = await ${name}Service.create${cap}(req.body)
    res.status(201).json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const update${cap} = async (req, res) => {
  try {
    const item = await ${name}Service.update${cap}(req.params.id, req.body)
    res.json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const delete${cap} = async (req, res) => {
  try {
    await ${name}Service.delete${cap}(req.params.id)
    res.status(204).send()
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}
`,

  Sequelize: (cap, name) =>
`import * as ${name}Service from "./${name}.service.js"

export const getAll${cap} = async (req, res) => {
  try {
    const items = await ${name}Service.getAll${cap}()
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const get${cap}ById = async (req, res) => {
  try {
    const item = await ${name}Service.get${cap}ById(req.params.id)
    if (!item) return res.status(404).json({ error: "${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const create${cap} = async (req, res) => {
  try {
    const item = await ${name}Service.create${cap}(req.body)
    res.status(201).json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const update${cap} = async (req, res) => {
  try {
    const item = await ${name}Service.update${cap}(req.params.id, req.body)
    if (!item) return res.status(404).json({ error: "${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const delete${cap} = async (req, res) => {
  try {
    const deleted = await ${name}Service.delete${cap}(req.params.id)
    if (!deleted) return res.status(404).json({ error: "${cap} not found" })
    res.status(204).send()
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}
`,

  Mongoose: (cap, name) =>
`import * as ${name}Service from "./${name}.service.js"

export const getAll${cap} = async (req, res) => {
  try {
    const items = await ${name}Service.getAll${cap}()
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const get${cap}ById = async (req, res) => {
  try {
    const item = await ${name}Service.get${cap}ById(req.params.id)
    if (!item) return res.status(404).json({ error: "${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const create${cap} = async (req, res) => {
  try {
    const item = await ${name}Service.create${cap}(req.body)
    res.status(201).json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const update${cap} = async (req, res) => {
  try {
    const item = await ${name}Service.update${cap}(req.params.id, req.body)
    if (!item) return res.status(404).json({ error: "${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const delete${cap} = async (req, res) => {
  try {
    const item = await ${name}Service.delete${cap}(req.params.id)
    if (!item) return res.status(404).json({ error: "${cap} not found" })
    res.status(204).send()
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}
`,
}

// ─── Route Template ───────────────────────────────────────────────────────────

const routeContent = (cap, name) =>
`import express from "express"
import {
  getAll${cap},
  get${cap}ById,
  create${cap},
  update${cap},
  delete${cap},
} from "./${name}.controller.js"

const router = express.Router()
router.get("/", getAll${cap})
router.get("/:id", get${cap}ById)
router.post("/", create${cap})
router.put("/:id", update${cap})
router.delete("/:id", delete${cap})
export default router
`

// ─── Model Templates ──────────────────────────────────────────────────────────

const modelContent = {
  Sequelize: (cap) =>
`import { DataTypes } from "sequelize"
import sequelize from "../../config/db.js"

const ${cap} = sequelize.define("${cap}", {
  // name: { type: DataTypes.STRING, allowNull: false },
}, { timestamps: true })

export default ${cap}
`,

  Mongoose: (cap) =>
`import mongoose from "mongoose"

const ${cap.toLowerCase()}Schema = new mongoose.Schema(
  {
    // name: { type: String, required: true },
  },
  { timestamps: true }
)

const ${cap} = mongoose.model("${cap}", ${cap.toLowerCase()}Schema)
export default ${cap}
`,
}

// ─── createModule.js source per ORM ─────────────────────────────────────────
// These are plain strings written verbatim to tools/createModule.js.
// They use template literals internally but are stored here as regular strings
// with all $ signs escaped so they survive being written to disk unchanged.

const createModuleFile = {

  Prisma:
`import fs from "fs"
import path from "path"

const name = process.argv[2]
const type = process.argv[3] || "all"

if (!name) {
  console.error("Usage: npm run module <name> [controller|routes|model|all]")
  process.exit(1)
}

const validTypes = ["all", "controller", "routes", "service"]
if (!validTypes.includes(type)) {
  console.error(\`Invalid type "\${type}". Use: \${validTypes.join(", ")}\`)
  process.exit(1)
}

const cap = name.charAt(0).toUpperCase() + name.slice(1)
const featureDir = path.join(process.cwd(), "src", "features", name)
if (!fs.existsSync(featureDir)) fs.mkdirSync(featureDir, { recursive: true })

const serviceContent =
\`import prisma from "../../config/db.js"

export const getAll\${cap} = async () => {
  return await prisma.\${name}.findMany()
}

export const get\${cap}ById = async (id) => {
  return await prisma.\${name}.findUnique({ where: { id: Number(id) } })
}

export const create\${cap} = async (data) => {
  return await prisma.\${name}.create({ data })
}

export const update\${cap} = async (id, data) => {
  return await prisma.\${name}.update({
    where: { id: Number(id) },
    data,
  })
}

export const delete\${cap} = async (id) => {
  return await prisma.\${name}.delete({ where: { id: Number(id) } })
}
\`

const controllerContent =
\`import * as \${name}Service from "./\${name}.service.js"

export const getAll\${cap} = async (req, res) => {
  try {
    const items = await \${name}Service.getAll\${cap}()
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const get\${cap}ById = async (req, res) => {
  try {
    const item = await \${name}Service.get\${cap}ById(req.params.id)
    if (!item) return res.status(404).json({ error: "\${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const create\${cap} = async (req, res) => {
  try {
    const item = await \${name}Service.create\${cap}(req.body)
    res.status(201).json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const update\${cap} = async (req, res) => {
  try {
    const item = await \${name}Service.update\${cap}(req.params.id, req.body)
    res.json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const delete\${cap} = async (req, res) => {
  try {
    await \${name}Service.delete\${cap}(req.params.id)
    res.status(204).send()
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}
\`

const routeContent =
\`import express from "express"
import {
  getAll\${cap},
  get\${cap}ById,
  create\${cap},
  update\${cap},
  delete\${cap},
} from "./\${name}.controller.js"

const router = express.Router()
router.get("/", getAll\${cap})
router.get("/:id", get\${cap}ById)
router.post("/", create\${cap})
router.put("/:id", update\${cap})
router.delete("/:id", delete\${cap})
export default router
\`

const write = (fileName, content) => {
  const filePath = path.join(featureDir, fileName)
  if (fs.existsSync(filePath)) { console.log(\`  Skipped (exists): \${fileName}\`); return }
  fs.writeFileSync(filePath, content)
  console.log(\`  Created: \${fileName}\`)
}

if (type === "all" || type === "service")    write(\`\${name}.service.js\`,   serviceContent)
if (type === "all" || type === "controller") write(\`\${name}.controller.js\`, controllerContent)
if (type === "all" || type === "routes")     write(\`\${name}.routes.js\`,     routeContent)

console.log(\`\\n✓ Module "\${name}" ready! Mount it in app.js:\`)
console.log(\`  import \${name}Router from "./features/\${name}/\${name}.routes.js"\`)
console.log(\`  app.use("/\${name}", \${name}Router)\`)
console.log(\`\\nDon't forget to add the model to prisma/schema.prisma and run:\`)
console.log(\`  npx prisma migrate dev --name add_\${name}\`)
`,

  Sequelize:
`import fs from "fs"
import path from "path"

const name = process.argv[2]
const type = process.argv[3] || "all"

if (!name) {
  console.error("Usage: npm run module <name> [controller|routes|model|all]")
  process.exit(1)
}

const validTypes = ["all", "controller", "routes", "model", "service"]
if (!validTypes.includes(type)) {
  console.error(\`Invalid type "\${type}". Use: \${validTypes.join(", ")}\`)
  process.exit(1)
}

const cap = name.charAt(0).toUpperCase() + name.slice(1)
const featureDir = path.join(process.cwd(), "src", "features", name)
if (!fs.existsSync(featureDir)) fs.mkdirSync(featureDir, { recursive: true })

const modelContent =
\`import { DataTypes } from "sequelize"
import sequelize from "../../config/db.js"

const \${cap} = sequelize.define("\${cap}", {
  // name: { type: DataTypes.STRING, allowNull: false },
}, { timestamps: true })

export default \${cap}
\`

const serviceContent =
\`import \${cap} from "./\${name}.model.js"

export const getAll\${cap} = async () => {
  return await \${cap}.findAll()
}

export const get\${cap}ById = async (id) => {
  return await \${cap}.findByPk(id)
}

export const create\${cap} = async (data) => {
  return await \${cap}.create(data)
}

export const update\${cap} = async (id, data) => {
  const [updated] = await \${cap}.update(data, { where: { id } })
  if (!updated) return null
  return await \${cap}.findByPk(id)
}

export const delete\${cap} = async (id) => {
  const deleted = await \${cap}.destroy({ where: { id } })
  return deleted > 0
}
\`

const controllerContent =
\`import * as \${name}Service from "./\${name}.service.js"

export const getAll\${cap} = async (req, res) => {
  try {
    const items = await \${name}Service.getAll\${cap}()
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const get\${cap}ById = async (req, res) => {
  try {
    const item = await \${name}Service.get\${cap}ById(req.params.id)
    if (!item) return res.status(404).json({ error: "\${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const create\${cap} = async (req, res) => {
  try {
    const item = await \${name}Service.create\${cap}(req.body)
    res.status(201).json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const update\${cap} = async (req, res) => {
  try {
    const item = await \${name}Service.update\${cap}(req.params.id, req.body)
    if (!item) return res.status(404).json({ error: "\${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const delete\${cap} = async (req, res) => {
  try {
    const deleted = await \${name}Service.delete\${cap}(req.params.id)
    if (!deleted) return res.status(404).json({ error: "\${cap} not found" })
    res.status(204).send()
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}
\`

const routeContent =
\`import express from "express"
import {
  getAll\${cap},
  get\${cap}ById,
  create\${cap},
  update\${cap},
  delete\${cap},
} from "./\${name}.controller.js"

const router = express.Router()
router.get("/", getAll\${cap})
router.get("/:id", get\${cap}ById)
router.post("/", create\${cap})
router.put("/:id", update\${cap})
router.delete("/:id", delete\${cap})
export default router
\`

const write = (fileName, content) => {
  const filePath = path.join(featureDir, fileName)
  if (fs.existsSync(filePath)) { console.log(\`  Skipped (exists): \${fileName}\`); return }
  fs.writeFileSync(filePath, content)
  console.log(\`  Created: \${fileName}\`)
}

if (type === "all" || type === "model")      write(\`\${name}.model.js\`,      modelContent)
if (type === "all" || type === "service")    write(\`\${name}.service.js\`,    serviceContent)
if (type === "all" || type === "controller") write(\`\${name}.controller.js\`, controllerContent)
if (type === "all" || type === "routes")     write(\`\${name}.routes.js\`,     routeContent)

console.log(\`\\n✓ Module "\${name}" ready! Mount it in app.js:\`)
console.log(\`  import \${name}Router from "./features/\${name}/\${name}.routes.js"\`)
console.log(\`  app.use("/\${name}", \${name}Router)\`)
`,

  Mongoose:
`import fs from "fs"
import path from "path"

const name = process.argv[2]
const type = process.argv[3] || "all"

if (!name) {
  console.error("Usage: npm run module <name> [controller|routes|model|all]")
  process.exit(1)
}

const validTypes = ["all", "controller", "routes", "model", "service"]
if (!validTypes.includes(type)) {
  console.error(\`Invalid type "\${type}". Use: \${validTypes.join(", ")}\`)
  process.exit(1)
}

const cap = name.charAt(0).toUpperCase() + name.slice(1)
const featureDir = path.join(process.cwd(), "src", "features", name)
if (!fs.existsSync(featureDir)) fs.mkdirSync(featureDir, { recursive: true })

const modelContent =
\`import mongoose from "mongoose"

const \${name}Schema = new mongoose.Schema(
  {
    // name: { type: String, required: true },
  },
  { timestamps: true }
)

const \${cap} = mongoose.model("\${cap}", \${name}Schema)
export default \${cap}
\`

const serviceContent =
\`import \${cap} from "./\${name}.model.js"

export const getAll\${cap} = async () => {
  return await \${cap}.find()
}

export const get\${cap}ById = async (id) => {
  return await \${cap}.findById(id)
}

export const create\${cap} = async (data) => {
  return await \${cap}.create(data)
}

export const update\${cap} = async (id, data) => {
  return await \${cap}.findByIdAndUpdate(id, data, { new: true, runValidators: true })
}

export const delete\${cap} = async (id) => {
  return await \${cap}.findByIdAndDelete(id)
}
\`

const controllerContent =
\`import * as \${name}Service from "./\${name}.service.js"

export const getAll\${cap} = async (req, res) => {
  try {
    const items = await \${name}Service.getAll\${cap}()
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const get\${cap}ById = async (req, res) => {
  try {
    const item = await \${name}Service.get\${cap}ById(req.params.id)
    if (!item) return res.status(404).json({ error: "\${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const create\${cap} = async (req, res) => {
  try {
    const item = await \${name}Service.create\${cap}(req.body)
    res.status(201).json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const update\${cap} = async (req, res) => {
  try {
    const item = await \${name}Service.update\${cap}(req.params.id, req.body)
    if (!item) return res.status(404).json({ error: "\${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const delete\${cap} = async (req, res) => {
  try {
    const item = await \${name}Service.delete\${cap}(req.params.id)
    if (!item) return res.status(404).json({ error: "\${cap} not found" })
    res.status(204).send()
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}
\`

const routeContent =
\`import express from "express"
import {
  getAll\${cap},
  get\${cap}ById,
  create\${cap},
  update\${cap},
  delete\${cap},
} from "./\${name}.controller.js"

const router = express.Router()
router.get("/", getAll\${cap})
router.get("/:id", get\${cap}ById)
router.post("/", create\${cap})
router.put("/:id", update\${cap})
router.delete("/:id", delete\${cap})
export default router
\`

const write = (fileName, content) => {
  const filePath = path.join(featureDir, fileName)
  if (fs.existsSync(filePath)) { console.log(\`  Skipped (exists): \${fileName}\`); return }
  fs.writeFileSync(filePath, content)
  console.log(\`  Created: \${fileName}\`)
}

if (type === "all" || type === "model")      write(\`\${name}.model.js\`,      modelContent)
if (type === "all" || type === "service")    write(\`\${name}.service.js\`,    serviceContent)
if (type === "all" || type === "controller") write(\`\${name}.controller.js\`, controllerContent)
if (type === "all" || type === "routes")     write(\`\${name}.routes.js\`,     routeContent)

console.log(\`\\n✓ Module "\${name}" ready! Mount it in app.js:\`)
console.log(\`  import \${name}Router from "./features/\${name}/\${name}.routes.js"\`)
console.log(\`  app.use("/\${name}", \${name}Router)\`)
`,
}

// ─── Main ────────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

console.log("\n🔧 Express Project Setup\n")
console.log("Select an ORM:")
Object.entries(ORMS).forEach(([k, v]) => console.log(`  ${k}. ${v}`))
console.log("")

const answer = await ask(rl, "Enter choice (1-3): ")
rl.close()

const choice = parseInt(answer.trim())
const orm = ORMS[choice]

if (!orm) {
  console.error("Invalid choice. Exiting.")
  process.exit(1)
}

console.log(`\n✓ Using ORM: ${orm}\n`)

const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout })
const wantsDocker = await ask(rl2, "Do you want to include a Dockerfile? (y/n): ")
rl2.close()

const includeDocker = wantsDocker.trim().toLowerCase() === "y"
console.log(includeDocker ? "\n✓ Docker support enabled\n" : "\n✗ Docker support skipped\n")

// package.json
const pkgPath = path.join(projectDir, "package.json")
if (!fs.existsSync(pkgPath)) {
  run("npm init -y")
} else {
  console.log("  package.json exists — skipping npm init")
}

// Dependencies
if (!fs.existsSync(path.join(projectDir, "node_modules"))) {
  run(`npm install express dotenv ${ormPackages[orm]}`)
} else {
  console.log("  node_modules exist — skipping install")
}

// Update package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
pkg.type = "module"
pkg.main = "src/server.js"
pkg.scripts = {
  dev:    "node --watch src/server.js",
  module: "node tools/createModule.js",
  delete: "node tools/deleteModule.js",
}
if (includeDocker) {
  pkg.scripts.docker  = "docker build -t myapp ."
  pkg.scripts["docker:up"] = "docker compose up -d"
  pkg.scripts["docker:down"] = "docker compose down"
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
console.log("  Updated package.json")

// Folders
;["src/config", "src/core/middleware", "src/core/utils", "src/features", "tools"].forEach((dir) => {
  const fullPath = path.join(projectDir, dir)
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true })
    console.log(`  Created folder: ${dir}`)
  }
})

// Static files
writeIfMissing(path.join(projectDir, ".gitignore"),   `node_modules\n.env\nsetUp.js\n`)
writeIfMissing(path.join(projectDir, ".env"),         `PORT=5000\n${ormEnvAdditions[orm]}\n`)
writeIfMissing(path.join(projectDir, ".env.example"), `PORT=5000\n${ormEnvAdditions[orm]}\n`)
writeIfMissing(path.join(srcDir, "config/db.js"),     ormDbFile[orm])
writeIfMissing(path.join(srcDir, "app.js"),           ormAppJs[orm])
writeIfMissing(path.join(srcDir, "server.js"),
`import dotenv from "dotenv"
dotenv.config()

import app from "./app.js"

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`)
})
`)

// Prisma needs its own init
if (orm === "Prisma" && !fs.existsSync(path.join(projectDir, "prisma"))) {
  run("npx prisma init --datasource-provider postgresql")
}

// Docker files
if (includeDocker) {
  writeIfMissing(path.join(projectDir, "Dockerfile"), dockerfileContent(orm))
  writeIfMissing(
    path.join(projectDir, "docker-compose.yml"),
    dockerComposeYml[dockerComposeServices[orm]]
  )
  writeIfMissing(
    path.join(projectDir, ".dockerignore"),
    `node_modules\n.env\n.git\n`
  )
}

// tools — written as plain string content, no .toString() hacks
writeIfMissing(path.join(toolsDir, "createModule.js"), createModuleFile[orm])
writeIfMissing(path.join(toolsDir, "deleteModule.js"),
`import fs from "fs"
import path from "path"

const name = process.argv[2]
if (!name) {
  console.error("Usage: npm run delete <name>")
  process.exit(1)
}

const featureDir = path.join(process.cwd(), "src", "features", name)
if (fs.existsSync(featureDir)) {
  fs.rmSync(featureDir, { recursive: true, force: true })
  console.log(\`Deleted: src/features/\${name}\`)
} else {
  console.log(\`Feature "\${name}" not found.\`)
}
`)

console.log(`\n✅ Setup complete with ${orm}!\n`)
console.log(`  npm run dev             — start the server`)
console.log(`  npm run module <name>   — scaffold a feature module`)
console.log(`  npm run delete <name>   — remove a feature module`)
if (orm === "Prisma") {
  console.log(`  npx prisma migrate dev  — run migrations after editing schema.prisma`)
}
if (includeDocker) {
  console.log(`  npm run docker          — build Docker image`)
  console.log(`  npm run docker:up        — start Docker containers`)
  console.log(`  npm run docker:down     — stop Docker containers`)
}
console.log("")