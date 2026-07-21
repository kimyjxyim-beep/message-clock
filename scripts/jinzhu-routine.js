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
    var reminderActive = false;
    var ownerMood = "normal";
    var companionMode = "normal";
    var animationMode = "system";
    var oldIPad = /iPad.*OS (?:[1-9]|10)_/i.test(navigator.userAgent || "");
    var lowPowerDevice = oldIPad || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    var simpleMotion = lowPowerDevice;
    var climbing = false;
    var perched = false;
    var clockAnchorActive = "";
    var clockAnchorTimer = null;
    var spriteBase = "assets/jinzhu/";
    var behaviorClasses = [
        "sleeping", "sleepy", "idle", "look-around", "grooming",
        "walking", "tap-running", "playing", "eating", "happy", "rain", "heat", "fan",
        "climbing", "perched", "climbing-down", "clock-perch", "clock-hook", "clock-nap", "clock-peek", "colon-sit"
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
        "colon-sit": ["idle-1.png", "idle-2.png"]
    };
    var spriteSpeeds = {
        idle: 1100, walking: 145, "tap-running": 92, "look-around": 700, grooming: 760,
        playing: 420, happy: 330, eating: 620, sleepy: 1800, sleeping: 3200, rain: 1100, fan: 620,
        climbing: 620, perched: 2200, "climbing-down": 680,
        "clock-perch": 2200, "clock-hook": 750, "clock-nap": 3200, "clock-peek": 2000, "colon-sit": 1800
    };
    var now = Date.now();
    var state = {
        mood: 72,
        energy: 68,
        fullness: 76,
        bond: 40,
        lastInteraction: now,
        lastUpdated: now,
        lastFed: 0,
        nextWalkAllowed: now,
        nextClimbAllowed: now,
        sleepUntil: 0,
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

    (lowPowerDevice ? ["idle", "walking"] : Object.keys(sprites)).forEach(function (name) {
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
        if (simpleMotion && status !== "walking" && status !== "tap-running" && status !== "climbing" && status !== "climbing-down" && status !== "eating") return;
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
        }, spriteSpeeds[status] || 800);
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

    function say(text, persistent) {
        prepareOverlays();
        var spaceOnRight = window.innerWidth - (currentPosition.x + walker.offsetWidth);
        var bubbleWidth = Math.min(window.innerWidth - 16, window.innerWidth <= 600 ? 180 : 210);
        var spaceOnLeft = currentPosition.x;
        var useRight = spaceOnRight >= bubbleWidth + 8;
        var useLeft = !useRight && spaceOnLeft >= bubbleWidth + 8;
        home.classList.toggle("bubble-right", useRight);
        home.classList.toggle("bubble-left", useLeft);
        home.classList.toggle("bubble-above", !useRight && !useLeft);
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
        return { width: Math.max(320, width), height: Math.max(320, height), usedFallback: !(vv && isFinite(Number(vv.width)) && isFinite(Number(vv.height))) };
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
        return {
            minX: 8,
            maxX: Math.max(24, viewport.width - petWidth - 8),
            minY: safeTop,
            maxY: Math.max(safeTop + 24, viewport.height - petHeight - safeBottom - 8)
        };
    }

    function overlaps(a, b, margin) {
        return !(a.right + margin <= b.left || a.left - margin >= b.right ||
            a.bottom + margin <= b.top || a.top - margin >= b.bottom);
    }

    function clampPosition(position) {
        var bounds = getViewportBounds();
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

    function setPosition(position, duration, persist) {
        var safe = clampPosition(position);
        if (safe.x < currentPosition.x) home.style.setProperty("--jinzhu-facing", "-1");
        if (safe.x > currentPosition.x) home.style.setProperty("--jinzhu-facing", "1");
        home.style.setProperty("--jinzhu-walk-duration", duration + "ms");
        home.style.setProperty("--jinzhu-x", Math.round(safe.x) + "px");
        home.style.setProperty("--jinzhu-y", Math.round(safe.y) + "px");
        // iPad mini 1 / iOS 9 does not support CSS custom properties. Keep a
        // direct left/top fallback so the pet is not stuck at (0, 0).
        if (!legacyPosition) {
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
        var bounds = getViewportBounds();
        state.positionX = bounds.maxX > bounds.minX ? (safe.x - bounds.minX) / (bounds.maxX - bounds.minX) : 0;
        state.positionY = bounds.maxY > bounds.minY ? (safe.y - bounds.minY) / (bounds.maxY - bounds.minY) : 0;
        if (persist !== false) saveState();
        window.dispatchEvent(new CustomEvent("jinzhu:position", { detail: { x: safe.x, y: safe.y } }));
    }

    function restoredPosition() {
        var bounds = getViewportBounds();
        return clampPosition({
            x: bounds.minX + clamp(Number(state.positionX) * 100) / 100 * (bounds.maxX - bounds.minX),
            y: bounds.minY + clamp(Number(state.positionY) * 100) / 100 * (bounds.maxY - bounds.minY)
        });
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

    function pointNear(selector, side) {
        var element = document.querySelector(selector);
        if (!element) return null;
        var rect = visibleRect(element);
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
        var names = Object.keys(points).filter(function (name) { return points[name]; });
        var candidate;
        if (Math.random() < .76) {
            candidate = points[names[Math.floor(Math.random() * names.length)]];
        } else {
            candidate = { x: randomBetween(b.minX, b.maxX), y: randomBetween(b.minY, b.maxY) };
        }
        if (Math.abs(candidate.x - currentPosition.x) + Math.abs(candidate.y - currentPosition.y) < 45) {
            candidate = points[names[(names.indexOf(debugPoint) + 5 + Math.floor(Math.random() * names.length)) % names.length]];
        }
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
        var w = walker.offsetWidth || 116;
        var h = walker.offsetHeight || 116;
        var bounds = getViewportBounds();
        var perchScale = Math.max(.70, Math.min(1, (rect.top - bounds.minY + 14) / h));
        home.style.setProperty("--jinzhu-perch-scale", perchScale.toFixed(3));
        var useLeft = currentPosition.x < rect.left + rect.width / 2;
        var edgeX = useLeft ? rect.left - w * .38 : rect.right - w * .62;
        return {
            base: clampPosition({ x: edgeX, y: rect.bottom - h * .32 }),
            edge: clampPosition({ x: edgeX, y: rect.top + rect.height * .32 }),
            top: clampPosition({ x: useLeft ? rect.left + 8 : rect.right - w - 8, y: rect.top - h + 14 }),
            landing: clampPosition({ x: useLeft ? rect.left - w - 12 : rect.right + 12, y: rect.bottom - h * .18 }),
            facing: useLeft ? 1 : -1
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
        if (!points.length) return pointOnTop(".clock");
        var choices = points.filter(function (item) { return item.name !== "colon"; });
        var target = choices[Math.floor(Math.random() * choices.length)] || points[0];
        if (kind === "clock-hook") {
            var hooks = choices.filter(function (item) { return "0689".indexOf(item.digit) >= 0; });
            target = hooks.length ? hooks[Math.floor(Math.random() * hooks.length)] : choices[0];
        } else if (kind === "colon-sit") {
            for (var c = 0; c < points.length; c++) if (points[c].name === "colon") target = points[c];
        }
        if (!target || !target.rect) return pointOnTop(".clock");
        var rect = target.rect, point;
        if (kind === "clock-hook") point = { x: rect.left + rect.width * .48 - w * .5, y: rect.top + rect.height * .19 - h * .28 };
        else if (kind === "clock-peek") point = { x: rect.right - w * .18, y: rect.top + rect.height * .17 - h * .14 };
        else if (kind === "colon-sit") point = { x: rect.left + rect.width * .5 - w * .5, y: rect.top + rect.height * .45 - h * .25 };
        else point = { x: rect.left + rect.width * .5 - w * .5, y: rect.top - h * .63 };
        return { point: clampPosition(point), target: target };
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

    function endClockAnchor() {
        clearTimeout(clockAnchorTimer);
        clockAnchorTimer = null;
        clockAnchorActive = "";
        home.classList.remove("on-clock");
        home.style.removeProperty("--jinzhu-perch-scale");
        setStatus("idle");
        schedule(randomBetween(45, 120) * 1000, chooseNextBehavior);
    }

    function startClockAnchor(kind, force) {
        if (!force && (Date.now() < Number(state.nextClimbAllowed || 0) || reminderActive || panel.hidden === false || reduceMotion.matches)) return false;
        if (feedingPending || currentStatus === "eating" || currentStatus === "rain" || currentStatus === "fan") return false;
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
        if (!geometry) {
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
        if (climbing || perched || reduceMotion.matches || simpleMotion || reminderActive || panel.hidden === false) return false;
        if (!force && Date.now() < Number(state.nextClimbAllowed || 0)) return false;
        var geometry = clockClimbGeometry();
        if (!geometry) return false;
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
        var desiredPanelWidth = panel.classList.contains("jinzhu-chat-open") ? 320 : panel.classList.contains("jinzhu-care-open") ? 276 : 278;
        var panelHalf = Math.min(desiredPanelWidth / 2, (window.innerWidth - 16) / 2);
        var centeredX = Math.max(panelHalf + 8, Math.min(window.innerWidth - panelHalf - 8,
            currentPosition.x + (walker.offsetWidth || 116) / 2));
        if (!panel.hidden) setPosition({ x: centeredX - (walker.offsetWidth || 116) / 2, y: currentPosition.y }, 0, false);
        var panelHeight = panel.hidden ? 132 : Math.min(panel.scrollHeight || panel.offsetHeight || 240, window.innerHeight * .68);
        var overlayBottomGap = window.innerWidth <= 600 ? 36 : 8;
        home.classList.toggle("panel-above", currentPosition.y + (walker.offsetHeight || 116) + panelHeight > window.innerHeight - overlayBottomGap);
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

    function startSleeping() {
        var period = routinePeriod();
        var minutes = period === "night" ? randomBetween(25, 90) : randomBetween(3, 10);
        state.sleepUntil = Date.now() + minutes * 60000;
        setStatus("sleeping");
        if (Math.random() < .22 || debugMode) say("zzZ", true);
        schedule(minutes * 60000, function () {
            state.sleepUntil = 0;
            setStatus(period === "night" || period === "wind-down" ? "sleepy" : "idle");
            schedule(randomBetween(30, 90) * 1000, chooseNextBehavior);
        });
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

    function startPlaying() {
        if (state.energy < 25 || state.fullness < 20) {
            idleFor(45, 100);
            return;
        }
        state.energy = clamp(state.energy - 2);
        setStatus("playing");
        schedule(randomBetween(5, 10) * 1000, function () { idleFor(45, 120); });
    }

    function startRainWatching() {
        if (!rainActive || currentStatus === "sleeping" || currentStatus === "eating" || currentStatus === "happy") return false;
        clearScheduler();
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
        return startRainWatching();
    }

    function requestHeat(active) {
        if (!active) {
            if (currentStatus === "heat") idleFor(30, 75);
            return true;
        }
        if (currentStatus === "sleeping" || currentStatus === "eating" || currentStatus === "happy" || currentStatus === "rain" || currentStatus === "grooming") return false;
        clearScheduler();
        setStatus("heat");
        return true;
    }

    function activateCooling(kind) {
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
        if (action === "sleeping") startSleeping();
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
        if (rainActive && Math.random() < .18 && startRainWatching()) return;
        var action = weightedChoice(behaviorWeights());
        if (companionMode === "quiet" && (action === "walking" || action === "playing")) action = "idle";
        if (companionMode === "strict" && action === "idle" && Math.random() < .35) action = "look-around";
        if ((ownerMood === "tired" || ownerMood === "annoyed" || ownerMood === "private") && (action === "walking" || action === "playing")) action = "idle";
        if (ownerMood === "happy" && (routinePeriod() === "morning" || routinePeriod() === "evening") && action === "idle" && Math.random() < .35) action = "playing";
        if (state.fullness < 18 && (action === "playing" || action === "walking")) action = "idle";
        if (action === "sleeping") startSleeping();
        else if (action === "sleepy") startSleepy();
        else if (action === "look-around") startLookAround();
        else if (action === "grooming") startGrooming();
        else if (action === "walking") {
            if (Math.random() < .08 && startClockAnchor(routinePeriod() === "night" ? "clock-nap" : ["clock-perch", "clock-hook", "clock-peek", "colon-sit"][Math.floor(Math.random() * 4)], false)) return;
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
        if (currentStatus === "sleeping") {
            clearScheduler();
            setStatus("sleepy");
            say(routinePeriod() === "night" ? "嗯…我聽到。" : "我醒啦。");
            panel.hidden = true;
            finishInteraction(routinePeriod() === "night" ? 20000 : 5000);
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

    function immersiveLine(category, fallback) {
        if (window.JinzhuWorld && window.JinzhuWorld.getInteractionReply) return window.JinzhuWorld.getInteractionReply(category);
        return fallback;
    }

    function openInteractions(message) {
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
        markImmersiveInteraction();
        closeInteractions(true);
        clearScheduler();
        state.mood = clamp(state.mood + 5);
        state.bond = clamp(state.bond + 3);
        setStatus("happy");
        say(immersiveLine("petted", "摸多两下都得嘅。"));
        finishInteraction(2200, true);
        window.dispatchEvent(new CustomEvent("jinzhu:interaction", { detail: { action: "pet" } }));
        renderStats();
        saveState();
    }

    function beginFeeding() {
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
            else stopMovementAndLook();
            return;
        }
        if (currentStatus === "eating") {
            say("食紧呀，等阵先。" );
            return;
        }
        if (currentStatus === "sleeping") {
            clearScheduler();
            setStatus("sleepy");
            say(routinePeriod() === "night" ? "嗯……我听到。" : "我醒啦。" );
            closeInteractions(true);
            finishInteraction(routinePeriod() === "night" ? 20000 : 5000);
            return;
        }
        if (!panel.hidden) {
            closeInteractions();
            return;
        }
        var roll = .70;
        if (tapAwayPending) {
            openInteractions();
            return;
        }
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

    function recalculatePosition() {
        if (clockAnchorActive) {
            var anchor = clockAnchorPoint(clockAnchorActive);
            if (anchor && anchor.point) setPosition(anchor.point, 0, false);
            else endClockAnchor();
        } else if (perched) {
            var geometry = clockClimbGeometry();
            if (geometry) setPosition(geometry.top, 0);
        } else setPosition(restoredPosition(), 0);
    }

    function handleMotionPreference() {
        clearScheduler();
        recalculatePosition();
        playSprite(currentStatus);
        if (!reduceMotion.matches) schedule(1500, chooseNextBehavior);
    }

    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", handleMotionPreference);
    else if (reduceMotion.addListener) reduceMotion.addListener(handleMotionPreference);

    window.addEventListener("resize", recalculatePosition);
    window.addEventListener("orientationchange", function () { setTimeout(recalculatePosition, 120); });
    window.addEventListener("scroll", recalculatePosition, { passive: true });
    window.addEventListener("jinzhu:clock-change", function () { recalculatePosition(); updateClockAnchorOverlay(); });

    document.addEventListener("visibilitychange", function () {
        clearScheduler();
        clearInterval(spriteTimer);
        spriteTimer = null;
        if (document.hidden) {
            saveState();
            return;
        }
        applyElapsedTime();
        recalculatePosition();
        restoreRoutine();
    });

    window.addEventListener("pagehide", saveState);

    function restoreRoutine() {
        clearScheduler();
        applyElapsedTime();
        renderStats();
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
            startSleeping();
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

    window.JinzhuBridge = {
        getStatus: function () { return currentStatus; },
        getState: function () {
            return {
                mood: state.mood, energy: state.energy, fullness: state.fullness, bond: state.bond,
                positionX: state.positionX, positionY: state.positionY, status: currentStatus, lastAction: state.lastAction
            };
        },
        isBusy: function () {
                return feedingPending || currentStatus === "eating" || currentStatus === "happy" || currentStatus === "sleeping" || currentStatus === "grooming" || currentStatus === "rain" || currentStatus === "fan" || climbing || perched;
        },
        say: say,
        openInteractions: openInteractions,
        closeInteractions: closeInteractions,
        refreshOverlay: prepareOverlays,
        openMenu: openInteractions,
        closeMenu: closeInteractions,
        startClockClimb: function () { state.nextClimbAllowed = 0; return startClockClimb(true); },
        startClockAnchor: function (kind) { return startClockAnchor(kind, true); },
        forceMove: function () { state.nextWalkAllowed = 0; startWalking(); },
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
                clearScheduler();
                if (currentStatus !== "eating" && currentStatus !== "sleeping" && currentStatus !== "happy" && currentStatus !== "rain" && currentStatus !== "heat" && currentStatus !== "fan") setStatus("idle");
            } else if (!document.hidden && currentStatus === "idle") {
                schedule(randomBetween(30, 75) * 1000, chooseNextBehavior);
            }
        }
    };

    if (debugMode) {
        window.JinzhuDebug = {
            forceMove: function () { state.nextWalkAllowed = 0; startWalking(); },
            forceClockState: function (kind) { return startClockAnchor(kind, true); },
            forceSleep: function () { startSleeping(); },
            forceEat: function () { beginFeeding(); },
            forceIPadFallback: function () { legacyPosition = true; home.classList.add("jinzhu-legacy-position"); setPosition({ x: NaN, y: NaN }, 0); },
            clearCooldowns: function () { state.nextWalkAllowed = 0; state.nextClimbAllowed = 0; saveState(); },
            info: function () { var b = getViewportBounds(); return { status: currentStatus, position: currentPosition, bounds: b, visualViewportFallback: viewportSize().usedFallback, anchor: clockAnchorActive }; }
        };
    }

    catImage.addEventListener("error", function () {
        if (catImage.getAttribute("src") !== spriteBase + "idle-1.png") catImage.src = spriteBase + "idle-1.png";
    });
    home.classList.toggle("jinzhu-simple-motion", simpleMotion);

    renderStats();
    setPosition(restoredPosition(), 0, false);
    restoreRoutine();
    if (debugOpenPanel) setTimeout(function () { openInteractions("调试互动选项"); }, 60);
})();
