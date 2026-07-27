/* 游標與觸控注意力（第八節）。
   刻意跟 jinzhu-routine.js 的行為排程器分開：這裡只疊加一個裝飾性的
   傾斜/縮放效果（透過 CSS 變數），從不呼叫 setStatus 或 setPosition，
   所以不會跟時鐘/留言板互動搶奪金主的位置或狀態。 */
(function initJinzhuAttention() {
    "use strict";

    var home = document.getElementById("jinzhu-home");
    var walker = document.getElementById("jinzhu-walker");
    if (!home || !walker) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    // 這些狀態下金主正在忙（睡覺/爬時鐘/吃嘢...），注意力效果讓路
    var busyStatuses = {
        sleeping: 1, "sleepy": 0, eating: 1, climbing: 1, "climbing-down": 1,
        perched: 1, "clock-perch": 1, "clock-hook": 1, "clock-nap": 1, "clock-peek": 1,
        "colon-sit": 1, "clock-scratching": 1, "clock-flip-pull": 1,
        "message-sit": 1, "message-peek": 1, "message-paw": 1, rain: 1, heat: 1, fan: 1, happy: 1
    };

    function busy() {
        if (window.JinzhuBridge && window.JinzhuBridge.isBusy && window.JinzhuBridge.isBusy()) return true;
        var status = window.JinzhuBridge && window.JinzhuBridge.getStatus ? window.JinzhuBridge.getStatus() : "idle";
        return !!busyStatuses[status];
    }

    var ATTENTION_RADIUS = 190; // 游標/觸控進入這個範圍才算「察覺」
    var HUNT_RADIUS = 90;       // 更近、且移動夠快才會有「捕獵反應」

    var level = "none"; // none | aware | watching | hunting
    var lastPointer = { x: -9999, y: -9999, t: 0 };
    var lastSpeed = 0;
    var cooldownUntil = 0;
    var throttled = false;

    function setTilt(deg, scale) {
        home.style.setProperty("--jinzhu-attn-tilt", deg + "deg");
        home.style.setProperty("--jinzhu-attn-scale", scale);
    }

    function clearTilt() {
        home.style.removeProperty("--jinzhu-attn-tilt");
        home.style.removeProperty("--jinzhu-attn-scale");
    }

    function setLevel(next) {
        if (next === level) return;
        level = next;
        if (level === "none") { clearTilt(); return; }
        if (level === "aware") { setTilt(-3, 1); return; }
        if (level === "watching") { setTilt(4, 1.015); return; }
        if (level === "hunting") {
            setTilt(6, 1.06);
            // 撲擊反應：短促的一下，之後自動退回 watching
            setTimeout(function () {
                if (level === "hunting") setLevel("watching");
            }, 260);
        }
    }

    function evaluate(px, py, fast) {
        if (busy() || Date.now() < cooldownUntil) { setLevel("none"); return; }
        var rect = walker.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dist = Math.hypot(px - cx, py - cy);

        if (dist > ATTENTION_RADIUS) { setLevel("none"); return; }
        if (dist > HUNT_RADIUS) { setLevel(Math.random() < 0.5 ? "aware" : "watching"); return; }

        // 夠近且移動夠快：低機率觸發一次捕獵反應，不是每次都撲
        if (fast && Math.random() < 0.12) {
            setLevel("hunting");
            cooldownUntil = Date.now() + 8000; // 冷靜一段時間先再有反應，唔會一直撲
            return;
        }
        setLevel("watching");
    }

    function handlePointerMove(x, y) {
        var now = Date.now();
        var dt = Math.max(16, now - lastPointer.t);
        var speed = Math.hypot(x - lastPointer.x, y - lastPointer.y) / dt; // px/ms
        lastSpeed = speed;
        lastPointer = { x: x, y: y, t: now };
        if (throttled) return;
        throttled = true;
        (window.requestAnimationFrame || function (fn) { setTimeout(fn, 60); })(function () {
            throttled = false;
            evaluate(x, y, speed > 0.55);
        });
    }

    window.addEventListener("mousemove", function (event) {
        handlePointerMove(event.clientX, event.clientY);
    }, { passive: true });

    window.addEventListener("mouseleave", function () { setLevel("none"); }, { passive: true });

    // 手機沒有游標：點擊附近短暫看向該處，滑動時短暫追蹤，不長駐監聽高頻事件耗電
    var touchTrackUntil = 0;
    window.addEventListener("touchstart", function (event) {
        var t = event.touches && event.touches[0];
        if (!t) return;
        touchTrackUntil = Date.now() + 1200;
        handlePointerMove(t.clientX, t.clientY);
    }, { passive: true });

    window.addEventListener("touchmove", function (event) {
        if (Date.now() > touchTrackUntil) return; // 過咗短暫窗口就唔再追蹤，慳電
        var t = event.touches && event.touches[0];
        if (!t) return;
        handlePointerMove(t.clientX, t.clientY);
    }, { passive: true });

    window.addEventListener("touchend", function () {
        setTimeout(function () { setLevel("none"); }, 500);
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) setLevel("none");
    });
})();
