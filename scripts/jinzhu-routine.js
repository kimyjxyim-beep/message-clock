/* Jinzhu's low-frequency daily routine and movement scheduler. */
(function initRealisticJinzhu() {
    "use strict";

    if (window.Element && !Element.prototype.closest) {
        Element.prototype.closest = function (selector) {
            var node = this;
            var matches = Element.prototype.matches || Element.prototype.webkitMatchesSelector || Element.prototype.msMatchesSelector;
            while (node && node.nodeType === 1) {
                if (matches.call(node, selector)) return node;
                node = node.parentElement;
            }
            return null;
        };
    }

    window.JINZHU_ROUTINE_V2 = true;
    var IDLE_SLEEP_DELAY_MS = 5 * 60 * 1000;

    var home = document.getElementById("jinzhu-home");
    var walker = document.getElementById("jinzhu-walker");
    var cat = document.getElementById("jinzhu-cat");
    var catImage = document.getElementById("jinzhu-image");
    var bubble = document.getElementById("jinzhu-bubble");
    var bubbleText = document.getElementById("jinzhu-bubble-text");
    var bubbleMenu = null;
    var panel = document.getElementById("jinzhu-panel");
    if (!home || !walker || !cat || !catImage || !bubble || !panel) return;

    var params = queryParameters(location.search);
    var debugMode = params.get("jinzhuDebug") === "1" || params.get("jinzhuTestMode") === "1";
    var actionTestMode = params.get("jinzhutest") === "1";
    var debugHold = debugMode && params.get("jinzhuHold") === "1";
    var debugNormalSpeed = debugMode && params.get("jinzhuSpeed") === "normal";
    var debugDelayedAction = debugMode && params.get("jinzhuDelay") === "1";
    var debugNoClimb = debugMode && params.get("jinzhuNoClimb") === "1";
    var debugOpenPanel = debugMode && params.get("jinzhuPanel") === "1";
    var debugClickOutcome = debugMode ? params.get("jinzhuClick") : null;
    var mockTime = params.get("mockTime");
    var debugHour = Number(params.get("jinzhuHour"));
    if (debugMode && mockTime && /^\d{1,2}:\d{2}$/.test(mockTime)) debugHour = Number(mockTime.split(":")[0]) + Number(mockTime.split(":")[1]) / 60;
    var debugAction = params.get("jinzhuAction") || params.get("forceState");
    var motionSpeed = Math.max(1, Math.min(20, Number(params.get("motionSpeed")) || 1));
    var debugPoint = params.get("jinzhuPoint");
    var storageKey = debugMode ? "messageClockJinzhuStateDebug" : "messageClockJinzhuState";
    var petStorage = new window.LocalStorageAdapter("");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var behaviorTimer = null;
    var spriteTimer = null;
    var bubbleTimer = null;
    var schedulerGeneration = 0;
    var currentStatus = "idle";
    var currentPosition = { x: 0, y: 0 };
    var legacyPosition = false;
    var positionSupportChecked = false;
    var legacyMoveFrame = null;
    var legacyMoveToken = 0;
    var lastTapAt = 0;
    var catClickTimer = null;
    var lastCatClickAt = 0;
    var longPressTimer = null;
    var longPressTriggered = false;
    var suppressClickUntil = 0;
    var pressStart = null;
    var panelTimer = null;
    var feedingPending = false;
    var tapAwayPending = false;
    var tapAwayTimer = null;
    window.JINZHU_IMMERSIVE = true;
    var introWalkPending = false;
    var pendingEatingDuration = 10000;
    var rainActive = false;
    var latestWeather = null;
    var reminderActive = false;
    var ownerMood = "normal";
    var companionMode = "normal";
    var animationMode = "system";
    var oldIPad = /iPad.*OS (?:[1-9]|10)_/i.test(navigator.userAgent || "");
    var lowPowerDevice = oldIPad || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    var simpleMotion = lowPowerDevice;
    if (oldIPad) document.documentElement.className += " jinzhu-old-ipad";
    var climbing = false;
    var perched = false;
    var clockAnchorActive = "";
    var clockAnchorTimer = null;
    var clockScratchActive = false;
    var lastScratchWindow = "";
    var spriteBase = "assets/jinzhu/";
    var behaviorClasses = [
        "sleeping", "sleepy", "idle", "look-around", "grooming",
        "walking", "tap-running", "playing", "eating", "happy", "rain", "heat", "fan",
        "climbing", "perched", "climbing-down", "clock-perch", "clock-hook", "clock-nap", "clock-peek", "colon-sit",
        "clock-scratching", "clock-flip-pull",
        "message-sit", "message-peek", "message-paw",
        "turn", "stretch", "crouch", "side-sleep", "side-sleeping",
        "clock-prone-closing", "clock-prone-sleeping", "clock-side-transition", "clock-side-sleeping",
        "clock-curl-transition", "clock-curl-sleeping",
        "look-clock", "jump-clock", "scratch-digits", "lie-clock", "card-peek",
        "paw-rest", "paw-rest-message", "paw-rest-weather", "paw-rest-release", "paw-tap",
        "sunbathe-prepare", "sunbathe-rest", "sunbathe-finish",
        "grass-notice", "grass-sniff", "grass-bite", "grass-chew", "grass-finish"
    ];
    var sprites = {
        idle: ["idle-1.png", "idle-2.png", "idle-3.png", "idle-5.png", "idle-2.png"],
        walking: ["walk-1.png", "walk-2.png", "walk-3.png", "walk-4.png", "walk-5.png", "walk-6.png", "walk-7.png"],
        "tap-running": ["walk-1.png", "walk-3.png", "walk-5.png", "walk-7.png", "walk-4.png", "walk-2.png"],
        "look-around": ["look-1.png", "look-2.png", "look-3.png", "look-4.png", "look-5.png", "look-3.png"],
        grooming: ["groom-1.png", "groom-2.png", "groom-3.png", "groom-4.png", "groom-1.png"],
        playing: ["roll-1.png", "roll-2.png", "roll-3.png", "roll-4.png", "roll-5.png", "roll-6.png"],
        happy: ["happy-1.png", "happy-2.png", "happy-3.png", "happy-4.png", "happy-2.png"],
        eating: ["eat-1.png", "eat-2.png", "eat-3.png", "eat-4.png", "eat-5.png"],
        sleepy: ["idle-3.png", "sleep-1.png", "idle-4.png"],
        sleeping: ["sleep-curl-1.png", "sleep-curl-2.png", "sleep-curl-1.png", "sleep-curl-3.png"],
        "side-sleeping": [
            "animations/new-actions/normalized/side-sleep-03.png",
            "animations/new-actions/normalized/side-sleep-04.png",
            "animations/new-actions/normalized/side-sleep-03.png"
        ],
        "clock-prone-closing": [
            "animations/new-actions/normalized/clock-prone-04.png",
            "animations/new-actions/normalized/clock-prone-sleep-01.png",
            "animations/new-actions/normalized/clock-prone-sleep-02.png"
        ],
        "clock-prone-sleeping": ["animations/new-actions/normalized/clock-prone-sleep-02.png"],
        "clock-side-transition": [
            "animations/new-actions/normalized/clock-prone-sleep-02.png",
            "animations/new-actions/normalized/side-sleep-01.png",
            "animations/new-actions/normalized/side-sleep-02.png",
            "animations/new-actions/normalized/side-sleep-03.png"
        ],
        "clock-side-sleeping": [
            "animations/new-actions/normalized/side-sleep-03.png",
            "animations/new-actions/normalized/side-sleep-04.png",
            "animations/new-actions/normalized/side-sleep-03.png"
        ],
        "clock-curl-transition": [
            "animations/new-actions/normalized/side-sleep-04.png",
            "animations/new-actions/normalized/side-sleep-03.png",
            "sleep-curl-1.png",
            "sleep-curl-2.png"
        ],
        "clock-curl-sleeping": ["sleep-curl-1.png", "sleep-curl-2.png", "sleep-curl-1.png", "sleep-curl-3.png"],
        rain: ["rain-1.png", "rain-2.png", "rain-3.png", "rain-2.png"],
        heat: ["heat-1.png"],
        fan: ["fan-1.png", "fan-2.png", "fan-3.png", "fan-2.png"],
        climbing: ["climb-1.png", "climb-2.png", "climb-3.png", "climb-4.png", "climb-5.png"],
        perched: ["perch-1.png", "perch-2.png"],
        "climbing-down": ["climb-down-1.png", "climb-down-2.png", "climb-down-3.png"],
        "clock-perch": ["perch-1.png", "perch-2.png"],
        "clock-hook": ["climb-2.png", "climb-3.png", "climb-4.png"],
        "clock-nap": ["sleep-curl-1.png", "sleep-curl-2.png", "sleep-curl-3.png"],
        "clock-peek": ["clock-peek-1.png"],
        "colon-sit": ["idle-1.png", "idle-2.png"],
        "clock-scratching": ["climb-2.png", "climb-3.png", "climb-2.png", "climb-4.png"],
        "clock-flip-pull": ["climb-4.png", "climb-5.png", "climb-down-1.png", "climb-down-2.png"],
        // 留言板互动重用现有素材，暂不需要新画帧
        "message-sit": ["perch-1.png", "perch-2.png"],
        "message-peek": ["clock-peek-1.png"],
        "message-paw": ["climb-2.png", "climb-3.png", "climb-2.png"],
        "sunbathe-prepare": [
            "animations/lifestyle-preview/sunbathe/sunbathe-01.png",
            "animations/lifestyle-preview/sunbathe/sunbathe-02.png",
            "animations/lifestyle-preview/sunbathe/sunbathe-03.png"
        ],
        "sunbathe-rest": [
            "animations/lifestyle-preview/sunbathe/sunbathe-04.png",
            "animations/lifestyle-preview/sunbathe/sunbathe-05.png"
        ],
        "sunbathe-finish": [
            "animations/lifestyle-preview/sunbathe/sunbathe-05.png",
            "animations/lifestyle-preview/sunbathe/sunbathe-03.png",
            "animations/lifestyle-preview/sunbathe/sunbathe-02.png",
            "animations/lifestyle-preview/sunbathe/sunbathe-06.png"
        ],
        "grass-notice": ["animations/lifestyle-preview/cat-grass/cat/cat-grass-cat-01.png"],
        "grass-sniff": ["animations/lifestyle-preview/cat-grass/cat/cat-grass-cat-02.png"],
        "grass-bite": [
            "animations/lifestyle-preview/cat-grass/cat/cat-grass-cat-03.png",
            "animations/lifestyle-preview/cat-grass/cat/cat-grass-cat-04.png"
        ],
        "grass-chew": [
            "animations/lifestyle-preview/cat-grass/cat/cat-grass-cat-05.png",
            "animations/lifestyle-preview/cat-grass/cat/cat-grass-cat-04.png"
        ],
        "grass-finish": ["animations/lifestyle-preview/cat-grass/cat/cat-grass-cat-06.png"]
    };
    /* New actions deliberately live beside—not inside—the legacy sprite set. */
    var newActionConfig = {
        turn: { frames: ["animations/new-actions/free-roam/turn-01.png", "animations/new-actions/free-roam/turn-02.png", "animations/new-actions/free-roam/turn-03.png", "animations/new-actions/free-roam/turn-04.png"], frame: 180, cooldown: 22000 },
        stretch: { frames: ["animations/new-actions/stretch/stretch-01.png", "animations/new-actions/stretch/stretch-02.png", "animations/new-actions/stretch/stretch-03.png", "animations/new-actions/stretch/stretch-04.png"], frame: 240, cooldown: 90000 },
        crouch: { frames: ["animations/new-actions/rest/crouch-01.png", "animations/new-actions/rest/crouch-02.png", "animations/new-actions/rest/crouch-03.png", "animations/new-actions/rest/crouch-04.png"], frame: 210, cooldown: 70000 },
        "side-sleep": { frames: ["animations/new-actions/normalized/side-sleep-01.png", "animations/new-actions/normalized/side-sleep-02.png", "animations/new-actions/normalized/side-sleep-03.png", "animations/new-actions/normalized/side-sleep-04.png"], frame: 420, hold: 2200, cooldown: 150000 },
        "look-clock": { frames: ["animations/new-actions/normalized/look-clock-01.png", "animations/new-actions/normalized/look-clock-02.png", "animations/new-actions/normalized/look-clock-03.png", "animations/new-actions/normalized/look-clock-04.png"], frame: 320, hold: 2600, cooldown: 90000 },
        "jump-clock": { frames: ["animations/new-actions/normalized/paw-grip-01.png", "animations/new-actions/normalized/clock-prone-01.png", "animations/new-actions/normalized/paw-grip-02.png", "animations/new-actions/normalized/clock-prone-02.png"], frame: 220, cooldown: 120000 },
        "scratch-digits": { frames: ["animations/new-actions/digit-scratch/digit-scratch-01.png", "animations/new-actions/digit-scratch/digit-scratch-02.png", "animations/new-actions/digit-scratch/digit-scratch-03.png", "animations/new-actions/digit-scratch/digit-scratch-04.png", "animations/new-actions/digit-scratch/digit-scratch-05.png", "animations/new-actions/digit-scratch/digit-scratch-02.png", "animations/new-actions/digit-scratch/digit-scratch-03.png", "animations/new-actions/digit-scratch/digit-scratch-04.png", "animations/new-actions/digit-scratch/digit-scratch-05.png", "animations/new-actions/digit-scratch/digit-scratch-06.png"], frame: 150, hold: 700, cooldown: 120000 },
        "lie-clock": { frames: ["animations/new-actions/normalized/clock-prone-01.png", "animations/new-actions/normalized/clock-prone-02.png", "animations/new-actions/normalized/clock-prone-03.png", "animations/new-actions/normalized/clock-prone-04.png"], frame: 380, hold: 3200, cooldown: 150000 },
        "card-peek": { frames: ["animations/new-actions/normalized/card-peek-01.png", "animations/new-actions/normalized/card-peek-02.png", "animations/new-actions/normalized/card-peek-03.png", "animations/new-actions/normalized/card-peek-04.png"], frame: 260, hold: 1500, cooldown: 100000 },
        "paw-rest": { frames: ["animations/new-actions/normalized/paw-grip-01.png", "animations/new-actions/normalized/paw-grip-02.png", "animations/new-actions/normalized/paw-grip-03.png", "animations/new-actions/normalized/paw-grip-03.png"], frame: 220, hold: 2200, cooldown: 90000 },
        "paw-rest-message": { frames: ["animations/new-actions/normalized/paw-grip-01.png", "animations/new-actions/normalized/paw-grip-02.png", "animations/new-actions/normalized/paw-grip-03.png", "animations/new-actions/normalized/paw-grip-03.png"], frame: 220, hold: 2200, cooldown: 90000 },
        "paw-rest-weather": { frames: ["animations/new-actions/normalized/paw-grip-01.png", "animations/new-actions/normalized/paw-grip-02.png", "animations/new-actions/normalized/paw-grip-03.png", "animations/new-actions/normalized/paw-grip-03.png"], frame: 220, hold: 2200, cooldown: 90000 },
        "paw-rest-release": { frames: ["animations/new-actions/normalized/paw-grip-03.png", "animations/new-actions/normalized/paw-grip-02.png", "animations/new-actions/normalized/paw-grip-01.png", "animations/new-actions/normalized/paw-grip-04.png"], frame: 180, hold: 0, cooldown: 0 },
        "paw-tap": { frames: ["animations/new-actions/normalized/paw-tap-01.png", "animations/new-actions/normalized/paw-tap-02.png", "animations/new-actions/normalized/paw-tap-03.png", "animations/new-actions/normalized/paw-tap-04.png"], frame: 160, hold: 600, cooldown: 90000 }
    };
    Object.keys(newActionConfig).forEach(function (name) { sprites[name] = newActionConfig[name].frames; });
    var spriteSpeeds = {
        idle: 1100, walking: 145, "tap-running": 92, "look-around": 700, grooming: 760,
        playing: 420, happy: 330, eating: 620, sleepy: 1800, sleeping: 3200,
        "side-sleeping": 3000,
        "clock-prone-closing": 900, "clock-prone-sleeping": 3200,
        "clock-side-transition": 700, "clock-side-sleeping": 3000,
        "clock-curl-transition": 850, "clock-curl-sleeping": 3200,
        rain: 1100, fan: 620,
        climbing: 620, perched: 2200, "climbing-down": 680,
        "clock-perch": 2200, "clock-hook": 750, "clock-nap": 3200, "clock-peek": 2000, "colon-sit": 1800,
        "clock-scratching": 360, "clock-flip-pull": 145,
        "message-sit": 2200, "message-peek": 2000, "message-paw": 380,
        "sunbathe-prepare": 430, "sunbathe-rest": 1250, "sunbathe-finish": 420,
        "grass-notice": 700, "grass-sniff": 700, "grass-bite": 360, "grass-chew": 430, "grass-finish": 700
    };
    var finiteSpriteStatuses = {
        "sunbathe-prepare": true,
        "sunbathe-finish": true,
        "grass-notice": true,
        "grass-sniff": true,
        "grass-finish": true,
        "clock-prone-closing": true,
        "clock-side-transition": true,
        "clock-curl-transition": true
    };
    Object.keys(newActionConfig).forEach(function (name) { spriteSpeeds[name] = newActionConfig[name].frame; });
    var now = Date.now();
    var state = {
        mood: 72,
        energy: 68,
        fullness: 76,
        bond: 40,
        lastInteraction: now,
        lastSleepResetAt: now,
        lastUpdated: now,
        lastFed: 0,
        lastSunbatheDay: "",
        lastCatGrassDay: "",
        sunbathePlanDay: "",
        sunbathePlanMinute: 0,
        lastRainStoppedAt: 0,
        nextLifestyleAllowed: now,
        nextWalkAllowed: now,
        nextClimbAllowed: now,
        nextScratchAllowed: now,
        nextMessageVisitAllowed: now,
        nextMessagePatAllowed: now,
        nextMessagePawPrintAllowed: now,
        nextCurlSleepAllowed: now,
        nextSideSleepAllowed: now,
        nextClockSleepAllowed: now,
        nextInteractivePlayingAllowed: 0,
        sleepUntil: 0,
        sleepPose: "",
        sleepNextPose: "",
        sleepStage: "",
        sleepClockSide: "",
        routineOffsetMinutes: Math.round(Math.random() * 30 - 15),
        behavior: "idle",
        positionX: .72,
        positionY: .68,
        lastAction: "idle"
    };

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

    try {
        var saved = petStorage.get(storageKey, null);
        if (saved && typeof saved === "object") {
            Object.keys(state).forEach(function (key) {
                if (saved[key] !== undefined) state[key] = saved[key];
            });
        }
    } catch (e) {}

    if (!debugMode && !reduceMotion.matches) {
        try {
            if (!sessionStorage.getItem("jinzhuAliveIntroSeen")) {
                sessionStorage.setItem("jinzhuAliveIntroSeen", "1");
                introWalkPending = true;
            }
        } catch (e) {
            introWalkPending = true;
        }
    }

    if (debugMode && isFinite(Number(params.get("jinzhuFullness")))) {
        state.fullness = Number(params.get("jinzhuFullness"));
    }

    var preloadSpriteNames = lowPowerDevice
        ? ["idle", "walking", "sunbathe-prepare", "sunbathe-rest", "sunbathe-finish", "grass-notice", "grass-sniff", "grass-bite", "grass-chew", "grass-finish"]
        : Object.keys(sprites);
    preloadSpriteNames.forEach(function (name) {
        sprites[name].forEach(function (filename) {
            var preload = new Image();
            preload.src = spriteBase + filename;
        });
    });

    var debugBadge = null;
    if (debugMode) {
        debugBadge = document.createElement("div");
        debugBadge.className = "jinzhu-debug";
        document.body.appendChild(debugBadge);
    }

    function clamp(value) {
        return Math.max(0, Math.min(100, Number(value) || 0));
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function scaledDuration(milliseconds) {
        if (debugNormalSpeed) return milliseconds;
        return debugMode ? Math.max(250, milliseconds / (60 * motionSpeed)) : milliseconds;
    }

    function compactViewport() {
        return viewportSize().width <= 600;
    }

    function spriteDelay(status) {
        var delay = spriteSpeeds[status] || 800;
        if (!compactViewport()) return delay;
        if (/^(sunbathe-|grass-)/.test(status)) return delay;
        /* Mobile Safari can swap several PNG frames in the same paint cycle.
           Keep the movement legible instead of treating the cat like a GIF. */
        if (status === "tap-running") return 135;
        if (status === "walking") return 220;
        if (status === "clock-scratching") return 520;
        if (status === "clock-flip-pull") return 185;
        return Math.max(delay, 980);
    }

    function currentDate() {
        var date = new Date();
        if (debugMode && isFinite(debugHour) && debugHour >= 0 && debugHour < 24) {
            date.setHours(Math.floor(debugHour), Math.round((debugHour % 1) * 60), 0, 0);
        }
        return date;
    }

    function routinePeriod() {
        var date = currentDate();
        var minuteOfDay = date.getHours() * 60 + date.getMinutes() + Number(state.routineOffsetMinutes || 0);
        minuteOfDay = (minuteOfDay + 1440) % 1440;
        if (minuteOfDay < 390) return "night";
        if (minuteOfDay < 540) return "morning";
        if (minuteOfDay < 1050) return "day";
        if (minuteOfDay < 1350) return "evening";
        return "wind-down";
    }

    function saveState() {
        state.mood = clamp(state.mood);
        state.energy = clamp(state.energy);
        state.fullness = clamp(state.fullness);
        state.bond = clamp(state.bond);
        try {
            petStorage.set(storageKey, state);
        } catch (e) {}
    }

    function applyElapsedTime() {
        var timestamp = Date.now();
        var elapsed = Math.max(0, timestamp - Number(state.lastUpdated || timestamp));
        var hours = Math.min(elapsed / 3600000, 24 * 14);
        state.fullness = clamp(state.fullness - hours * 1.35);
        if (state.fullness < 25) {
            state.mood = clamp(state.mood - hours * .18);
            state.energy = clamp(state.energy - hours * .08);
        }
        state.lastUpdated = timestamp;
    }

    function renderStats() {
        document.getElementById("jinzhu-mood").textContent = Math.round(state.mood);
        document.getElementById("jinzhu-energy").textContent = Math.round(state.energy);
        document.getElementById("jinzhu-fullness").textContent = Math.round(state.fullness);
        document.getElementById("jinzhu-bond").textContent = Math.round(state.bond);
        if (debugBadge) {
            debugBadge.textContent =
                "Jinzhu " + currentStatus +
                " · " + routinePeriod() +
                " · fullness " + Math.round(state.fullness) +
                " · scheduler " + (behaviorTimer ? "1" : "0");
        }
    }

    function playSprite(status) {
        clearInterval(spriteTimer);
        spriteTimer = null;
        var frames = sprites[status] || sprites.idle;
        var index = 0;
        catImage.src = spriteBase + frames[0];
        if (document.hidden || reduceMotion.matches || frames.length < 2) return;
        if (newActionConfig[status] || finiteSpriteStatuses[status]) {
            spriteTimer = setInterval(function () {
                index++;
                if (index >= frames.length) {
                    clearInterval(spriteTimer);
                    spriteTimer = null;
                    catImage.src = spriteBase + frames[frames.length - 1];
                    return;
                }
                catImage.src = spriteBase + frames[index];
            }, spriteDelay(status));
            return;
        }
        if (simpleMotion && !newActionConfig[status] && status !== "walking" && status !== "tap-running" && status !== "climbing" && status !== "climbing-down" && status !== "eating" && status !== "clock-scratching" && status !== "clock-flip-pull") return;
        if (status === "eating") {
            var eatingStep = Math.max(900, (pendingEatingDuration - 2000) / 4);
            spriteTimer = setInterval(function () {
                index++;
                if (index >= frames.length - 1) {
                    clearInterval(spriteTimer);
                    spriteTimer = null;
                    catImage.src = spriteBase + frames[frames.length - 1];
                    return;
                }
                catImage.src = spriteBase + frames[index];
            }, eatingStep);
            return;
        }
        spriteTimer = setInterval(function () {
            index = (index + 1) % frames.length;
            catImage.src = spriteBase + frames[index];
        }, spriteDelay(status));
    }

    function setStatus(status) {
        var previousStatus = currentStatus;
        behaviorClasses.forEach(function (name) { home.classList.remove(name); });
        home.classList.add(status);
        currentStatus = status;
        state.behavior = status;
        state.lastAction = status;
        if (previousStatus === "sleeping" && status !== "sleeping") {
            clearTimeout(bubbleTimer);
            bubble.classList.remove("show");
        }
        playSprite(status);
        renderStats();
        saveState();
        window.dispatchEvent(new CustomEvent("jinzhu:status", { detail: { status: status } }));
    }

    function updateBubblePlacement() {
        var viewport = viewportSize();
        var spaceOnRight = viewport.width - (currentPosition.x + walker.offsetWidth);
        var bubbleWidth = Math.min(viewport.width - 16, viewport.width <= 600 ? 180 : 210);
        var spaceOnLeft = currentPosition.x;
        var useRight = spaceOnRight >= bubbleWidth + 8;
        var useLeft = !useRight && spaceOnLeft >= bubbleWidth + 8;
        home.classList.toggle("bubble-right", useRight);
        home.classList.toggle("bubble-left", useLeft);
        home.classList.toggle("bubble-above", !useRight && !useLeft);
    }

    function say(text, persistent) {
        prepareOverlays();
        updateBubblePlacement();
        if (bubbleText) bubbleText.textContent = text;
        else bubble.textContent = text;
        bubble.classList.add("show");
        clearTimeout(bubbleTimer);
        if (!persistent) {
            bubbleTimer = setTimeout(function () { bubble.classList.remove("show"); }, 3600);
        }
    }

    function clearScheduler() {
        clearTimeout(behaviorTimer);
        behaviorTimer = null;
        schedulerGeneration++;
        renderStats();
    }

    function schedule(milliseconds, callback, exactDuration) {
        clearTimeout(behaviorTimer);
        var generation = ++schedulerGeneration;
        behaviorTimer = setTimeout(function () {
            if (generation !== schedulerGeneration || document.hidden) return;
            behaviorTimer = null;
            callback();
        }, exactDuration ? milliseconds : scaledDuration(milliseconds));
        renderStats();
    }

    function viewportSize() {
        var vv = window.visualViewport;
        var width = vv && Number(vv.width);
        var height = vv && Number(vv.height);
        if (!isFinite(width) || width < 120) width = Number(window.innerWidth) || Number(document.documentElement.clientWidth) || 390;
        if (!isFinite(height) || height < 120) height = Number(window.innerHeight) || Number(document.documentElement.clientHeight) || 844;
        return {
            width: Math.max(120, width),
            height: Math.max(120, height),
            usedFallback: !(vv && isFinite(Number(vv.width)) && isFinite(Number(vv.height)))
        };
    }

    function getViewportBounds() {
        var petWidth = walker.offsetWidth || 116;
        var petHeight = walker.offsetHeight || 116;
        var viewport = viewportSize();
        var rootStyle = getComputedStyle(document.documentElement);
        var safeTop = Math.max(8, parseFloat(rootStyle.getPropertyValue("--safe-top")) || 0);
        var safeBottom = Math.max(
            8,
            parseFloat(rootStyle.getPropertyValue("--safe-bottom")) || 0
        );
        var compact = viewport.width <= 600 || viewport.height <= 480;
        var visibleWidth = compact ? Math.min(petWidth, Math.max(56, petWidth * .72)) : petWidth;
        var visibleHeight = compact ? Math.min(petHeight, Math.max(60, petHeight * .68)) : petHeight;
        var minX = 8 - (petWidth - visibleWidth);
        var maxX = viewport.width - visibleWidth - 8;
        var minY = safeTop;
        var maxY = viewport.height - visibleHeight - safeBottom - 8;
        if (maxX < minX) minX = maxX = (viewport.width - petWidth) / 2;
        if (maxY < minY) minY = maxY = Math.max(0, (viewport.height - petHeight) / 2);
        return {
            minX: minX,
            maxX: maxX,
            minY: minY,
            maxY: maxY
        };
    }

    function overlaps(a, b, margin) {
        return !(a.right + margin <= b.left || a.left - margin >= b.right ||
            a.bottom + margin <= b.top || a.top - margin >= b.bottom);
    }

    function clampPosition(position, knownBounds) {
        var bounds = knownBounds || getViewportBounds();
        var fallbackX = bounds.minX + (bounds.maxX - bounds.minX) * .5;
        var fallbackY = bounds.minY + (bounds.maxY - bounds.minY) * .62;
        var x = Number(position && position.x), y = Number(position && position.y);
        if (!isFinite(x)) x = fallbackX;
        if (!isFinite(y)) y = fallbackY;
        return {
            x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
            y: Math.max(bounds.minY, Math.min(bounds.maxY, y))
        };
    }

    function setPosition(position, duration, persist, knownBounds, quiet) {
        var bounds = knownBounds || getViewportBounds();
        var safe = clampPosition(position, bounds);
        if (safe.x < currentPosition.x) home.style.setProperty("--jinzhu-facing", "-1");
        if (safe.x > currentPosition.x) home.style.setProperty("--jinzhu-facing", "1");
        home.style.setProperty("--jinzhu-walk-duration", duration + "ms");
        home.style.setProperty("--jinzhu-x", Math.round(safe.x) + "px");
        home.style.setProperty("--jinzhu-y", Math.round(safe.y) + "px");
        // iPad mini 1 / iOS 9 does not support CSS custom properties. Keep a
        // direct left/top fallback so the pet is not stuck at (0, 0).
        if (!positionSupportChecked) {
            positionSupportChecked = true;
            var probe = getComputedStyle(home).getPropertyValue("--jinzhu-x");
            legacyPosition = oldIPad || !probe;
            if (legacyPosition) home.className += " jinzhu-legacy-position";
        }
        if (legacyPosition) {
            walker.style.transform = "none";
            walker.style.transition = "none";
            legacyMoveToken++;
            if (legacyMoveFrame !== null) {
                if (window.cancelAnimationFrame) window.cancelAnimationFrame(legacyMoveFrame);
                else clearTimeout(legacyMoveFrame);
                legacyMoveFrame = null;
            }
            if (duration && window.requestAnimationFrame) {
                var token = legacyMoveToken;
                var startRect = walker.getBoundingClientRect();
                var startX = startRect.left;
                var startY = startRect.top;
                var startTime = Date.now();
                var lastPaint = 0;
                var legacyStep = function () {
                    if (token !== legacyMoveToken) return;
                    var elapsed = Date.now() - startTime;
                    var progress = Math.max(0, Math.min(1, elapsed / duration));
                    var eased = progress * progress * (3 - 2 * progress);
                    if (elapsed - lastPaint >= 42 || progress === 1) {
                        walker.style.left = Math.round(startX + (safe.x - startX) * eased) + "px";
                        walker.style.top = Math.round(startY + (safe.y - startY) * eased) + "px";
                        lastPaint = elapsed;
                    }
                    if (progress < 1) legacyMoveFrame = window.requestAnimationFrame(legacyStep);
                    else legacyMoveFrame = null;
                };
                legacyMoveFrame = window.requestAnimationFrame(legacyStep);
            } else {
                walker.style.left = Math.round(safe.x) + "px";
                walker.style.top = Math.round(safe.y) + "px";
            }
        }
        currentPosition = safe;
        if (bubble.classList.contains("show")) updateBubblePlacement();
        state.positionX = bounds.maxX > bounds.minX ? (safe.x - bounds.minX) / (bounds.maxX - bounds.minX) : 0;
        state.positionY = bounds.maxY > bounds.minY ? (safe.y - bounds.minY) / (bounds.maxY - bounds.minY) : 0;
        if (persist !== false) saveState();
        if (!quiet) window.dispatchEvent(new CustomEvent("jinzhu:position", { detail: { x: safe.x, y: safe.y } }));
    }

    function restoredPosition() {
        var bounds = getViewportBounds();
        var preferred = clampPosition({
            x: bounds.minX + clamp(Number(state.positionX) * 100) / 100 * (bounds.maxX - bounds.minX),
            y: bounds.minY + clamp(Number(state.positionY) * 100) / 100 * (bounds.maxY - bounds.minY)
        });
        /* Resize only clamps an out-of-bounds position; it never teleports Jinzhu
           to the old bottom-edge safe-point list. */
        return preferred;
    }

    function restingPositionIsClear(position) {
        var width = walker.offsetWidth || 116, height = walker.offsetHeight || 116;
        var pet = { left: position.x, top: position.y, right: position.x + width, bottom: position.y + height };
        var protectedCards = document.querySelectorAll(".clock, .weather-card, .card.message");
        for (var i = 0; i < protectedCards.length; i++) {
            var rect = visibleRect(protectedCards[i]);
            if (rect.width && rect.height && overlaps(pet, rect, 10)) return false;
        }
        return true;
    }

    function findSafeRestingPosition(preferred) {
        if (restingPositionIsClear(preferred)) return preferred;
        var b = getViewportBounds(), width = walker.offsetWidth || 116, height = walker.offsetHeight || 116;
        var candidates = [
            { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY },
            { x: b.maxX, y: b.minY }, { x: b.minX, y: b.minY },
            { x: (b.minX + b.maxX) / 2, y: b.maxY },
            { x: b.maxX, y: Math.max(b.minY, b.maxY - height - 18) }
        ].map(clampPosition);
        for (var i = 0; i < candidates.length; i++) if (restingPositionIsClear(candidates[i])) return candidates[i];
        /* A compact viewport can leave no fully empty lane.  The bottom edge
           is least likely to conceal text and remains within the viewport. */
        return clampPosition({ x: b.maxX, y: b.maxY });
    }

    function visibleRect(element) {
        if (element && element.classList && element.classList.contains("clock")) {
            var cards = element.querySelectorAll(".flip-card");
            if (cards.length) {
                var first = cards[0].getBoundingClientRect();
                var last = cards[cards.length - 1].getBoundingClientRect();
                return { left: first.left, top: Math.min(first.top, last.top), right: last.right, bottom: Math.max(first.bottom, last.bottom), width: last.right - first.left, height: Math.max(first.bottom, last.bottom) - Math.min(first.top, last.top) };
            }
        }
        return element.getBoundingClientRect();
    }

    function rectHasVisibleArea(rect) {
        if (!rect || !isFinite(rect.left) || !isFinite(rect.top) || !rect.width || !rect.height) return false;
        var viewport = viewportSize();
        var visibleWidth = Math.min(rect.right, viewport.width) - Math.max(rect.left, 0);
        var visibleHeight = Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0);
        return visibleWidth >= Math.min(32, rect.width * .2) &&
            visibleHeight >= Math.min(32, rect.height * .2);
    }

    function petRectAt(point) {
        var width = walker.offsetWidth || 116;
        var height = walker.offsetHeight || 116;
        return {
            left: point.x,
            top: point.y,
            right: point.x + width,
            bottom: point.y + height
        };
    }

    function petVisibleRatio(point) {
        var rect = petRectAt(point);
        var viewport = viewportSize();
        var visibleWidth = Math.max(0, Math.min(rect.right, viewport.width) - Math.max(rect.left, 0));
        var visibleHeight = Math.max(0, Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0));
        var area = (rect.right - rect.left) * (rect.bottom - rect.top);
        return area > 0 ? visibleWidth * visibleHeight / area : 0;
    }

    function compactCardLayout(rect) {
        var viewport = viewportSize();
        return viewport.width <= 600 || rect.width >= viewport.width * .82;
    }

    function clampShift(raw, clamped) {
        return Math.max(Math.abs(raw.x - clamped.x), Math.abs(raw.y - clamped.y));
    }

    function pointNear(selector, side) {
        var element = document.querySelector(selector);
        if (!element) return null;
        var rect = visibleRect(element);
        if (!rectHasVisibleArea(rect)) return null;
        var w = walker.offsetWidth || 116;
        var h = walker.offsetHeight || 116;
        var x = side === "left" ? rect.left - w * .55 : rect.right - w * .45;
        var y = rect.bottom - h * .38;
        return clampPosition({ x: x, y: y });
    }
    function pointOnTop(selector) {
        var element = document.querySelector(selector);
        if (!element) return null;
        var rect = visibleRect(element);
        if (!rectHasVisibleArea(rect)) return null;
        var w = walker.offsetWidth || 116;
        var h = walker.offsetHeight || 116;
        // The paws overlap the casing by only a few pixels: the cat is on top,
        // never in the middle of the digits.
        return clampPosition({ x: rect.left + (rect.width - w) / 2, y: rect.top - h + 14 });
    }

    function roamingPoints() {
        var b = getViewportBounds();
        var points = {
            "top-left": { x: b.minX, y: b.minY },
            "top-right": { x: b.maxX, y: b.minY },
            "bottom-left": { x: b.minX, y: b.maxY },
            "bottom-right": { x: b.maxX, y: b.maxY },
            center: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 },
            "clock-left": pointNear(".clock", "left"),
            "clock-right": pointNear(".clock", "right"),
            "clock-top": pointOnTop(".clock"),
            "date-left": pointNear(".date", "left"),
            "date-right": pointNear(".date", "right"),
            "weather-left": pointNear(".weather-card", "left"),
            "weather-right": pointNear(".weather-card", "right"),
            "message-left": pointNear(".message", "left"),
            "message-right": pointNear(".message", "right")
        };
        return points;
    }

    function randomRoamingPosition() {
        var b = getViewportBounds();
        var points = roamingPoints();
        if (debugPoint && points[debugPoint]) return points[debugPoint];
        /* Most destinations are continuous whole-viewport points.  Named UI points
           are occasional flavour, never a safety cage or a bottom-home fallback. */
        var candidate = Math.random() < .82 ? { x: randomBetween(b.minX, b.maxX), y: randomBetween(b.minY, b.maxY) } : points[Object.keys(points)[Math.floor(Math.random() * Object.keys(points).length)]];
        if (!candidate || Math.abs(candidate.x - currentPosition.x) + Math.abs(candidate.y - currentPosition.y) < 70) candidate = { x: randomBetween(b.minX, b.maxX), y: randomBetween(b.minY, b.maxY) };
        return clampPosition(candidate);
    }

    function tapRunDestination() {
        var b = getViewportBounds();
        var points = roamingPoints();
        var names = Object.keys(points).filter(function (name) { return points[name]; });
        var minimumDistance = Math.max(140, Math.min(b.maxX - b.minX, b.maxY - b.minY) * .38);
        var choices = names.map(function (name) { return points[name]; }).filter(function (point) {
            return Math.abs(point.x - currentPosition.x) + Math.abs(point.y - currentPosition.y) >= minimumDistance;
        });
        if (!choices.length) {
            choices = [
                { x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY },
                { x: b.minX, y: b.maxY }, { x: b.maxX, y: b.maxY }
            ];
        }
        return clampPosition(choices[Math.floor(Math.random() * choices.length)]);
    }

    function clockClimbGeometry() {
        var clock = document.querySelector(".clock");
        if (!clock) return null;
        var rect = visibleRect(clock);
        if (!rectHasVisibleArea(rect)) return null;
        var w = walker.offsetWidth || 116;
        var h = walker.offsetHeight || 116;
        var bounds = getViewportBounds();
        var perchScale = Math.max(.70, Math.min(1, (rect.top - bounds.minY + 14) / h));
        home.style.setProperty("--jinzhu-perch-scale", perchScale.toFixed(3));
        var useLeft = currentPosition.x < rect.left + rect.width / 2;
        var edgeX = useLeft ? rect.left - w * .38 : rect.right - w * .62;
        var top = clampPosition({ x: useLeft ? rect.left + 8 : rect.right - w - 8, y: rect.top - h + 14 });
        return {
            base: clampPosition({ x: edgeX, y: rect.bottom - h * .32 }),
            edge: clampPosition({ x: edgeX, y: rect.top + rect.height * .32 }),
            top: top,
            landing: clampPosition({ x: useLeft ? rect.left - w - 12 : rect.right + 12, y: rect.bottom - h * .18 }),
            facing: useLeft ? 1 : -1,
            topFits: overlaps(petRectAt(top), rect, 0)
        };
    }

    function clockDigitRects() {
        var result = [], hour = document.getElementById("hour-card"), minute = document.getElementById("minute-card"), colon = document.querySelector(".colon");
        var groups = [{ element: hour, text: document.getElementById("hour-top-num") }, { element: minute, text: document.getElementById("minute-top-num") }];
        for (var i = 0; i < groups.length; i++) {
            if (!groups[i].element) continue;
            var rect = groups[i].element.getBoundingClientRect();
            if (!isFinite(rect.left) || rect.width < 20 || rect.height < 20) continue;
            var value = groups[i].text ? String(groups[i].text.textContent || "00") : "00";
            while (value.length < 2) value = "0" + value;
            for (var part = 0; part < 2; part++) result.push({
                name: (i === 0 ? "hour-" : "minute-") + part,
                digit: value.charAt(part),
                rect: { left: rect.left + rect.width * part / 2, top: rect.top, width: rect.width / 2, height: rect.height, right: rect.left + rect.width * (part + 1) / 2, bottom: rect.bottom }
            });
        }
        if (colon) {
            var colonRect = colon.getBoundingClientRect();
            if (isFinite(colonRect.left) && colonRect.width > 2) result.push({ name: "colon", digit: ":", rect: colonRect });
        }
        return result;
    }

    function clockAnchorPoint(kind) {
        var points = clockDigitRects(), w = walker.offsetWidth || 116, h = walker.offsetHeight || 116;
        if (!points.length) {
            var fallback = pointOnTop(".clock");
            return fallback ? { point: fallback, target: null } : null;
        }
        var choices = points.filter(function (item) { return item.name !== "colon"; });
        var target = choices[Math.floor(Math.random() * choices.length)] || points[0];
        if (kind === "clock-hook") {
            var hooks = choices.filter(function (item) { return "0689".indexOf(item.digit) >= 0; });
            target = hooks.length ? hooks[Math.floor(Math.random() * hooks.length)] : choices[0];
        } else if (kind === "colon-sit") {
            for (var c = 0; c < points.length; c++) if (points[c].name === "colon") target = points[c];
        }
        if (!target || !target.rect) return null;
        var card = target.name.indexOf("hour-") === 0 ? document.getElementById("hour-card") : document.getElementById("minute-card");
        var cardRect = card ? card.getBoundingClientRect() : target.rect;
        var rect = cardRect && cardRect.width ? cardRect : target.rect, point;
        if (!rectHasVisibleArea(rect)) return null;
        if (kind === "clock-hook") point = { x: rect.left - w * .38, y: rect.top + rect.height * .25 - h * .16 };
        else if (kind === "clock-peek") point = { x: rect.right - w * .55, y: rect.top - h * .50 };
        else if (kind === "colon-sit") point = { x: target.rect.left + target.rect.width * .5 - w * .5, y: rect.top - h * .65 };
        else point = { x: rect.left + rect.width * .5 - w * .5, y: rect.top - h * .78 };
        point = clampPosition(point);
        var contactRect = kind === "colon-sit" ? target.rect : rect;
        if (!overlaps(petRectAt(point), contactRect, 0)) return null;
        return { point: point, target: target };
    }

    function updateClockAnchorOverlay() {
        var overlay = document.getElementById("jinzhu-clock-anchor-debug");
        if (!debugMode) { if (overlay) overlay.parentNode.removeChild(overlay); return; }
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "jinzhu-clock-anchor-debug";
            overlay.className = "jinzhu-clock-anchor-debug";
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = "";
        clockDigitRects().forEach(function (item) {
            var marker = document.createElement("i"), rect = item.rect;
            marker.title = item.name + " " + item.digit;
            marker.style.left = Math.round(rect.left + rect.width * .5 - 4) + "px";
            marker.style.top = Math.round(rect.top - 4) + "px";
            overlay.appendChild(marker);
        });
    }

    /* ==========================================================
       留言板互动（第七節）
       只读取留言板的位置/尺寸，从不修改留言板本身的 DOM 或内容。
       爪印元素也不插进 .card.message 内部，而是浮在它上方的独立层，
       避免碰到留言板原有结构。
       ========================================================== */
    var messageAnchorActive = "";
    var messageAnchorTimer = null;

    function messageBoardEl() {
        return document.querySelector(".card.message");
    }

    function messageAnchorPoint(kind) {
        var card = messageBoardEl();
        if (!card) return null;
        var rect = card.getBoundingClientRect();
        if (!rectHasVisibleArea(rect)) return null;
        var w = walker.offsetWidth || 116;
        var h = walker.offsetHeight || 116;
        var point;
        if (kind === "message-paw" && compactCardLayout(rect)) {
            var edge = chooseCardGripEdge("message", card);
            var geometry = edge && cardGripGeometry("message", edge);
            if (!geometry || !geometry.fits) return null;
            return { point: geometry.grip, rect: rect, edge: edge };
        } else if (kind === "message-peek") {
            // 从留言板左上方探头，身体大部分留在卡片后面
            point = { x: rect.left - w * .30, y: rect.top - h * .55 };
        } else if (kind === "message-paw") {
            // 靠近右下角，方便伸爪轻拍
            point = { x: rect.right - w * .62, y: rect.bottom - h * .48 };
        } else {
            // message-sit：坐在留言板右下边缘
            point = { x: rect.right - w * .55, y: rect.bottom - h * .30 };
        }
        point = clampPosition(point);
        if (!overlaps(petRectAt(point), rect, 0)) return null;
        return { point: point, rect: rect };
    }

    function endMessageAnchor() {
        clearTimeout(messageAnchorTimer);
        messageAnchorTimer = null;
        messageAnchorActive = "";
        home.classList.remove("on-message");
        setStatus("idle");
        schedule(randomBetween(45, 120) * 1000, chooseNextBehavior);
    }

    function startMessageVisit(kind, force, onContact) {
        if (!force && (Date.now() < Number(state.nextMessageVisitAllowed || 0) || reminderActive || panel.hidden === false || reduceMotion.matches)) return false;
        if (feedingPending || currentStatus === "eating" || isFormalSleepActive() || currentStatus === "sleepy" || currentStatus === "rain" || currentStatus === "heat" || currentStatus === "fan" || climbing || perched || clockAnchorActive) return false;
        var anchor = messageAnchorPoint(kind);
        if (!anchor) return false;
        clearScheduler();
        clearTimeout(messageAnchorTimer);
        messageAnchorActive = kind;
        state.nextMessageVisitAllowed = Date.now() + randomBetween(10, 45) * 60000;
        home.classList.add("on-message");
        setStatus("walking");
        var travelDuration = scaledDuration(randomBetween(2, 4) * 1000);
        setPosition(anchor.point, travelDuration, false);
        schedule(travelDuration + 80, function () {
            if (!messageAnchorActive) return;
            var contactAnchor = messageAnchorPoint(kind);
            if (!contactAnchor) { endMessageAnchor(); return; }
            setPosition(contactAnchor.point, 0, false);
            setStatus(kind);
            if (onContact) onContact();
            if (kind === "message-peek") say("边度有新留言呀？");
            else if (Math.random() < .3) say("睇下大家讲咗啲乜。");
            messageAnchorTimer = setTimeout(endMessageAnchor, debugMode ? 3500 : randomBetween(15, 50) * 1000);
        }, true);
        saveState();
        return true;
    }

    function spawnMessagePawPrint() {
        var card = messageBoardEl();
        if (!card) return false;
        if (Date.now() < Number(state.nextMessagePawPrintAllowed || 0)) return false;
        state.nextMessagePawPrintAllowed = Date.now() + randomBetween(5, 12) * 60000;
        saveState();
        var rect = card.getBoundingClientRect();
        var print = document.createElement("div");
        print.className = "jinzhu-paw-print";
        // 只出现在卡片角落，不遮住主要文字
        var corner = Math.random() < .5;
        print.style.left = Math.round(corner ? rect.right - 34 : rect.left + 10) + "px";
        print.style.top = Math.round(rect.bottom - 30) + "px";
        document.body.appendChild(print);
        setTimeout(function () { print.parentNode && print.parentNode.removeChild(print); }, 4200);
        return true;
    }

    function nudgeMessageBoard() {
        var card = messageBoardEl();
        if (!card) return false;
        if (Date.now() < Number(state.nextMessagePatAllowed || 0)) return false;
        state.nextMessagePatAllowed = Date.now() + randomBetween(15, 45) * 60000;
        saveState();
        var items = card.querySelectorAll(".msg-item");
        var target = items.length ? items[Math.floor(Math.random() * items.length)] : card;
        target.classList.add("jinzhu-msg-nudge");
        setTimeout(function () { target.classList.remove("jinzhu-msg-nudge"); }, 900);
        return true;
    }

    function startMessagePat(force) {
        return startMessageVisit("message-paw", force, function () {
            nudgeMessageBoard();
            spawnMessagePawPrint();
        });
    }

    // 留言关键词反应：只做本机规则匹配，留言内容不会送去任何外部 AI 接口
    var messageKeywordRules = [
        { words: ["金主"], status: "look-around", say: "叫我做咩？" },
        { words: ["食飯", "食饭"], status: "grooming", say: "讲起先知肚饿。" },
        { words: ["瞓覺", "睡觉", "瞓覚"], status: "sleepy", say: "咁啱我都眼瞓。" },
        { words: ["落雨", "下雨"], status: "look-around", say: "出边落紧雨呀？" },
        { words: ["掛住你", "挂住你", "想你"], status: "look-around", say: null }
    ];

    function reactToMessage(content) {
        if (!content || isFormalSleepActive() || currentStatus === "eating" || currentStatus === "rain" || currentStatus === "heat" || currentStatus === "fan" || climbing || perched || clockAnchorActive) return false;
        var text = String(content);
        for (var i = 0; i < messageKeywordRules.length; i++) {
            var rule = messageKeywordRules[i];
            var matched = rule.words.some(function (word) { return text.indexOf(word) >= 0; });
            if (!matched) continue;
            if (Math.random() < .55) {
                if (rule.status) setStatus(rule.status);
                if (rule.say) say(rule.say);
                else if (Math.random() < .5) say("喵。");
                schedule(randomBetween(3, 6) * 1000, function () { idleFor(30, 90); });
            }
            return true;
        }
        return false;
    }

    window.addEventListener("jinzhu:message", function (event) {
        var detail = event && event.detail;
        if (!detail || !detail.content) return;
        var matched = reactToMessage(detail.content);
        if (!matched && Math.random() < .16) startMessageVisit(Math.random() < .5 ? "message-peek" : "message-sit", false);
    });

    function endClockAnchor() {
        clearTimeout(clockAnchorTimer);
        clockAnchorTimer = null;
        clockAnchorActive = "";
        home.classList.remove("on-clock");
        home.style.removeProperty("--jinzhu-perch-scale");
        setStatus("idle");
        schedule(randomBetween(45, 120) * 1000, chooseNextBehavior);
    }

    /* The hour scratch is a small, self-contained clock moment.  It never
       turns the clock into a button: Jinzhu only approaches an outer edge,
       scratches briefly, then reacts if that particular card actually flips. */
    function clockScratchPoint() {
        var card = document.getElementById("hour-card");
        if (!card) return null;
        var rect = card.getBoundingClientRect();
        var w = walker.offsetWidth || 116;
        var h = walker.offsetHeight || 116;
        if (!rectHasVisibleArea(rect)) return null;
        var point = clampPosition({
            x: rect.left - w * .56,
            y: rect.top + rect.height * .22 - h * .08
        });
        return overlaps(petRectAt(point), rect, 0) ? point : null;
    }

    function finishClockScratch() {
        if (!clockScratchActive) return;
        clockScratchActive = false;
        home.classList.remove("on-clock");
        home.style.removeProperty("--jinzhu-perch-scale");
        setStatus("idle");
        schedule(randomBetween(45, 120) * 1000, chooseNextBehavior);
    }

    function startClockScratch(force) {
        if (clockScratchActive || reduceMotion.matches) return false;
        if (!force && (Date.now() < Number(state.nextScratchAllowed || 0) || reminderActive || panel.hidden === false)) return false;
        if (force && isFormalSleepActive()) wakeFormalSleep(true);
        if (feedingPending || currentStatus === "eating" || isFormalSleepActive() || currentStatus === "happy" || currentStatus === "rain" || currentStatus === "fan") return false;
        var point = clockScratchPoint();
        if (!point) return false;
        clearScheduler();
        /* An hour can arrive while Jinzhu is already perched on the clock.
           The scratch is the one clock moment that is allowed to take over
           that passive pose, otherwise the visible easter egg is skipped. */
        clearTimeout(clockAnchorTimer);
        clockAnchorTimer = null;
        clockAnchorActive = "";
        climbing = false;
        perched = false;
        clockScratchActive = true;
        state.nextScratchAllowed = Date.now() + 50 * 60000;
        home.classList.add("on-clock");
        home.style.setProperty("--jinzhu-perch-scale", ".64");
        home.style.setProperty("--jinzhu-facing", "1");
        setStatus("walking");
        setPosition(point, scaledDuration(1000), false);
        schedule(980, function () {
            if (!clockScratchActive) return;
            setStatus("clock-scratching");
            schedule(9000, finishClockScratch, true);
        }, true);
        saveState();
        return true;
    }

    function pullClockFlip(detail) {
        if (!clockScratchActive || !detail || detail.card !== "hour") return false;
        clearScheduler();
        setStatus("clock-flip-pull");
        setPosition({ x: currentPosition.x - 10, y: currentPosition.y + 24 }, 380, false);
        schedule(900, finishClockScratch, true);
        return true;
    }

    function startClockAnchor(kind, force) {
        /* Legacy clock-nap remains available only to explicit/debug callers.
           The natural scheduler uses the formal lie-clock sleep flow. */
        if (kind === "clock-nap" && !force) return false;
        if (clockScratchActive || messageAnchorActive || (!force && (Date.now() < Number(state.nextClimbAllowed || 0) || reminderActive || panel.hidden === false || reduceMotion.matches))) return false;
        if (feedingPending || currentStatus === "eating" || isFormalSleepActive() || currentStatus === "sleepy" || currentStatus === "rain" || currentStatus === "heat" || currentStatus === "fan") return false;
        var anchor = clockAnchorPoint(kind);
        if (!anchor || !anchor.point) return false;
        clearScheduler();
        clearTimeout(clockAnchorTimer);
        clockAnchorActive = kind;
        state.nextClimbAllowed = Date.now() + randomBetween(10, 25) * 60000;
        home.classList.add("on-clock");
        home.style.setProperty("--jinzhu-perch-scale", kind === "clock-hook" ? ".64" : kind === "clock-peek" ? ".58" : kind === "colon-sit" ? ".58" : ".74");
        setStatus("walking");
        setPosition(anchor.point, scaledDuration(randomBetween(2, 4) * 1000), false);
        schedule(2800, function () {
            if (!clockAnchorActive) return;
            setStatus(kind);
            if (kind === "clock-nap") say("这里刚好可以睡一会。");
            else if (kind === "clock-peek") say("我从时间后面看住你。");
            clockAnchorTimer = setTimeout(endClockAnchor, debugMode ? 3500 : randomBetween(20, 90) * 1000);
        }, true);
        updateClockAnchorOverlay();
        saveState();
        return true;
    }

    function tapColon(force) {
        var colon = document.querySelector(".colon");
        if (!colon || (!force && (clockScratchActive || messageAnchorActive || isFormalSleepActive() || currentStatus === "rain" || currentStatus === "heat"))) return false;
        if (!startClockAnchor("colon-sit", force)) return false;
        schedule(3200, function () {
            colon.classList.add("jinzhu-colon-tap");
            setTimeout(function () { colon.classList.remove("jinzhu-colon-tap"); }, 1200);
        }, true);
        return true;
    }

    function finishClockClimb() {
        climbing = false;
        perched = true;
        home.classList.add("on-clock");
        setStatus("perched");
        say("上面几舒服，我坐阵先。");
        schedule(debugMode ? 3500 : randomBetween(25, 55) * 1000, startClockDescent, debugMode);
    }

    function startClockDescent() {
        var geometry = clockClimbGeometry();
        if (!geometry || !geometry.topFits) {
            perched = false;
            home.classList.remove("on-clock");
            idleFor(30, 90);
            return;
        }
        perched = false;
        climbing = true;
        home.classList.remove("on-clock");
        setStatus("climbing-down");
        setPosition(geometry.edge, scaledDuration(1500), false);
        schedule(1600, function () {
            setPosition(geometry.landing, scaledDuration(1500));
            schedule(1600, function () {
                climbing = false;
                setStatus("idle");
                schedule(randomBetween(45, 120) * 1000, chooseNextBehavior);
            });
        });
    }

    function startClockClimb(force) {
        if (clockScratchActive || climbing || perched || messageAnchorActive || isFormalSleepActive() || currentStatus === "sleepy" || reduceMotion.matches || simpleMotion || reminderActive || panel.hidden === false) return false;
        if (!force && Date.now() < Number(state.nextClimbAllowed || 0)) return false;
        var geometry = clockClimbGeometry();
        if (!geometry || !geometry.topFits) return false;
        clearScheduler();
        climbing = true;
        state.nextClimbAllowed = Date.now() + randomBetween(5, 10) * 60000;
        home.style.setProperty("--jinzhu-facing", String(geometry.facing));
        setStatus("walking");
        say("我上去睇下。");
        var approachDuration = scaledDuration(randomBetween(2, 4) * 1000);
        setPosition(geometry.base, approachDuration, false);
        schedule(approachDuration + 120, function () {
            setStatus("climbing");
            setPosition(geometry.edge, scaledDuration(1500), false);
            schedule(1600, function () {
                setPosition(geometry.top, scaledDuration(1700));
                schedule(1800, finishClockClimb);
            });
        }, true);
        saveState();
        return true;
    }

    function prepareOverlays() {
        var viewport = viewportSize();
        var desiredPanelWidth = panel.classList.contains("jinzhu-chat-open") ? 320 : panel.classList.contains("jinzhu-care-open") ? 276 : 278;
        var panelHalf = Math.min(desiredPanelWidth / 2, (viewport.width - 16) / 2);
        var centeredX = Math.max(panelHalf + 8, Math.min(viewport.width - panelHalf - 8,
            currentPosition.x + (walker.offsetWidth || 116) / 2));
        if (!panel.hidden) setPosition({ x: centeredX - (walker.offsetWidth || 116) / 2, y: currentPosition.y }, 0, false);
        var panelHeight = panel.hidden ? 132 : Math.min(panel.scrollHeight || panel.offsetHeight || 240, viewport.height * .68);
        var overlayBottomGap = viewport.width <= 600 ? 36 : 8;
        home.classList.toggle("panel-above", currentPosition.y + (walker.offsetHeight || 116) + panelHeight > viewport.height - overlayBottomGap);
    }

    function weightedChoice(entries) {
        var roll = Math.random();
        var total = 0;
        for (var i = 0; i < entries.length; i++) {
            total += entries[i][1];
            if (roll <= total) return entries[i][0];
        }
        return entries[entries.length - 1][0];
    }

    function behaviorWeights() {
        var period = routinePeriod();
        if (period === "night") return [["sleeping", .92], ["sleepy", .05], ["idle", .03]];
        if (period === "morning") return [["sleeping", .28], ["idle", .20], ["look-around", .12], ["grooming", .15], ["walking", .17], ["playing", .08]];
        if (period === "day") return [["sleeping", .55], ["idle", .20], ["look-around", .10], ["grooming", .08], ["walking", .05], ["playing", .02]];
        if (period === "evening") return [["sleeping", .27], ["idle", .20], ["look-around", .11], ["grooming", .10], ["walking", .17], ["playing", .15]];
        return [["sleeping", .72], ["sleepy", .18], ["idle", .07], ["grooming", .03]];
    }

    function idleFor(minSeconds, maxSeconds) {
        setStatus("idle");
        if (state.fullness < 28 && Math.random() < .22) say("想食嘢…");
        schedule(randomBetween(minSeconds, maxSeconds) * 1000, chooseNextBehavior);
    }

    function sleepMinuteOfDay() {
        var date = currentDate();
        return date.getHours() * 60 + date.getMinutes();
    }

    function sleepBlocked() {
        return feedingPending || reminderActive || rainActive ||
            currentStatus === "eating" || currentStatus === "happy" ||
            currentStatus === "rain" || currentStatus === "heat" || currentStatus === "fan" ||
            climbing || perched || clockScratchActive || !!clockAnchorActive ||
            !!messageAnchorActive || !!activeNewActionName;
    }

    function lastSleepActivityAt() {
        return Math.max(
            Number(state.lastInteraction || 0),
            Number(state.lastSleepResetAt || 0)
        );
    }

    function chooseSleepPose() {
        var timestamp = Date.now();
        var minute = sleepMinuteOfDay();
        var weights;
        if (minute >= 780 && minute < 1080) {
            weights = { clock: .58, side: .27, curl: .15 };
        } else if (minute >= 1080 && minute < 1260) {
            weights = { side: .50, curl: .35, clock: .15 };
        } else if (minute < 390 || minute >= 1260) {
            weights = { curl: .80, side: .15, clock: .05 };
        } else {
            weights = { curl: .60, side: .25, clock: .15 };
        }

        /* Draw once from the poses currently available; sequential chance
           checks previously made side sleep depend on clock sleep failing. */
        var choices = [["curl", weights.curl]];
        if (timestamp >= Number(state.nextSideSleepAllowed || 0)) {
            choices.push(["side", weights.side]);
        }
        if (timestamp >= Number(state.nextClockSleepAllowed || 0)) {
            var clockGeometry = clockInteractionGeometry(chooseClockSide());
            if (clockGeometry && clockGeometry.topFits) choices.push(["clock", weights.clock]);
        }
        var total = choices.reduce(function (sum, choice) { return sum + choice[1]; }, 0);
        return weightedChoice(choices.map(function (choice) {
            return [choice[0], choice[1] / total];
        }));
    }

    function finishTimedSleep(pose) {
        if (activeSleepPose === "clock") {
            if (pose === "clock-prone" && state.sleepStage === "prone") {
                beginClockSideTransition();
                return;
            }
            if (pose === "clock-side" && state.sleepStage === "side") {
                beginClockCurlTransition();
            }
            return;
        }
        if (activeSleepPose !== pose) return;
        if (pose === "side" && state.sleepNextPose === "curl") {
            wakeFormalSleep(true);
            startCurlSleep(true, true);
            return;
        }
        if (pose === "curl" && sleepExtensionCount < 2 &&
            Date.now() - Number(state.lastInteraction || 0) > IDLE_SLEEP_DELAY_MS &&
            (state.energy < 42 || Math.random() < .32)) {
            sleepExtensionCount++;
            var extension = randomBetween(2, 5) * 60000;
            state.sleepUntil = Date.now() + extension;
            schedule(extension, function () { finishTimedSleep("curl"); }, true);
            saveState();
            return;
        }
        wakeFormalSleep(false);
    }

    function startCurlSleep(force, deep) {
        if (!force && Date.now() < Number(state.nextCurlSleepAllowed || 0)) return false;
        clearScheduler();
        clearNewActionLayers();
        activeSleepPose = "curl";
        sideSleepActive = false;
        sleepExtensionCount = 0;
        var minutes = deep ? randomBetween(20, 30) : randomBetween(10, 30);
        state.sleepPose = "curl";
        state.sleepNextPose = "";
        state.sleepUntil = Date.now() + minutes * 60000;
        state.nextCurlSleepAllowed = Date.now() + randomBetween(12, 25) * 60000;
        home.classList.toggle("jinzhu-deep-sleep", !!deep);
        setStatus("sleeping");
        if (Math.random() < .22 || debugMode) say("zzZ", true);
        schedule(minutes * 60000, function () { finishTimedSleep("curl"); }, true);
        saveState();
        return true;
    }

    function enterSideSleep(progressToCurl) {
        if (activeNewActionName !== "side-sleep") return false;
        clearScheduler();
        activeSleepPose = "side";
        sideSleepActive = true;
        var minutes = randomBetween(3, 6);
        state.sleepPose = "side";
        state.sleepNextPose = progressToCurl ? "curl" : "";
        state.sleepUntil = Date.now() + minutes * 60000;
        setStatus("side-sleeping");
        schedule(minutes * 60000, function () { finishTimedSleep("side"); }, true);
        saveState();
        return true;
    }

    function startSideSleep(force, progressToCurl) {
        if (!force && Date.now() < Number(state.nextSideSleepAllowed || 0)) return false;
        clearScheduler();
        clearNewActionLayers();
        state.nextSideSleepAllowed = Date.now() + randomBetween(45, 90) * 60000;
        var point = findLifestylePosition("sleep");
        walkToActionPoint(point, function () {
            prepareNewActionLayers("side-sleep");
            setPosition(point, 0, false);
            setStatus("side-sleep");
            var config = newActionConfig["side-sleep"];
            schedule(config.frame * config.frames.length + 250, function () {
                enterSideSleep(!!progressToCurl);
            }, true);
        });
        saveState();
        return true;
    }

    function startClockSleep(force) {
        if (!force && Date.now() < Number(state.nextClockSleepAllowed || 0)) return false;
        var side = chooseClockSide();
        var geometry = clockInteractionGeometry(side);
        if (!geometry || !geometry.topFits) return false;
        state.nextClockSleepAllowed = Date.now() + randomBetween(75, 150) * 60000;
        state["newAction_lie-clock"] = Date.now() + newActionConfig["lie-clock"].cooldown;
        startClockJump("lie-clock", false);
        saveState();
        return true;
    }

    function startFormalSleep(preferredPose, force, deep) {
        if (isFormalSleepActive()) wakeFormalSleep(true);
        if (!force && sleepBlocked()) return false;
        if (!force && Date.now() - lastSleepActivityAt() < IDLE_SLEEP_DELAY_MS) {
            idleFor(45, 90);
            return false;
        }
        var pose = preferredPose || chooseSleepPose();
        if (pose === "clock" && startClockSleep(!!force)) return true;
        if (pose === "side" && startSideSleep(!!force, false)) return true;
        if (startCurlSleep(!!force, !!deep)) return true;
        idleFor(45, 120);
        return false;
    }

    function startSleeping() {
        return startFormalSleep("", false, false);
    }

    function startDeepSleep() {
        return startFormalSleep("curl", false, true);
    }

    function startSleepy() {
        setStatus("sleepy");
        if (Math.random() < .3 || debugMode) say("好眼瞓…");
        schedule(randomBetween(30, 90) * 1000, chooseNextBehavior);
    }

    function startLookAround() {
        setStatus("look-around");
        schedule(randomBetween(3, 8) * 1000, function () { idleFor(30, 90); });
    }

    function startGrooming() {
        setStatus("grooming");
        if (Math.random() < .3 || debugMode) say("整理下毛先。");
        schedule(randomBetween(6, 15) * 1000, function () { idleFor(40, 120); });
    }

    function startWalking(isIntro) {
        if ((!isIntro && Date.now() < Number(state.nextWalkAllowed || 0)) || reduceMotion.matches) {
            idleFor(30, 90);
            return;
        }
        var duration = randomBetween(2, 6) * 1000;
        state.nextWalkAllowed = Date.now() + randomBetween(45, 180) * 1000;
        setStatus("walking");
        setPosition(randomRoamingPosition(), scaledDuration(duration));
        schedule(duration, function () {
            if (isIntro) {
                setStatus("look-around");
                schedule(randomBetween(3, 6) * 1000, function () { idleFor(30, 90); });
            } else {
                idleFor(30, 120);
            }
        });
    }

    var activeNewActionName = "";
    var activeNewActionHost = null;
    var lifestyleAnchor = null;
    var lifestylePhase = "";
    var lifestyleSunPatch = null;
    var lifestyleGrassLayer = null;
    var lifestyleGrassImage = null;
    var lifestyleTimers = [];
    var activeClockSide = "left";
    var clockSleepActive = false;
    var sideSleepActive = false;
    var activeSleepPose = "";
    var sleepExtensionCount = 0;
    var actionMotionFrame = null;
    var actionMotionGeneration = 0;
    var activeTappedCard = null;
    var clockTapTimer = null;
    var activeCardGripKind = "";
    var activeCardGripSide = "left";
    var activeCardPeekEdge = "";
    var activeGripTarget = null;
    var cardGripTimer = null;
    var activeScratchDigit = null;
    var scratchDigitTimer = null;
    var scratchEffectTimers = [];
    var scratchDebrisNodes = [];

    function cancelActionMotion() {
        actionMotionGeneration++;
        if (actionMotionFrame !== null) {
            if (window.cancelAnimationFrame) window.cancelAnimationFrame(actionMotionFrame);
            else clearTimeout(actionMotionFrame);
            actionMotionFrame = null;
        }
    }

    function removeLifestyleNode(node) {
        if (node && node.parentNode) node.parentNode.removeChild(node);
    }

    function clearLifestyleLayers() {
        lifestyleTimers.forEach(clearTimeout);
        lifestyleTimers = [];
        removeLifestyleNode(lifestyleSunPatch);
        removeLifestyleNode(lifestyleGrassLayer);
        lifestyleSunPatch = null;
        lifestyleGrassLayer = null;
        lifestyleGrassImage = null;
        lifestyleAnchor = null;
        lifestylePhase = "";
        home.classList.remove("jinzhu-lifestyle-action", "jinzhu-sunbathing", "jinzhu-eating-grass");
    }

    function clearNewActionLayers() {
        var wasFormalSleep = !!activeSleepPose;
        cancelActionMotion();
        clearLifestyleLayers();
        clockSleepActive = false;
        sideSleepActive = false;
        activeSleepPose = "";
        activeNewActionName = "";
        home.classList.remove("jinzhu-special-action", "jinzhu-real-clock-action", "jinzhu-real-card-peek", "jinzhu-real-card-grip", "jinzhu-clock-sleeping");
        home.style.removeProperty("--jinzhu-action-scale");
        if (wasFormalSleep) {
            state.sleepUntil = 0;
            state.sleepPose = "";
            state.sleepNextPose = "";
            state.sleepStage = "";
            state.sleepClockSide = "";
        }
        if (activeNewActionHost) activeNewActionHost.classList.remove("jinzhu-real-peek-host");
        if (activeNewActionHost) activeNewActionHost.classList.remove("jinzhu-real-grip-host");
        clearTimeout(clockTapTimer);
        clockTapTimer = null;
        if (activeTappedCard) activeTappedCard.classList.remove("jinzhu-clock-tapped");
        activeTappedCard = null;
        clearTimeout(cardGripTimer);
        cardGripTimer = null;
        if (activeGripTarget) activeGripTarget.classList.remove("jinzhu-card-gripped");
        activeGripTarget = null;
        activeCardGripKind = "";
        activeCardPeekEdge = "";
        clearTimeout(scratchDigitTimer);
        scratchDigitTimer = null;
        scratchEffectTimers.forEach(clearTimeout);
        scratchEffectTimers = [];
        if (activeScratchDigit) activeScratchDigit.classList.remove("jinzhu-digit-scratched");
        activeScratchDigit = null;
        scratchDebrisNodes.forEach(function (node) {
            if (node.parentNode) node.parentNode.removeChild(node);
        });
        scratchDebrisNodes = [];
        activeNewActionHost = null;
    }

    function isCardGripAction(name) {
        return name === "paw-rest" || name === "paw-rest-message" || name === "paw-rest-weather";
    }

    function cardGripElement(kind) {
        return kind === "weather" ? document.querySelector(".weather-card") : messageBoardEl();
    }

    function chooseCardGripKind() {
        var catX = currentPosition.x + (walker.offsetWidth || 116) / 2;
        var catY = currentPosition.y + (walker.offsetHeight || 116) / 2;
        var choices = ["message", "weather"].map(function (kind) {
            var element = cardGripElement(kind);
            if (!element) return null;
            var rect = element.getBoundingClientRect();
            return {
                kind: kind,
                distance: Math.hypot(catX - (rect.left + rect.width / 2), catY - (rect.top + rect.height / 2))
            };
        }).filter(Boolean);
        choices.sort(function (a, b) { return a.distance - b.distance; });
        return choices.length ? choices[0].kind : "";
    }

    function chooseCardGripEdge(kind, element) {
        var rect = element.getBoundingClientRect();
        var catX = currentPosition.x + (walker.offsetWidth || 116) / 2;
        if (!compactCardLayout(rect)) {
            return Math.abs(catX - rect.left) <= Math.abs(catX - rect.right) ? "left" : "right";
        }
        var viewport = viewportSize();
        var horizontal = viewport.width - rect.right >= rect.left ? ["right", "left"] : ["left", "right"];
        var edges = ["top", horizontal[0], horizontal[1], "bottom"];
        for (var i = 0; i < edges.length; i++) {
            var geometry = cardGripGeometry(kind, edges[i]);
            if (geometry && geometry.fits) return edges[i];
        }
        return "";
    }

    function cardGripGeometry(kind, side) {
        var element = cardGripElement(kind);
        if (!element) return null;
        var rect = element.getBoundingClientRect();
        if (!rectHasVisibleArea(rect)) return null;
        var w = walker.offsetWidth || 116;
        var h = walker.offsetHeight || 116;
        var compact = compactCardLayout(rect);
        var rawApproach;
        var rawGrip;
        var contact;
        if (side === "top" || side === "bottom") {
            var inset = Math.min(16, rect.width * .08);
            var minimumX = rect.left + inset;
            var maximumX = rect.right - w - inset;
            var x = maximumX >= minimumX
                ? Math.max(minimumX, Math.min(maximumX, currentPosition.x))
                : rect.left + (rect.width - w) / 2;
            if (side === "top") {
                rawApproach = { x: x, y: rect.top - h - 14 };
                rawGrip = { x: x, y: rect.top - h * .76 };
                contact = { x: x + w * .5, y: rawGrip.y + h * .76 };
            } else {
                rawApproach = { x: x, y: rect.bottom + 14 };
                rawGrip = { x: x, y: rect.bottom - h * .24 };
                contact = { x: x + w * .5, y: rawGrip.y + h * .24 };
            }
        } else {
            var contactY = rect.top + Math.min(rect.height * .26, 50) - h * .50;
            rawApproach = {
                x: side === "left" ? rect.left - w * 1.08 : rect.right + w * .08,
                y: rect.bottom - h * .72
            };
            rawGrip = {
                x: side === "left" ? rect.left - w * .84 : rect.right - w * .16,
                y: contactY
            };
            contact = {
                x: side === "left" ? rawGrip.x + w * .84 : rawGrip.x + w * .16,
                y: rawGrip.y + h * .5
            };
        }
        var approach = clampPosition(rawApproach);
        var grip = clampPosition(rawGrip);
        var contactAfterClamp = {
            x: contact.x + grip.x - rawGrip.x,
            y: contact.y + grip.y - rawGrip.y
        };
        var edgeDistance = side === "top" ? Math.abs(contactAfterClamp.y - rect.top) :
            side === "bottom" ? Math.abs(contactAfterClamp.y - rect.bottom) :
            side === "left" ? Math.abs(contactAfterClamp.x - rect.left) :
            Math.abs(contactAfterClamp.x - rect.right);
        var fits = overlaps(petRectAt(grip), rect, 0);
        if (compact) {
            fits = fits && petVisibleRatio(grip) >= .58 &&
                clampShift(rawGrip, grip) <= Math.max(14, Math.min(w, h) * .22) &&
                edgeDistance <= Math.max(10, Math.min(w, h) * .14);
        }
        return {
            element: element,
            rect: rect,
            edge: side,
            approach: approach,
            grip: grip,
            contact: contactAfterClamp,
            fits: fits,
            facing: side === "left" ? 1 : side === "right" ? -1 :
                (currentPosition.x + w / 2 < rect.left + rect.width / 2 ? 1 : -1)
        };
    }

    function clockInteractionGeometry(side) {
        var clock = document.querySelector(".clock");
        var card = document.getElementById(side === "right" ? "minute-card" : "hour-card") ||
            document.querySelector(".clock .flip-card");
        if (!clock || !card) return null;
        var clockRect = visibleRect(clock);
        var rect = card.getBoundingClientRect();
        if (!rectHasVisibleArea(clockRect) || !rectHasVisibleArea(rect)) return null;
        var w = walker.offsetWidth || 116;
        var h = walker.offsetHeight || 116;
        var bounds = getViewportBounds();
        var rawTop = {
            x: rect.left + (rect.width - w) / 2,
            y: rect.top - h * .70
        };
        var safeTop = clampPosition(rawTop);
        var edge = clampPosition({
            x: side === "left" ? rect.left - w * .84 : rect.right - w * .16,
            y: rect.top + Math.min(rect.height * .28, 54) - h * .50
        });
        var topContactDepth = safeTop.y + h - rect.top;
        var topCenterX = safeTop.x + w / 2;
        return {
            card: card,
            rect: rect,
            clockRect: clockRect,
            approach: clampPosition({
                x: side === "left" ? rect.left - w * .92 : rect.right - w * .08,
                y: rect.bottom - h * .72
            }),
            look: clampPosition({
                x: side === "left" ? clockRect.left - w * .86 : clockRect.right - w * .14,
                y: clockRect.bottom - h * .72
            }),
            edge: edge,
            top: safeTop,
            edgeFits: overlaps(petRectAt(edge), rect, 0),
            /* A clock close to the safe-area edge may need the cat position
               clamped while still leaving a convincing overlap with the real
               card. Judge the visible contact, not the unclamped coordinate. */
            topFits: topCenterX >= rect.left && topCenterX <= rect.right &&
                topContactDepth >= h * .18 && topContactDepth <= h * .85 &&
                safeTop.y >= bounds.minY && safeTop.y <= bounds.maxY
        };
    }

    function digitScratchGeometry(side) {
        var card = document.getElementById(side === "right" ? "minute-card" : "hour-card");
        if (!card) return null;
        var cardRect = card.getBoundingClientRect();
        if (!rectHasVisibleArea(cardRect)) return null;
        var digit = card.querySelector(".leaf.front .num");
        var clip = digit && digit.parentElement;
        if (!digit || !clip || !digit.firstChild) return null;
        var range = document.createRange();
        range.selectNodeContents(digit);
        var textRect = range.getBoundingClientRect();
        var clipRect = clip.getBoundingClientRect();
        range.detach && range.detach();
        var visible = {
            left: Math.max(textRect.left, clipRect.left),
            top: Math.max(textRect.top, clipRect.top),
            right: Math.min(textRect.right, clipRect.right),
            bottom: Math.min(textRect.bottom, clipRect.bottom)
        };
        visible.width = Math.max(0, visible.right - visible.left);
        visible.height = Math.max(0, visible.bottom - visible.top);
        if (!visible.width || !visible.height) return null;
        var w = walker.offsetWidth || 116;
        var h = walker.offsetHeight || 116;
        var contact = {
            x: side === "left" ? visible.left + Math.min(10, visible.width * .10) : visible.right - Math.min(10, visible.width * .10),
            y: visible.top + visible.height * .64
        };
        var approach = clampPosition({
            x: side === "left" ? cardRect.left - w * .92 : cardRect.right - w * .08,
            y: cardRect.bottom - h * .72
        });
        var scratch = clampPosition({
            x: side === "left" ? contact.x - w * .84 : contact.x - w * .16,
            y: contact.y - h * .64
        });
        return {
            card: card,
            digit: digit,
            visible: visible,
            contact: contact,
            approach: approach,
            scratch: scratch,
            fits: contact.x >= scratch.x && contact.x <= scratch.x + w &&
                contact.y >= scratch.y && contact.y <= scratch.y + h
        };
    }

    function cardPeekGeometry(preferredEdge) {
        var message = messageBoardEl();
        if (!message) return null;
        var rect = message.getBoundingClientRect();
        if (!rectHasVisibleArea(rect)) return null;
        var w = walker.offsetWidth || 116;
        var h = walker.offsetHeight || 116;
        var compact = compactCardLayout(rect);
        var defaults = compact ? ["top", "right", "left", "bottom"] : ["right"];
        var edges = preferredEdge ? [preferredEdge] : [];
        for (var edgeIndex = 0; edgeIndex < defaults.length; edgeIndex++) {
            if (defaults[edgeIndex] !== preferredEdge) edges.push(defaults[edgeIndex]);
        }
        var viewport = viewportSize();
        for (var i = 0; i < edges.length; i++) {
            var edge = edges[i];
            var rawHidden;
            var rawPeek;
            if (edge === "top" || edge === "bottom") {
                var inset = Math.min(16, rect.width * .08);
                var minimumX = rect.left + inset;
                var maximumX = rect.right - w - inset;
                var x = maximumX >= minimumX
                    ? Math.max(minimumX, Math.min(maximumX, currentPosition.x))
                    : rect.left + (rect.width - w) / 2;
                if (edge === "top") {
                    rawHidden = { x: x, y: rect.top - h * .18 };
                    rawPeek = { x: x, y: rect.top - h * .56 };
                } else {
                    rawHidden = { x: x, y: rect.bottom - h * .82 };
                    rawPeek = { x: x, y: rect.bottom - h * .44 };
                }
            } else {
                var y = rect.top + Math.min(rect.height * .24, 62) - h * .42;
                if (edge === "left") {
                    rawHidden = { x: rect.left - w * .06, y: y };
                    rawPeek = { x: rect.left - w * .42, y: y };
                } else {
                    rawHidden = { x: rect.right - w * .94, y: y };
                    rawPeek = { x: rect.right - w * .58, y: y };
                }
            }
            var hidden = clampPosition(rawHidden);
            var peek = clampPosition(rawPeek);
            var motion = Math.abs(peek.x - hidden.x) + Math.abs(peek.y - hidden.y);
            var exposed = edge === "top"
                ? Math.max(0, Math.min(rect.top, viewport.height) - Math.max(peek.y, 0))
                : edge === "bottom"
                    ? Math.max(0, Math.min(peek.y + h, viewport.height) - Math.max(rect.bottom, 0))
                    : edge === "left"
                        ? Math.max(0, Math.min(rect.left, viewport.width) - Math.max(peek.x, 0))
                        : Math.max(0, Math.min(peek.x + w, viewport.width) - Math.max(rect.right, 0));
            var edgeSize = edge === "top" || edge === "bottom" ? h : w;
            var fits = overlaps(petRectAt(peek), rect, 0) && motion >= Math.max(12, edgeSize * .12);
            if (compact) {
                fits = fits && petVisibleRatio(peek) >= .58 &&
                    exposed >= edgeSize * .38 &&
                    clampShift(rawPeek, peek) <= Math.max(14, edgeSize * .22);
            }
            if (fits) {
                return {
                    rect: rect,
                    edge: edge,
                    hidden: hidden,
                    peek: peek,
                    exposed: exposed,
                    fits: true,
                    facing: edge === "left" ? -1 : edge === "right" ? 1 :
                        (currentPosition.x + w / 2 < rect.left + rect.width / 2 ? 1 : -1)
                };
            }
        }
        return null;
    }

    function newActionPoint(name) {
        if (name === "sunbathe" || name === "cat-grass") {
            return lifestylePhase === "approach" ? clampPosition(currentPosition) : lifestyleTargetPoint();
        }
        if (name === "card-peek") {
            var cardGeometry = cardPeekGeometry(activeCardPeekEdge);
            if (cardGeometry) {
                activeCardPeekEdge = cardGeometry.edge;
                home.style.setProperty("--jinzhu-facing", String(cardGeometry.facing));
            }
            return cardGeometry && cardGeometry.fits ? cardGeometry.peek : null;
        }
        if (isCardGripAction(name)) {
            var gripGeometry = cardGripGeometry(activeCardGripKind, activeCardGripSide);
            return gripGeometry && gripGeometry.fits ? gripGeometry.grip : null;
        }
        if (name === "look-clock" || name === "jump-clock" || name === "scratch-digits" || name === "lie-clock" || name === "paw-tap") {
            if (name === "scratch-digits") {
                var digitGeometry = digitScratchGeometry(activeClockSide);
                return digitGeometry && digitGeometry.fits ? digitGeometry.scratch : null;
            }
            var clockGeometry = clockInteractionGeometry(activeClockSide);
            if (!clockGeometry) return null;
            if (name === "look-clock") return clockGeometry.look;
            if (name === "paw-tap") return clockGeometry.edgeFits ? clockGeometry.edge : null;
            return clockGeometry.topFits ? clockGeometry.top : null;
        }
        return currentPosition;
    }

    function prepareNewActionLayers(name) {
        var gripKind = activeCardGripKind;
        var gripSide = activeCardGripSide;
        clearNewActionLayers();
        if (isCardGripAction(name)) {
            activeCardGripKind = gripKind;
            activeCardGripSide = gripSide;
        }
        activeNewActionName = name;
        home.classList.add("jinzhu-special-action");
        if (name === "card-peek") {
            activeNewActionHost = messageBoardEl();
            if (activeNewActionHost) activeNewActionHost.classList.add("jinzhu-real-peek-host");
            home.classList.add("jinzhu-real-card-peek");
            home.style.setProperty("--jinzhu-action-scale", ".98");
        } else if (isCardGripAction(name)) {
            activeNewActionHost = cardGripElement(activeCardGripKind);
            if (activeNewActionHost) activeNewActionHost.classList.add("jinzhu-real-grip-host");
            home.classList.add("jinzhu-real-card-grip");
            home.style.setProperty("--jinzhu-action-scale", "1.02");
        } else if (name === "look-clock" || name === "jump-clock" || name === "scratch-digits" || name === "lie-clock" || name === "paw-tap") {
            home.classList.add("jinzhu-real-clock-action");
            home.style.setProperty("--jinzhu-action-scale", "1.02");
        }
    }

    function finishNewAction() {
        clearNewActionLayers();
        idleFor(12, 35);
    }

    function isFormalSleepActive() {
        return !!activeSleepPose || currentStatus === "sleeping" ||
            currentStatus === "side-sleeping" ||
            /^clock-(?:prone|side|curl)-/.test(currentStatus);
    }

    function wakeFormalSleep(immediate) {
        if (!isFormalSleepActive()) return false;
        clearScheduler();
        clearNewActionLayers();
        activeSleepPose = "";
        sideSleepActive = false;
        clockSleepActive = false;
        state.sleepPose = "";
        state.sleepNextPose = "";
        state.sleepStage = "";
        state.sleepClockSide = "";
        state.sleepUntil = 0;
        home.classList.remove("jinzhu-deep-sleep");
        if (immediate) {
            setStatus("idle");
            saveState();
            return true;
        }
        var duration = randomBetween(900, 1500);
        setStatus("walking");
        setPosition(randomRoamingPosition(), duration, false);
        schedule(duration + 100, function () { idleFor(20, 55); }, true);
        saveState();
        return true;
    }

    function wakeClockSleep(immediate) {
        if (!clockSleepActive) return false;
        return wakeFormalSleep(immediate);
    }

    /*
     * All three clock-sleep sprites use the same DOM anchor. Their transparent
     * canvases have different content baselines, so these small calibrated
     * offsets align the lowest visible body pixel with clock-prone's contact
     * line instead of compensating frame by frame.
     */
    var clockSleepAnchorOffsets = {
        prone: { x: 0, y: 0 },
        side: { x: 0, y: -0.045 },
        curl: { x: 0, y: -0.152 }
    };

    function clockSleepStagePoint(stage, geometry) {
        geometry = geometry || clockInteractionGeometry(activeClockSide);
        if (!geometry) return null;
        var offset = clockSleepAnchorOffsets[stage] || clockSleepAnchorOffsets.prone;
        var w = walker.offsetWidth || 116;
        var h = walker.offsetHeight || 116;
        return clampPosition({
            x: geometry.top.x + offset.x * w,
            y: geometry.top.y + offset.y * h
        });
    }

    function currentClockSleepAnchor() {
        var stage = state.sleepStage === "side" || state.sleepStage === "side-transition" ? "side" :
            state.sleepStage === "curl" || state.sleepStage === "curl-transition" ? "curl" : "prone";
        return clockSleepStagePoint(stage);
    }

    function setClockSleepStage(stage, status, minimumMinutes, maximumMinutes, nextPose) {
        clearScheduler();
        var geometry = clockInteractionGeometry(activeClockSide);
        var point = clockSleepStagePoint(stage, geometry);
        if (!geometry || !geometry.topFits || !point) {
            wakeClockSleep(false);
            return false;
        }
        clockSleepActive = true;
        sideSleepActive = stage === "side";
        activeSleepPose = "clock";
        activeNewActionName = "lie-clock";
        state.sleepPose = "clock";
        state.sleepStage = stage;
        state.sleepClockSide = activeClockSide;
        state.sleepNextPose = nextPose || "";
        state.sleepUntil = Date.now() + randomBetween(minimumMinutes, maximumMinutes) * 60000;
        home.classList.add("jinzhu-special-action", "jinzhu-real-clock-action", "jinzhu-clock-sleeping");
        home.style.setProperty("--jinzhu-action-scale", "1.02");
        setPosition(point, 0, false);
        setStatus(status);
        saveState();
        return true;
    }

    function enterClockProneSleep() {
        if (!clockSleepActive || activeNewActionName !== "lie-clock") return false;
        if (!setClockSleepStage("prone", "clock-prone-sleeping", 8, 15, "side")) return false;
        schedule(state.sleepUntil - Date.now(), function () { finishTimedSleep("clock-prone"); }, true);
        return true;
    }

    function enterClockSideSleep() {
        if (!clockSleepActive) return false;
        if (!setClockSleepStage("side", "clock-side-sleeping", 3, 6, "curl")) return false;
        schedule(state.sleepUntil - Date.now(), function () { finishTimedSleep("clock-side"); }, true);
        return true;
    }

    function enterClockCurlSleep() {
        if (!clockSleepActive) return false;
        if (!setClockSleepStage("curl", "clock-curl-sleeping", 10, 30, "")) return false;
        /*
         * sleepUntil records the minimum deep-sleep age for persistence and
         * diagnostics only. No ordinary scheduler wakes this final phase.
         */
        return true;
    }

    function beginClockSideTransition() {
        if (!clockSleepActive || state.sleepStage !== "prone") return false;
        clearScheduler();
        state.sleepStage = "side-transition";
        state.sleepUntil = 0;
        setStatus("clock-prone-sleeping");
        var sidePoint = clockSleepStagePoint("side");
        if (!sidePoint) { wakeClockSleep(false); return false; }
        setPosition(sidePoint, 1100, false);
        saveState();
        schedule(1150, function () {
            setStatus("clock-side-transition");
            schedule(spriteDelay("clock-side-transition") * sprites["clock-side-transition"].length + 180, enterClockSideSleep, true);
        }, true);
        return true;
    }

    function beginClockCurlTransition() {
        if (!clockSleepActive || state.sleepStage !== "side") return false;
        clearScheduler();
        state.sleepStage = "curl-transition";
        state.sleepUntil = 0;
        setStatus("clock-side-sleeping");
        var curlPoint = clockSleepStagePoint("curl");
        if (!curlPoint) { wakeClockSleep(false); return false; }
        setPosition(curlPoint, 1200, false);
        saveState();
        schedule(1250, function () {
            setStatus("clock-curl-transition");
            schedule(spriteDelay("clock-curl-transition") * sprites["clock-curl-transition"].length + 180, enterClockCurlSleep, true);
        }, true);
        return true;
    }

    function enterClockSleep() {
        if (activeNewActionName !== "lie-clock") return false;
        var geometry = clockInteractionGeometry(activeClockSide);
        if (!geometry || !geometry.topFits) {
            finishNewAction();
            return false;
        }
        clearScheduler();
        clockSleepActive = true;
        sideSleepActive = false;
        activeSleepPose = "clock";
        state.sleepPose = "clock";
        state.sleepStage = "prone-closing";
        state.sleepClockSide = activeClockSide;
        state.sleepNextPose = "side";
        state.sleepUntil = 0;
        home.classList.add("jinzhu-clock-sleeping");
        setPosition(clockSleepStagePoint("prone", geometry), 0, false);
        setStatus("clock-prone-closing");
        schedule(spriteDelay("clock-prone-closing") * sprites["clock-prone-closing"].length + 180, enterClockProneSleep, true);
        saveState();
        return true;
    }

    function scheduleClockSleepTransition() {
        var lieConfig = newActionConfig["lie-clock"];
        schedule(lieConfig.frame * lieConfig.frames.length + 450, enterClockSleep, true);
    }

    function lifestyleDayKey(date) {
        return [date.getFullYear(), ("0" + (date.getMonth() + 1)).slice(-2), ("0" + date.getDate()).slice(-2)].join("-");
    }

    function lifestyleMinute(date) {
        return date.getHours() * 60 + date.getMinutes();
    }

    function weatherIsRainy(weather) {
        return !!weather && (weather.condition === "rain" || weather.condition === "storm" || Number(weather.rain) > 0 || Number(weather.precipitation) > 0);
    }

    function sunnyMorningWeather() {
        if (!latestWeather || !latestWeather.isDay || weatherIsRainy(latestWeather) || rainActive) return false;
        if (latestWeather.condition === "clear") return true;
        return latestWeather.condition === "cloudy" && Number(latestWeather.code) >= 0 && Number(latestWeather.code) <= 3;
    }

    function lifestyleBusy() {
        return feedingPending || reminderActive || climbing || perched || clockScratchActive ||
            !!clockAnchorActive || !!messageAnchorActive || !!activeNewActionName ||
            ["sleeping", "sleepy", "eating", "happy", "rain", "heat", "fan", "grooming", "climbing", "climbing-down"].indexOf(currentStatus) >= 0;
    }

    function lifestylePositionIsClear(position, kind) {
        var width = walker.offsetWidth || 116;
        var height = walker.offsetHeight || 116;
        var extraRight = kind === "cat-grass" ? Math.min(78, width * .72) : 0;
        var area = {
            left: position.x - 10,
            top: position.y + 4,
            right: position.x + width + extraRight,
            bottom: position.y + height + 4
        };
        var protectedCards = document.querySelectorAll(".clock, .weather-card, .card.message");
        for (var i = 0; i < protectedCards.length; i++) {
            var rect = visibleRect(protectedCards[i]);
            if (rect.width && rect.height && overlaps(area, rect, 12)) return false;
        }
        return true;
    }

    function findLifestylePosition(kind) {
        var bounds = getViewportBounds();
        var yRange = bounds.maxY - bounds.minY;
        var minY = bounds.minY + yRange * (kind === "cat-grass" ? .48 : .12);
        var maxY = bounds.minY + yRange * (kind === "cat-grass" ? .92 : .82);
        var maxX = kind === "cat-grass" ? Math.max(bounds.minX, bounds.maxX - 56) : bounds.maxX;
        for (var i = 0; i < 36; i++) {
            var candidate = clampPosition({
                x: randomBetween(bounds.minX, maxX),
                y: randomBetween(minY, maxY)
            });
            if (lifestylePositionIsClear(candidate, kind)) return candidate;
        }
        var current = clampPosition(currentPosition);
        if (lifestylePositionIsClear(current, kind)) return current;
        return clampPosition({
            x: randomBetween(bounds.minX, maxX),
            y: randomBetween(bounds.minY, bounds.maxY)
        });
    }

    function rememberLifestyleAnchor(point, kind) {
        var bounds = getViewportBounds();
        lifestyleAnchor = {
            kind: kind,
            x: bounds.maxX > bounds.minX ? (point.x - bounds.minX) / (bounds.maxX - bounds.minX) : .5,
            y: bounds.maxY > bounds.minY ? (point.y - bounds.minY) / (bounds.maxY - bounds.minY) : .6
        };
    }

    function lifestyleTargetPoint() {
        if (!lifestyleAnchor) return clampPosition(currentPosition);
        var bounds = getViewportBounds();
        return clampPosition({
            x: bounds.minX + lifestyleAnchor.x * (bounds.maxX - bounds.minX),
            y: bounds.minY + lifestyleAnchor.y * (bounds.maxY - bounds.minY)
        });
    }

    function positionLifestyleLayers() {
        if (!lifestyleAnchor) return;
        var point = lifestyleTargetPoint();
        var width = walker.offsetWidth || 116;
        var height = walker.offsetHeight || 116;
        if (lifestyleSunPatch) {
            lifestyleSunPatch.style.left = Math.round(point.x - width * .38) + "px";
            lifestyleSunPatch.style.top = Math.round(point.y + height * .12) + "px";
            lifestyleSunPatch.style.width = Math.round(width * 1.78) + "px";
            lifestyleSunPatch.style.height = Math.round(height * 1.18) + "px";
        }
        if (lifestyleGrassLayer) {
            lifestyleGrassLayer.style.left = Math.round(point.x + width * .73) + "px";
            lifestyleGrassLayer.style.top = Math.round(point.y + height * .36) + "px";
        }
    }

    function createSunPatch() {
        lifestyleSunPatch = document.createElement("i");
        lifestyleSunPatch.className = "jinzhu-sun-patch";
        lifestyleSunPatch.setAttribute("aria-hidden", "true");
        document.body.appendChild(lifestyleSunPatch);
        positionLifestyleLayers();
        if (actionTestMode) parkTestPanelAwayFrom(lifestyleSunPatch);
    }

    function setGrassFrame(number) {
        if (!lifestyleGrassImage) return;
        lifestyleGrassImage.src = spriteBase + "animations/lifestyle-preview/cat-grass/grass/cat-grass-0" + number + ".png";
    }

    function createGrassLayer() {
        lifestyleGrassLayer = document.createElement("span");
        lifestyleGrassLayer.className = "jinzhu-cat-grass-layer is-growing";
        lifestyleGrassImage = document.createElement("img");
        lifestyleGrassImage.alt = "";
        lifestyleGrassImage.setAttribute("aria-hidden", "true");
        lifestyleGrassLayer.appendChild(lifestyleGrassImage);
        document.body.appendChild(lifestyleGrassLayer);
        setGrassFrame(1);
        positionLifestyleLayers();
        if (actionTestMode) parkTestPanelAwayFrom(lifestyleGrassLayer);
    }

    function beginLifestyleAction(name, point, forced) {
        clearScheduler();
        clearNewActionLayers();
        activeNewActionName = name;
        lifestylePhase = "approach";
        rememberLifestyleAnchor(point, name);
        home.classList.add("jinzhu-special-action", "jinzhu-lifestyle-action");
        home.classList.add(name === "sunbathe" ? "jinzhu-sunbathing" : "jinzhu-eating-grass");
        home.style.setProperty("--jinzhu-action-scale", "1");
        if (!forced) state.nextLifestyleAllowed = Date.now() + 12 * 60000;
        saveState();
    }

    function finishLifestyleAction() {
        clearScheduler();
        clearNewActionLayers();
        /* A completed lifestyle event starts a fresh five-minute rest window. */
        state.lastSleepResetAt = Date.now();
        state.nextLifestyleAllowed = Math.max(Number(state.nextLifestyleAllowed || 0), Date.now() + 8 * 60000);
        var duration = randomBetween(900, 1500);
        setStatus("walking");
        setPosition(randomRoamingPosition(), duration, false);
        schedule(duration + 100, function () { idleFor(12, 35); }, true);
        saveState();
    }

    function startSunbathe(forced) {
        var date = currentDate();
        var minute = lifestyleMinute(date);
        var day = lifestyleDayKey(date);
        if (!forced && (document.hidden || lifestyleBusy() || Date.now() < Number(state.nextLifestyleAllowed || 0) ||
            minute < 510 || minute > 690 || state.lastSunbatheDay === day || !sunnyMorningWeather())) return false;
        var target = findLifestylePosition("sunbathe");
        beginLifestyleAction("sunbathe", target, forced);
        if (!forced) state.lastSunbatheDay = day;
        var walkDuration = randomBetween(1100, 1800);
        setStatus("walking");
        setPosition(target, walkDuration, false);
        schedule(walkDuration + 80, function () {
            lifestylePhase = "active";
            setPosition(lifestyleTargetPoint(), 0, false);
            createSunPatch();
            setStatus("sunbathe-prepare");
            schedule(1400, function () {
                setStatus("sunbathe-rest");
                schedule(randomBetween(15, 35) * 1000, function () {
                    setStatus("sunbathe-finish");
                    schedule(1800, finishLifestyleAction, true);
                }, true);
            }, true);
        }, true);
        saveState();
        return true;
    }

    function pulseGrassBite(frame) {
        if (activeNewActionName !== "cat-grass" || !lifestyleGrassLayer) return;
        setGrassFrame(frame);
        lifestyleGrassLayer.classList.remove("is-bitten");
        void lifestyleGrassLayer.offsetWidth;
        lifestyleGrassLayer.classList.add("is-bitten");
    }

    function faceCatTowardGrass(catPoint) {
        if (!lifestyleGrassLayer) return;
        positionLifestyleLayers();
        var grassRect = lifestyleGrassLayer.getBoundingClientRect();
        var catCenter = catPoint.x + (walker.offsetWidth || 116) / 2;
        var grassCenter = grassRect.left + grassRect.width / 2;
        home.style.setProperty("--jinzhu-facing", grassCenter < catCenter ? "-1" : "1");
    }

    function beginGrassEating() {
        if (activeNewActionName !== "cat-grass") return;
        lifestylePhase = "active";
        var target = lifestyleTargetPoint();
        setPosition(target, 0, false);
        faceCatTowardGrass(target);
        setStatus("grass-sniff");
        schedule(950, function () {
            setStatus("grass-bite");
            [0, 430, 860, 1290].forEach(function (delay, index) {
                var timer = setTimeout(function () { pulseGrassBite(index % 2 ? 2 : 3); }, delay);
                lifestyleTimers.push(timer);
            });
            schedule(1800, function () {
                setGrassFrame(2);
                setStatus("grass-chew");
                schedule(1300, function () {
                    setStatus("grass-finish");
                    schedule(1050, function () {
                        if (lifestyleGrassLayer) lifestyleGrassLayer.classList.add("is-fading");
                        schedule(750, finishLifestyleAction, true);
                    }, true);
                }, true);
            }, true);
        }, true);
    }

    function startCatGrass(forced, reason) {
        var date = currentDate();
        var day = lifestyleDayKey(date);
        if (!forced && (document.hidden || lifestyleBusy() || weatherIsRainy(latestWeather) || rainActive ||
            Date.now() < Number(state.nextLifestyleAllowed || 0) || state.lastCatGrassDay === day)) return false;
        var target = findLifestylePosition("cat-grass");
        beginLifestyleAction("cat-grass", target, forced);
        if (!forced) state.lastCatGrassDay = day;
        createGrassLayer();
        setStatus("grass-notice");
        schedule(900, function () {
            setGrassFrame(2);
            if (lifestyleGrassLayer) lifestyleGrassLayer.classList.remove("is-growing");
            schedule(650, function () {
                var duration = randomBetween(1100, 1800);
                var approachFrom = clampPosition(currentPosition);
                var target = lifestyleTargetPoint();
                lifestylePhase = "approach";
                setStatus("walking");
                setPosition(target, duration, false);
                faceCatTowardGrass(approachFrom);
                schedule(duration + 80, beginGrassEating, true);
            }, true);
        }, true);
        if (reason === "rain-stop-test") say("雨停咗，生咗猫草。");
        saveState();
        return true;
    }

    function ensureSunbathePlan(date) {
        var day = lifestyleDayKey(date);
        if (state.sunbathePlanDay === day && Number(state.sunbathePlanMinute) >= 510 && Number(state.sunbathePlanMinute) <= 690) return;
        state.sunbathePlanDay = day;
        state.sunbathePlanMinute = Math.round(randomBetween(510, 690));
        saveState();
    }

    function tryNaturalLifestyleBehavior() {
        if (document.hidden || lifestyleBusy() || Date.now() < Number(state.nextLifestyleAllowed || 0)) return false;
        var date = currentDate();
        var minute = lifestyleMinute(date);
        var day = lifestyleDayKey(date);
        ensureSunbathePlan(date);
        if (minute >= Number(state.sunbathePlanMinute) && minute <= 690 && state.lastSunbatheDay !== day && sunnyMorningWeather()) {
            return startSunbathe(false);
        }
        if (!latestWeather || !latestWeather.isDay || weatherIsRainy(latestWeather) || rainActive || state.lastCatGrassDay === day) return false;
        var recentRainStop = Date.now() - Number(state.lastRainStoppedAt || 0) <= 3 * 60 * 60000;
        var humid = Number(latestWeather.humidity) >= 78;
        if ((recentRainStop || humid) && Math.random() < .07) return startCatGrass(false, "humid");
        var sinceFed = Date.now() - Number(state.lastFed || 0);
        var fedWindow = minute >= 660 && minute <= 1080 && sinceFed >= 30 * 60000 && sinceFed <= 120 * 60000;
        if (fedWindow && Math.random() < .22) return startCatGrass(false, "after-feed");
        if (minute >= 780 && minute <= 1050 && Math.random() < .025) return startCatGrass(false, "afternoon");
        return false;
    }

    function faceClock(side) {
        home.style.setProperty("--jinzhu-facing", side === "left" ? "1" : "-1");
    }

    function animateActionPosition(start, end, duration, arcHeight, done) {
        cancelActionMotion();
        if (!start || !end || !isFinite(Number(start.x)) || !isFinite(Number(start.y)) ||
            !isFinite(Number(end.x)) || !isFinite(Number(end.y))) {
            if (done) done();
            return;
        }
        var generation = actionMotionGeneration;
        var startedAt = Date.now();
        var lastPaintAt = -Infinity;
        var motionBounds = getViewportBounds();
        duration = Math.max(1, Number(duration) || 1);
        var step = function () {
            if (generation !== actionMotionGeneration) return;
            var elapsed = Date.now() - startedAt;
            var progress = Math.max(0, Math.min(1, elapsed / duration));
            var eased = progress * progress * (3 - 2 * progress);
            var arc = arcHeight ? Math.sin(Math.PI * progress) * arcHeight : 0;
            if (!lowPowerDevice || progress === 1 || elapsed - lastPaintAt >= 42) {
                setPosition({
                    x: start.x + (end.x - start.x) * eased,
                    y: start.y + (end.y - start.y) * eased - arc
                }, 0, false, motionBounds, progress < 1);
                lastPaintAt = elapsed;
            }
            if (progress < 1) {
                actionMotionFrame = window.requestAnimationFrame ? window.requestAnimationFrame(step) : setTimeout(step, 16);
            } else {
                actionMotionFrame = null;
                if (done) done();
            }
        };
        step();
    }

    function walkToActionPoint(point, done) {
        var duration = randomBetween(1000, 1550);
        setStatus("walking");
        setPosition(point, duration, false);
        schedule(duration + 40, done, true);
    }

    function startGroundNewAction(name) {
        var config = newActionConfig[name];
        clearScheduler();
        clearNewActionLayers();
        setStatus(name);
        schedule(config.frame * config.frames.length + Number(config.hold || 900), finishNewAction, true);
    }

    function chooseClockSide() {
        var catX = currentPosition.x + (walker.offsetWidth || 116) / 2;
        var catY = currentPosition.y + (walker.offsetHeight || 116) / 2;
        var hour = document.getElementById("hour-card");
        var minute = document.getElementById("minute-card");
        if (!hour || !minute) return "left";
        var hourRect = hour.getBoundingClientRect();
        var minuteRect = minute.getBoundingClientRect();
        var hourDistance = Math.hypot(catX - (hourRect.left + hourRect.width / 2), catY - (hourRect.top + hourRect.height / 2));
        var minuteDistance = Math.hypot(catX - (minuteRect.left + minuteRect.width / 2), catY - (minuteRect.top + minuteRect.height / 2));
        return hourDistance <= minuteDistance ? "left" : "right";
    }

    function startLookAtClock() {
        activeClockSide = chooseClockSide();
        var geometry = clockInteractionGeometry(activeClockSide);
        if (!geometry) { finishNewAction(); return; }
        walkToActionPoint(geometry.look, function () {
            prepareNewActionLayers("look-clock");
            faceClock(activeClockSide);
            var fresh = clockInteractionGeometry(activeClockSide);
            if (!fresh) { finishNewAction(); return; }
            setPosition(fresh.look, 0, false);
            setStatus("look-clock");
            var config = newActionConfig["look-clock"];
            schedule(config.frame * config.frames.length + config.hold, finishNewAction, true);
        });
    }

    function startClockJump(finalAction, previewOnly) {
        activeClockSide = chooseClockSide();
        var geometry = clockInteractionGeometry(activeClockSide);
        if (!geometry || !geometry.topFits) return false;
        walkToActionPoint(geometry.approach, function () {
            prepareNewActionLayers("jump-clock");
            faceClock(activeClockSide);
            var fresh = clockInteractionGeometry(activeClockSide);
            if (!fresh || !fresh.topFits) { finishNewAction(); return; }
            setPosition(fresh.approach, 0, false);
            setStatus("jump-clock");
            var arcHeight = Math.max(82, Math.min(150, Math.abs(fresh.approach.y - fresh.top.y) * .48 + 46));
            animateActionPosition(fresh.approach, fresh.top, 1050, arcHeight, function () {
                var landing = clockInteractionGeometry(activeClockSide);
                if (!landing || !landing.topFits) { finishNewAction(); return; }
                activeNewActionName = "lie-clock";
                setPosition(landing.top, 0, false);
                setStatus("lie-clock");
                if (previewOnly) {
                    var lieConfig = newActionConfig["lie-clock"];
                    schedule(lieConfig.frame * lieConfig.frames.length + 2000, finishNewAction, true);
                } else {
                    scheduleClockSleepTransition();
                }
            });
        });
        return true;
    }

    function removeScratchDebris(node) {
        var index = scratchDebrisNodes.indexOf(node);
        if (index >= 0) scratchDebrisNodes.splice(index, 1);
        if (node.parentNode) node.parentNode.removeChild(node);
    }

    function emitScratchDebris(geometry) {
        if (!geometry || activeNewActionName !== "scratch-digits") return;
        var originX = geometry.contact.x;
        var originY = geometry.contact.y + 17;
        var chipCount = Math.random() < .35 ? 2 : 1;
        for (var i = 0; i < chipCount; i++) {
            var chip = document.createElement("i");
            chip.className = "jinzhu-paper-chip";
            chip.style.left = Math.round(originX + randomBetween(-3, 4)) + "px";
            chip.style.top = Math.round(originY + randomBetween(-5, 7)) + "px";
            chip.style.width = randomBetween(3, 6) + "px";
            chip.style.height = randomBetween(4, 8) + "px";
            chip.style.setProperty("--jinzhu-chip-x", randomBetween(-16, 17) + "px");
            chip.style.setProperty("--jinzhu-chip-rotate", randomBetween(-110, 110) + "deg");
            chip.style.setProperty("--jinzhu-chip-duration", randomBetween(650, 900) + "ms");
            document.body.appendChild(chip);
            scratchDebrisNodes.push(chip);
            (function (node) {
                var timer = setTimeout(function () { removeScratchDebris(node); }, 950);
                scratchEffectTimers.push(timer);
            })(chip);
        }
    }

    function pulseScratchDigit(digit) {
        if (!digit || activeNewActionName !== "scratch-digits") return;
        clearTimeout(scratchDigitTimer);
        if (activeScratchDigit) activeScratchDigit.classList.remove("jinzhu-digit-scratched");
        activeScratchDigit = digit;
        digit.classList.remove("jinzhu-digit-scratched");
        void digit.offsetWidth;
        digit.classList.add("jinzhu-digit-scratched");
        scratchDigitTimer = setTimeout(function () {
            if (activeScratchDigit) activeScratchDigit.classList.remove("jinzhu-digit-scratched");
            activeScratchDigit = null;
            scratchDigitTimer = null;
        }, 260);
    }

    function leaveDigitScratch() {
        clearNewActionLayers();
        var duration = randomBetween(900, 1400);
        setStatus("walking");
        setPosition(randomRoamingPosition(), duration, false);
        schedule(duration + 80, function () { idleFor(12, 35); }, true);
    }

    function beginDigitScratch() {
        var geometry = digitScratchGeometry(activeClockSide);
        if (!geometry || !geometry.fits) { finishNewAction(); return; }
        setPosition(geometry.scratch, 0, false);
        setStatus("scratch-digits");
        [150, 450, 750, 1050].forEach(function (delay) {
            var timer = setTimeout(function () {
                var latest = digitScratchGeometry(activeClockSide);
                if (!latest || activeNewActionName !== "scratch-digits") return;
                pulseScratchDigit(latest.digit);
                emitScratchDebris(latest);
            }, delay);
            scratchEffectTimers.push(timer);
        });
        var config = newActionConfig["scratch-digits"];
        schedule(config.frame * config.frames.length + config.hold, leaveDigitScratch, true);
    }

    function startDigitScratch() {
        activeClockSide = chooseClockSide();
        var geometry = digitScratchGeometry(activeClockSide);
        if (!geometry || !geometry.fits) { clearNewActionLayers(); idleFor(12, 35); return; }
        if (actionTestMode) parkTestPanelAwayFrom(document.querySelector(".clock"));
        walkToActionPoint(geometry.approach, function () {
            prepareNewActionLayers("scratch-digits");
            faceClock(activeClockSide);
            var fresh = digitScratchGeometry(activeClockSide);
            if (!fresh || !fresh.fits) { finishNewAction(); return; }
            setPosition(fresh.approach, 0, false);
            setStatus("jump-clock");
            var arcHeight = Math.max(62, Math.min(105, Math.abs(fresh.approach.y - fresh.scratch.y) * .34 + 36));
            animateActionPosition(fresh.approach, fresh.scratch, 820, arcHeight, beginDigitScratch);
        });
    }

    function pulseClockCard(card) {
        if (!card || activeNewActionName !== "paw-tap") return;
        clearTimeout(clockTapTimer);
        if (activeTappedCard) activeTappedCard.classList.remove("jinzhu-clock-tapped");
        activeTappedCard = card;
        card.classList.remove("jinzhu-clock-tapped");
        void card.offsetWidth;
        card.classList.add("jinzhu-clock-tapped");
        clockTapTimer = setTimeout(function () {
            if (activeTappedCard) activeTappedCard.classList.remove("jinzhu-clock-tapped");
            activeTappedCard = null;
            clockTapTimer = null;
        }, 430);
    }

    function pulseGripTarget(target) {
        if (!target || !isCardGripAction(activeNewActionName)) return;
        clearTimeout(cardGripTimer);
        if (activeGripTarget) activeGripTarget.classList.remove("jinzhu-card-gripped");
        activeGripTarget = target;
        target.classList.remove("jinzhu-card-gripped");
        void target.offsetWidth;
        target.classList.add("jinzhu-card-gripped");
        cardGripTimer = setTimeout(function () {
            if (activeGripTarget) activeGripTarget.classList.remove("jinzhu-card-gripped");
            activeGripTarget = null;
            cardGripTimer = null;
        }, 520);
    }

    function leaveCardGrip() {
        clearNewActionLayers();
        var duration = randomBetween(900, 1400);
        setStatus("walking");
        setPosition(randomRoamingPosition(), duration, false);
        schedule(duration + 80, function () { idleFor(12, 35); }, true);
    }

    function startCardGripAction(name) {
        activeCardGripKind = name === "paw-rest-message" ? "message" :
            name === "paw-rest-weather" ? "weather" : chooseCardGripKind();
        var target = cardGripElement(activeCardGripKind);
        if (!target) { clearNewActionLayers(); idleFor(12, 35); return; }
        activeCardGripSide = chooseCardGripEdge(activeCardGripKind, target);
        if (!activeCardGripSide) { clearNewActionLayers(); idleFor(12, 35); return; }
        var geometry = cardGripGeometry(activeCardGripKind, activeCardGripSide);
        if (!geometry || !geometry.fits) { clearNewActionLayers(); idleFor(12, 35); return; }
        if (actionTestMode) parkTestPanelAwayFrom(target);
        walkToActionPoint(geometry.approach, function () {
            prepareNewActionLayers(name);
            var fresh = cardGripGeometry(activeCardGripKind, activeCardGripSide);
            if (!fresh || !fresh.fits) { finishNewAction(); return; }
            home.style.setProperty("--jinzhu-facing", String(fresh.facing));
            setPosition(fresh.grip, 420, false);
            schedule(450, function () {
                var contact = cardGripGeometry(activeCardGripKind, activeCardGripSide);
                if (!contact || !contact.fits) { finishNewAction(); return; }
                setPosition(contact.grip, 0, false);
                setStatus(name);
                var config = newActionConfig[name];
                schedule(config.frame * 2, function () {
                    var latest = cardGripGeometry(activeCardGripKind, activeCardGripSide);
                    pulseGripTarget(latest && latest.element);
                    schedule(config.frame * Math.max(1, config.frames.length - 2) + config.hold, function () {
                        var release = newActionConfig["paw-rest-release"];
                        setStatus("paw-rest-release");
                        schedule(release.frame * release.frames.length, leaveCardGrip, true);
                    }, true);
                }, true);
            }, true);
        });
    }

    function startClockEdgeAction(name) {
        activeClockSide = chooseClockSide();
        var geometry = clockInteractionGeometry(activeClockSide);
        if (!geometry || !geometry.edgeFits) { finishNewAction(); return; }
        walkToActionPoint(geometry.approach, function () {
            prepareNewActionLayers(name);
            faceClock(activeClockSide);
            var fresh = clockInteractionGeometry(activeClockSide);
            if (!fresh || !fresh.edgeFits) { finishNewAction(); return; }
            setPosition(fresh.edge, 360, false);
            schedule(390, function () {
                var contact = clockInteractionGeometry(activeClockSide);
                if (!contact || !contact.edgeFits) { finishNewAction(); return; }
                setPosition(contact.edge, 0, false);
                setStatus(name);
                var config = newActionConfig[name];
                if (name === "paw-tap") {
                    schedule(config.frame * 2, function () {
                        var target = clockInteractionGeometry(activeClockSide);
                        pulseClockCard(target && target.card);
                        schedule(config.frame * Math.max(1, config.frames.length - 2) + config.hold, finishNewAction, true);
                    }, true);
                } else {
                    schedule(config.frame * config.frames.length + config.hold, finishNewAction, true);
                }
            }, true);
        });
    }

    function retractCardPeek() {
        var latest = cardPeekGeometry(activeCardPeekEdge);
        if (!latest || !latest.fits) { finishNewAction(); return; }
        activeCardPeekEdge = latest.edge;
        home.style.setProperty("--jinzhu-facing", String(latest.facing));
        animateActionPosition(latest.peek, latest.hidden, 600, 0, finishNewAction);
    }

    function holdThenRetractCardPeek() {
        var config = newActionConfig["card-peek"];
        schedule(config.frame * config.frames.length + config.hold, retractCardPeek, true);
    }

    function startCardPeekAction() {
        var geometry = cardPeekGeometry();
        if (!geometry || !geometry.fits) { finishNewAction(); return; }
        if (actionTestMode) parkTestPanelAwayFrom(messageBoardEl());
        clearScheduler();
        prepareNewActionLayers("card-peek");
        activeCardPeekEdge = geometry.edge;
        home.style.setProperty("--jinzhu-facing", String(geometry.facing));
        setPosition(geometry.hidden, 0, false);
        setStatus("card-peek");
        animateActionPosition(geometry.hidden, geometry.peek, 650, 0, function () {
            holdThenRetractCardPeek();
        });
    }

    function playNewAction(name, force) {
        if (name === "jump-clock") {
            if (force && isFormalSleepActive()) wakeFormalSleep(true);
            return startClockJump("lie-clock", true);
        }
        if (name === "side-sleep") return startFormalSleep("side", !!force, false);
        if (name === "lie-clock") return startFormalSleep("clock", !!force, false);
        if (force && isFormalSleepActive()) wakeFormalSleep(true);
        var config = newActionConfig[name];
        if (!config || (!force && (Date.now() < Number(state["newAction_" + name] || 0) || reminderActive || currentStatus === "sleeping" || currentStatus === "rain" || currentStatus === "heat"))) return false;
        state["newAction_" + name] = Date.now() + config.cooldown;
        if (name === "look-clock") startLookAtClock();
        else if (name === "scratch-digits") startDigitScratch();
        else if (isCardGripAction(name)) startCardGripAction(name);
        else if (name === "paw-tap") startClockEdgeAction(name);
        else if (name === "card-peek") startCardPeekAction();
        else startGroundNewAction(name);
        saveState();
        return true;
    }

    function startPlaying() {
        if (state.energy < 25 || state.fullness < 20) {
            idleFor(45, 100);
            return;
        }
        state.energy = clamp(state.energy - 2);
        setStatus("playing");
        schedule(randomBetween(5, 10) * 1000, function () { idleFor(45, 120); });
    }

    var INTERACTIVE_PLAY_CHANCE = .30;
    var INTERACTIVE_PLAY_COOLDOWN_MS = 45 * 1000;
    var testPlayingActive = false;

    function testPlayingLog(message) {
        if (actionTestMode && window.console && typeof window.console.log === "function") {
            window.console.log("[Jinzhu Test] " + message);
        }
    }

    function interactivePlayingBlocked(source) {
        return currentStatus === "playing" ||
            (source === "hover" && !panel.hidden) ||
            feedingPending || reminderActive || rainActive ||
            currentStatus === "eating" || currentStatus === "happy" ||
            currentStatus === "rain" || currentStatus === "heat" || currentStatus === "fan" ||
            isFormalSleepActive() || climbing || perched || clockScratchActive ||
            !!clockAnchorActive || !!messageAnchorActive || !!activeNewActionName;
    }

    function startInteractivePlaying(force, source) {
        if (force) {
            if (isFormalSleepActive()) wakeFormalSleep(true);
            if (activeNewActionName || clockAnchorActive || messageAnchorActive || clockScratchActive) {
                clearScheduler();
                clearNewActionLayers();
                setStatus("idle");
            }
        }
        if (interactivePlayingBlocked(source || "test")) return false;
        if (!force && Date.now() < Number(state.nextInteractivePlayingAllowed || 0)) return false;
        if (!force && Math.random() >= INTERACTIVE_PLAY_CHANCE) return false;
        clearScheduler();
        state.nextInteractivePlayingAllowed = Date.now() + INTERACTIVE_PLAY_COOLDOWN_MS;
        setStatus("playing");
        say(source === "pet" ? "摸到我啦，翻個身俾你睇下。" : "你搵到我呀，玩兩下先。");
        schedule(randomBetween(5, 10) * 1000, function () { idleFor(45, 120); }, true);
        saveState();
        return true;
    }

    function maybeStartInteractivePlaying(source) {
        return startInteractivePlaying(false, source);
    }

    /* The action-panel preview deliberately has a separate path from owner
       interactions. It must be able to show the accepted roll sprites even
       when rain or another interruptible routine is currently active. */
    function finishTestPlaying() {
        if (!testPlayingActive) return;
        testPlayingActive = false;
        clearScheduler();
        if (rainActive) {
            startRainWatching();
            return;
        }
        setStatus("idle");
        if (!reminderActive) idleFor(45, 120);
    }

    function clearInterruptibleStateForTestPlaying() {
        clearScheduler();
        if (isFormalSleepActive()) wakeFormalSleep(true);
        if (clockScratchActive) finishClockScratch();
        if (clockAnchorActive) endClockAnchor();
        if (messageAnchorActive) endMessageAnchor();
        clearScheduler();
        clearNewActionLayers();
        climbing = false;
        perched = false;
        feedingPending = false;
        home.classList.remove("on-clock", "on-message");
        home.style.removeProperty("--jinzhu-perch-scale");
    }

    function forcePlayActionForTest(action) {
        if (action !== "playing") return false;
        if (!actionTestMode) {
            testPlayingLog("playing blocked by: test-mode-disabled");
            return false;
        }
        if (testPlayingActive || currentStatus === "playing") {
            testPlayingLog("playing blocked by: already-playing");
            return false;
        }
        clearInterruptibleStateForTestPlaying();
        testPlayingActive = true;
        setStatus("playing");
        testPlayingLog("playing started");
        /* Six 420ms frames loop clearly for more than two full cycles. */
        schedule(7200, finishTestPlaying, true);
        return true;
    }

    function startRainWatching() {
        if (!rainActive || activeNewActionName || currentStatus === "sleeping" || currentStatus === "eating" || currentStatus === "happy") return false;
        clearScheduler();
        setPosition(restoredPosition(), scaledDuration(450), false);
        setStatus("rain");
        var rainDuration = debugMode ? 4000 : randomBetween(8, 15) * 1000;
        schedule(rainDuration, function () { idleFor(45, 120); }, debugMode);
        return true;
    }

    function requestRain(active) {
        rainActive = !!active;
        if (!rainActive) {
            if (currentStatus === "rain") {
                clearScheduler();
                catImage.src = spriteBase + "rain-4.png";
                schedule(900, function () { idleFor(30, 75); });
            }
            return true;
        }
        if (isFormalSleepActive()) wakeFormalSleep(true);
        return startRainWatching();
    }

    function requestHeat(active) {
        if (!active) {
            if (currentStatus === "heat") idleFor(30, 75);
            return true;
        }
        if (isFormalSleepActive()) wakeFormalSleep(true);
        if (activeNewActionName || currentStatus === "sleeping" || currentStatus === "eating" || currentStatus === "happy" || currentStatus === "rain" || currentStatus === "grooming") return false;
        clearScheduler();
        setStatus("heat");
        return true;
    }

    function activateCooling(kind) {
        if (isFormalSleepActive()) wakeFormalSleep(true);
        clearScheduler();
        if (kind === "fan") {
            setStatus("fan");
            say("風扇開咗，舒服晒。");
            schedule(12000, function () { idleFor(45, 100); }, true);
        } else {
            setStatus("happy");
            say("冷氣開咗，唔該主人。");
            schedule(3000, function () { idleFor(45, 100); }, true);
        }
    }

    function forceDebugAction(action) {
        var clockStates = { clockPerch: "clock-perch", clockHook: "clock-hook", clockNap: "clock-nap", clockPeek: "clock-peek", colonSit: "colon-sit" };
        if (clockStates[action]) { startClockAnchor(clockStates[action], true); return; }
        if (action === "clockScratch") { startClockScratch(true); return; }
        if (action === "sleeping") startFormalSleep("curl", true, false);
        else if (action === "sleepy") startSleepy();
        else if (action === "walking") { state.nextWalkAllowed = 0; startWalking(); }
        else if (action === "grooming") startGrooming();
        else if (action === "playing") startPlaying();
        else if (action === "eating") {
            pendingEatingDuration = 9000;
            setStatus("eating");
            finishInteraction(pendingEatingDuration, true);
        }
        else if (action === "happy") {
            setStatus("happy");
            finishInteraction(2000, true);
        }
        else if (action === "look-around") startLookAround();
        else if (action === "climbing" || action === "climb") { state.nextClimbAllowed = 0; startClockClimb(true); }
        else idleFor(30, 60);
    }

    function chooseNextBehavior() {
        if (reminderActive) return;
        applyElapsedTime();
        renderStats();
        saveState();
        if (debugMode && debugAction) {
            var action = debugAction;
            debugAction = null;
            forceDebugAction(action);
            return;
        }
        if (debugHold) {
            setStatus("idle");
            return;
        }
        if (tryNaturalLifestyleBehavior()) return;
        if (rainActive && Math.random() < .18 && startRainWatching()) return;
        var action = weightedChoice(behaviorWeights());
        if (companionMode === "quiet" && (action === "walking" || action === "playing")) action = "idle";
        if (companionMode === "strict" && action === "idle" && Math.random() < .35) action = "look-around";
        if ((ownerMood === "tired" || ownerMood === "annoyed" || ownerMood === "private") && (action === "walking" || action === "playing")) action = "idle";
        if (ownerMood === "happy" && (routinePeriod() === "morning" || routinePeriod() === "evening") && action === "idle" && Math.random() < .35) action = "playing";
        if (state.fullness < 18 && (action === "playing" || action === "walking")) action = "idle";
        if (action === "sleeping") startFormalSleep("", false, false);
        else if (action === "sleepy") startSleepy();
        else if (action === "look-around") startLookAround();
        else if (action === "grooming") startGrooming();
        else if (action === "walking") {
            if (Math.random() < .22 && playNewAction(["turn", "stretch", "crouch", "look-clock", "card-peek", "paw-rest", "paw-tap", "scratch-digits"][Math.floor(Math.random() * 8)], false)) return;
            if (Math.random() < .08 && startClockAnchor(["clock-perch", "clock-hook", "clock-peek", "colon-sit"][Math.floor(Math.random() * 4)], false)) return;
            if (Math.random() < .06 && startMessageVisit(Math.random() < .4 ? "message-peek" : "message-sit", false)) return;
            if (Math.random() < .03 && startMessagePat(false)) return;
            startWalking();
        }
        else if (action === "playing") startPlaying();
        else idleFor(30, 120);
    }

    function interactionAllowed() {
        var timestamp = Date.now();
        if (timestamp - lastTapAt < 1200) return false;
        lastTapAt = timestamp;
        state.lastInteraction = timestamp;
        applyElapsedTime();
        return true;
    }

    function finishInteraction(milliseconds, exactDuration) {
        schedule(milliseconds, function () {
            setStatus(routinePeriod() === "night" ? "sleepy" : "idle");
            schedule(routinePeriod() === "night" ? randomBetween(15, 40) * 1000 : randomBetween(30, 90) * 1000, chooseNextBehavior);
        }, exactDuration);
    }
    var lastChatReply = "";
    var chatReplies = ["你做嘢，我監督。", "今日有冇摸我？", "我唔系寵物，我系金主。", "做完先准休息。", "我醒住，你放心。"];
    function nextChatReply() {
        var choices = chatReplies.filter(function (reply) { return reply !== lastChatReply; });
        var reply = choices[Math.floor(Math.random() * choices.length)] || chatReplies[0];
        lastChatReply = reply;
        return reply;
    }

    function openMenu(message) {
        clearScheduler();
        tapAwayPending = false;
        clearTimeout(tapAwayTimer);
        panel.hidden = false;
        prepareOverlays();
        if (currentStatus !== "sleeping" && currentStatus !== "eating") setStatus("idle");
        say(message || (state.fullness < 25 ? "想食嘢。" : "揀啦，金主听住。"));
    }

    function closeMenu() {
        panel.hidden = true;
        if (!document.hidden && currentStatus !== "sleeping" && currentStatus !== "eating") {
            schedule(randomBetween(30, 90) * 1000, chooseNextBehavior);
        }
    }

    function stopMovementAndOpenMenu() {
        var rect = walker.getBoundingClientRect();
        climbing = false;
        perched = false;
        home.classList.remove("on-clock");
        setPosition({ x: rect.left, y: rect.top }, 0);
        openMenu("好啦，俾你捉到。");
    }

    function startClickRun() {
        clearScheduler();
        tapAwayPending = true;
        clearTimeout(tapAwayTimer);
        tapAwayTimer = setTimeout(function () { tapAwayPending = false; }, 12000);
        if (!debugNoClimb && Math.random() < .20 && startClockClimb(false)) return;
        var replies = ["捉我唔到。", "做咩撳我呀？", "我去第二度坐。", "借借。"];
        var duration = scaledDuration(randomBetween(2, 5) * 1000);
        setStatus("walking");
        say(replies[Math.floor(Math.random() * replies.length)]);
        setPosition(randomRoamingPosition(), duration);
        schedule(duration + 120, function () {
            var arrivals = ["idle", "look-around", "grooming"];
            var arrival = arrivals[Math.floor(Math.random() * arrivals.length)];
            setStatus(arrival);
            schedule(arrival === "grooming" ? 7000 : 5000, function () { idleFor(45, 120); });
        }, true);
        saveState();
    }

    if (!window.JINZHU_IMMERSIVE) {
    cat.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (window.JINZHU_IMMERSIVE) return;
        if (currentStatus === "walking" || climbing || currentStatus === "climbing" || currentStatus === "climbing-down") {
            lastTapAt = Date.now();
            stopMovementAndOpenMenu();
            return;
        }
        if (!interactionAllowed()) return;
        if (currentStatus === "eating") {
            say("食紧呀，等阵先。");
            return;
        }
        if (isFormalSleepActive()) {
            wakeFormalSleep(false);
            say(routinePeriod() === "night" ? "嗯…我聽到。" : "我醒啦。");
            panel.hidden = true;
            return;
        }
        if (!panel.hidden) {
            panel.hidden = true;
            schedule(randomBetween(30, 90) * 1000, chooseNextBehavior);
            return;
        }
        if (tapAwayPending) openMenu();
        else startClickRun();
    });

    if (bubbleMenu) bubbleMenu.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        setTimeout(function () { openMenu(); }, 0);
    });

    panel.addEventListener("click", function (event) {
        if (window.JINZHU_IMMERSIVE) return;
        var button = event.target.closest("[data-jinzhu-action]");
        if (!button) return;
        event.stopPropagation();
        if (Date.now() - lastTapAt < 300) return;
        lastTapAt = Date.now();
        state.lastInteraction = lastTapAt;
        applyElapsedTime();
        var action = button.getAttribute("data-jinzhu-action");
        clearScheduler();

        if (action === "pet") {
            state.mood = clamp(state.mood + 5);
            state.bond = clamp(state.bond + 3);
            setStatus("happy");
            say("摸多兩下都可以嘅。");
            finishInteraction(2000);
            window.dispatchEvent(new CustomEvent("jinzhu:interaction", { detail: { action: "pet" } }));
        }

        if (action === "feed") {
            var feedCooldown = debugMode ? 2500 : 15 * 60000;
            if (state.fullness >= 85 || Date.now() - Number(state.lastFed || 0) < feedCooldown) {
                setStatus("idle");
                say("我飽啦。");
                schedule(randomBetween(30, 75) * 1000, chooseNextBehavior);
            } else {
                state.lastFed = Date.now();
                state.fullness = clamp(state.fullness + 30);
                state.mood = clamp(state.mood + 3);
                state.energy = clamp(state.energy + 2);
                pendingEatingDuration = randomBetween(8, 15) * 1000;
                setStatus("eating");
                say("食齋食齋！！🌱🥬");
                finishInteraction(pendingEatingDuration, true);
                window.dispatchEvent(new CustomEvent("jinzhu:interaction", { detail: { action: "feed" } }));
            }
        }

        if (action === "chat") {
            setStatus("idle");
            if (window.JinzhuWorld && window.JinzhuWorld.openChat) window.JinzhuWorld.openChat();
            else say(nextChatReply());
            window.dispatchEvent(new CustomEvent("jinzhu:interaction", { detail: { action: "chat" } }));
        }

        renderStats();
        saveState();
    });

    }

    function markImmersiveInteraction() {
        state.lastInteraction = Date.now();
        applyElapsedTime();
    }

    function notePageActivity(timestamp) {
        state.lastInteraction = Number(timestamp) || Date.now();
    }

    function immersiveLine(category, fallback) {
        if (window.JinzhuWorld && window.JinzhuWorld.getInteractionReply) return window.JinzhuWorld.getInteractionReply(category);
        return fallback;
    }

    function openInteractions(message) {
        notePageActivity(Date.now());
        if (isFormalSleepActive()) wakeFormalSleep(true);
        if (activeNewActionName) {
            say("等我做完先啦。");
            return;
        }
        clearScheduler();
        clearTimeout(panelTimer);
        panel.hidden = false;
        panel.classList.remove("jinzhu-chat-open", "jinzhu-care-open");
        if (window.JinzhuWorld && window.JinzhuWorld.showActions) window.JinzhuWorld.showActions();
        prepareOverlays();
        if (currentStatus !== "sleeping" && currentStatus !== "eating") setStatus("idle");
        say(message || (state.fullness < 25 ? "个饭碗好似空咗喔。" : "想同我玩一阵呀？"));
        panelTimer = setTimeout(function () {
            if (!panel.classList.contains("jinzhu-chat-open") && !panel.classList.contains("jinzhu-care-open")) closeInteractions();
        }, 15000);
    }

    function closeInteractions(skipSchedule) {
        clearTimeout(panelTimer);
        panel.hidden = true;
        panel.classList.remove("jinzhu-chat-open", "jinzhu-care-open");
        if (window.JinzhuWorld && window.JinzhuWorld.closeOverlay) window.JinzhuWorld.closeOverlay();
        if (!skipSchedule && !document.hidden && currentStatus !== "sleeping" && currentStatus !== "eating") {
            schedule(randomBetween(30, 90) * 1000, chooseNextBehavior);
        }
    }

    function stopMovementAndLook() {
        var rect = walker.getBoundingClientRect();
        climbing = false;
        perched = false;
        home.classList.remove("on-clock");
        setPosition({ x: rect.left, y: rect.top }, 0);
        clearScheduler();
        setStatus("look-around");
        say("做咩叫住我呀？");
        schedule(4000, function () { idleFor(45, 100); }, true);
    }

    function startImmersiveRun() {
        clearScheduler();
        tapAwayPending = true;
        clearTimeout(tapAwayTimer);
        tapAwayTimer = setTimeout(function () { tapAwayPending = false; }, 12000);
        if (!debugNoClimb && Math.random() < .35 && startClockAnchor(["clock-perch", "clock-hook", "clock-peek", "colon-sit"][Math.floor(Math.random() * 4)], true)) return;
        var replies = ["我行过嚟睇下你。", "我去第二度坐阵。", "借借，我巡下屋企。", "唔好成日撳我呀。"];
        var duration = scaledDuration(randomBetween(900, 1700));
        setStatus("tap-running");
        say(replies[Math.floor(Math.random() * replies.length)]);
        setPosition(tapRunDestination(), duration);
        schedule(duration + 120, function () {
            var arrivals = ["idle", "look-around", "grooming"];
            var arrival = arrivals[Math.floor(Math.random() * arrivals.length)];
            setStatus(arrival);
            schedule(arrival === "grooming" ? 7000 : 5000, function () { idleFor(45, 120); });
        }, true);
        saveState();
    }

    function petJinzhu() {
        if (isFormalSleepActive()) wakeFormalSleep(true);
        if (activeNewActionName) {
            say("等我做完先啦。");
            return;
        }
        markImmersiveInteraction();
        closeInteractions(true);
        clearScheduler();
        state.mood = clamp(state.mood + 5);
        state.bond = clamp(state.bond + 3);
        if (maybeStartInteractivePlaying("pet")) {
            window.dispatchEvent(new CustomEvent("jinzhu:interaction", { detail: { action: "pet" } }));
            renderStats();
            saveState();
            return;
        }
        setStatus("happy");
        say(immersiveLine("petted", "摸多两下都得嘅。"));
        finishInteraction(2200, true);
        window.dispatchEvent(new CustomEvent("jinzhu:interaction", { detail: { action: "pet" } }));
        renderStats();
        saveState();
    }

    function beginFeeding() {
        if (activeNewActionName) {
            say("等我做完先啦。");
            return;
        }
        markImmersiveInteraction();
        closeInteractions(true);
        clearScheduler();
        var feedCooldown = debugMode ? 2500 : 15 * 60000;
        if (state.fullness >= 85 || Date.now() - Number(state.lastFed || 0) < feedCooldown) {
            setStatus("idle");
            say("我饱啦，留返下一餐先。" );
            schedule(randomBetween(30, 75) * 1000, chooseNextBehavior);
            return;
        }
        feedingPending = true;
        var bounds = getViewportBounds();
        var direction = currentPosition.x < (bounds.minX + bounds.maxX) / 2 ? 1 : -1;
        var bowlPoint = clampPosition({
            x: currentPosition.x + direction * Math.min(100, Math.max(62, window.innerWidth * .16)),
            y: Math.min(bounds.maxY, currentPosition.y + 18)
        });
        var walkDuration = scaledDuration(randomBetween(1.4, 2.2) * 1000);
        setStatus("walking");
        say("个饭碗喺前面，我行过去先。" );
        setPosition(bowlPoint, walkDuration);
        schedule(walkDuration + 120, function () {
            state.lastFed = Date.now();
            state.fullness = clamp(state.fullness + 30);
            state.mood = clamp(state.mood + 3);
            state.energy = clamp(state.energy + 2);
            feedingPending = false;
            pendingEatingDuration = randomBetween(8, 15) * 1000;
            setStatus("eating");
            say(immersiveLine("fed", "开饭啦，唔好望住我食。"));
            finishInteraction(pendingEatingDuration, true);
            window.dispatchEvent(new CustomEvent("jinzhu:interaction", { detail: { action: "feed" } }));
            renderStats();
            saveState();
        }, true);
    }

    function handleImmersiveSingleClick() {
        markImmersiveInteraction();
        if (currentStatus === "walking" || climbing || currentStatus === "climbing" || currentStatus === "climbing-down") {
            if (feedingPending) say("我去食饭呀，等阵先。" );
            else {
                stopMovementAndLook();
                if (maybeStartInteractivePlaying("click")) return;
            }
            return;
        }
        if (currentStatus === "eating") {
            say("食紧呀，等阵先。" );
            return;
        }
        if (isFormalSleepActive()) {
            wakeFormalSleep(false);
            say(routinePeriod() === "night" ? "嗯……我听到。" : "我醒啦。" );
            closeInteractions(true);
            return;
        }
        if (!panel.hidden) {
            closeInteractions();
            return;
        }
        /* Each click must give visible feedback; the follow-up action remains
           varied instead of being locked to the old .70 test value. */
        say(state.fullness < 25 ? "我有少少肚饿呀。" : "我喺度陪你呀。");
        var roll = Math.random();
        if (tapAwayPending) {
            openInteractions();
            return;
        }
        if (maybeStartInteractivePlaying("click")) return;
        if (roll < .60) {
            var lines = state.fullness < 25 ? ["个饭碗好似空咗喔。", "有少少肚饿呀。"] :
                ["我喺度陪你呀。", "今日有冇乖乖饮水？", "我行过嚟睇下你。", "你做你嘅，我坐阵先。", "做咩又搵我呀？"];
            say(lines[Math.floor(Math.random() * lines.length)]);
        } else if (roll < .85) startImmersiveRun();
        else openInteractions();
    }

    function beginLongPress(clientX, clientY) {
        clearTimeout(longPressTimer);
        longPressTriggered = false;
        pressStart = { x: clientX, y: clientY };
        longPressTimer = setTimeout(function () {
            longPressTriggered = true;
            suppressClickUntil = Date.now() + 800;
            openInteractions("我停低啦，想点呀？");
        }, 560);
    }

    function moveLongPress(clientX, clientY) {
        if (!pressStart) return;
        if (Math.abs(clientX - pressStart.x) + Math.abs(clientY - pressStart.y) > 14) {
            clearTimeout(longPressTimer);
            pressStart = null;
        }
    }

    function endLongPress() {
        clearTimeout(longPressTimer);
        pressStart = null;
    }

    if (window.PointerEvent) {
        cat.addEventListener("pointerdown", function (event) { beginLongPress(event.clientX, event.clientY); });
        cat.addEventListener("pointermove", function (event) { moveLongPress(event.clientX, event.clientY); });
        cat.addEventListener("pointerup", endLongPress);
        cat.addEventListener("pointercancel", endLongPress);
    } else {
        cat.addEventListener("touchstart", function (event) { var touch = event.touches[0]; if (touch) beginLongPress(touch.clientX, touch.clientY); }, { passive: true });
        cat.addEventListener("touchmove", function (event) { var touch = event.touches[0]; if (touch) moveLongPress(touch.clientX, touch.clientY); }, { passive: true });
        cat.addEventListener("touchend", endLongPress);
        cat.addEventListener("touchcancel", endLongPress);
    }
    cat.addEventListener("mousedown", function (event) { beginLongPress(event.clientX, event.clientY); });
    cat.addEventListener("mouseup", endLongPress);
    cat.addEventListener("mouseleave", endLongPress);
    if (window.PointerEvent) {
        cat.addEventListener("pointerenter", function (event) {
            if (event.pointerType && event.pointerType !== "mouse") return;
            maybeStartInteractivePlaying("hover");
        });
    } else {
        cat.addEventListener("mouseenter", function () { maybeStartInteractivePlaying("hover"); });
    }
    cat.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        suppressClickUntil = Date.now() + 800;
        openInteractions("我停低啦，想点呀？");
    });

    cat.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (Date.now() < suppressClickUntil || longPressTriggered) {
            longPressTriggered = false;
            return;
        }
        var timestamp = Date.now();
        if (timestamp - lastCatClickAt < 330) {
            clearTimeout(catClickTimer);
            catClickTimer = null;
            lastCatClickAt = 0;
            petJinzhu();
            return;
        }
        lastCatClickAt = timestamp;
        clearTimeout(catClickTimer);
        catClickTimer = setTimeout(function () {
            catClickTimer = null;
            lastCatClickAt = 0;
            handleImmersiveSingleClick();
        }, 300);
    });

    panel.addEventListener("click", function (event) {
        var button = event.target.closest("[data-jinzhu-action]");
        if (!button) return;
        event.stopPropagation();
        if (Date.now() - lastTapAt < 180) return;
        lastTapAt = Date.now();
        var action = button.getAttribute("data-jinzhu-action");
        if (action === "pet") petJinzhu();
        if (action === "feed") beginFeeding();
        if (action === "care" && window.JinzhuWorld && window.JinzhuWorld.openCare) {
            markImmersiveInteraction();
            window.JinzhuWorld.openCare();
        }
    });

    if (window.PointerEvent) {
        document.addEventListener("pointerdown", function () { notePageActivity(Date.now()); }, { passive: true });
    } else {
        document.addEventListener("mousedown", function () { notePageActivity(Date.now()); }, { passive: true });
        document.addEventListener("touchstart", function () { notePageActivity(Date.now()); }, { passive: true });
    }
    document.addEventListener("keydown", function () { notePageActivity(Date.now()); });

    function recalculatePosition() {
        if (clockSleepActive) {
            var sleepGeometry = clockInteractionGeometry(activeClockSide);
            if (!sleepGeometry || !sleepGeometry.topFits) {
                wakeClockSleep(false);
                return;
            }
            setPosition(currentClockSleepAnchor(), 0, false);
        } else if (activeNewActionName) {
            if (activeNewActionName === "jump-clock" && actionMotionFrame !== null) {
                cancelActionMotion();
                activeNewActionName = "lie-clock";
                setStatus("lie-clock");
                scheduleClockSleepTransition();
            }
            if (activeNewActionName === "scratch-digits" && actionMotionFrame !== null) {
                cancelActionMotion();
                beginDigitScratch();
                return;
            }
            if (activeNewActionName === "card-peek" && actionMotionFrame !== null) {
                cancelActionMotion();
                var resizedPeek = cardPeekGeometry(activeCardPeekEdge);
                if (!resizedPeek || !resizedPeek.fits) { finishNewAction(); return; }
                activeCardPeekEdge = resizedPeek.edge;
                home.style.setProperty("--jinzhu-facing", String(resizedPeek.facing));
                setPosition(resizedPeek.peek, 0, false);
                holdThenRetractCardPeek();
                return;
            }
            var activePoint = newActionPoint(activeNewActionName);
            if (!activePoint) { finishNewAction(); return; }
            setPosition(activePoint, 0, false);
            positionLifestyleLayers();
        } else if (clockScratchActive) {
            var scratchPoint = clockScratchPoint();
            if (scratchPoint) setPosition(scratchPoint, 0, false);
            else finishClockScratch();
        } else if (messageAnchorActive) {
            var messageAnchor = messageAnchorPoint(messageAnchorActive);
            if (messageAnchor && messageAnchor.point) setPosition(messageAnchor.point, 0, false);
            else endMessageAnchor();
        } else if (clockAnchorActive) {
            var anchor = clockAnchorPoint(clockAnchorActive);
            if (anchor && anchor.point) setPosition(anchor.point, 0, false);
            else endClockAnchor();
        } else if (climbing) {
            /* The staged climb holds geometry captured before it starts. A
               rotation invalidates those points, so abort this occurrence
               instead of continuing toward stale desktop coordinates. */
            climbing = false;
            clearScheduler();
            home.classList.remove("on-clock");
            setStatus("idle");
            setPosition(clampPosition(currentPosition), 0, false);
            schedule(randomBetween(12, 35) * 1000, chooseNextBehavior);
        } else if (perched) {
            var geometry = clockClimbGeometry();
            if (geometry && geometry.topFits) setPosition(geometry.top, 0);
            else {
                perched = false;
                home.classList.remove("on-clock");
                idleFor(12, 35);
            }
        } else {
            /* Preserve the live pixel position when it is still valid. Rotation
               and narrow-window resize only correct an actual boundary escape. */
            setPosition(clampPosition(currentPosition), 0);
        }
    }

    function handleMotionPreference() {
        clearScheduler();
        recalculatePosition();
        playSprite(currentStatus);
        if (!reduceMotion.matches) schedule(1500, chooseNextBehavior);
    }

    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", handleMotionPreference);
    else if (reduceMotion.addListener) reduceMotion.addListener(handleMotionPreference);

    var layoutRecalcTimer = null;
    var layoutRecalcFrame = null;
    var updateAnchorOverlayAfterLayout = false;

    function queuePositionRecalculation(delay, refreshOverlay) {
        if (document.hidden) return;
        updateAnchorOverlayAfterLayout = updateAnchorOverlayAfterLayout || !!refreshOverlay;
        clearTimeout(layoutRecalcTimer);
        if (layoutRecalcFrame !== null) {
            if (window.cancelAnimationFrame) window.cancelAnimationFrame(layoutRecalcFrame);
            else clearTimeout(layoutRecalcFrame);
            layoutRecalcFrame = null;
        }
        layoutRecalcTimer = setTimeout(function () {
            layoutRecalcTimer = null;
            var run = function () {
                layoutRecalcFrame = null;
                if (document.hidden) return;
                recalculatePosition();
                if (updateAnchorOverlayAfterLayout) updateClockAnchorOverlay();
                updateAnchorOverlayAfterLayout = false;
            };
            if (window.requestAnimationFrame) layoutRecalcFrame = window.requestAnimationFrame(run);
            else run();
        }, Math.max(0, Number(delay) || 0));
    }

    window.addEventListener("resize", function () { queuePositionRecalculation(80, true); });
    window.addEventListener("orientationchange", function () { queuePositionRecalculation(160, true); });
    window.addEventListener("scroll", function () { queuePositionRecalculation(80, false); }, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", function () { queuePositionRecalculation(80, true); });
        window.visualViewport.addEventListener("scroll", function () { queuePositionRecalculation(80, false); });
    }
    /* Dynamic anchors are measured only on layout events, never per frame. */
    if (window.ResizeObserver) {
        var anchorObserver = new ResizeObserver(function () { queuePositionRecalculation(80, true); });
        [".clock", ".message", ".weather-card", ".container"].forEach(function (selector) {
            var target = document.querySelector(selector);
            if (target) anchorObserver.observe(target);
        });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { queuePositionRecalculation(0, true); });
    window.addEventListener("jinzhu:clock-change", function () { queuePositionRecalculation(0, true); });
    window.addEventListener("jinzhu:clock-tick", function (event) {
        var detail = event && event.detail || {};
        var minute = Number(detail.minute), second = Number(detail.second);
        var hourKey = String(detail.hour || "") + ":" + String(minute);
        /* A sleepy, eating, or busy cat is never pulled into this gag.  When
           awake, she only tries it occasionally just before an hour changes. */
        if (minute === 59 && second === 50 && lastScratchWindow !== hourKey) {
            lastScratchWindow = hourKey;
            startClockScratch(false);
        }
    });
    window.addEventListener("jinzhu:clock-flip", function (event) {
        if (pullClockFlip(event && event.detail)) return;
        /* A normal flip almost always stays quiet.  The rare response is
           independently gated by the existing anchor cooldown. */
        if (Math.random() < .025) {
            if (Math.random() < .45) tapColon(false);
            else startClockAnchor("clock-peek", false);
        }
    });

    window.addEventListener("jinzhu:weather", function (event) {
        var previousWasRain = weatherIsRainy(latestWeather);
        var detail = event && event.detail;
        if (!detail || typeof detail !== "object") return;
        latestWeather = detail;
        if (previousWasRain && !weatherIsRainy(latestWeather)) {
            state.lastRainStoppedAt = Date.now();
            saveState();
        }
    });

    document.addEventListener("visibilitychange", function () {
        clearScheduler();
        clearInterval(spriteTimer);
        spriteTimer = null;
        if (document.hidden) {
            if (activeNewActionName === "sunbathe" || activeNewActionName === "cat-grass") {
                clearNewActionLayers();
                setStatus("idle");
            }
            saveState();
            return;
        }
        applyElapsedTime();
        recalculatePosition();
        restoreRoutine();
    });

    window.addEventListener("pagehide", saveState);

    function restoreClockSleep() {
        activeClockSide = state.sleepClockSide === "right" ? "right" :
            state.sleepClockSide === "left" ? "left" : chooseClockSide();
        var geometry = clockInteractionGeometry(activeClockSide);
        if (!geometry || !geometry.topFits) return false;
        clockSleepActive = true;
        activeSleepPose = "clock";
        activeNewActionName = "lie-clock";
        home.classList.add("jinzhu-special-action", "jinzhu-real-clock-action", "jinzhu-clock-sleeping");
        home.style.setProperty("--jinzhu-action-scale", "1.02");

        var stage = state.sleepStage;
        if (!stage) {
            /* Migrate the previous clock sleep, which stored no stage. */
            stage = "prone";
            state.sleepStage = stage;
            state.sleepUntil = Date.now() + randomBetween(8, 15) * 60000;
            state.sleepNextPose = "side";
            state.sleepClockSide = activeClockSide;
            saveState();
        }
        if (stage === "prone-closing") {
            setPosition(clockSleepStagePoint("prone", geometry), 0, false);
            setStatus("clock-prone-closing");
            schedule(spriteDelay("clock-prone-closing") * sprites["clock-prone-closing"].length + 180, enterClockProneSleep, true);
            return true;
        }
        if (stage === "side-transition") {
            setPosition(clockSleepStagePoint("side", geometry), 0, false);
            return enterClockSideSleep();
        }
        if (stage === "curl-transition") {
            setPosition(clockSleepStagePoint("curl", geometry), 0, false);
            return enterClockCurlSleep();
        }
        if (stage === "side") {
            sideSleepActive = true;
            setPosition(clockSleepStagePoint("side", geometry), 0, false);
            setStatus("clock-side-sleeping");
            if (state.sleepUntil > Date.now()) {
                schedule(state.sleepUntil - Date.now(), function () { finishTimedSleep("clock-side"); }, true);
            } else beginClockCurlTransition();
            return true;
        }
        if (stage === "curl") {
            setPosition(clockSleepStagePoint("curl", geometry), 0, false);
            setStatus("clock-curl-sleeping");
            return true;
        }
        state.sleepStage = "prone";
        setPosition(clockSleepStagePoint("prone", geometry), 0, false);
        setStatus("clock-prone-sleeping");
        if (state.sleepUntil > Date.now()) {
            schedule(state.sleepUntil - Date.now(), function () { finishTimedSleep("clock-prone"); }, true);
        } else beginClockSideTransition();
        return true;
    }

    function restoreRoutine() {
        clearScheduler();
        applyElapsedTime();
        renderStats();
        if (activeSleepPose === "clock" && clockSleepActive) {
            if (!restoreClockSleep()) wakeFormalSleep(false);
            return;
        }
        if (activeSleepPose === "side" && sideSleepActive) {
            setStatus("side-sleeping");
            if (state.sleepUntil > Date.now()) {
                schedule(state.sleepUntil - Date.now(), function () { finishTimedSleep("side"); }, true);
            } else {
                wakeFormalSleep(false);
            }
            return;
        }
        if (activeSleepPose === "curl") {
            setStatus("sleeping");
            if (state.sleepUntil > Date.now()) {
                schedule(state.sleepUntil - Date.now(), function () { finishTimedSleep("curl"); }, true);
            } else {
                wakeFormalSleep(false);
            }
            return;
        }
        if (state.sleepPose === "clock") {
            if (restoreClockSleep()) return;
            state.sleepPose = "";
            state.sleepNextPose = "";
            state.sleepStage = "";
            state.sleepClockSide = "";
            state.sleepUntil = 0;
        } else if (state.sleepPose === "side" && state.sleepUntil > Date.now()) {
            activeSleepPose = "side";
            sideSleepActive = true;
            activeNewActionName = "side-sleep";
            home.classList.add("jinzhu-special-action");
            setStatus("side-sleeping");
            schedule(state.sleepUntil - Date.now(), function () { finishTimedSleep("side"); }, true);
            return;
        } else if (state.sleepPose === "curl" && state.sleepUntil > Date.now()) {
            activeSleepPose = "curl";
            setStatus("sleeping");
            schedule(state.sleepUntil - Date.now(), function () { finishTimedSleep("curl"); }, true);
            return;
        }
        if (state.sleepPose && state.sleepUntil <= Date.now()) {
            state.sleepPose = "";
            state.sleepNextPose = "";
            state.sleepStage = "";
            state.sleepClockSide = "";
            state.sleepUntil = 0;
            saveState();
        }
        if (debugMode && debugAction && debugDelayedAction) {
            setStatus("idle");
            schedule(1000, chooseNextBehavior, true);
            return;
        }
        if (debugMode && debugAction) {
            chooseNextBehavior();
            return;
        }
        if (debugHold) {
            setStatus("idle");
            return;
        }
        var period = routinePeriod();
        if (Number(state.sleepUntil || 0) > Date.now() || period === "night") {
            startFormalSleep("", false, false);
        } else if (period === "wind-down") {
            startSleepy();
        } else if (introWalkPending) {
            introWalkPending = false;
            setStatus("look-around");
            schedule(randomBetween(6, 10) * 1000, function () { startWalking(true); });
        } else {
            setStatus("idle");
            schedule(randomBetween(12, 30) * 1000, chooseNextBehavior);
        }
    }

    /* The idle monitor is deliberately outside the scheduler, but it never
       touches sprites or positions itself.  This is the scheduler's single
       gateway for wake/sleep priority. */
    function setExternalIdleLevel(level) {
        if (isFormalSleepActive()) {
            if (level === "awake") {
                state.lastInteraction = Date.now();
                saveState();
            }
            return;
        }
        if (activeNewActionName && level !== "awake") return;
        if (level === "sleep") {
            if (!isFormalSleepActive() && !feedingPending && !reminderActive && currentStatus !== "rain" && currentStatus !== "heat" && currentStatus !== "fan") {
                /* Lifestyle events get the same first chance as chooseNextBehavior. */
                if (tryNaturalLifestyleBehavior()) return;
                startFormalSleep("", false, false);
            }
            return;
        }
        if (level === "deep-sleep") {
            if (!home.classList.contains("jinzhu-deep-sleep")) startDeepSleep();
            return;
        }
        if (level === "drowsy") {
            if (currentStatus === "idle" || currentStatus === "look-around") startSleepy();
            return;
        }
        if (level === "awake") {
            state.lastInteraction = Date.now();
            if (currentStatus === "sleepy") {
                clearScheduler();
                home.classList.remove("jinzhu-deep-sleep");
                setStatus(Math.random() < .5 ? "look-around" : "idle");
                schedule(randomBetween(20, 55) * 1000, chooseNextBehavior);
            }
            saveState();
        }
    }

    window.JinzhuBridge = {
        getStatus: function () { return currentStatus; },
        getState: function () {
            return {
                mood: state.mood, energy: state.energy, fullness: state.fullness, bond: state.bond,
                positionX: state.positionX, positionY: state.positionY, status: currentStatus, lastAction: state.lastAction
            };
        },
        isBusy: function () {
                return feedingPending || currentStatus === "eating" || currentStatus === "happy" || isFormalSleepActive() || currentStatus === "grooming" || currentStatus === "rain" || currentStatus === "heat" || currentStatus === "fan" || climbing || perched || clockScratchActive || !!clockAnchorActive || !!messageAnchorActive || !!activeNewActionName;
        },
        say: say,
        openInteractions: openInteractions,
        closeInteractions: closeInteractions,
        refreshOverlay: prepareOverlays,
        openMenu: openInteractions,
        closeMenu: closeInteractions,
        startClockClimb: function (force) { return startClockClimb(!!force); },
        startClockAnchor: function (kind, force) { return startClockAnchor(kind, !!force); },
        tapColon: function () { return tapColon(false); },
        startClockScratch: function () { return startClockScratch(true); },
        forceMove: function () { state.nextWalkAllowed = 0; startWalking(); },
        playNewAction: function (name) { return playNewAction(name, true); },
        startSunbathe: function () { return startSunbathe(true); },
        startCatGrass: function (reason) { return startCatGrass(true, reason || "test"); },
        startSleepPose: function (pose) { return startFormalSleep(pose, true, false); },
        startInteractivePlaying: function () { return startInteractivePlaying(true, "test"); },
        forcePlayActionForTest: forcePlayActionForTest,
        resumeFreeRoam: function () {
            if (wakeFormalSleep(false)) return;
            clearScheduler();
            clearNewActionLayers();
            setStatus("idle");
            schedule(600, chooseNextBehavior, true);
        },
        requestRain: requestRain,
        requestHeat: requestHeat,
        activateCooling: activateCooling,
        setQuietMode: function (quiet) {
            if (quiet) state.nextWalkAllowed = Date.now() + randomBetween(120, 300) * 1000;
            saveState();
        },
        setOwnerMood: function (mood) { ownerMood = mood || "normal"; },
        setCompanionMode: function (mode) {
            companionMode = mode || "normal";
            if (companionMode === "quiet") state.nextWalkAllowed = Date.now() + randomBetween(180, 360) * 1000;
            saveState();
        },
        setAnimationMode: function (mode) {
            animationMode = mode || "system";
            simpleMotion = lowPowerDevice || animationMode === "simple" || (animationMode === "system" && reduceMotion.matches);
            home.classList.toggle("jinzhu-simple-motion", simpleMotion);
            playSprite(currentStatus);
        },
        setReminder: function (active) {
            reminderActive = !!active;
            if (reminderActive) {
                if (isFormalSleepActive()) wakeFormalSleep(true);
                clearScheduler();
                if (currentStatus !== "eating" && currentStatus !== "sleeping" && currentStatus !== "happy" && currentStatus !== "rain" && currentStatus !== "heat" && currentStatus !== "fan") setStatus("idle");
            } else if (!document.hidden && currentStatus === "idle") {
                schedule(randomBetween(30, 75) * 1000, chooseNextBehavior);
            }
        },
        setIdleLevel: setExternalIdleLevel,
        getIdleSleepDelay: function () { return IDLE_SLEEP_DELAY_MS; },
        noteActivity: function () { setExternalIdleLevel("awake"); },
        startMessageVisit: function (kind) { return startMessageVisit(kind || "message-sit", false); },
        startMessagePat: function () { return startMessagePat(false); }
    };

    if (debugMode) {
        window.JinzhuDebug = {
            forceMove: function () { state.nextWalkAllowed = 0; startWalking(); },
            forceClockState: function (kind) { return startClockAnchor(kind, true); },
            forceClockScratch: function () { return startClockScratch(true); },
            forceClockPull: function () { return pullClockFlip({ card: "hour" }); },
            forceSleep: function () { startSleeping(); },
            forceEat: function () { beginFeeding(); },
            forceIPadFallback: function () { legacyPosition = true; home.classList.add("jinzhu-legacy-position"); setPosition({ x: NaN, y: NaN }, 0); },
            clearCooldowns: function () { state.nextWalkAllowed = 0; state.nextClimbAllowed = 0; saveState(); },
            info: function () { var b = getViewportBounds(); return { status: currentStatus, position: currentPosition, bounds: b, visualViewportFallback: viewportSize().usedFallback, anchor: clockAnchorActive }; }
        };
    }

    var testPanelBox = null;
    var testPanelStorageKey = "jinzhuActionTestPanel";

    function readTestPanelState() {
        try {
            var saved = JSON.parse(sessionStorage.getItem(testPanelStorageKey) || "{}");
            return {
                left: isFinite(Number(saved.left)) ? Number(saved.left) : 12,
                top: isFinite(Number(saved.top)) ? Number(saved.top) : 12,
                collapsed: !!saved.collapsed
            };
        } catch (e) {
            return { left: 12, top: 12, collapsed: false };
        }
    }

    function saveTestPanelState() {
        if (!testPanelBox) return;
        try {
            sessionStorage.setItem(testPanelStorageKey, JSON.stringify({
                left: parseFloat(testPanelBox.style.left) || 0,
                top: parseFloat(testPanelBox.style.top) || 0,
                collapsed: testPanelBox.classList.contains("is-collapsed")
            }));
        } catch (e) {}
    }

    function clampTestPanelPosition() {
        if (!testPanelBox) return;
        var rect = testPanelBox.getBoundingClientRect();
        var left = Math.max(8, Math.min(window.innerWidth - rect.width - 8, parseFloat(testPanelBox.style.left) || 8));
        var top = Math.max(8, Math.min(window.innerHeight - rect.height - 8, parseFloat(testPanelBox.style.top) || 8));
        testPanelBox.style.left = Math.round(left) + "px";
        testPanelBox.style.top = Math.round(top) + "px";
    }

    function setTestPanelCollapsed(collapsed) {
        if (!testPanelBox) return;
        testPanelBox.classList.toggle("is-collapsed", !!collapsed);
        var toggle = testPanelBox.querySelector("[data-test-panel-toggle]");
        if (toggle) {
            toggle.textContent = collapsed ? "展開" : "收起";
            toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
        }
        clampTestPanelPosition();
        saveTestPanelState();
    }

    function parkTestPanelAwayFrom(element) {
        if (!testPanelBox) return;
        setTestPanelCollapsed(true);
        if (!element) return;
        var targetRect = element.getBoundingClientRect();
        var panelRect = testPanelBox.getBoundingClientRect();
        var targetIsLeft = targetRect.left + targetRect.width / 2 < window.innerWidth / 2;
        var targetIsTop = targetRect.top + targetRect.height / 2 < window.innerHeight / 2;
        testPanelBox.style.left = Math.round(targetIsLeft ? window.innerWidth - panelRect.width - 8 : 8) + "px";
        testPanelBox.style.top = Math.round(targetIsTop ? window.innerHeight - panelRect.height - 8 : 8) + "px";
        clampTestPanelPosition();
        saveTestPanelState();
    }

    function installActionTestPanel() {
        if (!actionTestMode) return;
        var box = document.createElement("section");
        box.className = "jinzhu-action-test";
        box.innerHTML = "<div class=\"jinzhu-action-test-header\" data-test-panel-drag><b>金主動作測試</b><button type=\"button\" data-test-panel-toggle aria-expanded=\"true\">收起</button></div><div class=\"jinzhu-action-test-content\"></div>";
        testPanelBox = box;
        var content = box.querySelector(".jinzhu-action-test-content");
        var actions = [["自由隨機走動", "move"], ["向左走", "left"], ["向右走", "right"], ["回頭", "turn"], ["伸懶腰", "stretch"], ["趴低", "crouch"], ["翻滾／玩耍", "interactive-playing"], ["蜷縮睡", "curl-sleep"], ["側睡", "side-sleep"], ["抬頭看時鐘", "look-clock"], ["卡片後探頭", "card-peek"], ["前爪搭住留言板", "paw-rest-message"], ["前爪搭住天氣卡", "paw-rest-weather"], ["拍一下", "paw-tap"], ["磨抓數字", "scratch-digits"], ["跳上時鐘", "jump-clock"], ["趴在時鐘上睡", "lie-clock"], ["曬太陽", "sunbathe"], ["食貓草", "cat-grass"], ["模擬雨停後長出貓草", "rain-stop-grass"], ["恢復日常自由活動", "resume"]];
        actions.forEach(function (item) { var button = document.createElement("button"); button.type = "button"; button.textContent = item[0]; button.setAttribute("data-action", item[1]); content.appendChild(button); });
        box.addEventListener("click", function (event) {
            if (event.target.closest("[data-test-panel-toggle]")) {
                setTestPanelCollapsed(!box.classList.contains("is-collapsed"));
                return;
            }
            var action = event.target.getAttribute("data-action");
            if (!action) return;
            if (action === "resume") return window.JinzhuBridge.resumeFreeRoam();
            if (action === "sunbathe") return window.JinzhuBridge.startSunbathe();
            if (action === "cat-grass") return window.JinzhuBridge.startCatGrass("test");
            if (action === "rain-stop-grass") return window.JinzhuBridge.startCatGrass("rain-stop-test");
            if (action === "curl-sleep") return window.JinzhuBridge.startSleepPose("curl");
            if (action === "side-sleep") return window.JinzhuBridge.startSleepPose("side");
            if (action === "lie-clock") return window.JinzhuBridge.startSleepPose("clock");
            if (action === "interactive-playing") {
                event.preventDefault();
                event.stopPropagation();
                testPlayingLog("playing button clicked");
                return window.JinzhuBridge.forcePlayActionForTest("playing");
            }
            if (action === "move") { clearNewActionLayers(); return window.JinzhuBridge.forceMove(); }
            if (action === "left" || action === "right") {
                clearScheduler();
                clearNewActionLayers();
                var b = getViewportBounds();
                setStatus("walking");
                setPosition({ x: action === "left" ? b.minX : b.maxX, y: randomBetween(b.minY, b.maxY) }, 1200);
                schedule(1500, function () { idleFor(12, 35); }, true);
                return;
            }
            window.JinzhuBridge.playNewAction(action);
        });
        document.body.appendChild(box);
        var state = readTestPanelState();
        box.style.left = state.left + "px";
        box.style.top = state.top + "px";
        setTestPanelCollapsed(state.collapsed || viewportSize().width <= 720);

        var handle = box.querySelector("[data-test-panel-drag]");
        var drag = null;
        handle.addEventListener("pointerdown", function (event) {
            if (event.target.closest("button")) return;
            var rect = box.getBoundingClientRect();
            drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
            box.classList.add("is-dragging");
            if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);
            event.preventDefault();
        });
        window.addEventListener("pointermove", function (event) {
            if (!drag) return;
            box.style.left = drag.left + event.clientX - drag.x + "px";
            box.style.top = drag.top + event.clientY - drag.y + "px";
            clampTestPanelPosition();
        });
        window.addEventListener("pointerup", function () {
            if (!drag) return;
            drag = null;
            box.classList.remove("is-dragging");
            saveTestPanelState();
        });
        window.addEventListener("pointercancel", function () {
            if (!drag) return;
            drag = null;
            box.classList.remove("is-dragging");
            saveTestPanelState();
        });
        window.addEventListener("resize", function () {
            if (viewportSize().width <= 720 && !box.classList.contains("is-collapsed")) {
                setTestPanelCollapsed(true);
                return;
            }
            clampTestPanelPosition();
            saveTestPanelState();
        });
    }

    catImage.addEventListener("error", function () {
        if (catImage.getAttribute("src") !== spriteBase + "idle-1.png") catImage.src = spriteBase + "idle-1.png";
    });
    home.classList.toggle("jinzhu-simple-motion", simpleMotion);

    renderStats();
    installActionTestPanel();
    setPosition(restoredPosition(), 0, false);
    restoreRoutine();
    if (debugOpenPanel) setTimeout(function () { openInteractions("调试互动选项"); }, 60);
})();
