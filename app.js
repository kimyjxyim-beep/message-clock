function flipUpdate(el, newValue) {
    if (el.innerHTML !== newValue) {
        el.classList.add("flip");
        setTimeout(function () { el.innerHTML = newValue; }, 150);
        setTimeout(function () { el.classList.remove("flip"); }, 300);
    }
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

    flipUpdate(document.getElementById("hour"), hourStr);
    flipUpdate(document.getElementById("minute"), minuteStr);
    
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
