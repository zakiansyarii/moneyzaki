/* Set this to the deployed Google Apps Script Web App URL to enable shared storage. */
const API_URL = "https://script.google.com/macros/s/AKfycbwoPOHFjxSrqh9sxvFBm0qRZ1q4Z7BcDfOok84bkSdj6bzpOOfj5aU8O-KEP7zmAFm8yA/exec";
const STORAGE_KEY = "ruanguang-transactions-v1";
const THEME_KEY = "ruanguang-theme";
const moneyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const palette = ["#625bf6", "#21b987", "#f3a64a", "#f06d75", "#3b9ce7", "#a46be3", "#25b8c2", "#718096"];
const demoTransactions = [
  { id: "demo-1", date: dateOffset(0), category: "Gaji", description: "Gaji bulanan", amount: 12500000, type: "income" },
  { id: "demo-2", date: dateOffset(-1), category: "Makanan", description: "Belanja mingguan", amount: 385000, type: "expense" },
  { id: "demo-3", date: dateOffset(-2), category: "Transportasi", description: "Bensin dan parkir", amount: 175000, type: "expense" },
  { id: "demo-4", date: dateOffset(-4), category: "Tagihan", description: "Internet rumah", amount: 350000, type: "expense" },
  { id: "demo-5", date: dateOffset(-6), category: "Freelance", description: "Proyek desain", amount: 1800000, type: "income" },
  { id: "demo-6", date: dateOffset(-8), category: "Belanja", description: "Keperluan rumah", amount: 620000, type: "expense" },
  { id: "demo-7", date: dateOffset(-11), category: "Hiburan", description: "Nonton akhir pekan", amount: 125000, type: "expense" },
  { id: "demo-8", date: dateOffset(-14), category: "Investasi", description: "Reksa dana", amount: 500000, type: "expense" },
];

let transactions = [];
let cashflowChart;
let categoryChart;
let toastTimer;

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validTransaction(item) {
  return item && typeof item === "object"
    && typeof item.id === "string" && item.id.length > 0
    && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date))
    && typeof item.category === "string"
    && typeof item.description === "string"
    && Number.isFinite(Number(item.amount)) && Number(item.amount) > 0
    && ["income", "expense"].includes(item.type);
}

function normalizeTransaction(item) {
  const transaction = {
    id: String(item.id),
    date: String(item.date).slice(0, 10),
    category: String(item.category).trim(),
    description: String(item.description).trim(),
    amount: Number(item.amount),
    type: item.type,
  };
  if (!validTransaction(transaction) || !transaction.category || !transaction.description) {
    throw new Error("Data transaksi dari server tidak valid.");
  }
  return transaction;
}

function showToast(message, isError = false) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function setSyncing(isSyncing, message = "") {
  const status = document.querySelector("#sync-status");
  status.classList.toggle("syncing", isSyncing);
  document.querySelector("#sync-text").textContent = message || (isSyncing ? "Menyinkronkan..." : "Data tersimpan");
  document.querySelector("#refresh-icon").classList.toggle("spinning", isSyncing);
  document.querySelector("#refresh-button").disabled = isSyncing;
}

function readLocalTransactions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demoTransactions));
      return demoTransactions.map(normalizeTransaction);
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Format penyimpanan lokal tidak valid.");
    return parsed.map(normalizeTransaction);
  } catch (error) {
    console.error("Gagal membaca transaksi lokal:", error);
    showToast("Data lokal tidak dapat dibaca. Periksa penyimpanan browser Anda.", true);
    return [];
  }
}

function saveLocalTransaction(transaction) {
  const index = transactions.findIndex((item) => item.id === transaction.id);
  if (index >= 0) transactions[index] = transaction;
  else transactions.unshift(transaction);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

async function requestTransactions() {
  if (!API_URL) return readLocalTransactions();
  const response = await fetch(API_URL, { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error(`Server mengembalikan status ${response.status}.`);
  const payload = await response.json();
  if (!payload || payload.success !== true || !Array.isArray(payload.data)) {
    throw new Error(payload?.error || "Respons server tidak sesuai format.");
  }
  return payload.data.map(normalizeTransaction);
}

async function persistTransaction(transaction, isUpdate) {
  if (!API_URL) {
    saveLocalTransaction(transaction);
    return;
  }
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: isUpdate ? "update" : "create", transaction }),
  });
  if (!response.ok) throw new Error(`Server mengembalikan status ${response.status}.`);
  const payload = await response.json();
  if (!payload || payload.success !== true || !payload.data) {
    throw new Error(payload?.error || "Transaksi tidak berhasil disimpan.");
  }
  const saved = normalizeTransaction(payload.data);
  const index = transactions.findIndex((item) => item.id === saved.id);
  if (index >= 0) transactions[index] = saved;
  else transactions.unshift(saved);
}

async function loadTransactions(showMessage = false) {
  setSyncing(true);
  try {
    transactions = await requestTransactions();
    render();
    if (showMessage) showToast("Data berhasil disinkronkan.");
  } catch (error) {
    console.error("Sinkronisasi gagal:", error);
    setSyncing(false, "Sinkronisasi gagal");
    showToast(`Gagal memuat data: ${error.message}`, true);
    if (API_URL) {
      document.querySelector("#connection-label").innerHTML = '<span class="status-dot" style="background:#ef6c67"></span> Koneksi gagal';
    }
    return;
  }
  setSyncing(false, API_URL ? "Terhubung ke Google Sheets" : "Data tersimpan di perangkat");
  document.querySelector("#connection-label").innerHTML = API_URL
    ? '<span class="status-dot"></span> Terhubung ke Sheets'
    : '<span class="status-dot"></span> Mode demo';
}

function formatMoney(value) {
  return moneyFormatter.format(value).replace(/\u00a0/g, " ");
}

function displayDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

function renderSummary() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthTransactions = transactions.filter((item) => {
    const [year, month] = item.date.split("-").map(Number);
    return year === currentYear && month === currentMonth + 1;
  });
  const income = monthTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = monthTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const balance = transactions.reduce((sum, item) => sum + (item.type === "income" ? item.amount : -item.amount), 0);
  document.querySelector("#balance-total").textContent = formatMoney(balance);
  document.querySelector("#income-total").textContent = formatMoney(income);
  document.querySelector("#expense-total").textContent = formatMoney(expense);
  const net = document.querySelector("#net-total");
  net.textContent = formatMoney(income - expense);
  net.classList.toggle("text-rose-500", income - expense < 0);
  net.classList.toggle("dark:text-rose-300", income - expense < 0);
}

function monthLabel(date) {
  return new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date);
}

function renderCharts() {
  if (!window.Chart) return;
  const dark = document.documentElement.classList.contains("dark");
  const gridColor = dark ? "rgba(255,255,255,.07)" : "rgba(30,41,59,.07)";
  const textColor = dark ? "#929bad" : "#929bad";
  const months = [];
  const today = new Date();
  for (let offset = 5; offset >= 0; offset -= 1) {
    months.push(new Date(today.getFullYear(), today.getMonth() - offset, 1));
  }
  const incomeData = months.map((month) => transactions.reduce((sum, item) => {
    const [year, monthNumber] = item.date.split("-").map(Number);
    return item.type === "income" && year === month.getFullYear() && monthNumber === month.getMonth() + 1 ? sum + item.amount : sum;
  }, 0));
  const expenseData = months.map((month) => transactions.reduce((sum, item) => {
    const [year, monthNumber] = item.date.split("-").map(Number);
    return item.type === "expense" && year === month.getFullYear() && monthNumber === month.getMonth() + 1 ? sum + item.amount : sum;
  }, 0));

  if (cashflowChart) cashflowChart.destroy();
  cashflowChart = new Chart(document.querySelector("#cashflow-chart"), {
    type: "bar",
    data: {
      labels: months.map(monthLabel),
      datasets: [
        { label: "Pemasukan", data: incomeData, backgroundColor: "#21b987", borderRadius: 5, maxBarThickness: 18 },
        { label: "Pengeluaran", data: expenseData, backgroundColor: "#625bf6", borderRadius: 5, maxBarThickness: 18 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, boxHeight: 7, padding: 18, color: textColor, font: { family: "DM Sans", size: 10 } } }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatMoney(context.raw)}` } } },
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: textColor, font: { family: "DM Sans", size: 10 } } }, y: { beginAtZero: true, grid: { color: gridColor }, border: { display: false }, ticks: { color: textColor, font: { family: "DM Sans", size: 9 }, callback: (value) => value >= 1000000 ? `${value / 1000000}jt` : value >= 1000 ? `${value / 1000}rb` : value } } },
    },
  });

  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const totals = new Map();
  transactions.filter((item) => item.type === "expense" && item.date.startsWith(currentKey)).forEach((item) => totals.set(item.category, (totals.get(item.category) || 0) + item.amount));
  const categories = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const chartCategories = categories.length ? categories : [["Belum ada data", 1]];
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(document.querySelector("#category-chart"), {
    type: "doughnut",
    data: { labels: chartCategories.map(([name]) => name), datasets: [{ data: chartCategories.map(([, amount]) => amount), backgroundColor: palette, borderWidth: 0, hoverOffset: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "72%", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => categories.length ? `${context.label}: ${formatMoney(context.raw)}` : "Belum ada pengeluaran bulan ini" } } } },
  });
  document.querySelector("#category-legend").innerHTML = categories.slice(0, 4).map(([name, amount], index) =>
    `<div class="flex min-w-0 items-center gap-2 text-[10px]"><span class="h-2 w-2 shrink-0 rounded-full" style="background:${palette[index % palette.length]}"></span><span class="truncate text-slate-500 dark:text-slate-400">${escapeHtml(name)}</span><span class="ml-auto font-bold">${formatCompact(amount)}</span></div>`
  ).join("") || '<p class="col-span-2 text-center text-[10px] text-slate-400">Belum ada pengeluaran bulan ini.</p>';
}

function formatCompact(value) {
  if (value >= 1000000) return `Rp${(value / 1000000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  if (value >= 1000) return `Rp${(value / 1000).toLocaleString("id-ID", { maximumFractionDigits: 0 })}rb`;
  return formatMoney(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function renderTransactions() {
  const query = document.querySelector("#search-input").value.trim().toLocaleLowerCase("id");
  const category = document.querySelector("#category-filter").value;
  const from = document.querySelector("#date-from").value;
  const to = document.querySelector("#date-to").value;
  const filtered = transactions.filter((item) => {
    const matchesQuery = !query || `${item.description} ${item.category} ${item.type}`.toLocaleLowerCase("id").includes(query);
    return matchesQuery && (!category || item.category === category) && (!from || item.date >= from) && (!to || item.date <= to);
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const list = document.querySelector("#transaction-list");
  list.innerHTML = filtered.map((item) => {
    const income = item.type === "income";
    return `<tr class="transaction-row">
      <td class="whitespace-nowrap text-slate-500 dark:text-slate-400">${displayDate(item.date)}</td>
      <td><div class="flex items-center gap-2.5"><span class="transaction-icon">${income ? "↗" : "↘"}</span><div class="min-w-0"><p class="max-w-[180px] truncate font-bold text-ink dark:text-slate-100">${escapeHtml(item.description)}</p><p class="mt-0.5 text-[10px] text-slate-400">Transaksi keuangan</p></div></div></td>
      <td><span class="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500 dark:bg-white/5 dark:text-slate-300">${escapeHtml(item.category)}</span></td>
      <td><span class="type-badge ${income ? "income" : "expense"}">${income ? "↗ Masuk" : "↘ Keluar"}</span></td>
      <td class="whitespace-nowrap text-right font-bold ${income ? "text-emerald-600 dark:text-emerald-300" : "text-ink dark:text-slate-100"}">${income ? "+" : "−"} ${formatMoney(item.amount)}</td>
      <td class="text-center"><button class="edit-button" type="button" data-edit="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(item.description)}" title="Edit transaksi">⋯</button></td>
    </tr>`;
  }).join("");
  document.querySelector("#empty-state").classList.toggle("hidden", filtered.length > 0);
  document.querySelector("#transaction-count").textContent = `${filtered.length} transaksi`;
}

function renderCategoryFilters() {
  const select = document.querySelector("#category-filter");
  const previous = select.value;
  const categories = [...new Set(transactions.map((item) => item.category))].sort((a, b) => a.localeCompare(b, "id"));
  select.innerHTML = '<option value="">Semua kategori</option>' + categories.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  if (categories.includes(previous)) select.value = previous;
}

function render() {
  renderSummary();
  renderCategoryFilters();
  renderTransactions();
  renderCharts();
}

function openModal(transaction) {
  const modal = document.querySelector("#transaction-modal");
  const form = document.querySelector("#transaction-form");
  form.reset();
  document.querySelector("#transaction-id").value = transaction?.id || "";
  document.querySelector("#amount-input").value = transaction?.amount ?? "";
  document.querySelector("#date-input").value = transaction?.date || localDateString(new Date());
  document.querySelector("#category-input").value = transaction?.category || "";
  document.querySelector("#description-input").value = transaction?.description || "";
  setTransactionType(transaction?.type || "expense");
  document.querySelector("#modal-title").textContent = transaction ? "Edit transaksi" : "Tambah transaksi";
  document.querySelector("#save-button span").textContent = transaction ? "Simpan perubahan" : "Simpan transaksi";
  document.querySelector("#form-error").classList.add("hidden");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  window.setTimeout(() => document.querySelector("#amount-input").focus(), 100);
}

function closeModal() {
  const modal = document.querySelector("#transaction-modal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setTransactionType(type) {
  document.querySelector("#transaction-type").value = type;
  document.querySelectorAll(".type-option").forEach((button) => button.classList.toggle("selected", button.dataset.type === type));
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
  if (transactions.length) renderCharts();
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  applyTheme(localStorage.getItem(THEME_KEY) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  document.querySelector("#theme-toggle").addEventListener("click", () => applyTheme(document.documentElement.classList.contains("dark") ? "light" : "dark"));
  document.querySelector("#add-transaction").addEventListener("click", () => openModal());
  document.querySelector("#close-modal").addEventListener("click", closeModal);
  document.querySelector("#transaction-modal").addEventListener("click", (event) => {
    if (event.target.id === "transaction-modal") closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
  document.querySelectorAll(".type-option").forEach((button) => button.addEventListener("click", () => setTransactionType(button.dataset.type)));
  ["search-input", "category-filter", "date-from", "date-to"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener(id === "search-input" ? "input" : "change", renderTransactions);
  });
  document.querySelector("#refresh-button").addEventListener("click", () => loadTransactions(true));
  document.querySelector("#transaction-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit]");
    if (!button) return;
    const transaction = transactions.find((item) => item.id === button.dataset.edit);
    if (transaction) openModal(transaction);
  });
  document.querySelector("#transaction-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorElement = document.querySelector("#form-error");
    const id = document.querySelector("#transaction-id").value;
    const transaction = {
      id: id || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      date: document.querySelector("#date-input").value,
      category: document.querySelector("#category-input").value.trim(),
      description: document.querySelector("#description-input").value.trim(),
      amount: Number(document.querySelector("#amount-input").value),
      type: document.querySelector("#transaction-type").value,
    };
    if (!transaction.category || !transaction.description || !Number.isFinite(transaction.amount) || transaction.amount <= 0) {
      errorElement.textContent = "Lengkapi semua kolom dan masukkan nominal lebih dari nol.";
      errorElement.classList.remove("hidden");
      return;
    }
    const saveButton = document.querySelector("#save-button");
    saveButton.disabled = true;
    saveButton.querySelector("span").textContent = "Menyimpan...";
    setSyncing(true);
    try {
      await persistTransaction(normalizeTransaction(transaction), Boolean(id));
      render();
      closeModal();
      showToast(id ? "Perubahan transaksi berhasil disimpan." : "Transaksi baru berhasil disimpan.");
      setSyncing(false, API_URL ? "Terhubung ke Google Sheets" : "Data tersimpan di perangkat");
    } catch (error) {
      console.error("Gagal menyimpan transaksi:", error);
      errorElement.textContent = `Gagal menyimpan: ${error.message}`;
      errorElement.classList.remove("hidden");
      setSyncing(false, "Gagal menyimpan");
      showToast("Transaksi belum tersimpan. Periksa koneksi dan coba lagi.", true);
    } finally {
      saveButton.disabled = false;
      saveButton.querySelector("span").textContent = id ? "Simpan perubahan" : "Simpan transaksi";
    }
  });
  loadTransactions();
});
