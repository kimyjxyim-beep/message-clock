/* Jinzhu's world reactions, weather, reminders, and companion state. */
(function initJinzhuWorld() {
    "use strict";

    window.JINZHU_WORLD_V1 = true;

    if (window.Element && !Element.prototype.closest) {
        Element.prototype.closest = function (selector) {
            var node = this;
            while (node && node.nodeType === 1) {
                if (node.matches ? node.matches(selector) : node.webkitMatchesSelector(selector)) return node;
                node = node.parentElement;
            }
            return null;
        };
    }

    var LocalStorageAdapter = window.LocalStorageAdapter;
    var params = queryParameters(location.search);
    var debugMode = params.get("jinzhuDebug") === "1" || params.get("jinzhuTestMode") === "1";
    var forcedWeather = debugMode ? (params.get("jinzhuWeather") || params.get("forceRain")) : null;
    var storage = new LocalStorageAdapter(debugMode ? "messageClockDebug:" : "messageClock:");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var lowPowerDevice = /iPad.*OS (?:[1-9]|10)_/i.test(navigator.userAgent || "") || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    var bridge = window.JinzhuBridge;
    var now = Date.now();
    var todayKey = dayKey(new Date());
    var defaults = {
        firstMetDate: todayKey,
        lastSeenAt: now,
        currentOpenAt: now,
        totalCompanionMs: 0,
        consecutiveDays: 1,
        lastVisitDay: todayKey,
        lastMoodCheckAt: 0,
        lastRestAt: 0,
        lastWaterAt: 0,
        activeUseMs: 0,
        waterUseMs: 0,
        work: { active: false, mode: "normal", effectiveMs: 0 },
        settings: {
            restEnabled: true, restMinutes: 50, waterEnabled: true, waterMinutes: 90,
            mealEnabled: true, restPausedDate: "", waterPausedDate: "", mealPausedDate: "", animationMode: "system", soundEnabled: false
        },
        reminder: {
            restSnoozeUntil: 0, waterSnoozeUntil: 0, mealSnoozeUntil: 0,
            lastRestPrompt: 0, lastWaterPrompt: 0, lastMealPrompt: 0,
            restDeferrals: 0, waterDeferrals: 0, mealDeferrals: 0
        },
        rain: { active: false, lastReminderAt: 0, lastEventAt: 0 },
        heat: { active: false, lastReminderAt: 0, lastTemperature: 0, coolingUntil: 0, fanCount: 0, airconCount: 0 },
        today: freshToday(todayKey),
        current: { status: "idle", positionX: .5, positionY: .5, fullness: 76, energy: 68, mood: 72, bond: 40 }
    };
    var memory = merge(defaults, storage.get("JinzhuMemory", {}));
    var previousSeenAt = Number(memory.lastSeenAt || now);
    normaliseMemory();
    var weatherData = storage.get("JinzhuWeather", null);
    var lastTickAt = now;
    var lastActivityAt = now;
    var lastSkyMinute = -1;
    var tickTimer = null;
    var reminderQueue = [];
    var catMessageQueue = [];
    var currentReminder = null;
    var rainLayer = null;
    var starsLayer = null;
    var reminderBox = null;
    var controls = document.getElementById("jinzhu-world-controls");
    var debugBox = null;
    var activeControl = "";
    var chatHistory = [];
    var recentReplies = [];
    var chatBusyUntil = 0;
    var chatTimer = null;

    function queryParameters(search) {
        return { get: function (name) {
            var query = String(search || "").replace(/^\?/, "").split("&");
            for (var i = 0; i < query.length; i++) {
                var pair = query[i].split("=");
                if (decodeURIComponent(pair[0] || "") === name) return decodeURIComponent((pair[1] || "").replace(/\+/g, " "));
            }
            return null;
        } };
    }

    function freshToday(key) {
        return { date: key, petCount: 0, feedCount: 0, waterCount: 0, restCount: 0, companionMs: 0, mood: "", events: [] };
    }
    function dayKey(date) {
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    }
    function pad(value) { return value < 10 ? "0" + value : String(value); }
    function merge(base, source) {
        var result = {}, key;
        source = source && typeof source === "object" ? source : {};
        for (key in base) {
            if (!Object.prototype.hasOwnProperty.call(base, key)) continue;
            if (base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) result[key] = merge(base[key], source[key]);
            else result[key] = source[key] !== undefined ? source[key] : base[key];
        }
        return result;
    }
    function normaliseMemory() {
        if (!memory.today || memory.today.date !== todayKey) memory.today = freshToday(todayKey);
        if (memory.lastVisitDay !== todayKey) {
            var yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            memory.consecutiveDays = memory.lastVisitDay === dayKey(yesterday) ? Number(memory.consecutiveDays || 0) + 1 : 1;
            memory.lastVisitDay = todayKey;
        }
        memory.currentOpenAt = now;
        memory.work.active = false;
    }
    function saveMemory() {
        memory.lastSeenAt = Date.now();
        if (bridge) memory.current = merge(memory.current, bridge.getState());
        storage.set("JinzhuMemory", memory);
    }
    function setupLayers() {
        starsLayer = document.createElement("div");
        starsLayer.className = "sky-stars";
        starsLayer.setAttribute("aria-hidden", "true");
        document.body.insertBefore(starsLayer, document.body.firstChild);
        rainLayer = document.createElement("div");
        rainLayer.className = "weather-effects";
        rainLayer.setAttribute("aria-hidden", "true");
        document.body.insertBefore(rainLayer, document.body.firstChild);
        reminderBox = document.createElement("div");
        reminderBox.className = "jinzhu-reminder";
        reminderBox.hidden = true;
        document.getElementById("jinzhu-walker").appendChild(reminderBox);
        if (debugMode) {
            document.body.classList.add("jinzhu-debug-mode");
            debugBox = document.createElement("div");
            debugBox.className = "jinzhu-world-debug";
            document.body.appendChild(debugBox);
        }
    }

    function fallbackSolar(date) {
        var start = new Date(date.getFullYear(), 0, 0);
        var day = Math.floor((date - start) / 86400000);
        var daylight = 12 + 1.55 * Math.sin(2 * Math.PI * (day - 80) / 365);
        var noon = 12.42;
        return { sunrise: (noon - daylight / 2) * 60, sunset: (noon + daylight / 2) * 60, offset: 28800, source: "Guangzhou fallback" };
    }
    function timePart(value) {
        if (!value || value.indexOf("T") < 0) return null;
        var bits = value.split("T")[1].split(":");
        return Number(bits[0]) * 60 + Number(bits[1]);
    }
    function solarTimes() {
        var fallback = fallbackSolar(new Date());
        if (!weatherData) return fallback;
        var sunrise = timePart(weatherData.sunrise), sunset = timePart(weatherData.sunset);
        if (sunrise === null || sunset === null || !isFinite(sunrise) || !isFinite(sunset)) return fallback;
        return { sunrise: sunrise, sunset: sunset, offset: Number(weatherData.utcOffsetSeconds || 28800), source: weatherData.timezone || "weather" };
    }
    function rgb(hex) {
        var value = parseInt(hex.slice(1), 16);
        return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    }
    function mixColor(a, b, progress) {
        var aa = rgb(a), bb = rgb(b);
        return "rgb(" + aa.map(function (value, index) { return Math.round(value + (bb[index] - value) * progress); }).join(",") + ")";
    }
    function skyState() {
        var solar = solarTimes();
        var seconds = Math.floor(Date.now() / 1000) + solar.offset;
        var minute = ((seconds % 86400) + 86400) % 86400 / 60;
        var override = debugMode ? params.get("jinzhuSky") : null;
        var anchors = [
            [0, "night", "#07111f", "#152b4a"],
            [Math.max(0, solar.sunrise - 90), "pre-dawn", "#101a31", "#263d61"],
            [Math.max(0, solar.sunrise - 45), "dawn", "#536786", "#8a7897"],
            [solar.sunrise, "sunrise", "#d9827e", "#f6b07e"],
            [solar.sunrise + 75, "morning", "#79b8e8", "#b8ddf5"],
            [(solar.sunrise + solar.sunset) / 2, "noon", "#3c92d2", "#78c6ef"],
            [Math.max(solar.sunrise + 90, solar.sunset - 120), "afternoon", "#4d8fc3", "#e2a36f"],
            [solar.sunset, "sunset", "#d36d73", "#6b548e"],
            [solar.sunset + 45, "twilight", "#312b5d", "#243d68"],
            [Math.min(1439, solar.sunset + 90), "night", "#07111f", "#152b4a"],
            [1440, "night", "#07111f", "#152b4a"]
        ];
        if (override) {
            var map = { night: 30, dawn: solar.sunrise - 35, sunrise: solar.sunrise, noon: (solar.sunrise + solar.sunset) / 2, sunset: solar.sunset };
            if (map[override] !== undefined) minute = map[override];
        }
        var left = anchors[0], right = anchors[anchors.length - 1];
        for (var i = 0; i < anchors.length - 1; i++) {
            if (minute >= anchors[i][0] && minute <= anchors[i + 1][0]) { left = anchors[i]; right = anchors[i + 1]; break; }
        }
        var progress = right[0] === left[0] ? 0 : (minute - left[0]) / (right[0] - left[0]);
        return {
            minute: minute, sunrise: solar.sunrise, sunset: solar.sunset, source: solar.source,
            phase: left[1] + " → " + right[1], progress: Math.max(0, Math.min(1, progress)),
            colorA: mixColor(left[2], right[2], progress), colorB: mixColor(left[3], right[3], progress),
            night: minute < solar.sunrise - 70 || minute > solar.sunset + 65
        };
    }
    function applySky() {
        var sky = skyState(), root = document.documentElement;
        root.style.setProperty("--sky-a", sky.colorA);
        root.style.setProperty("--sky-b", sky.colorB);
        root.style.setProperty("--card-bg", sky.night ? "rgba(38,45,61,.64)" : "rgba(45,62,78,.42)");
        root.style.setProperty("--text-main", sky.night ? "#f7f8ff" : "#ffffff");
        root.style.setProperty("--border-color", sky.night ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.20)");
        root.style.setProperty("--shadow-color", sky.night ? "rgba(0,0,0,.44)" : "rgba(26,53,72,.28)");
        document.body.style.background = "linear-gradient(155deg," + sky.colorA + "," + sky.colorB + ") fixed";
        var cards = document.querySelectorAll(".card");
        for (var i = 0; i < cards.length; i++) cards[i].style.background = sky.night ? "rgba(38,45,61,.64)" : "rgba(45,62,78,.42)";
        starsLayer.classList.toggle("show", sky.night);
        return sky;
    }

    function weatherType(code) {
        code = Number(code);
        if (code >= 95 && code <= 99) return "thunder";
        if (code === 65 || code === 82) return "heavy";
        if (code === 63 || code === 81) return "moderate";
        if (code === 61 || code === 80) return "shower";
        if (code >= 51 && code <= 57) return "drizzle";
        return "clear";
    }
    function debugWeatherCode(value) {
        return { drizzle: 51, shower: 80, moderate: 63, heavy: 65, thunder: 95, clear: 0 }[value];
    }
    function applyRain(type) {
        var raining = type !== "clear";
        rainLayer.className = "weather-effects" + (raining ? " rain-" + type : "");
        while (rainLayer.firstChild) rainLayer.removeChild(rainLayer.firstChild);
        if (raining && !reduceMotion.matches) {
            var count = type === "drizzle" ? 18 : type === "heavy" || type === "thunder" ? 58 : 34;
            if (lowPowerDevice || memory.settings.animationMode === "simple") count = Math.min(count, 12);
            for (var i = 0; i < count; i++) {
                var drop = document.createElement("i");
                drop.style.left = (i * 37 % 101) + "%";
                drop.style.animationDelay = -(i * .17 % 2.4) + "s";
                drop.style.animationDuration = (type === "drizzle" ? 1.6 : type === "heavy" ? .62 : .95) + "s";
                rainLayer.appendChild(drop);
            }
        }
        if (raining !== memory.rain.active) {
            memory.rain.active = raining;
            memory.rain.lastEventAt = Date.now();
            if (raining) recordEvent("rain");
        }
        if (bridge) bridge.requestRain(raining, type);
        if (raining && Date.now() - Number(memory.rain.lastReminderAt || 0) > 6 * 3600000) {
            memory.rain.lastReminderAt = Date.now();
            queueCatMessage(type === "heavy" || type === "thunder" ? "今日出門要小心濕身。" : "落雨啦，記得帶遮。");
        }
        saveMemory();
    }
    function handleWeather(detail) {
        weatherData = detail;
        storage.set("JinzhuWeather", weatherData);
        var forced = forcedWeather;
        var type = forced && debugWeatherCode(forced) !== undefined ? forced : weatherType(detail.code);
        applyRain(type);
        var forcedTemperature = debugMode && isFinite(Number(params.get("jinzhuTemperature"))) ? Number(params.get("jinzhuTemperature")) : null;
        applyHeat(forcedTemperature !== null ? forcedTemperature : Number(detail.temperature));
        applySky();
    }

    function applyHeat(temperature) {
        if (!isFinite(temperature)) return;
        var hot = temperature > 32;
        var cooling = Date.now() < Number(memory.heat.coolingUntil || 0);
        memory.heat.lastTemperature = temperature;
        memory.heat.active = hot;
        if (bridge && bridge.requestHeat) bridge.requestHeat(hot && !cooling);
        if (hot && !cooling && Date.now() - Number(memory.heat.lastReminderAt || 0) > 4 * 3600000) {
            memory.heat.lastReminderAt = Date.now();
            recordEvent("heat");
            queueReminder("heat");
        }
        saveMemory();
    }

    function recordEvent(type) {
        var events = memory.today.events;
        var last = events.length ? events[events.length - 1] : null;
        if (!last || last.type !== type || Date.now() - last.at > 30 * 60000) {
            events.push({ type: type, at: Date.now() });
            if (events.length > 40) events.shift();
        }
    }
    function queueCatMessage(text) {
        if (catMessageQueue.indexOf(text) < 0) catMessageQueue.push(text);
        flushQueues();
    }
    function flushQueues() {
        if (!bridge || bridge.isBusy()) return;
        if (!currentReminder && reminderQueue.length) showReminder(reminderQueue.shift());
        else if (!currentReminder && catMessageQueue.length) bridge.say(catMessageQueue.shift());
    }

    function queueReminder(type) {
        if (currentReminder === type || reminderQueue.indexOf(type) >= 0) return;
        if (type === "rest") reminderQueue.unshift(type);
        else reminderQueue.push(type);
        flushQueues();
    }
    function reminderCopy(type) {
        var choices = {
            water: ["喝水了吗？金主在监督你喔。", "先喝一口水啦。", "主人，补水时间到。", "今天喝水好像有点少喔。", "喝水先，等下再继续忙。"],
            rest: ["眼睛休息一下，好不好？", "看屏幕好久啦，望远一点。", "起来走两步，金主等你。", "休息五分钟也很乖。"],
            breakfast: ["早安，今天有吃早餐吗？", "空腹太久不乖喔。", "先吃点东西再开始忙吧。"],
            lunch: ["中午啦，吃饭了吗？", "先吃饭啦，金主也想开饭。", "不要只顾着忙，午饭也很重要。"],
            dinner: ["晚饭吃了吗？不要饿着自己。", "今天辛苦啦，记得好好吃饭。", "金主陪你慢慢收工。"]
        };
        var list = choices[type] || choices.water;
        return list[Math.floor(Math.random() * list.length)];
    }
    function showReminder(type) {
        if (!bridge || bridge.isBusy()) { queueReminder(type); return; }
        currentReminder = type;
        if (bridge && bridge.setReminder) bridge.setReminder(true);
        var rest = type === "rest", heat = type === "heat", meal = type === "breakfast" || type === "lunch" || type === "dinner";
        if (rest) memory.reminder.waterSnoozeUntil = Math.max(Number(memory.reminder.waterSnoozeUntil || 0), Date.now() + (5 + Math.random() * 5) * 60000);
        if (heat) reminderBox.innerHTML = "<p>超过 32°C，好热呀。帮我降温？</p><div><button data-heat='fan'>开风扇</button><button data-heat='aircon'>开冷气</button><button data-heat='later'>稍后</button></div>";
        else reminderBox.innerHTML = "<p>" + reminderCopy(type) + "</p><div><button data-reminder-done='" + type + "'>" + (rest ? "知道啦" : meal ? "已吃饭" : "已喝水") + "</button><button data-reminder-later='" + type + "'>" + (rest ? "10 分钟后" : "15 分钟后") + "</button><button data-reminder-pause='" + type + "'>今日暂停</button></div>";
        reminderBox.hidden = false;
        bridge.say(heat ? "主人，开风扇还是开冷气呀？" : reminderCopy(type));
    }
    function closeReminder() {
        reminderBox.hidden = true;
        reminderBox.innerHTML = "";
        currentReminder = null;
        if (bridge && bridge.setReminder) bridge.setReminder(false);
        setTimeout(flushQueues, 500);
    }
    function handleReminderAction(event) {
        var button = event.target.closest("button");
        if (!button) return;
        var heatAction = button.getAttribute("data-heat");
        if (heatAction) {
            if (heatAction === "fan") { memory.heat.fanCount++; memory.heat.coolingUntil = Date.now() + 2 * 3600000; recordEvent("fan"); if (bridge && bridge.activateCooling) bridge.activateCooling("fan"); }
            else if (heatAction === "aircon") { memory.heat.airconCount++; memory.heat.coolingUntil = Date.now() + 2 * 3600000; recordEvent("aircon"); if (bridge && bridge.activateCooling) bridge.activateCooling("aircon"); }
            else if (bridge && bridge.requestHeat) bridge.requestHeat(false);
            closeReminder(); saveMemory(); return;
        }
        var type = button.getAttribute("data-reminder-done") || button.getAttribute("data-reminder-later") || button.getAttribute("data-reminder-pause");
        if (!type) return;
        var done = button.hasAttribute("data-reminder-done"), later = button.hasAttribute("data-reminder-later");
        if (done) {
            if (type === "rest") { memory.today.restCount++; memory.lastRestAt = Date.now(); memory.activeUseMs = 0; recordEvent("rest"); }
            else if (type === "water") { memory.today.waterCount++; memory.lastWaterAt = Date.now(); memory.waterUseMs = 0; recordEvent("water"); }
            else { memory.reminder.mealSnoozeUntil = Date.now() + 4 * 3600000; recordEvent(type); }
        } else if (later) {
            memory.reminder[type + "SnoozeUntil"] = Date.now() + (type === "rest" ? 10 : 15) * 60000;
            memory.reminder[type + "Deferrals"]++;
        } else {
            memory.settings[(type === "breakfast" || type === "lunch" || type === "dinner") ? "mealPausedDate" : type + "PausedDate"] = todayKey;
        }
        closeReminder();
        saveMemory();
    }

    function mealDue() {
        var hour = new Date().getHours() + new Date().getMinutes() / 60;
        var type = hour >= 7 && hour < 10 ? "breakfast" : hour >= 11.5 && hour < 13.5 ? "lunch" : hour >= 18 && hour < 20.5 ? "dinner" : "";
        if (!type || !memory.settings.mealEnabled || memory.settings.mealPausedDate === todayKey) return "";
        if (Date.now() < Number(memory.reminder.mealSnoozeUntil || 0)) return "";
        var lastPrompt = Number(memory.reminder.lastMealPrompt || 0);
        if (Date.now() - lastPrompt < 60 * 60000) return "";
        memory.reminder.lastMealPrompt = Date.now();
        return type;
    }
    function reminderDue(type) {
        var settings = memory.settings, reminder = memory.reminder;
        if (!settings[type + "Enabled"] || settings[type + "PausedDate"] === todayKey) return false;
        if (Date.now() < Number(reminder[type + "SnoozeUntil"] || 0)) return false;
        var threshold = Number(settings[type + "Minutes"]) * 60000;
        var basis = type === "rest" ? memory.activeUseMs : memory.waterUseMs;
        var lastPrompt = Number(reminder["last" + title(type) + "Prompt"] || 0);
        var courtesy = Math.min(Number(reminder[type + "Deferrals"] || 0) * 10, 30) * 60000;
        if (basis >= threshold + courtesy && Date.now() - lastPrompt > 45 * 60000) {
            reminder["last" + title(type) + "Prompt"] = Date.now();
            return true;
        }
        return false;
    }
    function title(value) { return value.charAt(0).toUpperCase() + value.slice(1); }

    function renderControls() {
        if (!controls) return;
        controls.innerHTML = "<section id='jinzhu-care-box' hidden>" + careHtml() + "</section>";
        showControl(activeControl);
    }
    function moodButtons() {
        var current = { "開心": "happy", "普通": "normal", "有點累": "tired", "有點煩": "annoyed", "暫時不想說": "private" }[memory.today.mood];
        return [["happy", "開心"], ["normal", "普通"], ["tired", "有點累"], ["annoyed", "有點煩"], ["private", "暫時不想說"]].map(function (item) {
            return "<button data-mood='" + item[0] + "' class='" + (current === item[0] ? "selected" : "") + "'>" + item[1] + "</button>";
        }).join("");
    }
    function chatHtml() {
        return "<div class='panel-heading'><h3>同金主講兩句</h3><button data-panel-close type='button' aria-label='收起對話'>×</button></div>" +
            "<p class='local-chat-note'>本地陪伴回應，不會讀取或傳送其他內容。</p>" +
            "<div id='jinzhu-chat-history' class='jinzhu-chat-history' aria-live='polite'></div>" +
            "<form id='jinzhu-chat-form' class='jinzhu-chat-form'><input id='jinzhu-chat-input' maxlength='64' autocomplete='off' placeholder='同金主講句嘢…' aria-label='同金主講句嘢'><button type='submit' aria-label='講畀金主聽'>講</button></form>";
    }
    function careHtml() {
        return "<div class='panel-heading'><h3>金主提醒</h3><button data-panel-close type='button' aria-label='收起提醒'>×</button></div>" +
            "<div class='jinzhu-care-grid'>" +
            "<label class='toggle-row'><input id='rest-enabled' type='checkbox' " + (memory.settings.restEnabled ? "checked" : "") + ">休息提醒</label>" +
            "<select id='rest-minutes' aria-label='休息提醒間隔'>" + options([30,45,50,60], memory.settings.restMinutes) + "</select>" +
            "<label class='toggle-row'><input id='water-enabled' type='checkbox' " + (memory.settings.waterEnabled ? "checked" : "") + ">飲水提醒</label>" +
            "<select id='water-minutes' aria-label='飲水提醒間隔'>" + options([60,90,120], memory.settings.waterMinutes) + "</select>" +
            "<label class='toggle-row'><input id='meal-enabled' type='checkbox' " + (memory.settings.mealEnabled ? "checked" : "") + ">吃饭提醒</label><span></span>" +
            "<button type='button' data-pause-all>今日暂停</button>" +
            "</div>";
    }
    function settingsHtml() {
        return "<div class='panel-heading'><h3>金主設定</h3><button data-panel-close type='button'>關閉</button></div>" +
            "<label>陪伴模式<select id='settings-companion-mode'>" + textOptions([["quiet","安靜"],["normal","正常"],["strict","嚴格"]], memory.work.mode) + "</select></label>" +
            "<label class='toggle-row'><input id='rest-enabled' type='checkbox' " + (memory.settings.restEnabled ? "checked" : "") + ">休息提醒</label>" +
            "<label>休息間隔<select id='rest-minutes'>" + options([30,45,50,60], memory.settings.restMinutes) + "</select></label>" +
            "<label class='toggle-row'><input id='water-enabled' type='checkbox' " + (memory.settings.waterEnabled ? "checked" : "") + ">喝水提醒</label>" +
            "<label>喝水間隔<select id='water-minutes'>" + options([60,90,120], memory.settings.waterMinutes) + "</select></label>" +
            "<label>動畫效果<select id='animation-mode'>" + textOptions([["full","完整"],["simple","精簡"],["system","跟隨系統"]], memory.settings.animationMode) + "</select></label>" +
            "<label class='toggle-row'><input id='sound-enabled' type='checkbox' " + (memory.settings.soundEnabled ? "checked" : "") + ">金主聲音（預設關閉）</label>" +
            "<button type='button' class='danger-button' data-reset-jinzhu>重置金主狀態</button>";
    }
    function options(values, selected) {
        return values.map(function (value) { return "<option value='" + value + "' " + (Number(selected) === value ? "selected" : "") + ">" + value + " 分鐘</option>"; }).join("");
    }
    function textOptions(values, selected) {
        return values.map(function (item) { return "<option value='" + item[0] + "' " + (selected === item[0] ? "selected" : "") + ">" + item[1] + "</option>"; }).join("");
    }
    function showControl(name) {
        activeControl = name || "";
        ["care"].forEach(function (key) {
            var element = document.getElementById("jinzhu-" + key + "-box");
            if (element) element.hidden = key !== activeControl;
        });
        var petPanel = document.getElementById("jinzhu-panel");
        if (petPanel) {
            petPanel.classList.toggle("jinzhu-care-open", activeControl === "care");
        }
    }
    window.JinzhuMenuAction = function (name) {
        showControl(name);
        return false;
    };
    function closestFromEventTarget(target, selector) {
        if (!target) return null;
        if (target.nodeType !== 1) target = target.parentElement;
        return target && target.closest ? target.closest(selector) : null;
    }
    function handleControls(event) {
        var button = closestFromEventTarget(event.target, "button"),
            select = closestFromEventTarget(event.target, "select"),
            input = closestFromEventTarget(event.target, "input");
        if (button && button.dataset.world) {
            event.preventDefault();
            event.stopPropagation();
            var action = button.dataset.world;
            if (action === "work") {
                memory.work.active = !memory.work.active;
                if (bridge) bridge.setQuietMode(memory.work.active && memory.work.mode === "quiet");
                if (bridge && bridge.setCompanionMode) bridge.setCompanionMode(memory.work.active ? memory.work.mode : "normal");
                recordEvent(memory.work.active ? "work-start" : "work-end");
                if (!memory.work.active) queueCatMessage("收工啦，放鬆下先。");
                renderControls();
                showControl("work");
            } else showControl(action);
            saveMemory(); return;
        }
        if (button && button.hasAttribute("data-panel-close")) {
            showControl("");
            if (bridge && bridge.closeInteractions) bridge.closeInteractions();
            else if (bridge && bridge.closeMenu) bridge.closeMenu();
            return;
        }
        if (button && button.hasAttribute("data-pause-all")) {
            memory.settings.restPausedDate = todayKey;
            memory.settings.waterPausedDate = todayKey;
            memory.settings.mealPausedDate = todayKey;
            queueCatMessage("今日先唔提你，记得自己照顾好自己喔。");
            saveMemory();
            if (bridge && bridge.closeInteractions) bridge.closeInteractions();
            return;
        }
        if (button && button.hasAttribute("data-reset-jinzhu")) {
            if (button.getAttribute("data-confirm") !== "1") {
                button.setAttribute("data-confirm", "1");
                button.textContent = "再按一次確認重置";
                setTimeout(function () { if (button) { button.removeAttribute("data-confirm"); button.textContent = "重置金主狀態"; } }, 5000);
            } else {
                try { localStorage.removeItem((debugMode ? "messageClockDebug:" : "messageClock:") + "JinzhuMemory"); localStorage.removeItem(debugMode ? "messageClockJinzhuStateDebug" : "messageClockJinzhuState"); } catch (error) {}
                location.reload();
            }
            return;
        }
        if (button && button.dataset.mood) {
            var moodMap = { happy: "開心", normal: "普通", tired: "有點累", annoyed: "有點煩", private: "暫時不想說" };
            memory.today.mood = moodMap[button.dataset.mood];
            if (bridge && bridge.setOwnerMood) bridge.setOwnerMood(button.dataset.mood);
            memory.lastMoodCheckAt = Date.now();
            recordEvent("mood-" + button.dataset.mood);
            if (button.dataset.mood === "happy") queueCatMessage("你開心，我就放心啦。");
            else if (button.dataset.mood === "tired") queueCatMessage("攰就慢慢做，我陪住你。");
            else if (button.dataset.mood === "annoyed") queueCatMessage("我坐近少少，唔嘈你。");
            else if (button.dataset.mood === "private") queueCatMessage("好，我唔追問。");
            else queueCatMessage("嗯，我喺度。");
            saveMemory();
            renderControls();
            showControl("mood");
            return;
        }
        if (select && (select.id === "jinzhu-work-mode" || select.id === "settings-companion-mode")) {
            memory.work.mode = select.value;
            if (bridge) bridge.setQuietMode(select.value === "quiet");
            if (bridge && bridge.setCompanionMode) bridge.setCompanionMode(select.value);
            saveMemory();
        }
        if (select && select.id === "rest-minutes") memory.settings.restMinutes = Number(select.value);
        if (select && select.id === "water-minutes") memory.settings.waterMinutes = Number(select.value);
        if (select && select.id === "animation-mode") {
            memory.settings.animationMode = select.value;
            if (bridge && bridge.setAnimationMode) bridge.setAnimationMode(select.value);
        }
        if (input && input.id === "rest-enabled") memory.settings.restEnabled = input.checked;
        if (input && input.id === "water-enabled") memory.settings.waterEnabled = input.checked;
        if (input && input.id === "meal-enabled") memory.settings.mealEnabled = input.checked;
        if (input && input.id === "sound-enabled") memory.settings.soundEnabled = input.checked;
        if (select || input) saveMemory();
    }

    var replyPools = {
        daily: ["我喺度呀。", "你做你嘅，我睇住你。", "金主今日都有乖乖陪你。", "做咩又搵我呀？", "摸多兩下都得嘅。", "我啱啱只係巡查緊。", "呢个位几舒服，我坐阵先。", "你继续啦，我冇走。", "我听紧，虽然未必听得明。", "金主批准你休息一阵。"],
        morning: ["早晨呀，今日都要慢慢嚟。", "我醒咗，你醒咗未？", "朝早空气好似几舒服。", "食咗早餐未呀？", "新一日又开始啦。"],
        afternoon: ["下昼最适合打个盹。", "做咗一阵啦，饮啖水先。", "我有少少眼瞓，但会继续监督。", "今日进行成点呀？", "唔使急，一样一样做。"],
        late: ["咁夜仲未瞓呀？", "我已经想蜷埋瞓觉啦。", "做埋手头呢少少就休息啦。", "夜晚要细声啲，金主要瞓。", "听日再做都得㗎。"],
        sunny: ["今日有太阳，个背景都光咗。", "天气几好，适合晒下毛。", "今日睇落暖笠笠。", "出门记得唔好晒亲。", "我想去有阳光嘅地方坐。"],
        rain: ["落雨啦，记得带遮。", "出门小心湿身。", "今日适合留喺屋企。", "雨声几适合瞓觉。", "我把遮借俾你又点话。"],
        hunger: ["有少少肚饿。", "个饭碗好似空咗。", "今日食咩呀？", "我要真系有饭先食㗎。", "我饱啦，唔好再喂。", "食完饭要舔干净块面。", "呢餐可以，金主收货。"],
        sleep: ["zzz……", "我听日再审你。", "唔好嘈，我蜷得啱啱好。", "我只係合埋眼休息。", "你都早点瞓啦。", "再摸一下我就醒㗎啦。"],
        work: ["你做嘢，我监督。", "专心啦，唔好成日撳我。", "我陪你做埋呢一段。", "你忙你嘅，我喺旁边坐。", "差唔多要休息啦。", "今日效率几高喔。", "做唔晒都唔代表今日冇做过。"],
        comfort: ["攰就休息阵，我陪住你。", "今日唔开心都冇所谓。", "唔使即刻解决晒所有事。", "我唔催你，我喺度。", "饮啖水，透下气先。", "你可以乜都唔讲。", "摸下金主，今日就算过咗一关。"],
        return: ["你返嚟啦。", "你去咗一阵，我冇乱走。", "等咗你好几个钟。", "今日终于见到你啦。", "好耐冇见，不过金主冇嬲你。", "欢迎返屋企。"]
    };

    replyPools.daily = ["我喺度陪你呀。", "你做你嘅，我坐阵先。", "今日有冇乖乖饮水？", "我行过嚟睇下你。", "金主冇走开，只係换个位。", "摸下我先再做嘢啦。", "你望屏幕望咗好耐喔。", "我听紧，你慢慢讲。"];
    replyPools.late = ["夜晚啦，唔好捱太夜。", "咁夜仲做紧呀？", "我想蜷埋瞓啦，你呢？", "做埋手头呢少少就休息啦。", "夜深要细声啲，金主眼瞓。", "听日再做都唔迟㗎。", "你唔瞓，我就坐喺度陪你。", "屏幕光好亮，俾眼睛休息下啦。"];
    replyPools.morning = ["早晨呀，今日慢慢嚟。", "我醒咗，你食早餐未？", "朝早空气几舒服喔。", "新一日又见到你啦。", "先饮啖水再开始啦。", "今日都交俾金主监督。", "晨早摸一下，成日都顺啲。", "唔使急，朝早要伸个懒腰先。"];
    replyPools.rain = ["落雨啦，记得带遮。", "今日出门小心湿身。", "雨声几适合瞓觉。", "我撑住遮，你行慢啲。", "地下湿，唔好急住走。", "今日留喺屋企陪我都几好。", "个天灰灰哋，记得着够衫。", "停雨先再出去玩啦。"];
    replyPools.heat = ["今日好热，开阵风扇啦。", "超过三十二度喔，唔好焗亲。", "冷气唔使太冻，舒服就得。", "我想去阴凉个位坐。", "天气热要饮多啲水。", "个太阳晒住我个头呀。", "开风扇俾我吹下毛啦。", "热到唔想郁，我静静陪你。"];
    replyPools.tired = ["攰就停一停，我陪住你。", "做咗好耐啦，望远少少。", "唔使顶硬上，休息唔係偷懒。", "饮啖水，郁下膊头先。", "今日做到呢度已经几好。", "你坐低，我坐旁边。", "慢慢呼吸，唔使赶。", "瞓一阵都得，我帮你睇住时间。"];
    replyPools.sad = ["唔开心都可以，我喺度。", "你唔想讲都冇关系。", "我坐近少少，唔嘈你。", "今日难过，听日再慢慢嚟。", "摸下我啦，俾你借一阵。", "唔使即刻解决晒所有事。", "你已经好努力，我知㗎。", "想静一静就静一静，我陪住。"];
    replyPools.hunger = ["个饭碗好似空咗喔。", "我有少少肚饿呀。", "今日食咩？金主要先睇货。", "真係有饭先好叫我过去。", "闻到食物味，我就醒㗎啦。", "唔好净係挂住自己做嘢，开饭啦。", "我会行去饭碗嗰边等你。", "肚饿就冇力巡屋企啦。"];
    replyPools.sleepy = ["我只係合埋眼休息下。", "好眼瞓呀，你都早啲瞓。", "呢个位几舒服，我瞓阵先。", "唔好嘈，我啱啱蜷好。", "再摸一下我就醒㗎啦。", "夜晚啦，我要收埋条尾。", "zzz……我仲听到少少。", "瞓醒再继续监督你。"];
    replyPools.petted = ["摸多两下都得嘅。", "嗯……呢个位几舒服。", "只准你摸，唔好同人讲。", "我冇开心呀，只係尾巴郁咗。", "再轻啲，我听到你㗎。", "今日份摸摸收到了。", "你终于记得理我啦。", "好啦，俾你黐一阵。"];
    replyPools.fed = ["开饭啦，唔好望住我食。", "呢餐可以，金主收货。", "我低头食紧，等阵先讲。", "个碗放得啱啱好。", "食完我会自己舔干净。", "有饭食，心情即刻好啲。", "慢慢食先，唔使催我。", "多谢你呀……不过我冇撒娇。"];
    replyPools.return = ["你返嚟啦。", "我冇乱走，一直喺度。", "等咗你好几个钟呀。", "今日终于又见到你。", "好耐冇见，不过我冇嬲你。", "欢迎返屋企，先摸下我。", "你去咗边呀？我只係问下。", "返嚟就好，金主继续陪你。"];
    replyPools.doing = ["我巡紧呢个页面呀。", "我啱啱整理完啲毛。", "坐喺度睇你做嘢。", "我谂紧下一觉去边度瞓。", "等紧你摸我，唔明显咩？", "我望紧天气，睇下落唔落雨。", "我检查紧饭碗有冇满。", "我喺时钟上面监督你呀。"];
    replyPools.goodnight = ["晚安呀，我蜷埋陪你瞓。", "去瞓啦，听日再见。", "被角盖好，唔好冻亲。", "我会静静守住呢个页面。", "今晚唔准再捱夜啦。", "关细屏幕光先瞓呀。", "好啦，金主批准你收工。", "晚安……zzz。"];
    replyPools.love = ["我都几钟意你㗎……少少啦。", "知啦知啦，唔使讲咁大声。", "咁你要记得每日摸我。", "我准你一直陪住我。", "钟意我就准时食饭同瞓觉。", "我冇面红，係天气热。", "好啦，我都爱你呀。", "你係我最熟嗰个主人。"];

    function hasAny(text, words) {
        for (var i = 0; i < words.length; i++) if (text.indexOf(words[i]) >= 0) return true;
        return false;
    }
    function chatCategory(text) {
        var value = String(text || "").toLowerCase();
        var pet = bridge && bridge.getState ? bridge.getState() : memory.current;
        var status = pet.status || "idle";
        var rain = weatherData && weatherType(weatherData.code) !== "clear";
        if (hasAny(value, ["我爱你", "我愛你", "喜欢你", "喜歡你", "爱你", "愛你", "love you"])) return "love";
        if (hasAny(value, ["晚安", "good night", "瞓啦", "睡了", "睡啦"])) return "goodnight";
        if (hasAny(value, ["你在做什么", "你在做甚麼", "做紧咩", "做緊咩", "做什么", "做乜"])) return "doing";
        if (hasAny(value, ["不开心", "不開心", "难过", "難過", "伤心", "傷心", "压力大", "壓力大", "烦", "煩"])) return "sad";
        if (hasAny(value, ["好累", "有点累", "有點累", "攰", "疲劳", "疲勞", "压力", "壓力"])) return "tired";
        if (hasAny(value, ["好热", "好熱", "太热", "太熱", "风扇", "風扇", "空调", "冷气", "冷氣"]) || Number(weatherData && weatherData.temperature) > 32) return "heat";
        if (hasAny(value, ["返嚟", "回来", "回來", "我回", "back"])) return "return";
        if (hasAny(value, ["攰", "累", "烦", "煩", "不开心", "不開心", "难受", "難受"])) return "comfort";
        if (hasAny(value, ["工作", "做嘢", "陪工", "监督", "監督"]) || memory.work.active) return "work";
        if (hasAny(value, ["睡觉", "睡覺", "瞓觉", "瞓覺"]) || status === "sleeping" || status === "sleepy") return "sleepy";
        if (hasAny(value, ["肚饿", "肚餓", "吃饭", "吃飯", "食饭", "食飯", "喂", "餵"]) || Number(pet.fullness) < 25) return "hunger";
        if (hasAny(value, ["天气", "天氣", "下雨", "落雨", "雨"])) return rain ? "rain" : "sunny";
        if (memory.today.mood === "有点累" || memory.today.mood === "有点烦" || memory.today.mood === "有點累" || memory.today.mood === "有點煩") return "comfort";
        var hour = new Date().getHours();
        if (hour < 6 || hour >= 23) return "late";
        if (hour < 11) return "morning";
        if (hour >= 12 && hour < 18) return "afternoon";
        return rain ? "rain" : "daily";
    }
    function chooseReply(category) {
        var pool = replyPools[category] || replyPools.daily;
        var choices = pool.filter(function (line) { return recentReplies.indexOf(line) < 0; });
        if (!choices.length) choices = pool.slice(0);
        var reply = choices[Math.floor(Math.random() * choices.length)] || replyPools.daily[0];
        recentReplies.push(reply);
        while (recentReplies.length > 5) recentReplies.shift();
        return reply;
    }
    function rememberReply(reply) {
        recentReplies.push(reply);
        while (recentReplies.length > 5) recentReplies.shift();
        return reply;
    }
    function contextualReply(text) {
        var value = String(text || "").toLowerCase();
        var pet = bridge && bridge.getState ? bridge.getState() : memory.current;
        var status = pet.status || "idle";
        var category = chatCategory(value);
        if (["love", "goodnight", "doing", "sad", "tired", "heat"].indexOf(category) >= 0) return chooseReply(category);
        if (hasAny(value, ["几点", "幾點", "时间", "時間", "几时", "幾時"])) {
            var clockNow = new Date();
            var minuteText = clockNow.getMinutes() < 10 ? "0" + clockNow.getMinutes() : String(clockNow.getMinutes());
            return rememberReply("而家 " + clockNow.getHours() + ":" + minuteText + "，金主睇住时间㗎。");
        }
        if (hasAny(value, ["饮水", "飲水", "喝水", "水呢"])) {
            return rememberReply(Date.now() - Number(memory.lastWaterAt || 0) < 45 * 60000 ? "你啱啱饮过水，做得几乖。" : "今日有冇乖乖饮水？而家饮啖先啦。");
        }
        if (hasAny(value, ["吃饭", "吃飯", "食饭", "食飯", "肚饿", "肚餓"])) {
            return Number(pet.fullness) < 35 ? chooseReply("hunger") : rememberReply("我仲饱住呀，你自己都要准时食饭。");
        }
        if (hasAny(value, ["做什么", "做甚麼", "做咩", "干嘛", "幹嘛"])) {
            var actions = {
                sleeping: "我蜷埋瞓紧，唔好声张。", eating: "我食紧饭，个碗就快清晒。",
                grooming: "整理下毛先，仪容好重要。", walking: "我啱啱巡查紧呢个页面。",
                climbing: "我爬紧上时钟，望高啲。", perched: "我坐喺时间框上面监督你。",
                playing: "我只係活动下，唔算贪玩。", idle: "我坐紧呢度陪你呀。"
            };
            return rememberReply(actions[status] || "我喺度观察紧你。");
        }
        if (hasAny(value, ["天气", "天氣", "太阳", "太陽", "天色"])) {
            var sky = skyState();
            var raining = weatherData && weatherType(weatherData.code) !== "clear";
            if (raining) return chooseReply("rain");
            if (sky.phase.indexOf("sunrise") >= 0 || sky.phase.indexOf("dawn") >= 0) return rememberReply("天光紧啦，今日慢慢开始。");
            if (sky.night) return rememberReply("夜色好静，你都唔好捱得太夜。");
            return chooseReply("sunny");
        }
        if (hasAny(value, ["返嚟", "回来", "回來", "我回"])) {
            var away = Math.max(0, now - previousSeenAt);
            if (away > 24 * 3600000) return rememberReply("好耐冇见，不过金主冇嬲你。");
            if (away > 3 * 3600000) return rememberReply("等咗你好几个钟，欢迎返屋企。");
            return rememberReply("你返嚟啦，我冇乱走。");
        }
        if (hasAny(value, ["攰", "累", "烦", "煩", "休息"])) {
            if (Date.now() - Number(memory.lastRestAt || 0) < 30 * 60000) return rememberReply("啱啱休息过就慢慢嚟，我继续陪住你。");
            if (Date.now() - Number(memory.lastWaterAt || 0) > 90 * 60000) return rememberReply("攰就停一停，顺便饮啖水先。");
        }
        return "";
    }
    function renderChatHistory(thinking) {
        var box = document.getElementById("jinzhu-chat-history");
        if (!box) return;
        while (box.firstChild) box.removeChild(box.firstChild);
        chatHistory.slice(-5).forEach(function (item) {
            var line = document.createElement("p");
            line.className = "chat-line " + item.role;
            line.textContent = item.text;
            box.appendChild(line);
        });
        if (thinking) {
            var wait = document.createElement("p");
            wait.className = "chat-line cat thinking";
            wait.textContent = "……";
            box.appendChild(wait);
        }
        box.scrollTop = box.scrollHeight;
    }
    function sendChat(text) {
        text = String(text || "").replace(/^\s+|\s+$/g, "");
        if (!text || Date.now() < chatBusyUntil) return;
        chatBusyUntil = Date.now() + 900;
        chatHistory.push({ role: "user", text: text });
        while (chatHistory.length > 10) chatHistory.shift();
        renderChatHistory(true);
        clearTimeout(chatTimer);
        chatTimer = setTimeout(function () {
            var reply = contextualReply(text) || chooseReply(chatCategory(text));
            chatHistory.push({ role: "cat", text: reply });
            while (chatHistory.length > 10) chatHistory.shift();
            renderChatHistory(false);
            if (bridge) bridge.say(reply);
        }, 350 + Math.floor(Math.random() * 450));
        var input = document.getElementById("jinzhu-chat-input");
        if (input) input.value = "";
    }

    function welcomeMessage() {
        var away = Math.max(0, now - previousSeenAt);
        if (debugMode && params.get("jinzhuAway") === "hours") away = 5 * 3600000;
        if (debugMode && params.get("jinzhuAway") === "day") away = 30 * 3600000;
        if (away < 2 * 3600000) return "你返嚟啦。";
        if (away < 20 * 3600000) return "你去咗幾個鐘，我一直喺度。";
        if (away < 72 * 3600000) return "今日都見到你啦。";
        return "好耐冇見，返嚟就好。";
    }
    function tick() {
        var timestamp = Date.now(), elapsed = Math.min(30000, Math.max(0, timestamp - lastTickAt));
        lastTickAt = timestamp;
        var active = !document.hidden && timestamp - lastActivityAt < 60000;
        if (active) {
            memory.totalCompanionMs += elapsed;
            memory.today.companionMs += elapsed;
            memory.activeUseMs += elapsed;
            memory.waterUseMs += elapsed;
            if (memory.work.active) memory.work.effectiveMs += elapsed;
        }
        if (memory.work.active && active && new Date().getHours() < 5 && timestamp - memory.currentOpenAt > 45 * 60000) queueCatMessage("仲未瞓呀？");
        if (reminderDue("rest")) queueReminder("rest");
        if (!currentReminder && reminderQueue.indexOf("rest") < 0 && reminderDue("water")) queueReminder("water");
        if (!currentReminder && reminderQueue.length === 0) {
            var mealType = mealDue();
            if (mealType) queueReminder(mealType);
        }
        if (Math.floor(timestamp / 60000) !== lastSkyMinute) { lastSkyMinute = Math.floor(timestamp / 60000); applySky(); }
        flushQueues();
        saveMemory();
        updateDebug();
        clearTimeout(tickTimer);
        tickTimer = setTimeout(tick, 30000);
    }
    function updateDebug() {
        if (!debugBox) return;
        var sky = skyState();
        debugBox.innerHTML = "<div>world " + sky.phase + " " + Math.round(sky.progress * 100) + "% · queue " + reminderQueue.join(",") + " · storage " + (storage.available ? "local" : "memory-only") + "</div>" +
            "<div class='jinzhu-debug-actions'><button data-debug='water'>水</button><button data-debug='breakfast'>早</button><button data-debug='lunch'>午</button><button data-debug='dinner'>晚</button><button data-debug='rest'>休</button><button data-debug='rain'>雨</button><button data-debug='clear'>晴</button><button data-debug='sleep'>睡</button><button data-debug='eat'>食</button><button data-debug='move'>走</button><button data-debug='ipad'>iPad</button><button data-debug='clock-perch'>趴</button><button data-debug='clock-hook'>挂</button><button data-debug='clock-nap'>睡钟</button><button data-debug='clock-peek'>探</button><button data-debug='colon-sit'>:</button><button data-debug='clock-scratch'>爪</button><button data-debug='clock-pull'>翻</button></div>";
    }
    function noteActivity() { lastActivityAt = Date.now(); }

    setupLayers();
    renderControls();
    window.JinzhuWorld = {
        openCare: function () {
            if (bridge && bridge.openInteractions) bridge.openInteractions("你想我几时提你呀？");
            else if (bridge && bridge.openMenu) bridge.openMenu("你想我几时提你呀？");
            showControl("care");
            if (bridge && bridge.refreshOverlay) bridge.refreshOverlay();
        },
        showActions: function () { showControl(""); },
        closeOverlay: function () { showControl(""); },
        getInteractionReply: function (category) { return chooseReply(category); }
    };
    if (debugMode) {
        window.JinzhuDebug = window.JinzhuDebug || {};
        window.JinzhuDebug.forceReminder = function (type) { queueReminder(type === "meal" ? "lunch" : type); };
        window.JinzhuDebug.forceRain = function (kind) { handleWeather({ code: kind === "heavy" ? 82 : 61, temperature: 26, utcOffsetSeconds: 28800 }); };
        window.JinzhuDebug.clearCooldowns = function () {
            memory.reminder.restSnoozeUntil = 0; memory.reminder.waterSnoozeUntil = 0; memory.reminder.mealSnoozeUntil = 0;
            memory.reminder.lastRestPrompt = 0; memory.reminder.lastWaterPrompt = 0; memory.reminder.lastMealPrompt = 0;
            saveMemory();
        };
        if (debugBox) debugBox.addEventListener("click", function (event) {
            var button = event.target && event.target.closest ? event.target.closest("button[data-debug]") : null;
            if (!button) return;
            var command = button.getAttribute("data-debug"), api = window.JinzhuDebug;
            if (command === "water" || command === "breakfast" || command === "lunch" || command === "dinner" || command === "rest") api.forceReminder(command);
            else if (command === "rain") api.forceRain("heavy");
            else if (command === "clear") handleWeather({ code: 0, temperature: 26, utcOffsetSeconds: 28800 });
            else if (command === "sleep") api.forceSleep();
            else if (command === "eat") api.forceEat();
            else if (command === "move") api.forceMove();
            else if (command === "ipad") api.forceIPadFallback();
            else if (command === "clock-scratch" && api.forceClockScratch) api.forceClockScratch();
            else if (command === "clock-pull" && api.forceClockPull) api.forceClockPull();
            else if (api.forceClockState) api.forceClockState(command);
            updateDebug();
        });
    }
    if (bridge && bridge.setOwnerMood) {
        var savedMoodKey = { "開心": "happy", "普通": "normal", "有點累": "tired", "有點煩": "annoyed", "暫時不想說": "private" }[memory.today.mood] || "normal";
        bridge.setOwnerMood(savedMoodKey);
    }
    if (bridge && bridge.setAnimationMode) bridge.setAnimationMode(memory.settings.animationMode || "system");
    controls.addEventListener("click", handleControls);
    controls.addEventListener("change", handleControls);
    controls.addEventListener("submit", function (event) {
        if (event.target && event.target.id === "jinzhu-chat-form") {
            event.preventDefault();
            var input = document.getElementById("jinzhu-chat-input");
            sendChat(input ? input.value : "");
        }
    });
    document.addEventListener("click", function (event) {
        var walker = document.getElementById("jinzhu-walker");
        var panel = document.getElementById("jinzhu-panel");
        if (!walker || !panel || panel.hidden || walker.contains(event.target)) return;
        showControl("");
        if (bridge && bridge.closeInteractions) bridge.closeInteractions();
        else if (bridge && bridge.closeMenu) bridge.closeMenu();
    }, true);
    reminderBox.addEventListener("click", handleReminderAction);
    ["pointerdown", "touchstart", "keydown", "mousemove"].forEach(function (name) {
        document.addEventListener(name, noteActivity, { passive: name !== "keydown" });
    });
    window.addEventListener("jinzhu:weather", function (event) {
        if (forcedWeather && debugWeatherCode(forcedWeather) !== undefined) return;
        handleWeather(event.detail || {});
    });
    window.addEventListener("jinzhu:status", function (event) {
        var status = event.detail && event.detail.status;
        memory.current.status = status;
        if (["sleeping", "eating", "playing", "look-around", "grooming", "rain", "heat", "fan"].indexOf(status) >= 0) recordEvent(status);
        if (memory.rain.active && bridge && bridge.requestRain && status === "idle") bridge.requestRain(true);
        if (memory.heat.active && Date.now() >= Number(memory.heat.coolingUntil || 0) && bridge && bridge.requestHeat && status === "idle") bridge.requestHeat(true);
        flushQueues();
    });
    window.addEventListener("jinzhu:position", function (event) {
        if (event.detail) { memory.current.positionX = event.detail.x; memory.current.positionY = event.detail.y; }
    });
    window.addEventListener("jinzhu:interaction", function (event) {
        var action = event.detail && event.detail.action;
        if (action === "pet") memory.today.petCount++;
        if (action === "feed") memory.today.feedCount++;
        saveMemory();
    });
    document.addEventListener("visibilitychange", function () {
        lastTickAt = Date.now();
        if (!document.hidden) { lastActivityAt = Date.now(); applySky(); flushQueues(); }
        saveMemory();
    });
    window.addEventListener("pagehide", function () { clearTimeout(tickTimer); saveMemory(); });
    window.addEventListener("pageshow", function () {
        clearTimeout(tickTimer);
        lastTickAt = Date.now();
        tick();
    });

    if (forcedWeather && debugWeatherCode(forcedWeather) !== undefined) handleWeather({ code: debugWeatherCode(forcedWeather), utcOffsetSeconds: 28800 });
    else if (weatherData) handleWeather(weatherData);
    else applySky();
    var requestedReminder = debugMode ? (params.get("forceReminder") || params.get("jinzhuReminder")) : null;
    if (requestedReminder === "both") { queueReminder("rest"); queueReminder("water"); }
    else if (requestedReminder) queueReminder(requestedReminder);
    if (debugMode && params.get("jinzhuMood")) {
        memory.today.mood = { happy: "開心", normal: "普通", tired: "有點累", annoyed: "有點煩", private: "暫時不想說" }[params.get("jinzhuMood")] || "普通";
    }
    setTimeout(function () { queueCatMessage(welcomeMessage()); }, 2200);
    if (!memory.today.mood) setTimeout(function () { queueCatMessage("今日感覺點呀？"); }, 9000);
    tick();
})();
