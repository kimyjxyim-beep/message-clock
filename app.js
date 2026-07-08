function updateClock() {
    const now = new Date();

    let hour = now.getHours().toString().padStart(2, "0");
    let minute = now.getMinutes().toString().padStart(2, "0");

    document.getElementById("hour").textContent = hour;
    document.getElementById("minute").textContent = minute;

    document.getElementById("date").textContent =
        now.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long"
        });

    document.getElementById("weather").textContent =
        "☀️ 30°C";

    const messages = [
        "❤️ 欢迎回家",
        "🌤 今天心情不错",
        "☕ 记得喝水",
        "🐶 Olivia 等你回来"
    ];

    const index = Math.floor(Date.now() / 5000) % messages.length;

    document.getElementById("message").textContent = messages[index];
}

updateClock();

setInterval(updateClock,1000);
