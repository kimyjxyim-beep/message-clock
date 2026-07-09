// ========== 初始化 Supabase ==========
let supabaseClient = null;
if (typeof supabase !== "undefined" && SUPABASE_URL.indexOf("YOUR-PROJECT-ID") === -1) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ========== 时钟 ==========
let lastHour = null;
let lastMinute = null;

function flipUpdate(el, newValue) {
    // 如果数字变了,加一个翻页动效
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
let currentTimeTheme = null;
let currentWeatherTheme = null;

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
// 默认坐标是广州,如果人在别的城市,改这两个数字就行
var WEATHER_LAT = 23.13;
var WEATHER_LON = 113.26;
var WEATHER_CITY_NAME = "广州";

function weatherCodeToInfo(code) {
    // WMO 天气码简化映射
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

async function fetchWeather() {
    try {
        var url = "https://api.open-meteo.com/v1/forecast?latitude=" + WEATHER_LAT +
            "&longitude=" + WEATHER_LON + "&current_weather=true";

        var res = await fetch(url);
        var data = await res.json();

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
        console.log("获取天气失败:", e);
    }
}

// ========== 提示音(用 Web Audio 合成,不依赖外部文件) ==========
function playDing() {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
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
        // 老 iPad 上 Web Audio 可能受限,静默失败即可
        console.log("播放提示音失败:", e);
    }
}

// ========== 留言系统 ==========
let lastMessageContent = null;
let firstMessageLoad = true;

async function fetchLatestMessage() {

    if (!supabaseClient) {
        // 没配置 Supabase 时,保底显示提示
        document.getElementById("message").innerHTML = "请先在 config.js 里配置 Supabase";
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from("messages")
            .select("content, created_at")
            .order("created_at", { ascending: false })
            .limit(1);

        if (error) {
            console.log("获取留言出错:", error);
            return;
        }

        if (data && data.length > 0) {
            var content = data[0].content;

            if (content !== lastMessageContent) {
                document.getElementById("message").innerHTML = content;

                // 第一次加载不响铃,只有后续内容变化才响
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
        console.log("留言请求异常:", e);
    }
}

// ========== 启动 ==========
updateClock();
setInterval(updateClock, 1000);

fetchLatestMessage();
setInterval(fetchLatestMessage, 5000); // 每5秒查一次新留言

fetchWeather();
setInterval(fetchWeather, 10 * 60 * 1000); // 每10分钟刷新一次天气
