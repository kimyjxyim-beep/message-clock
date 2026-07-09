var msgContentEl = document.getElementById("msg-content");
var sendMsgBtn = document.getElementById("send-msg-btn");
var statusEl = document.getElementById("status");

function sendData() {
    var text = msgContentEl.value.replace(/^\s+|\s+$/g, "");
    if (!text) {
        statusEl.innerHTML = "请先输入内容";
        return;
    }
    sendMsgBtn.disabled = true;
    statusEl.innerHTML = "发送中...";

    var xhr = new XMLHttpRequest();
    xhr.open("POST", SUPABASE_URL + "/rest/v1/messages", true);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Prefer", "return=minimal");

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            sendMsgBtn.disabled = false;
            if (xhr.status >= 200 && xhr.status < 300) {
                statusEl.innerHTML = "更新成功 ✔";
                msgContentEl.value = "";
                setTimeout(function () { statusEl.innerHTML = ""; }, 2000);
            } else {
                statusEl.innerHTML = "发送失败,请重试";
            }
        }
    };
    xhr.send(JSON.stringify({ content: text }));
}

sendMsgBtn.addEventListener("click", sendData);
