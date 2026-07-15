function flipUpdate(prefix, newValue) {
    var card = document.getElementById(prefix + "-card");
    var topNum = document.getElementById(prefix + "-top-num");
    var bottomNum = document.getElementById(prefix + "-bottom-num");
    var frontNum = document.getElementById(prefix + "-front-num");
    var backNum = document.getElementById(prefix + "-back-num");

    if (!card || topNum.innerHTML === newValue) return;

    // 前頁（翻走的那一半）先顯示舊值，後頁（翻進來的那一半）先放好新值
    frontNum.innerHTML = topNum.innerHTML;
    backNum.innerHTML = newValue;

    // 上半靜態頁可以立刻換成新值，因為此刻完全被前頁蓋住，不會看到跳動
    topNum.innerHTML = newValue;

    // 觸發翻頁：前頁往下倒下 0deg -> -90deg，後頁延遲後 90deg -> 0deg 翻入定位
    card.classList.add("flip");

    // 動畫結束（前頁 0.22s + 後頁延遲 0.2s + 0.22s ≈ 0.42s）後收尾
    setTimeout(function () {
        bottomNum.innerHTML = newValue;   // 此刻被後頁完全蓋住，不會看到跳動
        card.classList.add("no-anim");    // 瞬間復位，不要有動畫
        card.classList.remove("flip");
        frontNum.innerHTML = newValue;    // 前頁復位後應與新值一致
        void card.offsetWidth;            // 強制 reflow
        card.classList.remove("no-anim");
    }, 430);
}

function updateTheme(hour) {
    var body = document.body;
    var newTheme = "";
    
    if (hour >= 5 && hour < 8) {
        newTheme = "theme-sunrise";
    } else if (hour >= 8 && hour < 17) {
        newTheme = "theme-day";
    } else if (hour >= 17 && hour < 19) {
        newTheme = "theme-sunset";
    } else if (hour >= 19 && hour < 24) {
        newTheme = "theme-night";
    } else {
        newTheme = "theme-midnight";
    }

    if (body.className !== newTheme) {
        body.className = newTheme;
    }
}

function updateClock() {
    var now = new Date();
    var hour = now.getHours();
    var minute = now.getMinutes();
    var hourStr = (hour < 10 ? "0" + hour : "" + hour);
    var minuteStr = (minute < 10 ? "0" + minute : "" + minute);

    flipUpdate("hour", hourStr);
    flipUpdate("minute", minuteStr);
    
    // 每次更新時間時，檢查並切換背景主題
    updateTheme(hour);

    var weekdays = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"];
    document.getElementById("date").innerHTML =
        now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日 " + weekdays[now.getDay()];
}

var WEATHER_LAT = 23.13;
var WEATHER_LON = 113.26;
var WEATHER_CITY_NAME = "广州";

function weatherCodeToInfo(code) {
    if (code === 0 || code === 1) return { emoji: "☀️" };
    if (code === 2 || code === 3) return { emoji: "⛅" };
    if (code >= 45 && code <= 48) return { emoji: "🌫️" };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { emoji: "🌧️" };
    if (code >= 71 && code <= 77) return { emoji: "❄️" };
    if (code >= 95 && code <= 99) return { emoji: "⛈️" };
    return { emoji: "☁️" };
}

function fetchWeather() {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + WEATHER_LAT + "&longitude=" + WEATHER_LON + "&current_weather=true";
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
            try {
                var data = JSON.parse(xhr.responseText);
                if (data && data.current_weather) {
                    var temp = Math.round(data.current_weather.temperature);
                    var info = weatherCodeToInfo(data.current_weather.weathercode);
                    document.getElementById("weather").innerHTML = info.emoji + " " + WEATHER_CITY_NAME + " " + temp + "°C";
                }
            } catch (e) {}
        }
    };
    xhr.send();
}

function playDing() {
    try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        var ctx = new AudioCtx();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch (e) {}
}

var lastTopMessage = null;
var firstMessageLoad = true;

function fetchLatestMessage() {
    if (typeof SUPABASE_URL === "undefined") return;

    var url = SUPABASE_URL + "/rest/v1/messages?select=content,created_at&order=created_at.desc&limit=4";
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
            try {
                var data = JSON.parse(xhr.responseText);
                if (data && data.length > 0) {
                    var currentTopMessage = data[0].content;
                    
                    if (currentTopMessage !== lastTopMessage) {
                        var htmlList = "";
                        for (var i = 0; i < data.length; i++) {
                            htmlList += "<div class='msg-item'>💬 " + data[i].content + "</div>";
                        }
                        
                        document.getElementById("message").innerHTML = htmlList;
                        
                        if (!firstMessageLoad) {
                            playDing();
                            var msgBox = document.querySelector(".message");
                            msgBox.classList.add("pulse");
                            setTimeout(function () { msgBox.classList.remove("pulse"); }, 800);
                        }
                        
                        lastTopMessage = currentTopMessage;
                        firstMessageLoad = false;
                    }
                }
            } catch (e) {}
        }
    };
    xhr.send();
}

updateClock();
setInterval(updateClock, 1000);
fetchLatestMessage();
setInterval(fetchLatestMessage, 5000);
fetchWeather();
setInterval(fetchWeather, 10 * 60 * 1000);

/* 金主：輕量互動與本機狀態 */
(function initJinzhu() {
    var cat = document.getElementById("jinzhu-cat");
    var bubble = document.getElementById("jinzhu-bubble");
    var panel = document.getElementById("jinzhu-panel");
    if (!cat || !bubble || !panel) return;

    var storageKey = "messageClockJinzhuState";
    var state = { mood: 72, energy: 68, bond: 40 };
    try {
        var saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved) {
            if (isFinite(Number(saved.mood))) state.mood = Number(saved.mood);
            if (isFinite(Number(saved.energy))) state.energy = Number(saved.energy);
            if (isFinite(Number(saved.bond))) state.bond = Number(saved.bond);
        }
    } catch (e) {}

    var lines = ["今日有冇摸我？", "食齋食齋！！🌱🥬", "我唔系宠物，我系金主。", "你做嘢，我监督。"];
    var actionLines = {
        pet: ["摸多兩下都可以嘅。", "唔係我想你摸，係你手凍。"],
        feed: ["菜菜放低，我自己食。🌱", "勉強合格，聽日繼續。"],
        chat: ["你講，我有聽。", "今日做得點呀？我監督你。"]
    };
    var bubbleTimer;

    function clamp(value) { return Math.max(0, Math.min(100, value)); }
    function saveAndRender() {
        state.mood = clamp(state.mood);
        state.energy = clamp(state.energy);
        state.bond = clamp(state.bond);
        document.getElementById("jinzhu-mood").textContent = state.mood;
        document.getElementById("jinzhu-energy").textContent = state.energy;
        document.getElementById("jinzhu-bond").textContent = state.bond;
        try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) {}
    }
    function say(text) {
        bubble.textContent = text;
        bubble.classList.add("show");
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(function () { bubble.classList.remove("show"); }, 3200);
    }
    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

    cat.addEventListener("click", function () {
        panel.hidden = !panel.hidden;
        say(pick(lines));
    });
    panel.addEventListener("click", function (event) {
        var button = event.target.closest("[data-jinzhu-action]");
        if (!button) return;
        var action = button.getAttribute("data-jinzhu-action");
        if (action === "pet") { state.mood += 6; state.bond += 3; state.energy -= 1; }
        if (action === "feed") { state.energy += 10; state.mood += 3; state.bond += 1; }
        if (action === "chat") { state.bond += 5; state.mood += 2; state.energy -= 2; }
        saveAndRender();
        say(pick(actionLines[action]));
    });
    saveAndRender();
})();
