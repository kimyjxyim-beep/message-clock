/* Low-cost activity monitor.  It only requests state changes through
   JinzhuBridge, so the routine remains the sole animation/position owner. */
(function initJinzhuIdle() {
    "use strict";
    var lastActivity = Date.now();
    var level = "awake";
    var timer = null;
    var checkEvery = 30000;

    function bridge() { return window.JinzhuBridge; }
    function request(next) {
        if (next === level) return;
        level = next;
        var api = bridge();
        if (api && api.setIdleLevel) api.setIdleLevel(next);
        window.dispatchEvent(new CustomEvent("jinzhu:idle", { detail: { level: next, idleFor: Date.now() - lastActivity } }));
    }
    function check() {
        if (document.hidden) return;
        var idleFor = Date.now() - lastActivity;
        if (idleFor >= 8 * 60 * 1000) request("sleep");
        else if (idleFor >= 2 * 60 * 1000) request("drowsy");
        else request("awake");
    }
    function activity() {
        lastActivity = Date.now();
        request("awake");
        var api = bridge();
        if (api && api.noteActivity) api.noteActivity();
    }
    ["pointerdown", "keydown", "touchstart", "scroll", "focus"].forEach(function (name) {
        window.addEventListener(name, activity, { passive: name !== "keydown" });
    });
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) activity();
    });
    timer = setInterval(check, checkEvery);
    check();
}());
