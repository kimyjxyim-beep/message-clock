/* Weather and clock light are visual-only.  CSS owns the transition, this
   module only sets a compact condition token and never rebuilds the page. */
(function initJinzhuLighting() {
    "use strict";
    var root = document.documentElement;
    function apply(detail) {
        detail = detail || {};
        var condition = detail.condition || "cloudy";
        var hour = new Date().getHours();
        var period = hour < 5 ? "deep-night" : hour < 8 ? "morning" : hour < 17 ? "day" : hour < 19 ? "dusk" : "night";
        root.setAttribute("data-weather-condition", condition);
        root.setAttribute("data-light-period", period);
    }
    var timer = null;
    function startTimer() {
        clearInterval(timer);
        timer = setInterval(function () { if (!document.hidden) apply(); }, 10 * 60 * 1000);
    }
    window.addEventListener("jinzhu:weather", function (event) { apply(event && event.detail); });
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) { clearInterval(timer); timer = null; }
        else { apply(); startTimer(); }
    });
    startTimer();
    apply();
}());
