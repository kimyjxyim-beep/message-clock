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
        var api = bridge();
        /* Re-offer sleep on later checks: a higher-priority lifestyle event
           may have consumed the first request and restarted the five-minute
           eligibility window inside the routine. */
        if (next === level) {
            if (next === "sleep" && api && api.setIdleLevel) api.setIdleLevel(next);
            return;
        }
        level = next;
        if (api && api.setIdleLevel) api.setIdleLevel(next);
        window.dispatchEvent(new CustomEvent("jinzhu:idle", { detail: { level: next, idleFor: Date.now() - lastActivity } }));
    }
    function check() {
        if (document.hidden) return;
        var api = bridge();
        if (!api || !api.getIdleSleepDelay) return;
        var idleFor = Date.now() - lastActivity;
        if (idleFor >= api.getIdleSleepDelay()) request("sleep");
        else if (idleFor >= 2 * 60 * 1000) request("drowsy");
        else request("awake");
    }
    function activity() {
        lastActivity = Date.now();
        request("awake");
        var api = bridge();
        if (api && api.noteActivity) api.noteActivity();
    }
    if (window.PointerEvent) window.addEventListener("pointerdown", activity, { passive: true });
    else {
        window.addEventListener("mousedown", activity, { passive: true });
        window.addEventListener("touchstart", activity, { passive: true });
    }
    window.addEventListener("keydown", activity);
    function startTimer() {
        clearInterval(timer);
        timer = setInterval(check, checkEvery);
    }
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            clearInterval(timer);
            timer = null;
            return;
        }
        startTimer();
        check();
    });
    startTimer();
    check();
}());
