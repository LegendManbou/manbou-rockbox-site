const internalLinks = document.querySelectorAll('a[href^="#"]');

internalLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");

    if (!targetId) {
      return;
    }

    if (targetId === "#") {
      event.preventDefault();
      return;
    }

    const target = document.querySelector(targetId);

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    history.pushState(null, "", targetId);
  });
});

const trackEvent = (eventName, params = {}) => {
  if (typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", eventName, params);
};

document.querySelectorAll("[data-track-cta]").forEach((button) => {
  button.addEventListener("click", () => {
    trackEvent("cta_click", {
      button_name: button.dataset.trackCta,
    });
  });
});

document.querySelectorAll("[data-track-link]").forEach((link) => {
  link.addEventListener("click", () => {
    trackEvent("link_click", {
      link_name: link.dataset.trackLink,
    });
  });
});

const trackedSections = document.querySelectorAll("[data-section]");
const viewedSections = new Set();
const visibleSections = new Map();
const dwellLastSentAt = new Map();
let activeSection = null;
let activeSectionStartedAt = Date.now();

const updateActiveSection = () => {
  let nextSection = null;
  let nextRatio = 0;

  visibleSections.forEach((ratio, sectionName) => {
    if (ratio > nextRatio) {
      nextRatio = ratio;
      nextSection = sectionName;
    }
  });

  if (nextSection && nextSection !== activeSection) {
    activeSection = nextSection;
    activeSectionStartedAt = Date.now();
  }
};

if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const sectionName = entry.target.dataset.section;

        if (!sectionName) {
          return;
        }

        if (entry.isIntersecting) {
          visibleSections.set(sectionName, entry.intersectionRatio);

          if (entry.intersectionRatio >= 0.35 && !viewedSections.has(sectionName)) {
            viewedSections.add(sectionName);
            trackEvent("section_view", {
              section_name: sectionName,
            });
          }
        } else {
          visibleSections.delete(sectionName);
        }
      });

      updateActiveSection();
    },
    {
      threshold: [0, 0.25, 0.35, 0.5, 0.75, 1],
    }
  );

  trackedSections.forEach((section) => sectionObserver.observe(section));
}

setInterval(() => {
  if (!activeSection) {
    return;
  }

  const now = Date.now();
  const dwellMs = now - activeSectionStartedAt;
  const lastSentAt = dwellLastSentAt.get(activeSection) || 0;

  if (dwellMs < 5000 || now - lastSentAt < 30000) {
    return;
  }

  dwellLastSentAt.set(activeSection, now);
  trackEvent("section_dwell", {
    section_name: activeSection,
    dwell_seconds: Math.round(dwellMs / 1000),
  });
}, 1000);

const scrollDepthThresholds = [25, 50, 75, 90];
const sentScrollDepths = new Set();
let scrollTicking = false;

const checkScrollDepth = () => {
  const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
  const currentDepth = documentHeight <= 0 ? 100 : (window.scrollY / documentHeight) * 100;

  scrollDepthThresholds.forEach((threshold) => {
    if (currentDepth >= threshold && !sentScrollDepths.has(threshold)) {
      sentScrollDepths.add(threshold);
      trackEvent("scroll_depth", {
        depth_percent: threshold,
      });
    }
  });
};

const requestScrollDepthCheck = () => {
  if (scrollTicking) {
    return;
  }

  scrollTicking = true;
  window.requestAnimationFrame(() => {
    checkScrollDepth();
    scrollTicking = false;
  });
};

window.addEventListener("scroll", requestScrollDepthCheck, { passive: true });
window.addEventListener("load", checkScrollDepth);
checkScrollDepth();
