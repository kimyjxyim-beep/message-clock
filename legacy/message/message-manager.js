/* Message management controls for the private message-board console. */
(function () {
    var list = document.createElement("section");
    list.className = "message-history";
    list.innerHTML = "<h2>最近留言</h2><div id='message-list'>正在載入…</div>";
    document.querySelector(".box").appendChild(list);

    var style = document.createElement("style");
    style.textContent = ".message-history{margin-top:18px;padding:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:24px}.message-history h2{font-size:16px;margin:0 0 12px}.message-row{display:flex;gap:10px;align-items:center;padding:12px 0;border-top:1px solid rgba(255,255,255,.08)}.message-row:first-child{border-top:0}.message-text{flex:1;overflow-wrap:anywhere;line-height:1.4}.delete-msg-btn{width:auto;margin:0;padding:8px 10px;border-radius:10px;background:rgba(255,96,96,.16);color:#ffaaa5;font-size:13px}.empty-message{color:rgba(255,255,255,.52);font-size:14px}";
    document.head.appendChild(style);

    function headers(xhr) {
        xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
        xhr.setRequestHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);
    }
    function render(rows) {
        var target = document.getElementById("message-list");
        target.innerHTML = "";
        if (!rows.length) { target.textContent = "暫時沒有留言"; target.className = "empty-message"; return; }
        rows.forEach(function (row) {
            var item = document.createElement("div"), text = document.createElement("div"), button = document.createElement("button");
            item.className = "message-row"; text.className = "message-text"; text.textContent = row.content || "（空白留言）";
            button.className = "delete-msg-btn"; button.type = "button"; button.textContent = "刪除";
            button.onclick = function () { remove(row.id, button); };
            item.appendChild(text); item.appendChild(button); target.appendChild(item);
        });
    }
    function load() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", SUPABASE_URL + "/rest/v1/messages?select=id,content,created_at&order=created_at.desc&limit=50", true);
        headers(xhr);
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) render(JSON.parse(xhr.responseText));
            else document.getElementById("message-list").textContent = "留言載入失敗";
        };
        xhr.send();
    }
    function remove(id, button) {
        if (!confirm("確定要刪除這則留言嗎？")) return;
        button.disabled = true;
        var xhr = new XMLHttpRequest();
        xhr.open("DELETE", SUPABASE_URL + "/rest/v1/messages?id=eq." + encodeURIComponent(id), true);
        headers(xhr); xhr.setRequestHeader("Prefer", "return=representation");
        xhr.onload = function () {
            var rows = [];
            try { rows = JSON.parse(xhr.responseText); } catch (e) {}
            if (xhr.status >= 200 && xhr.status < 300 && rows.length) load();
            else { button.disabled = false; alert("刪除權限尚未設定。"); }
        };
        xhr.send();
    }
    document.getElementById("send-msg-btn").addEventListener("click", function () { setTimeout(load, 900); });
    load();
}());
