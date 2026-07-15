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
    var debugMode = params.get("jinzhuDebug") === "1";
    var storage = new LocalStorageAdapter(debugMode ? "messageClockDebug:" : "messageClock:");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
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
            restPausedDate: "", waterPausedDate: ""
        },
        reminder: {
            restSnoozeUntil: 0, waterSnoozeUntil: 0, lastRestPrompt: 0, lastWaterPrompt: 0,
            restDeferrals: 0, waterDeferrals: 0
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
        renderControls();
    }
    function minutes(ms) { return Math.floor(Number(ms || 0) / 60000); }
    function formatMinutes(ms) {
        var total = minutes(ms);
        return total >= 60 ? Math.floor(total / 60) + "小時 " + total % 60 + "分" : total + "分鐘";
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
        var forced = debugMode ? params.get("jinzhuWeather") : null;
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
    function showReminder(type) {
        if (!bridge || bridge.isBusy()) { queueReminder(type); return; }
        currentReminder = type;
        if (bridge && bridge.setReminder) bridge.setReminder(true);
        var rest = type === "rest", heat = type === "heat";
        if (rest) memory.reminder.waterSnoozeUntil = Math.max(Number(memory.reminder.waterSnoozeUntil || 0), Date.now() + (5 + Math.random() * 5) * 60000);
        if (heat) {
            reminderBox.innerHTML = "<p>超過 32°C，好熱呀。幫我降溫？</p><div><button data-heat='fan'>開風扇</button><button data-heat='aircon'>開冷氣</button><button data-heat='later'>稍後</button></div>";
        } else {
            reminderBox.innerHTML =
                "<p>" + (rest ? "望遠少少，俾眼睛休息下。" : "主人，飲啖水先啦。") + "</p>" +
                "<div><button data-reminder-done='" + type + "'>" + (rest ? "已休息" : "已喝水") + "</button>" +
                "<button data-reminder-later='" + type + "'>" + (rest ? "10 分鐘後" : "15 分鐘後") + "</button>" +
                "<button data-reminder-pause='" + type + "'>今日暫停</button></div>";
        }
        reminderBox.hidden = false;
        bridge.say(heat ? "主人，開冷氣定開風扇呀？" : rest ? "做咗好耐啦，起來郁一郁。" : "金主監督你補水。");
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
            else { memory.today.waterCount++; memory.lastWaterAt = Date.now(); memory.waterUseMs = 0; recordEvent("water"); }
        } else if (later) {
            memory.reminder[type + "SnoozeUntil"] = Date.now() + (type === "rest" ? 10 : 15) * 60000;
            memory.reminder[type + "Deferrals"]++;
        } else {
            memory.settings[type + "PausedDate"] = todayKey;
        }
        closeReminder();
        saveMemory();
    }

    function reminderDue(type) {
        var settings = memory.settings, reminder = memory.reminder;
        if (!settings[type + "Enabled"] || settings[type + "PausedDate"] === todayKey) return false;
        if (Date.now() < Number(reminder[type + "SnoozeUntil"] || 0)) return false;
        var threshold = Number(settings[type + "Minutes"]) * 60000;
        var basis = type === "rest" ? memory.activeUseMs : memory.waterUseMs;
        var lastPrompt = Number(reminder["last" + title(type) + "Prompt"] || 0);
        var courtesy = Math.min(Number(reminder[type + "Deferrals"] || 0) * 10, 30) * 60000;
        if (basis >= threshold + courtesy && Date.now() - lastPrompt > 15 * 60000) {
            reminder["last" + title(type) + "Prompt"] = Date.now();
            return true;
        }
        return false;
    }
    function title(value) { return value.charAt(0).toUpperCase() + value.slice(1); }

    function renderControls() {
        if (!controls) return;
        controls.innerHTML =
            "<div class='jinzhu-world-actions'>" +
            "<button data-world='work'>" + (memory.work.active ? "結束陪工" : "開始陪工") + "</button>" +
            "<button data-world='mood'>心情簽到</button><button data-world='diary'>金主日記</button><button data-world='settings'>設定</button></div>" +
            "<section id='jinzhu-work-box' hidden><label>陪伴方式<select id='jinzhu-work-mode'><option value='quiet'>安靜陪伴</option><option value='normal'>正常監督</option><option value='strict'>嚴格金主</option></select></label></section>" +
            "<section id='jinzhu-mood-box' hidden><p>今日感覺點呀？</p><div class='jinzhu-choice-grid'>" + moodButtons() + "</div></section>" +
            "<section id='jinzhu-diary-box' hidden>" + diaryHtml() + "</section>" +
            "<section id='jinzhu-settings-box' hidden>" + settingsHtml() + "</section>";
        var mode = document.getElementById("jinzhu-work-mode");
        if (mode) mode.value = memory.work.mode;
    }
    function moodButtons() {
        return [["happy", "開心"], ["normal", "普通"], ["tired", "有點累"], ["annoyed", "有點煩"], ["private", "暫時不想說"]].map(function (item) {
            return "<button data-mood='" + item[0] + "'>" + item[1] + "</button>";
        }).join("");
    }
    function diaryHtml() {
        var lines = diaryLines();
        return "<h3>今日金主日記</h3><p>陪伴 " + formatMinutes(memory.today.companionMs) + " · 飲水 " + memory.today.waterCount + " · 休息 " + memory.today.restCount + "</p>" +
            "<p>心情：" + (memory.today.mood || "未簽到") + " · 摸摸 " + memory.today.petCount + " · 投餵 " + memory.today.feedCount + "</p>" +
            "<ul>" + lines.map(function (line) { return "<li>" + line + "</li>"; }).join("") + "</ul>";
    }
    function diaryLines() {
        var types = {};
        memory.today.events.forEach(function (event) { types[event.type] = true; });
        var lines = [];
        if (memory.today.mood === "有點累") lines.push("今日主人有啲攰，我靜靜陪住佢。");
        else if (memory.today.mood === "有點煩") lines.push("主人今日想靜一靜，我冇再追問。");
        else if (memory.today.mood === "開心") lines.push("主人今日心情唔錯，我都有精神玩。");
        if (types.rain) lines.push("今日落過雨，我撐住遮陪主人。");
        if (types.fan) lines.push("今日好熱，主人幫我開咗風扇。");
        else if (types.aircon) lines.push("今日超過 32°C，主人幫我開咗冷氣。");
        if (types.eating) lines.push("今日我有好好食飯，碗都清晒。");
        if (types.sleeping) lines.push("我今日蜷埋瞓過一覺，醒來繼續監督。");
        if (types.water) lines.push("主人今日有記得飲水。");
        if (!lines.length) lines.push("今日我安靜坐喺度，陪主人睇時間。");
        return lines.slice(0, 3);
    }
    function settingsHtml() {
        return "<h3>提醒設定</h3>" +
            "<label><input id='rest-enabled' type='checkbox' " + (memory.settings.restEnabled ? "checked" : "") + ">休息提醒</label>" +
            "<select id='rest-minutes'>" + options([30,45,50,60], memory.settings.restMinutes) + "</select>" +
            "<label><input id='water-enabled' type='checkbox' " + (memory.settings.waterEnabled ? "checked" : "") + ">喝水提醒</label>" +
            "<select id='water-minutes'>" + options([60,90,120], memory.settings.waterMinutes) + "</select>" +
            "<p>今日喝水：" + memory.today.waterCount + " 次</p>";
    }
    function options(values, selected) {
        return values.map(function (value) { return "<option value='" + value + "' " + (Number(selected) === value ? "selected" : "") + ">" + value + " 分鐘</option>"; }).join("");
    }
    function showControl(name) {
        ["work", "mood", "diary", "settings"].forEach(function (key) {
            var element = document.getElementById("jinzhu-" + key + "-box");
            if (element) element.hidden = key !== name;
        });
    }
    function handleControls(event) {
        var button = event.target.closest("button"), select = event.target.closest("select"), input = event.target.closest("input");
        if (button && button.dataset.world) {
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
            renderControls(); saveMemory(); return;
        }
        if (select && select.id === "jinzhu-work-mode") {
            memory.work.mode = select.value;
            if (bridge) bridge.setQuietMode(select.value === "quiet");
            if (bridge && bridge.setCompanionMode) bridge.setCompanionMode(select.value);
            saveMemory();
        }
        if (select && select.id === "rest-minutes") memory.settings.restMinutes = Number(select.value);
        if (select && select.id === "water-minutes") memory.settings.waterMinutes = Number(select.value);
        if (input && input.id === "rest-enabled") memory.settings.restEnabled = input.checked;
        if (input && input.id === "water-enabled") memory.settings.waterEnabled = input.checked;
        if (select || input) saveMemory();
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
        debugBox.textContent = "world " + sky.phase + " " + Math.round(sky.progress * 100) + "% · " +
            "time " + Math.round(sky.minute) + " sunrise " + Math.round(sky.sunrise) + " sunset " + Math.round(sky.sunset) +
            " · weather " + (weatherData ? weatherType(weatherData.code) : "fallback") + " · queue " + reminderQueue.join(",") +
            " · storage " + (storage.available ? "local" : "memory-only");
    }
    function noteActivity() { lastActivityAt = Date.now(); }

    setupLayers();
    renderControls();
    if (bridge && bridge.setOwnerMood) {
        var savedMoodKey = { "開心": "happy", "普通": "normal", "有點累": "tired", "有點煩": "annoyed", "暫時不想說": "private" }[memory.today.mood] || "normal";
        bridge.setOwnerMood(savedMoodKey);
    }
    controls.addEventListener("click", handleControls);
    controls.addEventListener("change", handleControls);
    reminderBox.addEventListener("click", handleReminderAction);
    ["pointerdown", "touchstart", "keydown", "mousemove"].forEach(function (name) {
        document.addEventListener(name, noteActivity, { passive: name !== "keydown" });
    });
    window.addEventListener("jinzhu:weather", function (event) { handleWeather(event.detail || {}); });
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

    var forcedWeather = debugMode ? params.get("jinzhuWeather") : null;
    if (forcedWeather && debugWeatherCode(forcedWeather) !== undefined) handleWeather({ code: debugWeatherCode(forcedWeather), utcOffsetSeconds: 28800 });
    else if (weatherData) handleWeather(weatherData);
    else applySky();
    if (debugMode && params.get("jinzhuReminder") === "both") { queueReminder("rest"); queueReminder("water"); }
    else if (debugMode && params.get("jinzhuReminder")) queueReminder(params.get("jinzhuReminder"));
    if (debugMode && params.get("jinzhuMood")) {
        memory.today.mood = { happy: "開心", normal: "普通", tired: "有點累", annoyed: "有點煩", private: "暫時不想說" }[params.get("jinzhuMood")] || "普通";
    }
    setTimeout(function () { queueCatMessage(welcomeMessage()); }, 2200);
    if (!memory.today.mood) setTimeout(function () { queueCatMessage("今日感覺點呀？"); }, 9000);
    tick();
})();
