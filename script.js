// -----------------------------
// INIT SUPABASE
// -----------------------------
const supabaseUrl = "https://wsbpzqtgakkygqpetqrb.supabase.co";
const supabaseKey = "sb_publishable_b8y_NFKJekacZyGfgvgkPQ_cJ4UR2FG";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// -----------------------------
// ELEMENTI HTML
// -----------------------------
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const toggleAuthContainer = document.getElementById("toggleAuthMode");
const userEmailSpan = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

const tabs = document.querySelectorAll(".tab-btn");
const sections = document.querySelectorAll(".tab-content");
const addForm = document.getElementById("addForm");
const amountInput = document.getElementById("amount");
const dateInput = document.getElementById("date");
const typeSelect = document.getElementById("type");
const categorySelect = document.getElementById("category");
const descriptionInput = document.getElementById("description");

const ctx = document.getElementById("earningsChart").getContext("2d");
const periodSelect = document.getElementById("chart-period");

const totalEarningsEl = document.getElementById("totalEarnings");
const transactionCountEl = document.getElementById("transactionCount");
const averageEarningsEl = document.getElementById("averageEarnings");
const categoryCountEl = document.getElementById("categoryCount");

let registerMode = false;
let currentUser = null;
let earnings = [];
let editIndex = null;
let currentChart = null;

// -----------------------------
// LOGIN / REGISTRAZIONE
// -----------------------------
function toggleAuthMode(isRegister) {
    registerMode = isRegister;
    authSubmit.textContent = registerMode ? "Registrati" : "Accedi";
    toggleAuthContainer.innerHTML = registerMode
        ? `Hai già un account? <a href="#" id="switchToLogin">Accedi</a>`
        : `Non hai un account? <a href="#" id="switchToRegister">Registrati</a>`;
}

toggleAuthContainer.addEventListener("click", e => {
    e.preventDefault();
    if (e.target.id === "switchToRegister") toggleAuthMode(true);
    if (e.target.id === "switchToLogin") toggleAuthMode(false);
});

authForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();

    if (registerMode) {
        const { user, error } = await supabase.auth.signUp({ email, password });
        if (error) return alert(error.message);
        alert("Registrazione completata! Ora puoi accedere.");
        toggleAuthMode(false);
        authForm.reset();
    } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return alert(error.message);
        currentUser = data.user;
        showApp();
    }
});

// Controllo sessione
supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) {
        currentUser = user;
        showApp();
    }
});

logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    currentUser = null;
    earnings = [];
    appSection.classList.add("hidden");
    authSection.classList.remove("hidden");
    toggleAuthMode(false);
    authForm.reset();
});

// -----------------------------
// APP PRINCIPALE
// -----------------------------
function showApp() {
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    userEmailSpan.textContent = currentUser.email;
    setToday();
    loadEarnings();
    window.scrollTo({ top: 0, behavior: "instant" });
}

// -----------------------------
// Earnings CRUD
// -----------------------------
async function loadEarnings() {
    if (!currentUser) return;
    const { data, error } = await supabase
        .from("guadagni")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("date", { ascending: false });
    if (error) return alert(error.message);
    earnings = data.map(e => ({
        id: e.id,
        amount: e.amount,
        date: e.date,
        category: e.category,
        description: e.description
    }));
    updateOverview();
}

async function saveEarning(earning) {
    const { error } = await supabase.from("guadagni").insert([earning]);
    if (error) alert(error.message);
}

addForm.addEventListener("submit", async e => {
    e.preventDefault();
    const amountRaw = parseFloat(amountInput.value);
    if (isNaN(amountRaw) || amountRaw <= 0) return alert("Importo non valido");
    const type = typeSelect.value;
    const amount = type === "expense" ? -amountRaw : amountRaw;
    const date = dateInput.value || new Date().toISOString().split("T")[0];
    const category = categorySelect.value;
    const description = descriptionInput.value.trim();

    const earning = { user_id: currentUser.id, amount, date, category, description };
    await saveEarning(earning);
    addForm.reset();
    setToday();
    loadEarnings();
});

async function updateEarning(id, updated) {
    const { error } = await supabase.from("guadagni").update(updated).eq("id", id);
    if (error) alert(error.message);
}

async function deleteEarning(index) {
    if (!confirm("Vuoi davvero eliminare questo guadagno?")) return;
    const id = earnings[index].id;
    const { error } = await supabase.from("guadagni").delete().eq("id", id);
    if (error) return alert(error.message);
    loadEarnings();
}

function openEditModal(index) {
    editIndex = index;
    const e = earnings[index];
    document.getElementById("editAmount").value = Math.abs(e.amount);
    document.getElementById("editDate").value = e.date;
    document.getElementById("editCategory").value = e.category;
    document.getElementById("editDescription").value = e.description || "";
    document.getElementById("editType").value = e.amount >= 0 ? "income" : "expense";
    document.getElementById("editModal").classList.remove("hidden");
}

document.getElementById("saveEdit").addEventListener("click", async () => {
    const updatedAmount = parseFloat(document.getElementById("editAmount").value);
    const updatedDate = document.getElementById("editDate").value;
    const updatedCategory = document.getElementById("editCategory").value;
    const updatedDescription = document.getElementById("editDescription").value;
    const updatedType = document.getElementById("editType").value;
    if (isNaN(updatedAmount) || updatedAmount <= 0) return alert("Importo non valido");
    const amount = updatedType === "expense" ? -updatedAmount : updatedAmount;
    const updated = { amount, date: updatedDate, category: updatedCategory, description: updatedDescription };
    await updateEarning(earnings[editIndex].id, updated);
    closeEditModal();
    loadEarnings();
});

function closeEditModal() {
    document.getElementById("editModal").classList.add("hidden");
}

// -----------------------------
// Overview e grafici
// -----------------------------
function updateOverview() {
    const total = earnings.reduce((sum, e) => sum + e.amount, 0);
    const count = earnings.length;
    const avg = count ? total / count : 0;
    const categories = [...new Set(earnings.map(e => e.category))];
    totalEarningsEl.textContent = total.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
    transactionCountEl.textContent = count;
    averageEarningsEl.textContent = avg.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
    categoryCountEl.textContent = categories.length;
    renderRecent();
    renderChart();
}

function renderRecent() {
    const container = document.getElementById("recentListContainer");
    const sortMethod = document.getElementById("sortSelect")?.value || "date_desc";
    if (!earnings.length) {
        container.innerHTML = `<div class="no-data">Nessun guadagno registrato</div>`;
        return;
    }
    const sorted = sortEarnings(earnings, sortMethod);
    const recent = sorted.slice(-20).reverse();
    container.innerHTML = recent.map((e) => {
        const index = earnings.findIndex(item => item.id === e.id);
        return `<li class="recent-item">
        <span>${new Date(e.date).toLocaleDateString()} — ${e.category} <strong>${e.amount.toLocaleString("it-IT",{style:"currency",currency:"EUR"})}</strong></span>
        <div class="actions">
          <button class="edit-btn" data-index="${index}">✏️</button>
          <button class="delete-btn" data-index="${index}">🗑</button>
        </div>
      </li>`;
    }).join("");
    document.querySelectorAll(".delete-btn").forEach(btn => btn.addEventListener("click", () => deleteEarning(btn.dataset.index)));
    document.querySelectorAll(".edit-btn").forEach(btn => btn.addEventListener("click", () => openEditModal(btn.dataset.index)));
}

function renderChart() {
    if (currentChart) currentChart.destroy();
    const grouped = {};
    const period = periodSelect.value;
    earnings.forEach(e => {
        const d = new Date(e.date);
        let key = period === "year" ? d.getFullYear() :
                period === "month" ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` :
                e.date;
        grouped[key] = (grouped[key] || 0) + e.amount;
    });
    const labels = Object.keys(grouped).sort();
    const values = labels.map(k => grouped[k]);
    currentChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets: [{ data: values, borderColor: "#00b275", backgroundColor: "rgba(0,178,117,0.2)", fill: true }] },
        options: { plugins: { legend: { display: false } } }
    });
}
periodSelect.addEventListener("change", renderChart);

function sortEarnings(list, method) {
    const sorted = [...list];
    switch (method) {
        case "date_desc": return sorted.sort((a,b) => new Date(b.date) - new Date(a.date));
        case "date_asc": return sorted.sort((a,b) => new Date(a.date) - new Date(b.date));
        case "amount_desc": return sorted.sort((a,b) => b.amount - a.amount);
        case "amount_asc": return sorted.sort((a,b) => a.amount - b.amount);
        case "category_asc": return sorted.sort((a,b) => a.category.localeCompare(b.category));
        case "category_desc": return sorted.sort((a,b) => b.category.localeCompare(a.category));
        default: return sorted;
    }
}

// -----------------------------
// Tabs
// -----------------------------
tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        sections.forEach(s => s.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.tab).classList.add("active");
        if (tab.dataset.tab === "charts") renderChart();
    });
});

// -----------------------------
// Utilities
// -----------------------------
function setToday() {
    dateInput.value = new Date().toISOString().split("T")[0];
}

// Dark Mode
const darkToggle = document.getElementById("darkModeToggle");
if (localStorage.getItem("trackmoney_darkmode") === "true") {
    document.body.classList.add("dark-mode");
    darkToggle.textContent = "☀️";
}
darkToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("trackmoney_darkmode", isDark);
    darkToggle.textContent = isDark ? "☀️" : "🌙";
});
