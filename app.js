// ========== 老 iPad 兼容说明 ==========
// 本文件全部使用 ES5 语法(var / function / XMLHttpRequest)
// 禁止使用: const, let, 箭头函数, async/await, fetch, Promise.then 链式写法
// 目标设备: iPad mini 1 / iOS 9.3.5 / 老版本 Safari

// ========== 时钟 ==========

function flipUpdate(el, newValue) {
    if (el.innerHTML !== newValue) {
        el.classList.add("flip");
        setTimeout(function () {
            el.innerHTML = newValue;
        }, 150);
        setTimeout(function () {
            el.classList.remove("flip");
        }, 300);
    }
}

function updateClock() {

    var now = new Date();

    var hour = now.getHours();
    var minute = now.getMinutes();

    var hourStr = (hour < 10 ? "0" + hour : "" + hour);
    var minuteStr = (minute < 10 ? "0" + minute : "" + minute);

    var hourEl = document.getElementById("hour");
    var minuteEl = document.getElementById("minute");

    flipUpdate(hourEl, hourStr);
    flipUpdate(minuteEl, minuteStr);

    var weekdays = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"];

    document.getElementById("date").innerHTML =
        now.getFullYear() + "年" +
        (now.getMonth() + 1) + "月" +
        now.getDate() + "日 " +
        weekdays[now.getDay()];

    updateBackground(hour);
}

// ========== 背景随时间变化 + 天气叠加 ==========
var currentTimeTheme = null;
var currentWeatherTheme = null;

function applyBodyClass() {
    var body = document.body;
    var classes = [];

    if (currentTimeTheme) classes.push("theme-" + currentTimeTheme);
    if (currentWeatherTheme) classes.push("weather-" + currentWeatherTheme);

    body.className = classes.join(" ");
}

function updateBackground(hour) {

    var theme = "";

    if (hour >= 5 && hour < 8) {
        theme = "sunrise";
    } else if (hour >= 8 && hour < 17) {
        theme = "day";
    } else if (hour >= 17 && hour < 19) {
        theme = "sunset";
    } else if (hour >= 19 && hour < 23) {
        theme = "night";
    } else {
        theme = "midnight";
    }

    if (currentTimeTheme !== theme) {
        currentTimeTheme = theme;
        applyBodyClass();
    }
}

// ========== 真实天气(Open-Meteo,免费无需Key) ==========
var WEATHER_LAT = 23.13;
var WEATHER_LON = 113.26;
var WEATHER_CITY_NAME = "广州";

function weatherCodeToInfo(code) {
    if (code === 0 || code === 1) {
        return { emoji: "☀️", theme: "sunny" };
    }
    if (code === 2 || code === 3) {
        return { emoji: "⛅", theme: "cloudy" };
    }
    if (code >= 45 && code <= 48) {
        return { emoji: "🌫️", theme: "cloudy" };
    }
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
        return { emoji: "🌧️", theme: "rain" };
    }
    if (code >= 71 && code <= 77) {
        return { emoji: "❄️", theme: "snow" };
    }
    if (code >= 95 && code <= 99) {
        return { emoji: "⛈️", theme: "rain" };
    }
    return { emoji: "☁️", theme: "cloudy" };
}

function fetchWeather() {
    // 加上 getTime() 產生時間戳，強制瀏覽器不使用快取
    var timestamp = new Date().getTime();
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + WEATHER_LAT +
        "&longitude=" + WEATHER_LON + "&current_weather=true&_t=" + timestamp;

    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var data = JSON.parse(xhr.responseText);

                    if (data && data.current_weather) {
                        var temp = Math.round(data.current_weather.temperature);
                        var code = data.current_weather.weathercode;
                        var info = weatherCodeToInfo(code);

                        document.getElementById("weather").innerHTML =
                            info.emoji + " " + WEATHER_CITY_NAME + " " + temp + "°C";

                        if (currentWeatherTheme !== info.theme) {
                            currentWeatherTheme = info.theme;
                            applyBodyClass();
                        }
                    }
                } catch (e) {
                    console.log("解析天气数据失败:", e);
                }
            } else {
                console.log("获取天气失败,状态码:", xhr.status);
            }
        }
    };

    xhr.send();
}

// ========== 提示音(用 Web Audio 合成,不依赖外部文件) ==========
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
    } catch (e) {
        console.log("播放提示音失败:", e);
    }
}

// ========== 留言系统(直接调用 Supabase REST API,不用官方JS库) ==========
var lastMessageContent = null;
var firstMessageLoad = true;

function fetchLatestMessage() {

    if (typeof SUPABASE_URL === "undefined" || SUPABASE_URL.indexOf("YOUR-PROJECT-ID") !== -1) {
        document.getElementById("message").innerHTML = "请先在 config.js 里配置 Supabase";
        return;
    }

    var url = SUPABASE_URL + "/rest/v1/messages?select=content,created_at&order=created_at.desc&limit=1";

    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY);

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var data = JSON.parse(xhr.responseText);

                    if (data && data.length > 0) {
                        var content = data[0].content;

                        if (content !== lastMessageContent) {
                            document.getElementById("message").innerHTML = content;

                            if (!firstMessageLoad) {
                                playDing();
                                var msgBox = document.querySelector(".message");
                                msgBox.classList.add("pulse");
                                setTimeout(function () {
                                    msgBox.classList.remove("pulse");
                                }, 800);
                            }

                            lastMessageContent = content;
                            firstMessageLoad = false;
                        }
                    }
                } catch (e) {
                    console.log("解析留言数据失败:", e);
                }
            } else {
                console.log("获取留言失败,状态码:", xhr.status);
            }
        }
    };

    xhr.send();
}

// ========== 启动 ==========
updateClock();
setInterval(updateClock, 1000);

// 留言系統目前保持註解，若有配置 Supabase 再將下方兩行取消註解
// fetchLatestMessage();
// setInterval(fetchLatestMessage, 5000);

fetchWeather();
// 設定為每 10 分鐘 (10 * 60 * 1000 毫秒) 抓取一次天氣，可根據需求調整
setInterval(fetchWeather, 10 * 60 * 1000);