import { neon } from "@neondatabase/serverless";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Falta POSTGRES_URL o DATABASE_URL.");
}

const sql = neon(connectionString);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      date DATE NOT NULL,
      task TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      completed_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;`;
}

export default async function handler(req, res) {
  try {
    await ensureTable();

    if (req.method === "GET") {
      const rows = await sql`
        SELECT
          id,
          date::text AS date,
          task,
          completed,
          completed_at::text AS "completedAt",
          created_at::text AS "createdAt"
        FROM tasks
        ORDER BY completed ASC, date ASC, created_at ASC
      `;
      return res.status(200).json({ tasks: rows });
    }

    if (req.method === "POST") {
      const { date, task } = req.body || {};
      const cleanTask = typeof task === "string" ? task.trim() : "";
      if (!isIsoDate(date) || !cleanTask) {
        return res.status(400).json({ error: "Body invalido." });
      }

      const id = createId();
      const rows = await sql`
        INSERT INTO tasks (id, date, task, completed, completed_at)
        VALUES (${id}, ${date}, ${cleanTask}, FALSE, NULL)
        RETURNING
          id,
          date::text AS date,
          task,
          completed,
          completed_at::text AS "completedAt",
          created_at::text AS "createdAt"
      `;

      return res.status(201).json({ task: rows[0] });
    }

    if (req.method === "PATCH") {
      const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
      const completed = req.body?.completed;
      if (!id || typeof completed !== "boolean") {
        return res.status(400).json({ error: "Body invalido." });
      }

      const rows = await sql`
        UPDATE tasks
        SET
          completed = ${completed},
          completed_at = CASE WHEN ${completed} THEN NOW() ELSE NULL END
        WHERE id = ${id}
        RETURNING
          id,
          date::text AS date,
          task,
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
