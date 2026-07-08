alert("app.js 已加载");

function updateClock() {

    var now = new Date();

    var hour = now.getHours();
    var minute = now.getMinutes();

    if (hour < 10) hour = "0" + hour;
    if (minute < 10) minute = "0" + minute;

    document.getElementById("hour").innerHTML = hour;
    document.getElementById("minute").innerHTML = minute;

    document.getElementById("date").innerHTML =
        now.getFullYear() + "年" +
        (now.getMonth() + 1) + "月" +
        now.getDate() + "日";

    document.getElementById("weather").innerHTML =
        "☀️ 广州 30°C";

    document.getElementById("message").innerHTML =
        "💧 记得喝水";
}

updateClock();

setInterval(updateClock,1000);