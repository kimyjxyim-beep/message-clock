function updateClock() {
    const now = new Date();

    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const second = String(now.getSeconds()).padStart(2, "0");

    document.getElementById("hour").textContent = hour;
    document.getElementById("minute").textContent = minute;

    document.getElementById("date").textContent =
        now.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long"
        });

    // ===== 时间背景 =====

    const h = now.getHours();

    if (h >= 5 && h < 7) {

        document.body.style.background =
            "linear-gradient(180deg,#5B4B8A,#F4A261)";

    } else if (h >= 7 && h < 17) {

        document.body.style.background =
            "linear-gradient(180deg,#5DADE2,#AEDFF7)";

    } else if (h >= 17 && h < 19) {

        document.body.style.background =
            "linear-gradient(180deg,#F2994A,#D35400)";

    } else if (h >= 19 && h < 23) {

        document.body.style.background =
            "linear-gradient(180deg,#141E30,#243B55)";

    } else {

        document.body.style.background =
            "linear-gradient(180deg,#000000,#1B2735)";

    }

    // ===== 天气（先占位）=====

    document.getElementById("weather").textContent =
        "☀️ 广州 30°C";

    // ===== 留言（先占位）=====

    document.getElementById("message").textContent =
        "💧 记得喝水";

    // ===== 秒数同步 =====

    const delay = 1000 - now.getMilliseconds();

    clearTimeout(window.clockTimer);

    window.clockTimer = setTimeout(updateClock, delay);
}

updateClock();