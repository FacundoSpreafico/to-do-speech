const form = document.getElementById("task-form");
const dateInput = document.getElementById("date-input");
const taskInput = document.getElementById("task-input");
const grid = document.getElementById("task-grid");
const emptyState = document.getElementById("empty-state");
const voiceBtn = document.getElementById("voice-btn");
const voiceStatus = document.getElementById("voice-status");

const STORAGE_KEY = "voice-todo-items";
const todayIso = toIsoDate(new Date());
dateInput.value = todayIso;

let tasks = loadTasks();
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  addTask(dateInput.value, taskInput.value.trim());
});

voiceBtn.addEventListener("click", () => {
  startVoiceInput();
});

function addTask(date, taskText) {
  if (!date || !taskText) return;

  tasks.push({
    id: createId(),
    date,
    task: taskText,
    createdAt: new Date().toISOString(),
  });

  sortTasks();
  persistTasks();
  render();
  taskInput.value = "";
  dateInput.value = date;
}

function removeTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  persistTasks();
  render();
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

function persistTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("No se pudo leer el almacenamiento local:", error);
    localStorage.removeItem(STORAGE_KEY);
    return [];
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

    addTask(parsed.dateIso, parsed.taskText);
    voiceStatus.textContent = `Agregado: ${formatDate(parsed.dateIso)} - ${parsed.taskText}`;
  };

  recognition.onerror = () => {
    voiceStatus.textContent = "No pude capturar la voz. Intenta otra vez.";
  };

  recognition.onend = () => {
    voiceBtn.disabled = false;
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

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}
