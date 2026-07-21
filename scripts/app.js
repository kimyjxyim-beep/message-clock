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
    var hourStr = (hour < 10 ? "0" + hour : "" + hour);
    var minuteStr = (minute < 10 ? "0" + minute : "" + minute);

    flipUpdate("hour", hourStr);
    flipUpdate("minute", minuteStr);
    try {
        window.dispatchEvent(new CustomEvent("jinzhu:clock-change", { detail: { hour: hourStr, minute: minuteStr } }));
    } catch (e) {}

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
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + WEATHER_LAT + "&longitude=" + WEATHER_LON +
        "&current=temperature_2m,weather_code,precipitation,rain,showers&daily=sunrise,sunset&timezone=auto&forecast_days=1";
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
            try {
                var data = JSON.parse(xhr.responseText);
                var current = data && (data.current || data.current_weather);
                if (current) {
                    var code = current.weather_code !== undefined ? current.weather_code : current.weathercode;
                    var temperature = current.temperature_2m !== undefined ? current.temperature_2m : current.temperature;
                    var temp = Math.round(temperature);
                    var info = weatherCodeToInfo(code);
                    document.getElementById("weather").innerHTML = info.emoji + " " + WEATHER_CITY_NAME + " " + temp + "°C";
                    window.dispatchEvent(new CustomEvent("jinzhu:weather", { detail: {
                        code: Number(code),
                        temperature: Number(temperature),
                        precipitation: Number(current.precipitation || 0),
                        rain: Number(current.rain || 0),
                        showers: Number(current.showers || 0),
                        sunrise: data.daily && data.daily.sunrise ? data.daily.sunrise[0] : null,
                        sunset: data.daily && data.daily.sunset ? data.daily.sunset[0] : null,
                        timezone: data.timezone || "Asia/Shanghai",
                        utcOffsetSeconds: Number(data.utc_offset_seconds || 28800)
                    } }));
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
    if (window.JINZHU_ROUTINE_V2) return;
    var home = document.getElementById("jinzhu-home");
    var walker = document.getElementById("jinzhu-walker");
    var cat = document.getElementById("jinzhu-cat");
    var catImage = document.getElementById("jinzhu-image");
    var bubble = document.getElementById("jinzhu-bubble");
    var panel = document.getElementById("jinzhu-panel");
    if (!home || !walker || !cat || !catImage || !bubble || !panel) return;

    var storageKey = "messageClockJinzhuState";
    var state = { mood: 72, energy: 68, bond: 40, lastInteraction: Date.now() };
    try {
        var saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved) {
            if (isFinite(Number(saved.mood))) state.mood = Number(saved.mood);
            if (isFinite(Number(saved.energy))) state.energy = Number(saved.energy);
            if (isFinite(Number(saved.bond))) state.bond = Number(saved.bond);
            if (isFinite(Number(saved.lastInteraction))) state.lastInteraction = Number(saved.lastInteraction);
        }
    } catch (e) {}

    var lines = [
        "你做嘢，我监督。",
        "今日有冇摸我？",
        "我唔系宠物，我系金主。",
        "食齋食齋！！🌱🥬",
        "做完先准休息。",
        "我醒住，你放心。"
    ];
    var actionLines = {
        pet: ["摸多兩下都可以嘅。", "唔係我想你摸，係你手凍。"],
        feed: ["菜菜放低，我自己食。🌱", "勉強合格，聽日繼續。"],
        chat: lines
    };
    var bubbleTimer;
    var behaviorTimer;
    var sleepTimer;
    var spriteTimer;
    var currentStatus = "idle";
    var currentPosition = { x: 0, y: 0 };
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var testMode = new URLSearchParams(location.search).get("jinzhuTest");
    var isLocalTest = (location.hostname === "127.0.0.1" || location.hostname === "localhost") &&
        (testMode === "sleep" || testMode === "behaviors");
    var sleepyAfter = testMode === "sleep" && isLocalTest ? 3000 : 3 * 60 * 1000;
    var sleepingAfter = testMode === "sleep" && isLocalTest ? 8000 : 8 * 60 * 1000;
    var sleepCheckInterval = testMode === "sleep" && isLocalTest ? 250 : 15000;
    var testBehaviors = ["look-around", "grooming", "playing"];
    if (isLocalTest) state.lastInteraction = Date.now();
    var behaviorClasses = ["idle", "walk", "look-around", "grooming", "playing", "sleepy", "sleeping", "happy", "eating"];
    var spriteBase = "assets/jinzhu/";
    var sprites = {
        idle: ["idle-1.png", "idle-2.png", "idle-3.png", "idle-4.png", "idle-5.png", "idle-2.png"],
        walk: ["walk-1.png", "walk-2.png", "walk-3.png", "walk-4.png", "walk-5.png", "walk-6.png", "walk-7.png"],
        "look-around": ["look-1.png", "look-2.png", "look-3.png", "look-4.png", "look-5.png", "look-3.png"],
        grooming: ["groom-1.png", "groom-2.png", "groom-3.png", "groom-4.png", "groom-1.png"],
        playing: ["roll-1.png", "roll-2.png", "roll-3.png", "roll-4.png", "roll-5.png", "roll-6.png"],
        happy: ["happy-1.png", "happy-2.png", "happy-3.png", "happy-4.png", "happy-2.png"],
        eating: ["groom-1.png", "groom-4.png", "groom-1.png", "groom-4.png"],
        sleepy: ["idle-3.png", "idle-4.png"],
        sleeping: ["sleep-1.png"]
    };
    var spriteSpeeds = {
        idle: 900, walk: 145, "look-around": 480, grooming: 520,
        playing: 340, happy: 300, eating: 430, sleepy: 1500, sleeping: 2500
    };

    Object.keys(sprites).forEach(function (name) {
        sprites[name].forEach(function (filename) {
            var preload = new Image();
            preload.src = spriteBase + filename;
        });
    });

    function clamp(value) { return Math.max(0, Math.min(100, value)); }
    function saveAndRender(shouldSave) {
        state.mood = clamp(state.mood);
        state.energy = clamp(state.energy);
        state.bond = clamp(state.bond);
        document.getElementById("jinzhu-mood").textContent = state.mood;
        document.getElementById("jinzhu-energy").textContent = state.energy;
        document.getElementById("jinzhu-bond").textContent = state.bond;
        if (shouldSave) {
            try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) {}
        }
    }
    function setStatus(status) {
        for (var i = 0; i < behaviorClasses.length; i++) {
            home.classList.remove(behaviorClasses[i]);
        }
        home.classList.add(status);
        currentStatus = status;
        playSprite(status);
    }
    function playSprite(status) {
        clearInterval(spriteTimer);
        var frames = sprites[status] || sprites.idle;
        var frameIndex = 0;
        catImage.src = spriteBase + frames[0];
        if (document.hidden || reduceMotion.matches || frames.length < 2) return;
        spriteTimer = setInterval(function () {
            frameIndex = (frameIndex + 1) % frames.length;
            catImage.src = spriteBase + frames[frameIndex];
        }, spriteSpeeds[status] || 600);
    }
    function say(text, persistent) {
        var spaceOnRight = window.innerWidth - (currentPosition.x + walker.offsetWidth);
        home.classList.toggle("bubble-right", spaceOnRight >= 126);
        home.classList.toggle("bubble-left", spaceOnRight < 126);
        bubble.textContent = text;
        bubble.classList.add("show");
        clearTimeout(bubbleTimer);
        if (!persistent) {
            bubbleTimer = setTimeout(function () { bubble.classList.remove("show"); }, 3200);
        }
    }
    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
    function recordInteraction() {
        state.lastInteraction = Date.now();
        saveAndRender(true);
    }
    function getSafeBounds() {
        var date = document.getElementById("date");
        var dateBottom = date ? date.getBoundingClientRect().bottom : window.innerHeight * .35;
        var petWidth = walker.offsetWidth || 116;
        var petHeight = walker.offsetHeight || 116;
        var horizontalPadding = 8;
        var widestPopoverHalf = 112;
        var safeBottom = Math.max(14, parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom")) || 0);
        var minY = Math.max(Math.round(window.innerHeight * .46), Math.round(dateBottom + 56));
        var maxY = window.innerHeight - petHeight - safeBottom - 10;
        var minX = widestPopoverHalf - petWidth / 2 + horizontalPadding;
        var maxX = window.innerWidth - widestPopoverHalf - petWidth / 2 - horizontalPadding;

        // 短螢幕仍保證金主在日期下方，並完整留在視口內。
        var hasRoom = dateBottom + 16 <= maxY;
        if (minY > maxY) minY = Math.max(0, maxY);
        return {
            minX: Math.max(horizontalPadding, minX),
            maxX: Math.max(Math.max(horizontalPadding, minX), maxX),
            minY: minY,
            maxY: Math.max(minY, maxY),
            hasRoom: hasRoom
        };
    }
    function overlaps(rect, obstacle, margin) {
        return !(
            rect.right + margin <= obstacle.left ||
            rect.left - margin >= obstacle.right ||
            rect.bottom + margin <= obstacle.top ||
            rect.top - margin >= obstacle.bottom
        );
    }
    function positionIsSafe(position) {
        var petRect = {
            left: position.x,
            top: position.y,
            right: position.x + (walker.offsetWidth || 116),
            bottom: position.y + (walker.offsetHeight || 116)
        };
        var selectors = [".clock", ".date", ".weather-card", ".message"];
        for (var i = 0; i < selectors.length; i++) {
            var element = document.querySelector(selectors[i]);
            if (!element) continue;
            var rect = element.getBoundingClientRect();
            if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
            if (overlaps(petRect, rect, 8)) return false;
        }
        return true;
    }
    function clampPosition(position) {
        var bounds = getSafeBounds();
        return {
            x: Math.max(bounds.minX, Math.min(bounds.maxX, position.x)),
            y: Math.max(bounds.minY, Math.min(bounds.maxY, position.y))
        };
    }
    function setPosition(position, duration) {
        var bounds = getSafeBounds();
        home.classList.toggle("no-safe-room", !bounds.hasRoom);
        var safe = clampPosition(position);
        if (safe.x < currentPosition.x) home.style.setProperty("--jinzhu-facing", "-1");
        if (safe.x > currentPosition.x) home.style.setProperty("--jinzhu-facing", "1");
        home.style.setProperty("--jinzhu-walk-duration", duration + "ms");
        home.style.setProperty("--jinzhu-x", Math.round(safe.x) + "px");
        home.style.setProperty("--jinzhu-y", Math.round(safe.y) + "px");
        currentPosition = safe;
    }
    function homePosition() {
        var bounds = getSafeBounds();
        var slot = home.getBoundingClientRect();
        return clampPosition({
            x: slot.left + slot.width / 2 - walker.offsetWidth / 2,
            y: Math.max(bounds.minY, Math.min(bounds.maxY, slot.top))
        });
    }
    function randomPosition() {
        var bounds = getSafeBounds();
        var slot = home.getBoundingClientRect();
        var laneMinX = Math.max(bounds.minX, slot.left + 6);
        var laneMaxX = Math.min(bounds.maxX, slot.right - walker.offsetWidth - 6);
        var laneMinY = Math.max(bounds.minY, slot.top);
        var laneMaxY = Math.min(bounds.maxY, slot.bottom - walker.offsetHeight);
        var target = null;
        var attempts = 0;
        while (attempts < 80) {
            var useLane = laneMaxX >= laneMinX && laneMaxY >= laneMinY && (attempts < 40 || window.innerWidth <= 600);
            var candidate = useLane ? {
                x: laneMinX + Math.random() * (laneMaxX - laneMinX),
                y: laneMinY + Math.random() * Math.max(0, laneMaxY - laneMinY)
            } : {
                x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
                y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY)
            };
            attempts++;
            if (
                positionIsSafe(candidate) &&
                Math.abs(candidate.x - currentPosition.x) + Math.abs(candidate.y - currentPosition.y) >= 50
            ) {
                target = candidate;
                break;
            }
        }
        return target || homePosition();
    }
    function scheduleNextBehavior(delay) {
        clearTimeout(behaviorTimer);
        if (reduceMotion.matches || currentStatus === "sleeping" || currentStatus === "sleepy") return;
        var nextDelay = testMode === "behaviors" && isLocalTest ? 400 : 8000 + Math.random() * 12000;
        behaviorTimer = setTimeout(chooseBehavior, delay == null ? nextDelay : delay);
    }
    function finishBehavior(delay) {
        clearTimeout(behaviorTimer);
        behaviorTimer = setTimeout(function () {
            if (Date.now() - state.lastInteraction >= sleepyAfter) {
                updateSleepState();
                return;
            }
            setStatus("idle");
            scheduleNextBehavior();
        }, delay);
    }
    function walk() {
        if (reduceMotion.matches) {
            setStatus("idle");
            return;
        }
        setStatus("walk");
        var duration = testMode === "behaviors" && isLocalTest ? 900 : 3000 + Math.random() * 5000;
        setPosition(randomPosition(), duration);
        finishBehavior(duration + 150);
    }
    function lookAround() {
        setStatus("look-around");
        finishBehavior(testMode === "behaviors" && isLocalTest ? 700 : 2600);
    }
    function groom() {
        setStatus("grooming");
        say("整理下毛先。");
        finishBehavior(testMode === "behaviors" && isLocalTest ? 900 : 3000 + Math.random() * 2000);
    }
    function play() {
        setStatus("playing");
        say("活動下先。");
        finishBehavior(testMode === "behaviors" && isLocalTest ? 900 : 3200 + Math.random() * 1200);
    }
    function chooseBehavior() {
        if (reduceMotion.matches || Date.now() - state.lastInteraction >= sleepyAfter) {
            updateSleepState();
            return;
        }
        if (isLocalTest && testBehaviors.length) {
            var next = testBehaviors.shift();
            if (next === "walk") walk();
            if (next === "look-around") lookAround();
            if (next === "grooming") groom();
            if (next === "playing") play();
            return;
        }
        var roll = Math.random();
        if (roll < .46) {
            walk();
        } else if (roll < .66) {
            lookAround();
        } else if (roll < .82) {
            groom();
        } else if (roll < .94) {
            play();
        } else {
            setStatus("idle");
            scheduleNextBehavior();
        }
    }
    function updateSleepState() {
        if (currentStatus === "happy" || currentStatus === "eating") return;
        var idleTime = Date.now() - state.lastInteraction;
        if (idleTime >= sleepingAfter) {
            if (currentStatus !== "sleeping") {
                clearTimeout(behaviorTimer);
                panel.hidden = true;
                setStatus("sleeping");
                say("zzZ", true);
                saveAndRender(true);
            }
        } else if (idleTime >= sleepyAfter) {
            if (currentStatus !== "sleepy") {
                clearTimeout(behaviorTimer);
                setStatus("sleepy");
                say("有少少眼瞓…");
                saveAndRender(true);
            }
        } else if (currentStatus === "sleepy" || currentStatus === "sleeping") {
            setStatus("idle");
            scheduleNextBehavior();
        }
    }
    function wakeUp() {
        var wasAsleep = currentStatus === "sleeping" || currentStatus === "sleepy";
        clearTimeout(behaviorTimer);
        clearTimeout(bubbleTimer);
        bubble.classList.remove("show");
        recordInteraction();
        setStatus("idle");
        return wasAsleep;
    }
    function playInteraction(status, line) {
        clearTimeout(behaviorTimer);
        setStatus(status);
        say(line);
        behaviorTimer = setTimeout(function () {
            setStatus("idle");
            if (panel.hidden) scheduleNextBehavior();
        }, 2000);
    }

    cat.addEventListener("click", function () {
        var wasSleeping = wakeUp();
        if (wasSleeping) {
            panel.hidden = true;
            say("我醒住，你放心。");
            scheduleNextBehavior();
            return;
        }
        var openingPanel = panel.hidden;
        panel.hidden = !panel.hidden;
        say(pick(lines));
        if (openingPanel) {
            clearTimeout(behaviorTimer);
            setStatus("idle");
        } else {
            scheduleNextBehavior();
        }
    });
    panel.addEventListener("click", function (event) {
        var button = event.target.closest("[data-jinzhu-action]");
        if (!button) return;
        var action = button.getAttribute("data-jinzhu-action");
        wakeUp();
        if (action === "pet") {
            state.mood += 6; state.bond += 3; state.energy -= 1;
            playInteraction("happy", pick(actionLines.pet));
        }
        if (action === "feed") {
            state.energy += 10; state.mood += 3; state.bond += 1;
            playInteraction("eating", pick(actionLines.feed));
        }
        if (action === "chat") {
            state.bond += 5; state.mood += 2; state.energy -= 2;
            setStatus("idle");
            say(pick(actionLines.chat));
            if (panel.hidden) scheduleNextBehavior();
        }
        saveAndRender(true);
    });
    function handleMotionPreference() {
        clearTimeout(behaviorTimer);
        setPosition(homePosition(), reduceMotion.matches ? 0 : 500);
        setStatus("idle");
        if (!reduceMotion.matches) scheduleNextBehavior(1200);
    }
    if (reduceMotion.addEventListener) {
        reduceMotion.addEventListener("change", handleMotionPreference);
    } else if (reduceMotion.addListener) {
        reduceMotion.addListener(handleMotionPreference);
    }
    window.addEventListener("resize", function () {
        setPosition(positionIsSafe(currentPosition) ? currentPosition : homePosition(), 0);
    });
    window.addEventListener("orientationchange", function () {
        setTimeout(function () { setPosition(homePosition(), 0); }, 120);
    });
    window.addEventListener("scroll", function () {
        setPosition(positionIsSafe(currentPosition) ? currentPosition : homePosition(), 0);
    }, { passive: true });
    document.addEventListener("visibilitychange", function () {
        clearTimeout(behaviorTimer);
        clearInterval(spriteTimer);
        clearInterval(sleepTimer);
        if (document.hidden) return;
        setPosition(positionIsSafe(currentPosition) ? currentPosition : homePosition(), 0);
        updateSleepState();
        playSprite(currentStatus);
        sleepTimer = setInterval(updateSleepState, sleepCheckInterval);
        if (!reduceMotion.matches && currentStatus !== "sleepy" && currentStatus !== "sleeping") {
            scheduleNextBehavior(1200);
        }
    });

    saveAndRender(false);
    setPosition(homePosition(), 0);
    updateSleepState();
    sleepTimer = setInterval(updateSleepState, sleepCheckInterval);
    if (!reduceMotion.matches && currentStatus !== "sleepy" && currentStatus !== "sleeping") {
        clearTimeout(behaviorTimer);
        behaviorTimer = setTimeout(walk, 1200);
    }
})();
