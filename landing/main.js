(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TRACKING_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

  function randomId(prefix) {
    var raw = "";
    if (window.crypto && window.crypto.getRandomValues) {
      var bytes = new Uint8Array(12);
      window.crypto.getRandomValues(bytes);
      raw = Array.prototype.map.call(bytes, function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    } else {
      raw = String(Date.now()) + Math.random().toString(16).slice(2);
    }
    return prefix + "_" + raw;
  }

  function readCookie(name) {
    return document.cookie
      .split(";")
      .map(function (v) { return v.trim(); })
      .filter(function (v) { return v.indexOf(name + "=") === 0; })
      .map(function (v) { return decodeURIComponent(v.slice(name.length + 1)); })[0] || "";
  }

  function writeTrackingCookie(name, value) {
    document.cookie = name + "=" + encodeURIComponent(value) + "; Max-Age=" + TRACKING_COOKIE_MAX_AGE + "; Path=/; Domain=.vexbot.fr; SameSite=Lax; Secure";
  }

  function getTrackingIds() {
    var visitorId = readCookie("vex_vid") || window.localStorage.getItem("vex_vid") || randomId("v");
    var sessionId = window.sessionStorage.getItem("vex_sid_public") || randomId("s");
    window.localStorage.setItem("vex_vid", visitorId);
    window.sessionStorage.setItem("vex_sid_public", sessionId);
    writeTrackingCookie("vex_vid", visitorId);
    writeTrackingCookie("vex_sid_public", sessionId);
    return { visitorId: visitorId, sessionId: sessionId };
  }

  var yearEl = document.getElementById("y");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  function trackEvent(type, source, metadata) {
    try {
      var ids = getTrackingIds();
      var payload = JSON.stringify({
        type: type,
        source: source || "landing",
        path: window.location.pathname,
        referrer: document.referrer || "",
        visitorId: ids.visitorId,
        sessionId: ids.sessionId,
        metadata: metadata || null
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("https://panel.vexbot.fr/api/public/events", new Blob([payload], { type: "application/json" }));
        return;
      }
      fetch("https://panel.vexbot.fr/api/public/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(function () {});
    } catch {
      // Le tracking ne doit jamais bloquer la page.
    }
  }

  trackEvent("landing_visit", "landing");

  if (performance && performance.getEntriesByType) {
    var nav = performance.getEntriesByType("navigation")[0];
    if (nav && nav.type === "back_forward") {
      trackEvent("landing_return", "landing", { reason: "browser_back_forward" });
    }
  }

  document.querySelectorAll("[data-track-event]").forEach(function (el) {
    el.addEventListener("click", function () {
      trackEvent(el.getAttribute("data-track-event") || "click", "landing", {
        text: (el.textContent || "").trim().slice(0, 120),
        href: el.href || null
      });
    });
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      trackEvent("landing_session_exit", "landing", { reason: "hidden" });
    } else {
      trackEvent("landing_session_return", "landing");
    }
  });

  window.addEventListener("pagehide", function () {
    trackEvent("landing_session_exit", "landing", { reason: "pagehide" });
  });

  var header = document.querySelector(".site-header");
  if (header) {
    var updateHeader = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
  }

  var menuButton = document.querySelector(".menu-button");
  var mainNav = document.getElementById("main-nav");
  if (menuButton && mainNav) {
    menuButton.addEventListener("click", function () {
      var isOpen = document.body.classList.toggle("menu-open");
      menuButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        document.body.classList.remove("menu-open");
        menuButton.setAttribute("aria-expanded", "false");
      });
    });
  }

  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  var preview = document.querySelector("[data-panel-preview]");
  if (preview) {
    var tabs = Array.prototype.slice.call(preview.querySelectorAll("[data-panel-tab]"));
    var views = Array.prototype.slice.call(preview.querySelectorAll("[data-panel-view]"));
    var currentIndex = 0;
    var timer = null;

    function activate(index) {
      if (!tabs.length || !views.length) return;
      currentIndex = ((index % views.length) + views.length) % views.length;

      tabs.forEach(function (tab, i) {
        var active = i === currentIndex;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });

      views.forEach(function (view, i) {
        view.classList.toggle("is-active", i === currentIndex);
      });
    }

    function startRotation() {
      if (prefersReducedMotion || views.length < 2) return;
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(function () {
        activate(currentIndex + 1);
      }, 4800);
    }

    tabs.forEach(function (tab, index) {
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", index === 0 ? "true" : "false");
      tab.addEventListener("click", function () {
        activate(index);
        startRotation();
      });
    });

    activate(0);
    startRotation();
  }
})();
