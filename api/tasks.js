import { neon } from "@neondatabase/serverless";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Falta POSTGRES_URL o DATABASE_URL.");
}

const sql = neon(connectionString);
let tableReadyPromise = null;

async function ensureTable() {
  if (tableReadyPromise) return tableReadyPromise;

  tableReadyPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        date DATE NOT NULL,
        task TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'estudio',
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'estudio';`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;`;
    await sql`UPDATE tasks SET category = 'estudio' WHERE category IS NULL;`;
    await sql`
      CREATE INDEX IF NOT EXISTS tasks_category_completed_date_created_idx
      ON tasks (category, completed, date, created_at);
    `;
  })();

  return tableReadyPromise;
}

export default async function handler(req, res) {
  try {
    await ensureTable();
    const body = getRequestBody(req);

    if (req.method === "GET") {
      const rows = await sql`
        SELECT
          id,
          date::text AS date,
          task,
          category,
          completed,
          completed_at::text AS "completedAt",
          created_at::text AS "createdAt"
        FROM tasks
        ORDER BY category ASC, completed ASC, date ASC, created_at ASC
      `;
      return res.status(200).json({ tasks: rows });
    }

    if (req.method === "POST") {
      const { date, task, category } = body;
      const cleanTask = typeof task === "string" ? task.trim() : "";
      const cleanCategory = normalizeCategory(category);
      if (!isIsoDate(date) || !cleanTask || !cleanCategory) {
        return res.status(400).json({ error: "Body invalido." });
      }

      const id = createId();
      const rows = await sql`
        INSERT INTO tasks (id, date, task, category, completed, completed_at)
        VALUES (${id}, ${date}, ${cleanTask}, ${cleanCategory}, FALSE, NULL)
        RETURNING
          id,
          date::text AS date,
          task,
          category,
          completed,
          completed_at::text AS "completedAt",
          created_at::text AS "createdAt"
      `;

      return res.status(201).json({ task: rows[0] });
    }

    if (req.method === "PATCH") {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const completed = normalizeCompleted(body?.completed);
      const category = normalizeCategory(body?.category);
      const hasCompleted = completed !== null;
      const hasCategory = Boolean(category);
      if (!id || (!hasCompleted && !hasCategory)) {
        return res.status(400).json({ error: "Body invalido." });
      }

      const nextCompleted = hasCompleted ? completed : null;
      const nextCategory = hasCategory ? category : null;

      const rows = await sql`
        UPDATE tasks
        SET
          completed = CASE WHEN ${nextCompleted} IS NULL THEN completed ELSE ${nextCompleted} END,
          category = COALESCE(${nextCategory}, category),
          completed_at = CASE
            WHEN ${nextCompleted} IS NULL THEN completed_at
            WHEN ${nextCompleted} THEN NOW()
            ELSE NULL
          END
        WHERE id = ${id}
        RETURNING
          id,
          date::text AS date,
          task,
          category,
          completed,
          completed_at::text AS "completedAt",
          created_at::text AS "createdAt"
      `;

      if (!rows.length) return res.status(404).json({ error: "No existe la tarea." });
      return res.status(200).json({ task: rows[0] });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || "");
      if (!id) return res.status(400).json({ error: "Falta id." });

      const rows = await sql`
        DELETE FROM tasks
        WHERE id = ${id}
        RETURNING id
      `;
      if (!rows.length) return res.status(404).json({ error: "No existe la tarea." });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Metodo no permitido." });
  } catch (error) {
    console.error("Error en /api/tasks:", error);
    return res.status(500).json({ error: "Error de base de datos." });
  }
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  const valid = !Number.isNaN(date.getTime());
  return valid && date.toISOString().slice(0, 10) === value;
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function normalizeCategory(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized === "estudio" || normalized === "trabajo" ? normalized : null;
}

function getRequestBody(req) {
  if (req?.body && typeof req.body === "object") return req.body;
  if (typeof req?.body !== "string") return {};
  try {
    const parsed = JSON.parse(req.body);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function normalizeCompleted(value) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}
