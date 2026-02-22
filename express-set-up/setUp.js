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

const validTypes = ["all", "controller", "routes"]
if (!validTypes.includes(type)) {
  console.error(\`Invalid type "\${type}". Use: \${validTypes.join(", ")}\`)
  process.exit(1)
}

const cap = name.charAt(0).toUpperCase() + name.slice(1)
const featureDir = path.join(process.cwd(), "src", "features", name)
if (!fs.existsSync(featureDir)) fs.mkdirSync(featureDir, { recursive: true })

const controllerContent =
\`import prisma from "../../config/db.js"

export const getAll\${cap} = async (req, res) => {
  try {
    const items = await prisma.\${name}.findMany()
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const get\${cap}ById = async (req, res) => {
  try {
    const item = await prisma.\${name}.findUnique({ where: { id: Number(req.params.id) } })
    if (!item) return res.status(404).json({ error: "\${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const create\${cap} = async (req, res) => {
  try {
    const item = await prisma.\${name}.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const update\${cap} = async (req, res) => {
  try {
    const item = await prisma.\${name}.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    })
    res.json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const delete\${cap} = async (req, res) => {
  try {
    await prisma.\${name}.delete({ where: { id: Number(req.params.id) } })
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

const validTypes = ["all", "controller", "routes", "model"]
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

const controllerContent =
\`import \${cap} from "./\${name}.model.js"

export const getAll\${cap} = async (req, res) => {
  try {
    const items = await \${cap}.findAll()
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const get\${cap}ById = async (req, res) => {
  try {
    const item = await \${cap}.findByPk(req.params.id)
    if (!item) return res.status(404).json({ error: "\${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const create\${cap} = async (req, res) => {
  try {
    const item = await \${cap}.create(req.body)
    res.status(201).json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const update\${cap} = async (req, res) => {
  try {
    const [updated] = await \${cap}.update(req.body, { where: { id: req.params.id } })
    if (!updated) return res.status(404).json({ error: "\${cap} not found" })
    res.json(await \${cap}.findByPk(req.params.id))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const delete\${cap} = async (req, res) => {
  try {
    const deleted = await \${cap}.destroy({ where: { id: req.params.id } })
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

const validTypes = ["all", "controller", "routes", "model"]
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

const controllerContent =
\`import \${cap} from "./\${name}.model.js"

export const getAll\${cap} = async (req, res) => {
  try {
    const items = await \${cap}.find()
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const get\${cap}ById = async (req, res) => {
  try {
    const item = await \${cap}.findById(req.params.id)
    if (!item) return res.status(404).json({ error: "\${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const create\${cap} = async (req, res) => {
  try {
    const item = await \${cap}.create(req.body)
    res.status(201).json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const update\${cap} = async (req, res) => {
  try {
    const item = await \${cap}.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!item) return res.status(404).json({ error: "\${cap} not found" })
    res.json(item)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const delete\${cap} = async (req, res) => {
  try {
    const item = await \${cap}.findByIdAndDelete(req.params.id)
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
console.log("")