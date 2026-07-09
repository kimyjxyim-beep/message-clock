let supabaseClient = null;
if (typeof supabase !== "undefined" && SUPABASE_URL.indexOf("YOUR-PROJECT-ID") === -1) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const contentEl = document.getElementById("content");
const sendBtn = document.getElementById("send-btn");
const statusEl = document.getElementById("status");
const historyEl = document.getElementById("history");

async function sendMessage() {

    const text = contentEl.value.trim();

    if (!text) {
        statusEl.innerHTML = "请先输入内容";
        return;
    }

    if (!supabaseClient) {
        statusEl.innerHTML = "请先在 config.js 配置 Supabase";
        return;
    }

    sendBtn.disabled = true;
    statusEl.innerHTML = "发送中...";

    const { error } = await supabaseClient
        .from("messages")
        .insert([{ content: text }]);

    sendBtn.disabled = false;

    if (error) {
        statusEl.innerHTML = "发送失败,请重试";
        console.log(error);
        return;
    }

    statusEl.innerHTML = "已发送 ✔";
    contentEl.value = "";
    loadHistory();

    setTimeout(function () {
        statusEl.innerHTML = "";
    }, 2000);
}

async function loadHistory() {

    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from("messages")
        .select("content, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

    if (error || !data) return;

    historyEl.innerHTML = "";

    data.forEach(function (item) {
        const div = document.createElement("div");
        div.className = "history-item";

        const time = new Date(item.created_at);
        const timeStr = time.getMonth() + 1 + "月" + time.getDate() + "日 " +
            (time.getHours() < 10 ? "0" + time.getHours() : time.getHours()) + ":" +
            (time.getMinutes() < 10 ? "0" + time.getMinutes() : time.getMinutes());

        div.innerHTML = item.content + '<span class="time">' + timeStr + "</span>";
        historyEl.appendChild(div);
    });
}

sendBtn.addEventListener("click", sendMessage);
loadHistory();
