const form = document.getElementById("task-form");
const dateInput = document.getElementById("date-input");
const taskInput = document.getElementById("task-input");
const pendingGrid = document.getElementById("pending-grid");
const completedGrid = document.getElementById("completed-grid");
const pendingEmptyState = document.getElementById("pending-empty-state");
const completedEmptyState = document.getElementById("completed-empty-state");
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createTask(dateInput.value, taskInput.value.trim());
});

voiceBtn.addEventListener("click", () => {
  startVoiceInput();
});

async function bootstrap() {
  registerServiceWorker();
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

async function toggleTaskCompleted(id, completed) {
  try {
    setBusy(true);
    const response = await fetch(API_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed }),
    });

    if (!response.ok) {
      setAppStatus("No se pudo actualizar la tarea.", true);
      return;
    }

    const data = await response.json();
    tasks = tasks.map((task) => (task.id === data.task.id ? data.task : task));
    sortTasks();
    render();
    setAppStatus(completed ? "Tarea marcada como hecha." : "Tarea movida a pendientes.");
  } catch (error) {
    console.error("Error al actualizar tarea:", error);
    setAppStatus("No se pudo actualizar la tarea.", true);
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
  pendingGrid.innerHTML = "";
  completedGrid.innerHTML = "";

  const pendingTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  pendingEmptyState.hidden = pendingTasks.length > 0;
  completedEmptyState.hidden = completedTasks.length > 0;

  for (const task of pendingTasks) {
    pendingGrid.appendChild(buildTaskRow(task));
  }
  for (const task of completedTasks) {
    completedGrid.appendChild(buildTaskRow(task));
  }
}

function buildTaskRow(task) {
  const row = document.createElement("tr");

  const checkCell = document.createElement("td");
  const dateCell = document.createElement("td");
  const taskCell = document.createElement("td");
  const actionCell = document.createElement("td");

  const checkInput = document.createElement("input");
  checkInput.type = "checkbox";
  checkInput.className = "check-input";
  checkInput.checked = Boolean(task.completed);
  checkInput.setAttribute("aria-label", "Marcar tarea como realizada");
  checkInput.disabled = busy;
  checkInput.addEventListener("change", () => {
    toggleTaskCompleted(task.id, checkInput.checked);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "Eliminar";
  deleteBtn.className = "delete-btn";
  deleteBtn.disabled = busy;
  deleteBtn.addEventListener("click", () => removeTask(task.id));

  dateCell.textContent = formatDate(task.date);
  taskCell.textContent = task.task;
  if (task.completed) {
    taskCell.classList.add("task-text-completed");
  }

  checkCell.appendChild(checkInput);
  actionCell.appendChild(deleteBtn);
  row.append(checkCell, dateCell, taskCell, actionCell);
  return row;
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
    sortTasks();
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
    const byCompleted = Number(a.completed) - Number(b.completed);
    if (byCompleted !== 0) return byCompleted;

    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;

    const aTime = String(a.createdAt || "");
    const bTime = String(b.createdAt || "");
    return aTime.localeCompare(bTime);
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

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript.trim();
    const parsed = extractDateAndTask(transcript);

    if (!parsed) {
      voiceStatus.textContent =
        `No pude interpretar: "${transcript}". Probá "mañana - tarea".`;
      taskInput.value = transcript;
      return;
    }

    await createTask(parsed.dateIso, parsed.taskText);
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

  const naturalLeading = extractLeadingNaturalDate(text);
  if (naturalLeading) {
    return naturalLeading;
  }

  const splitByDash = text.match(/^(.+?)\s*-\s*(.+)$/);
  if (splitByDash) {
    const dateIso = parseDateText(splitByDash[1]);
    if (dateIso) {
      const taskText = cleanupTaskText(splitByDash[2]);
      if (!taskText) return null;
      return { dateIso, taskText };
    }
  }

  const naturalInline = extractInlineNaturalDate(text);
  if (naturalInline) {
    return naturalInline;
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

    const taskText = cleanupTaskText(text.replace(match[0], ""));
    if (!taskText) return null;
    return { dateIso, taskText };
  }

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
  if (natural) {
    return buildIsoDateFromNamedMonth(natural[1], natural[2], natural[3]);
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

  const now = new Date();
  const currentYear = now.getFullYear();
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
    .replace(/^(tengo que hacer|tengo que|tengo|debo hacer|debo|hacer)\s+/g, "")
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

function setBusy(isBusy) {
  busy = isBusy;
  addBtn.disabled = isBusy;
  voiceBtn.disabled = isBusy;
}

function setAppStatus(message, isError = false) {
  appStatus.textContent = message;
  appStatus.style.color = isError ? "var(--danger)" : "var(--ok)";
}
