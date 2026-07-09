// 纯 ES5 写法,避免任何设备兼容性问题

var contentEl = document.getElementById("content");
var sendBtn = document.getElementById("send-btn");
var statusEl = document.getElementById("status");
var historyEl = document.getElementById("history");

function isConfigured() {
    return typeof SUPABASE_URL !== "undefined" && SUPABASE_URL.indexOf("YOUR-PROJECT-ID") === -1;
}

function sendMessage() {

    var text = contentEl.value.replace(/^\s+|\s+$/g, ""); // 去除首尾空格,兼容老浏览器(没有 trim 也没关系)

    if (!text) {
        statusEl.innerHTML = "请先输入内容";
        return;
    }

    if (!isConfigured()) {
        statusEl.innerHTML = "请先在 config.js 配置 Supabase";
        return;
    }

    sendBtn.disabled = true;
    statusEl.innerHTML = "发送中...";

    var url = SUPABASE_URL + "/rest/v1/messages";

    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Prefer", "return=minimal");

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            sendBtn.disabled = false;

            if (xhr.status >= 200 && xhr.status < 300) {
                statusEl.innerHTML = "已发送 ✔";
                contentEl.value = "";
                loadHistory();

                setTimeout(function () {
                    statusEl.innerHTML = "";
                }, 2000);
            } else {
                statusEl.innerHTML = "发送失败,请重试";
                console.log("发送失败,状态码:", xhr.status, xhr.responseText);
            }
        }
    };

    xhr.send(JSON.stringify({ content: text }));
}

function loadHistory() {

    if (!isConfigured()) return;

    var url = SUPABASE_URL + "/rest/v1/messages?select=content,created_at&order=created_at.desc&limit=5";

    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
            try {
                var data = JSON.parse(xhr.responseText);
                historyEl.innerHTML = "";

                for (var i = 0; i < data.length; i++) {
                    var item = data[i];
                    var div = document.createElement("div");
                    div.className = "history-item";

                    var time = new Date(item.created_at);
                    var h = time.getHours();
                    var m = time.getMinutes();
                    var timeStr = (time.getMonth() + 1) + "月" + time.getDate() + "日 " +
                        (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);

                    div.innerHTML = item.content + '<span class="time">' + timeStr + "</span>";
                    historyEl.appendChild(div);
                }
            } catch (e) {
                console.log("解析历史留言失败:", e);
            }
        }
    };

    xhr.send();
}

sendBtn.addEventListener("click", sendMessage);
loadHistory();
