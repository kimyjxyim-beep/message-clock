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

    document.getElementById("weather").textContent =
        "☀️ 广州 30°C";

    document.getElementById("message").textContent =
        "💧 记得喝水";
}

updateClock();

setInterval(updateClock, 1000);