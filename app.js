const form = document.getElementById("task-form");
const dateInput = document.getElementById("date-input");
const taskInput = document.getElementById("task-input");
const addBtn = document.getElementById("add-btn");
const voiceBtn = document.getElementById("voice-btn");
const voiceStatus = document.getElementById("voice-status");
const appStatus = document.getElementById("app-status");
const pendingList = document.getElementById("pending-list");
const completedList = document.getElementById("completed-list");
const pendingEmpty = document.getElementById("pending-empty");
const completedEmpty = document.getElementById("completed-empty");
const pendingCounter = document.getElementById("pending-counter");
const completedCounter = document.getElementById("completed-counter");
const pendingTitle = document.getElementById("pending-title");
const themeToggle = document.getElementById("theme-toggle");
const categoryTabs = Array.from(document.querySelectorAll(".tab"));

const API_URL = "/api/tasks";
const THEME_KEY = "todo-theme";
const CATEGORIES = ["estudio", "trabajo"];
const CATEGORY_LABELS = { estudio: "Estudio", trabajo: "Trabajo" };
const todayIso = toIsoDate(new Date());

let tasks = [];
let busy = false;
let activeCategory = "estudio";

dateInput.value = todayIso;
bootstrap();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createTask(dateInput.value, taskInput.value.trim(), activeCategory);
});

voiceBtn.addEventListener("click", () => {
  startVoiceInput();
});

themeToggle.addEventListener("click", toggleTheme);
for (const tab of categoryTabs) {
  tab.addEventListener("click", () => {
    const category = tab.dataset.category;
    if (!CATEGORIES.includes(category)) return;
    activeCategory = category;
    updateCategoryUI();
    render();
  });
}

async function bootstrap() {
  registerServiceWorker();
  applyStoredTheme();
  updateCategoryUI();
  await loadTasks();
  render();
}

async function createTask(date, taskText, category) {
  if (!date || !taskText || !CATEGORIES.includes(category)) return;

  try {
    setBusy(true);
    setAppStatus("Guardando tarea...");
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, task: taskText, category }),
    });

    if (!response.ok) {
      setAppStatus("No se pudo guardar la tarea.", true);
      return;
    }

    const data = await response.json();
    tasks.push(data.task);
    sortTasks();
    taskInput.value = "";
    dateInput.value = date;
    render();
    setAppStatus("Tarea guardada.");
  } catch (error) {
    console.error("Error al guardar tarea:", error);
    setAppStatus("No se pudo guardar la tarea.", true);
  } finally {
    setBusy(false);
  }
}

async function updateTask(id, patch) {
  try {
    setBusy(true);
    const response = await fetch(API_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });

    if (!response.ok) {
      setAppStatus("No se pudo actualizar la tarea.", true);
      return;
    }

    const data = await response.json();
    tasks = tasks.map((task) => (task.id === data.task.id ? data.task : task));
    sortTasks();
    render();
  } catch (error) {
    console.error("Error al actualizar tarea:", error);
    setAppStatus("No se pudo actualizar la tarea.", true);
  } finally {
    setBusy(false);
  }
}

async function toggleTaskCompleted(id, completed) {
  await updateTask(id, { completed });
  setAppStatus(completed ? "Pasó a hechas." : "Volvió a pendientes.");
}

async function toggleTaskCategory(task) {
  const nextCategory = task.category === "estudio" ? "trabajo" : "estudio";
  await updateTask(task.id, { category: nextCategory });
  setAppStatus(`Movida a ${CATEGORY_LABELS[nextCategory]}.`);
}

async function removeTask(id) {
  try {
    setBusy(true);
    const response = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, { method: "DELETE" });

    if (!response.ok) {
      setAppStatus("No se pudo eliminar la tarea.", true);
      return;
    }

    tasks = tasks.filter((task) => task.id !== id);
    render();
    setAppStatus("Tarea eliminada.");
  } catch (error) {
    console.error("Error al eliminar tarea:", error);
    setAppStatus("No se pudo eliminar la tarea.", true);
  } finally {
    setBusy(false);
  }
}

async function loadTasks() {
  try {
    setBusy(true);
    setAppStatus("Cargando tareas...");
    const response = await fetch(API_URL);
    if (!response.ok) {
      setAppStatus("No se pudo cargar la base de datos.", true);
      return;
    }
    const data = await response.json();
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    sortTasks();
    setAppStatus("");
  } catch (error) {
    console.error("Error al cargar tareas:", error);
    setAppStatus("No se pudo cargar la base de datos.", true);
  } finally {
    setBusy(false);
  }
}

function render() {
  pendingList.innerHTML = "";
  completedList.innerHTML = "";

  const visible = tasks.filter((task) => task.category === activeCategory);
  const pending = visible.filter((task) => !task.completed);
  const completed = visible.filter((task) => task.completed);

  pendingCounter.textContent = String(pending.length);
  completedCounter.textContent = String(completed.length);
  pendingEmpty.hidden = pending.length > 0;
  completedEmpty.hidden = completed.length > 0;

  for (const task of pending) pendingList.appendChild(buildTaskItem(task));
  for (const task of completed) completedList.appendChild(buildTaskItem(task));
}

function buildTaskItem(task) {
  const item = document.createElement("li");
  item.className = `task-item${task.completed ? " is-complete" : ""}`;

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "task-check";
  check.checked = Boolean(task.completed);
  check.disabled = busy;
  check.setAttribute("aria-label", "Marcar tarea como hecha");
  check.addEventListener("change", () => toggleTaskCompleted(task.id, check.checked));

  const meta = document.createElement("div");
  meta.className = "task-meta";

  const name = document.createElement("p");
  name.className = "task-name";
  name.textContent = task.task;

  const subline = document.createElement("p");
  subline.className = "task-subline";

  const date = document.createElement("span");
  date.textContent = formatDate(task.date);

  const category = document.createElement("span");
  category.className = "pill";
  category.textContent = CATEGORY_LABELS[task.category] || "General";

  subline.append(date, category);
  meta.append(name, subline);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const moveBtn = document.createElement("button");
  moveBtn.type = "button";
  moveBtn.className = "tiny-btn";
  moveBtn.disabled = busy;
  moveBtn.textContent = task.category === "estudio" ? "Mover a Trabajo" : "Mover a Estudio";
  moveBtn.addEventListener("click", () => toggleTaskCategory(task));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "tiny-btn warn";
  deleteBtn.disabled = busy;
  deleteBtn.textContent = "Eliminar";
  deleteBtn.addEventListener("click", () => removeTask(task.id));

  actions.append(moveBtn, deleteBtn);
  item.append(check, meta, actions);
  return item;
}

function sortTasks() {
  tasks.sort((a, b) => {
    const byCategory = String(a.category || "").localeCompare(String(b.category || ""));
    if (byCategory !== 0) return byCategory;

    const byCompleted = Number(a.completed) - Number(b.completed);
    if (byCompleted !== 0) return byCompleted;

    const byDate = String(a.date || "").localeCompare(String(b.date || ""));
    if (byDate !== 0) return byDate;

    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });
}

function updateCategoryUI() {
  for (const tab of categoryTabs) {
    tab.classList.toggle("is-active", tab.dataset.category === activeCategory);
  }
  pendingTitle.textContent = `Pendientes · ${CATEGORY_LABELS[activeCategory]}`;
}

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceStatus.textContent = "Tu navegador no soporta voz. Usá carga manual.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "es-ES";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  voiceStatus.textContent = "Escuchando...";
  voiceBtn.disabled = true;

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript.trim();
    const parsed = extractDateTaskAndCategory(transcript);

    if (!parsed) {
      voiceStatus.textContent = `No pude interpretar "${transcript}".`;
      taskInput.value = transcript;
      return;
    }

    if (parsed.category && CATEGORIES.includes(parsed.category)) {
      activeCategory = parsed.category;
      updateCategoryUI();
    }
    await createTask(parsed.dateIso, parsed.taskText, parsed.category || activeCategory);
    voiceStatus.textContent = `Agregado: ${formatDate(parsed.dateIso)} · ${parsed.taskText}`;
  };

  recognition.onerror = () => {
    voiceStatus.textContent = "No pude capturar la voz. Probá otra vez.";
  };

  recognition.onend = () => {
    voiceBtn.disabled = busy;
  };

  recognition.start();
}

function extractDateTaskAndCategory(input) {
  const text = normalize(input);
  const category = detectCategory(text);

  const naturalLeading = extractLeadingNaturalDate(text);
  if (naturalLeading) return { ...naturalLeading, category };

  const splitByDash = text.match(/^(.+?)\s*-\s*(.+)$/);
  if (splitByDash) {
    const dateIso = parseDateText(splitByDash[1]);
    if (dateIso) {
      const taskText = cleanupTaskText(splitByDash[2]);
      if (taskText) return { dateIso, taskText, category };
    }
  }

  const naturalInline = extractInlineNaturalDate(text);
  if (naturalInline) return { ...naturalInline, category };

  const datePatterns = [
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/,
    /\b(\d{1,2}-\d{1,2}(?:-\d{2,4})?)\b/,
    /\b(hoy|manana|pasado manana)\b/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const dateIso = parseDateText(match[1]);
    if (!dateIso) continue;
    const taskText = cleanupTaskText(text.replace(match[0], ""));
    if (!taskText) return null;
    return { dateIso, taskText, category };
  }

  return null;
}

function detectCategory(text) {
  if (/\b(trabajo|laburo|oficina|cliente|reunion)\b/.test(text)) return "trabajo";
  if (/\b(estudio|facultad|parcial|guia|tp|examen|clase)\b/.test(text)) return "estudio";
  return null;
}

function extractLeadingNaturalDate(text) {
  const match = text.match(
    /^(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\s+(.+)$/,
  );
  if (!match) return null;
  const dateIso = buildIsoDateFromNamedMonth(match[1], match[2], match[3]);
  if (!dateIso) return null;
  const taskText = cleanupTaskText(match[4]);
  if (!taskText) return null;
  return { dateIso, taskText };
}

function extractInlineNaturalDate(text) {
  const match = text.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/,
  );
  if (!match) return null;
  const dateIso = buildIsoDateFromNamedMonth(match[1], match[2], match[3]);
  if (!dateIso) return null;
  const taskText = cleanupTaskText(text.replace(match[0], ""));
  if (!taskText) return null;
  return { dateIso, taskText };
}

function parseDateText(raw) {
  const value = normalize(raw).trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (value === "hoy") return toIsoDate(today);
  if (value === "manana") {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return toIsoDate(tomorrow);
  }
  if (value === "pasado manana") {
    const afterTomorrow = new Date(today);
    afterTomorrow.setDate(today.getDate() + 2);
    return toIsoDate(afterTomorrow);
  }

  const natural = value.match(
    /^(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?$/,
  );
  if (natural) return buildIsoDateFromNamedMonth(natural[1], natural[2], natural[3]);

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const slash = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) return buildIsoDate(slash[1], slash[2], slash[3]);

  const dash = value.match(/^(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?$/);
  if (dash) return buildIsoDate(dash[1], dash[2], dash[3]);

  return null;
}

function buildIsoDate(dayRaw, monthRaw, yearRaw) {
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const currentYear = new Date().getFullYear();
  let year = yearRaw ? Number(yearRaw) : currentYear;
  if (year < 100) year += 2000;
  return validateDate(year, month, day);
}

function buildIsoDateFromNamedMonth(dayRaw, monthNameRaw, yearRaw) {
  const monthMap = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12,
  };
  const month = monthMap[normalize(monthNameRaw)];
  if (!month) return null;
  const currentYear = new Date().getFullYear();
  let year = yearRaw ? Number(yearRaw) : currentYear;
  if (year < 100) year += 2000;
  return validateDate(year, month, Number(dayRaw));
}

function validateDate(year, month, day) {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return toIsoDate(date);
}

function cleanupTaskText(text) {
  const sanitized = normalize(text).replace(/^[-:,.\s]+|[-:,.\s]+$/g, "");
  return sanitized
    .replace(
      /^(tengo que hacer|tengo que|tengo|debo hacer|debo|hacer|para trabajo|de trabajo|para estudio|de estudio)\s+/g,
      "",
    )
    .trim();
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateIso) {
  const date = new Date(`${dateIso}T00:00:00`);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.error("No se pudo registrar el service worker:", error);
    });
  });
}

function applyStoredTheme() {
  const theme = localStorage.getItem(THEME_KEY);
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const resolved = theme || preferred;
  document.documentElement.dataset.theme = resolved;
  updateThemeIcon(resolved);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  themeToggle.textContent = theme === "dark" ? "🌙" : "☀️";
}

function setBusy(isBusy) {
  busy = isBusy;
  addBtn.disabled = isBusy;
  voiceBtn.disabled = isBusy;
}

function setAppStatus(message, isError = false) {
  appStatus.textContent = message;
  appStatus.style.color = isError ? "var(--danger)" : "var(--ok)";
}
