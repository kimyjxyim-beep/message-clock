/* Page bootstrap: clock, weather, message board, and wallpaper compatibility. */
/* Lively Wallpaper mode: keep the clock/weather atmosphere, hide pet controls.
   Use a string fallback so the page still works on old iPad Safari. */
(function () {
    try {
        var isWallpaper = /(?:^|&)wallpaper=1(?:&|$)/.test((location.search || '').replace(/^\?/, ''));
        if (isWallpaper && document.documentElement) document.documentElement.classList.add('wallpaper-mode');
    } catch (e) { /* wallpaper mode is optional */ }
}());

function flipUpdate(prefix, newValue) {
    var card = document.getElementById(prefix + "-card");
    var topNum = document.getElementById(prefix + "-top-num");
    var bottomNum = document.getElementById(prefix + "-bottom-num");
    var frontNum = document.getElementById(prefix + "-front-num");
    var backNum = document.getElementById(prefix + "-back-num");

    if (!card || topNum.innerHTML === newValue) return false;

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
    return true;
}

function updateTheme(hour) {
    if (window.JINZHU_WORLD_V1) return;
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
    var second = now.getSeconds();
    var hourStr = (hour < 10 ? "0" + hour : "" + hour);
    var minuteStr = (minute < 10 ? "0" + minute : "" + minute);

    var hourFlipped = flipUpdate("hour", hourStr);
    var minuteFlipped = flipUpdate("minute", minuteStr);
    try {
        /* The tick is only for the once-an-hour scratch cue.  A layout
           recalculation on every second cancels mobile CSS transitions and
           made Jinzhu visibly blink back to her target position. */
        window.dispatchEvent(new CustomEvent("jinzhu:clock-tick", { detail: { hour: hourStr, minute: minuteStr, second: second } }));
        if (hourFlipped || minuteFlipped) {
            window.dispatchEvent(new CustomEvent("jinzhu:clock-change", { detail: { hour: hourStr, minute: minuteStr, second: second } }));
        }
        if (hourFlipped) window.dispatchEvent(new CustomEvent("jinzhu:clock-flip", { detail: { card: "hour", hour: hourStr, minute: minuteStr } }));
        if (minuteFlipped) window.dispatchEvent(new CustomEvent("jinzhu:clock-flip", { detail: { card: "minute", hour: hourStr, minute: minuteStr } }));
    } catch (e) {}

    // 每次更新時間時，檢查並切換背景主題
    updateTheme(hour);

    var weekdays = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"];
    document.getElementById("date").innerHTML =
        now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日 " + weekdays[now.getDay()];
}

var WEATHER_LAT = 23.1291;
var WEATHER_LON = 113.2644;
var WEATHER_CITY_NAME = "广州";
var WEATHER_TIMEZONE = "Asia/Shanghai";

function weatherCodeToInfo(code) {
    if (code === 0 || code === 1) return { emoji: "☀️" };
    if (code === 2 || code === 3) return { emoji: "⛅" };
    if (code >= 45 && code <= 48) return { emoji: "🌫️" };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { emoji: "🌧️" };
    if (code >= 71 && code <= 77) return { emoji: "❄️" };
    if (code >= 95 && code <= 99) return { emoji: "⛈️" };
    return { emoji: "☁️" };
}

// Use the US AQI scale because its category ranges are well-defined.  The
// value remains real API data; absence is shown plainly as "--".
function aqiCategoryText(aqi) {
    if (aqi === null || aqi === undefined || isNaN(aqi)) return null;
    if (aqi <= 50) return "优";
    if (aqi <= 100) return "良";
    if (aqi <= 150) return "轻度污染";
    if (aqi <= 200) return "中度污染";
    if (aqi <= 300) return "重度污染";
    return "严重污染";
}

var WEATHER_CACHE_KEY = "jinzhu_weather_cache_v1";
var WEATHER_CACHE_MAX_AGE = 15 * 60 * 1000; // 缓存超过15分钟不再当作即时数据使用
var WEATHER_REFRESH_MS = 25 * 60 * 1000;
var weatherRequestInFlight = false;
var weatherRefreshTimer = null;

function weatherCondition(raw) {
    var code = Number(raw.code);
    var actual = Number(raw.temperature);
    var apparent = Number(raw.apparentTemperature);
    var feelsLike = isFinite(apparent) ? apparent : actual;
    if (code >= 95 || (Number(raw.precipitation) > 2 && code >= 80)) return "storm";
    if (Number(raw.rain) > 0 || Number(raw.precipitation) > 0 || (code >= 51 && code <= 82)) return "rain";
    if (raw.isDay && (actual >= 32 || feelsLike >= 35)) return "hot";
    if (actual <= 10) return "cold";
    if (!raw.isDay) return "night";
    if (code === 0 || code === 1) return "clear";
    return "cloudy";
}

/* The only weather shape emitted to the rest of the app.  Legacy fields such
   as code/rain are retained solely for jinzhu-world's existing renderer. */
function standardizeWeather(raw, options) {
    options = options || {};
    var now = Date.now();
    var result = {
        code: Number(raw.code),
        temperature: isFinite(Number(raw.temperature)) ? Number(raw.temperature) : null,
        apparentTemperature: isFinite(Number(raw.apparentTemperature)) ? Number(raw.apparentTemperature) : null,
        humidity: isFinite(Number(raw.humidity)) ? Number(raw.humidity) : null,
        windSpeed: isFinite(Number(raw.windSpeed)) ? Number(raw.windSpeed) : null,
        precipitation: isFinite(Number(raw.precipitation)) ? Number(raw.precipitation) : 0,
        rain: isFinite(Number(raw.rain)) ? Number(raw.rain) : 0,
        isDay: !!raw.isDay,
        aqi: isFinite(Number(raw.aqi)) ? Number(raw.aqi) : null,
        sunrise: raw.sunrise || null,
        sunset: raw.sunset || null,
        timezone: WEATHER_TIMEZONE,
        utcOffsetSeconds: 28800,
        updatedAt: Number(raw.updatedAt) || now,
        isCached: !!options.isCached,
        isStale: !!options.isStale
    };
    result.condition = weatherCondition(result);
    return result;
}

function syncJinzhuWeather(payload) {
    var bridge = window.JinzhuBridge;
    if (!bridge) return;
    var rainy = payload.condition === "rain" || payload.condition === "storm";
    if (bridge.requestRain) bridge.requestRain(rainy);
    if (bridge.requestHeat) bridge.requestHeat(payload.condition === "hot");
}

function renderWeather(payload) {
    var info = weatherCodeToInfo(payload.code);
    var temperature = Number(payload.temperature);
    var tempText = isFinite(temperature) ? Math.round(temperature) + "°C" : "--°C";
    document.getElementById("weather").innerHTML = info.emoji + " " + WEATHER_CITY_NAME + " " + tempText;

    var humEl = document.getElementById("weather-humidity");
    if (humEl) {
        humEl.textContent = (payload.humidity !== null && payload.humidity !== undefined && !isNaN(payload.humidity))
            ? Math.round(payload.humidity) + "%"
            : "--%";
    }

    var aqiEl = document.getElementById("weather-aqi");
    if (aqiEl) {
        var aqiText = aqiCategoryText(payload.aqi);
        aqiEl.textContent = (payload.aqi !== null && payload.aqi !== undefined && !isNaN(payload.aqi))
            ? Math.round(payload.aqi) + " " + aqiText
            : "--";
    }
}

function saveWeatherCache(payload) {
    try {
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload: payload }));
    } catch (e) {}
}

function loadWeatherCache() {
    try {
        var raw = localStorage.getItem(WEATHER_CACHE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.payload) return null;
        var stale = Date.now() - parsed.savedAt > WEATHER_CACHE_MAX_AGE;
        return standardizeWeather(parsed.payload, { isCached: true, isStale: stale });
    } catch (e) {
        return null;
    }
}

function fetchWeather() {
    if (document.hidden || weatherRequestInFlight) return;
    weatherRequestInFlight = true;
    // 主要天气：加入 relative_humidity_2m，之前完全没有请求这个字段，所以湿度永远是 --%
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + WEATHER_LAT + "&longitude=" + WEATHER_LON +
        "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,precipitation,rain,wind_speed_10m,is_day" +
        "&daily=sunrise,sunset&timezone=" + encodeURIComponent(WEATHER_TIMEZONE) + "&forecast_days=1";
    // AQI 用独立的空气质量接口，同样不需要 API Key
    var aqiUrl = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" + WEATHER_LAT + "&longitude=" + WEATHER_LON +
        "&current=us_aqi&timezone=" + encodeURIComponent(WEATHER_TIMEZONE);

    var pending = { weather: null, aqi: undefined }; // aqi 用 undefined 表示"还没回来"

    function tryFinish() {
        if (pending.weather === null || pending.aqi === undefined) return;
        var payload = standardizeWeather(pending.weather, { isCached: false, isStale: false });
        payload.aqi = pending.aqi; // 可能为 null，代表这次真的拿不到 AQI
        payload = standardizeWeather(payload, { isCached: false, isStale: false });
        renderWeather(payload);
        saveWeatherCache(payload);
        window.dispatchEvent(new CustomEvent("jinzhu:weather", { detail: payload }));
        syncJinzhuWeather(payload);
        weatherRequestInFlight = false;
    }

    var weatherXhr = new XMLHttpRequest();
    weatherXhr.open("GET", url, true);
    weatherXhr.onreadystatechange = function () {
        if (weatherXhr.readyState !== 4) return;
        if (weatherXhr.status >= 200 && weatherXhr.status < 300) {
            try {
                var data = JSON.parse(weatherXhr.responseText);
                var current = data && (data.current || data.current_weather);
                if (current) {
                    var code = current.weather_code !== undefined ? current.weather_code : current.weathercode;
                    var temperature = current.temperature_2m !== undefined ? current.temperature_2m : current.temperature;
                    pending.weather = {
                        code: Number(code),
                        temperature: Number(temperature),
                        humidity: current.relative_humidity_2m !== undefined ? Number(current.relative_humidity_2m) : null,
                        apparentTemperature: current.apparent_temperature !== undefined ? Number(current.apparent_temperature) : null,
                        precipitation: Number(current.precipitation || 0),
                        rain: Number(current.rain || 0),
                        windSpeed: current.wind_speed_10m !== undefined ? Number(current.wind_speed_10m) : null,
                        isDay: current.is_day === 1,
                        sunrise: data.daily && data.daily.sunrise ? data.daily.sunrise[0] : null,
                        sunset: data.daily && data.daily.sunset ? data.daily.sunset[0] : null,
                        timezone: data.timezone || "Asia/Shanghai",
                        utcOffsetSeconds: Number(data.utc_offset_seconds || 28800)
                    };
                }
            } catch (e) {}
        }
        if (pending.weather === null) {
            // 请求失败或解析失败：退回到未过期的缓存，过期就显示缺失状态，不伪装成即时数据
            var cached = loadWeatherCache();
            if (cached && !cached.isStale) {
                renderWeather(cached);
                syncJinzhuWeather(cached);
            } else {
                document.getElementById("weather").innerHTML = "☁️ " + WEATHER_CITY_NAME + " --°C";
                renderWeather({ code: 3, temperature: NaN, humidity: null, aqi: null });
            }
            weatherRequestInFlight = false;
            return; // 天气都拿不到就不用再等 AQI 了
        }
        if (pending.aqi === undefined) {
            // 天气已到但 AQI 还没回来，先不 finish，等 AQI 请求结束（无论成功与否）
        } else {
            tryFinish();
        }
    };
    weatherXhr.send();

    var aqiXhr = new XMLHttpRequest();
    aqiXhr.open("GET", aqiUrl, true);
    aqiXhr.onreadystatechange = function () {
        if (aqiXhr.readyState !== 4) return;
        pending.aqi = null;
        if (aqiXhr.status >= 200 && aqiXhr.status < 300) {
            try {
                var data = JSON.parse(aqiXhr.responseText);
                var current = data && data.current;
                if (current && current.us_aqi !== undefined && current.us_aqi !== null) {
                    pending.aqi = Number(current.us_aqi);
                }
            } catch (e) {}
        }
        if (pending.weather !== null) tryFinish();
    };
    aqiXhr.send();
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
                            window.dispatchEvent(new CustomEvent("jinzhu:message", { detail: { content: currentTopMessage } }));
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
(function () {
    var cached = loadWeatherCache();
    if (cached && !cached.isStale) {
        renderWeather(cached);
        syncJinzhuWeather(cached);
    }
})();
function scheduleWeatherRefresh() {
    clearTimeout(weatherRefreshTimer);
    if (document.hidden) return;
    weatherRefreshTimer = setTimeout(function () {
        fetchWeather();
        scheduleWeatherRefresh();
    }, WEATHER_REFRESH_MS);
}
var lastWeatherFetchAt = 0;
window.addEventListener("jinzhu:weather", function (event) {
    lastWeatherFetchAt = event && event.detail && event.detail.updatedAt ? Number(event.detail.updatedAt) : Date.now();
});
fetchWeather();
scheduleWeatherRefresh();
document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
        clearTimeout(weatherRefreshTimer);
        return;
    }
    if (Date.now() - lastWeatherFetchAt > WEATHER_CACHE_MAX_AGE) fetchWeather();
    scheduleWeatherRefresh();
});
