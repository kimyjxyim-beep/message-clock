/* Persistent, weighted Easter-egg pool.  The pool asks the existing routine
   to perform actions; it never changes Jinzhu's DOM, sprite or coordinates. */
(function initJinzhuEasterEggs() {
    "use strict";
    var key = "jinzhu_stage2_eggs_v1";
    var memory = { cooldowns: {}, recent: [], daily: { day: "", large: 0 } };
    try { memory = Object.assign(memory, JSON.parse(localStorage.getItem(key)) || {}); } catch (e) {}
    function save() { try { localStorage.setItem(key, JSON.stringify(memory)); } catch (e) {} }
    function now() { return Date.now(); }
    function today() { return new Date().toISOString().slice(0, 10); }
    function ready(item) {
        if (memory.daily.day !== today()) memory.daily = { day: today(), large: 0 };
        if (item.level === "large" && memory.daily.large >= 2) return false;
        if ((memory.cooldowns[item.id] || 0) > now()) return false;
        return memory.recent.indexOf(item.id) < 0;
    }
    function choose(items) {
        var total = items.reduce(function (sum, item) { return sum + item.weight; }, 0);
        var roll = Math.random() * total;
        for (var i = 0; i < items.length; i++) { roll -= items[i].weight; if (roll <= 0) return items[i]; }
        return items[items.length - 1];
    }
    function hourEvent() {
        var d = new Date(), text = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
        return text === "11:11" || text === "22:22" || text === "00:00" || d.getMinutes() === 0;
    }
    function pool() {
        var weather = document.documentElement.getAttribute("data-weather-condition") || "cloudy";
        return [
            { id: "clock-peek", level: "small", weight: weather === "night" ? 4 : 2, cooldown: 5 * 60000, run: function (b) { return b.startClockAnchor("clock-peek"); } },
            { id: "message-peek", level: "small", weight: 2, cooldown: 6 * 60000, run: function (b) { return b.startMessageVisit("message-peek"); } },
            { id: "colon-tap", level: "medium", weight: 2, cooldown: 20 * 60000, run: function (b) { return b.tapColon && b.tapColon(); } },
            { id: "clock-perch", level: "medium", weight: weather === "rain" ? 1 : 2, cooldown: 25 * 60000, run: function (b) { return b.startClockAnchor("clock-perch"); } },
            { id: "message-paw", level: "medium", weight: 2, cooldown: 30 * 60000, run: function (b) { return b.startMessagePat(); } },
            { id: "clock-climb", level: "large", weight: hourEvent() ? 3 : 1, cooldown: 2 * 60 * 60000, run: function (b) { return b.startClockClimb && b.startClockClimb(false); } }
        ];
    }
    function tick() {
        if (document.hidden || Math.random() > 0.18) return; // mostly stay quiet
        var b = window.JinzhuBridge;
        if (!b || (b.isBusy && b.isBusy())) return;
        var state = b.getState ? b.getState() : {};
        if (state.status === "sleeping" || state.status === "sleepy") return;
        var candidates = pool().filter(ready);
        if (!candidates.length) return;
        var item = choose(candidates);
        if (!item.run(b)) return;
        memory.cooldowns[item.id] = now() + item.cooldown;
        memory.recent = [item.id].concat(memory.recent.filter(function (id) { return id !== item.id; })).slice(0, 3);
        if (item.level === "large") memory.daily.large++;
        save();
    }
    var timer = null;
    function startTimer() {
        clearInterval(timer);
        timer = setInterval(tick, 3 * 60 * 1000);
    }
    window.addEventListener("jinzhu:idle", function (event) {
        if (event && event.detail && event.detail.level !== "awake") return;
        setTimeout(tick, 1500);
    });
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            clearInterval(timer);
            timer = null;
            return;
        }
        startTimer();
        setTimeout(tick, 8000);
    });
    startTimer();
}());
