const form = document.getElementById("task-form");
const dateInput = document.getElementById("date-input");
const taskInput = document.getElementById("task-input");
const grid = document.getElementById("task-grid");
const emptyState = document.getElementById("empty-state");
const voiceBtn = document.getElementById("voice-btn");
const voiceStatus = document.getElementById("voice-status");
const appStatus = document.getElementById("app-status");
const addBtn = document.getElementById("add-btn");

const API_URL = "/api/tasks";
const todayIso = toIsoDate(new Date());
dateInput.value = todayIso;

let tasks = [];
let busy = false;
bootstrap();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  createTask(dateInput.value, taskInput.value.trim());
});

voiceBtn.addEventListener("click", () => {
  startVoiceInput();
});

async function bootstrap() {
  await loadTasks();
  render();
}

async function createTask(date, taskText) {
  if (!date || !taskText) return;

  try {
    setBusy(true);
    setAppStatus("Guardando tarea...");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, task: taskText }),
    });

    if (!response.ok) {
      setAppStatus("No se pudo guardar la tarea.", true);
      return;
    }

    const data = await response.json();
    tasks.push(data.task);
    sortTasks();
    render();
    taskInput.value = "";
    dateInput.value = date;
    setAppStatus("Tarea guardada.");
  } catch (error) {
    console.error("Error al guardar tarea:", error);
    setAppStatus("No se pudo guardar la tarea.", true);
  } finally {
    setBusy(false);
  }
}

async function removeTask(id) {
  try {
    setBusy(true);
    const response = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

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

function render() {
  sortTasks();
  grid.innerHTML = "";

  if (!tasks.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  for (const task of tasks) {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td");
    const taskCell = document.createElement("td");
    const actionCell = document.createElement("td");
    const deleteBtn = document.createElement("button");

    dateCell.textContent = formatDate(task.date);
    taskCell.textContent = task.task;

    deleteBtn.type = "button";
    deleteBtn.textContent = "Eliminar";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", () => removeTask(task.id));

    actionCell.appendChild(deleteBtn);
    row.append(dateCell, taskCell, actionCell);
    grid.appendChild(row);
  }
}

async function loadTasks() {
  try {
    setBusy(true);
    setAppStatus("Cargando tareas...");
    const response = await fetch(API_URL);

    if (!response.ok) {
      setAppStatus("No se pudo conectar con la base de datos.", true);
      return;
    }

    const data = await response.json();
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    setAppStatus("");
  } catch (error) {
    console.error("Error al cargar tareas:", error);
    setAppStatus("No se pudo conectar con la base de datos.", true);
  } finally {
    setBusy(false);
  }
}

function sortTasks() {
  tasks.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceStatus.textContent =
      "Tu navegador no soporta reconocimiento de voz. Usa el formulario.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "es-ES";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  voiceStatus.textContent = "Escuchando...";
  voiceBtn.disabled = true;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    const parsed = extractDateAndTask(transcript);

    if (!parsed) {
      voiceStatus.textContent =
        `No pude interpretar la fecha en: "${transcript}". Prueba "mañana - tarea".`;
      taskInput.value = transcript;
      return;
    }

    createTask(parsed.dateIso, parsed.taskText);
    voiceStatus.textContent = `Agregado: ${formatDate(parsed.dateIso)} - ${parsed.taskText}`;
  };

  recognition.onerror = () => {
    voiceStatus.textContent = "No pude capturar la voz. Intenta otra vez.";
  };

  recognition.onend = () => {
    voiceBtn.disabled = busy;
  };

  recognition.start();
}

function extractDateAndTask(input) {
  const text = normalize(input);

  const splitByDash = text.match(/^(.+?)\s*-\s*(.+)$/);
  if (splitByDash) {
    const dateIso = parseDateText(splitByDash[1]);
    if (dateIso) {
      return { dateIso, taskText: splitByDash[2].trim() };
    }
  }

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

    const taskText = text.replace(match[0], "").replace(/^[-:,.\s]+|[-:,.\s]+$/g, "");
    if (!taskText) return null;
    return { dateIso, taskText };
  }

  return null;
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const slash = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    return buildIsoDate(slash[1], slash[2], slash[3]);
  }

  const dash = value.match(/^(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?$/);
  if (dash) {
    return buildIsoDate(dash[1], dash[2], dash[3]);
  }

  return null;
}

function buildIsoDate(dayRaw, monthRaw, yearRaw) {
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const now = new Date();
  const currentYear = now.getFullYear();

  let year = yearRaw ? Number(yearRaw) : currentYear;
  if (year < 100) year += 2000;

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
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
