/* =========================================================
   Emi's portfolio — interactions
   Projects come from projects.js (CATEGORIES + PROJECTS).
   ========================================================= */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (sel, root = document) => root.querySelector(sel);

/* ---------- 1. Marquee bands: repeat words with stars ---------- */
document.querySelectorAll(".marquee .track").forEach((track) => {
  const words = track.dataset.words.split("|");
  const oneRun = words.map((w) => `<span>${w}</span><span class="st">✶</span>`).join("");
  track.innerHTML = oneRun.repeat(6); // duplicated so the -50% loop is seamless
});

/* ---------- 2. Little twinkling dots in the hero "field" ---------- */
(function drawDots() {
  const svg = $(".dots");
  if (!svg) return;
  const colours = ["#e2683f", "#f2b33d", "#ffffff", "#d94a2b"];
  let html = "";
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 400, y = 30 + Math.random() * 90, r = 0.6 + Math.random() * 1.8;
    const c = colours[i % colours.length];
    html += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${c}" style="animation-delay:${(-Math.random() * 3).toFixed(2)}s"/>`;
  }
  svg.innerHTML = html;
})();

/* ---------- 3. Hero parallax: the field and title follow the mouse ---------- */
const hero = $(".hero");
if (hero && !reduceMotion) {
  hero.addEventListener("mousemove", (e) => {
    const r = hero.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    $(".field").style.transform = `translate(${dx * -24}px, ${dy * -10}px)`;
    $(".hero-title").style.transform = `translate(${dx * 14}px, ${dy * 8}px)`;
  });
}

/* ---------- 4. Floating nav appears after the hero ---------- */
const nav = $(".nav");
const onScroll = () => nav.classList.toggle("show", window.scrollY > window.innerHeight * 0.7);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- 5. Envelope: opens when scrolled into view, seal toggles it ---------- */
const envelope = $("#envelope");
$("#seal").addEventListener("click", () => envelope.classList.toggle("open"));
new IntersectionObserver((entries, obs) => {
  entries.forEach((en) => {
    if (en.isIntersecting) {
      setTimeout(() => envelope.classList.add("open"), 500);
      obs.disconnect();
    }
  });
}, { threshold: 0.6 }).observe(envelope);

/* ---------- 6. Build table of contents + chapters from projects.js ---------- */
// Each chapter has its own look (see "Chapter themes" in styles.css).
// THEME_ACCENT is the main colour of each theme, reused by the pop-up.
const THEME_ACCENT = { ml: "#c4161c", dl: "#d4282e", gen: "#1f3fb8", data: "#b4531b", eng: "#2f6b45", dev: "#2f8f4e" };

// Small decorations that only some themes show (terminal bar, stamp, file tab...)
function cardDeco(catId, p, n) {
  const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (catId === "dev")  return `<span class="term-bar"><i></i><i></i><i></i><code>~/projects/${slug}</code></span>`;
  if (catId === "gen")  return `<span class="postage">✶</span><span class="postmark">SG<br>2026</span>`;
  if (catId === "eng")  return `<span class="file-tab">FILE 05-${n}</span>`;
  if (catId === "dl")   return `<span class="frame-no">FRAME ${n}A</span>`;
  if (catId === "data") return `<span class="tape-strip"></span>`;
  return "";
}

const toc = $("#toc");
const chapters = $("#chapters");
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

CATEGORIES.forEach((cat) => {
  const items = PROJECTS.filter((p) => p.category === cat.id);
  if (!items.length) return; // skip empty categories

  // table of contents row
  toc.insertAdjacentHTML("beforeend", `
    <li style="--acc:${THEME_ACCENT[cat.id]}"><a href="#${cat.id}">
      <span class="num">${cat.num}</span>
      <span class="label">${escapeHtml(cat.title)}<small>${items.length} project${items.length > 1 ? "s" : ""}</small></span>
    </a></li>`);

  // chapter: CRT title card + marquee + project cards
  const cards = items.map((p) => {
    const i = PROJECTS.indexOf(p);
    const n = String(items.indexOf(p) + 1).padStart(2, "0");
    return `
      <button class="card reveal" data-project="${i}" data-tilt aria-label="Open ${escapeHtml(p.title)}">
        ${cardDeco(cat.id, p, n)}
        ${p.stat ? `<span class="stat"><b>${escapeHtml(p.stat.value)}</b><small>${escapeHtml(p.stat.label)}</small></span>` : ""}
        <span class="idx">${n}</span>
        <h3>${escapeHtml(p.title)}</h3>
        <span class="sub">${escapeHtml(p.subtitle)}</span>
        <p class="sum">${escapeHtml(p.summary)}</p>
        <span class="pills">${p.tools.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</span>
        <span class="more">View project</span>
      </button>`;
  }).join("");

  chapters.insertAdjacentHTML("beforeend", `
    <section class="chapter theme-${cat.id}" id="${cat.id}" data-accent="${THEME_ACCENT[cat.id]}">
      <div class="chapter-tv">
        <div class="tv"><div class="screen">
          <div class="field" aria-hidden="true">
            <span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span><span class="blob b4"></span>
          </div>
          <div class="chapter-title">
            <span class="n">${cat.num}</span>
            <h2 class="t">${escapeHtml(cat.title)}<sup>✶</sup></h2>
            <p class="sub">${escapeHtml(cat.tagline)}</p>
          </div>
          <div class="scanlines"></div><div class="vignette"></div>
        </div></div>
      </div>
      <div class="marquee" aria-hidden="true"><div class="track">${
        (items.map((p) => `<span>${escapeHtml(p.title)}</span><span class="st">✶</span>`).join("") +
         `<span>${escapeHtml(cat.title)}</span><span class="st">✶</span>`).repeat(4)
      }</div></div>
      <div class="cards">${cards}</div>
    </section>`);
});

/* ---------- 6b. Nav logo + cursor star take the colour of the section on screen ---------- */
const accentObserver = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) document.documentElement.style.setProperty("--live", en.target.dataset.accent);
  });
}, { rootMargin: "-45% 0px -45% 0px" }); // the section crossing the middle of the screen
document.querySelectorAll("[data-accent]").forEach((el) => accentObserver.observe(el));

/* ---------- 7. Chapter TVs "switch on" when they scroll into view ---------- */
const tvObserver = new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("lit"); tvObserver.unobserve(en.target); } });
}, { threshold: 0.45 });
document.querySelectorAll(".chapter-tv").forEach((el) => tvObserver.observe(el));

/* ---------- 8. Reveal-on-scroll ---------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); revealObserver.unobserve(en.target); } });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

/* ---------- 9. 3D tilt on cards and the polaroid ---------- */
if (!reduceMotion) {
  document.querySelectorAll("[data-tilt]").forEach((el) => {
    const base = el.classList.contains("polaroid") ? "rotate(-3deg)" : "";
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `${base} perspective(800px) rotateY(${x * 8}deg) rotateX(${y * -8}deg) translateY(-4px)`;
    });
    el.addEventListener("mouseleave", () => { el.style.transform = base; });
  });
}

/* ---------- 10. Project pop-up ---------- */
const modal = $("#modal");
const modalBody = $("#modal-body");

function openProject(i) {
  const p = PROJECTS[i];
  const cat = CATEGORIES.find((c) => c.id === p.category);
  const links = [
    p.repo ? `<a class="btn" href="${p.repo}" target="_blank" rel="noopener">View on GitHub ↗</a>` : "",
    p.demo ? `<a class="btn ghost" href="${p.demo}" target="_blank" rel="noopener">Live demo ↗</a>` : "",
  ].join("");
  modalBody.innerHTML = `
    <p class="cat">${cat.num} · ${escapeHtml(cat.title)}</p>
    <h3 id="modal-title">${escapeHtml(p.title)}</h3>
    <p class="sub">${escapeHtml(p.subtitle)}</p>
    <p class="lead">${escapeHtml(p.summary)}</p>
    <div class="meta-row">
      <span class="k">Project type</span><span>${escapeHtml(p.type)}</span>
      <span class="k">Tools</span><span class="pills">${p.tools.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</span>
    </div>
    <ul>${p.points.map((pt) => `<li>${escapeHtml(pt)}</li>`).join("")}</ul>
    ${links ? `<div class="links">${links}</div>` : ""}`;
  modal.style.setProperty("--red", THEME_ACCENT[p.category] || "#c4161c"); // pop-up matches its chapter
  modal.showModal();
}

chapters.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) openProject(Number(card.dataset.project));
});
$("#modal-close").addEventListener("click", () => modal.close());
modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); }); // click outside to close

/* ---------- 11. Cursor star ---------- */
const star = $(".cursor-star");
if (star && window.matchMedia("(hover: hover)").matches) {
  window.addEventListener("mousemove", (e) => {
    star.style.opacity = 1;
    star.style.left = e.clientX + "px";
    star.style.top = e.clientY + "px";
  });
  document.addEventListener("mouseover", (e) => {
    star.classList.toggle("big", !!e.target.closest("a, button, .chips span"));
  });
  document.addEventListener("mouseleave", () => (star.style.opacity = 0));
}
