function updateClock() {

    const now = new Date();

    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");

    document.getElementById("hour").textContent = hour;
    document.getElementById("minute").textContent = minute;

    document.getElementById("date").textContent =
        now.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long"
        });

    // ======== 时间背景 ========

    const h = now.getHours();

    if (h >= 6 && h < 8) {

        document.body.style.background = "#E8B56A";

    } else if (h >= 8 && h < 17) {

        document.body.style.background = "#6FAFEA";

    } else if (h >= 17 && h < 19) {

        document.body.style.background = "#E6864A";

    } else if (h >= 19 && h < 23) {

        document.body.style.background = "#182845";

    } else {

        document.body.style.background = "#000000";

    }

    // ======== 示例天气 ========

    document.getElementById("weather").textContent =
        "☀️ 广州 30°C";

    // ======== 示例留言 ========

    document.getElementById("message").textContent =
        "💧 记得喝水";

}

updateClock();

setInterval(updateClock,1000);