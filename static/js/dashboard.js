/*
  Dashboard (dataset-driven) renderer
  - Fetches protected JSON from /api/dashboard-data
  - Renders KPIs + 5 charts (Chart.js) + searchable preview table
*/

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const THEME_KEY = "yt-dashboard-theme";
  const restoreTheme = () => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "mono-ui") {
      document.body.classList.add("mono-ui");
      document.body.classList.remove("vibrant-ui");
    } else if (stored === "vibrant-ui") {
      document.body.classList.add("vibrant-ui");
      document.body.classList.remove("mono-ui");
    }
  };
  restoreTheme();

  const isMono = document.body.classList.contains("mono-ui");
  const isVibrant = document.body.classList.contains("vibrant-ui");

  const fmtInt = (n) => {
    const v = Number(n || 0);
    if (!Number.isFinite(v)) return "—";
    return v.toLocaleString();
  };

  const fmtBig = (n) => {
    const v = Number(n || 0);
    if (!Number.isFinite(v)) return "—";
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString();
  };

  // ------- Charts -------
  const charts = {};
  const destroyCharts = () => {
    Object.values(charts).forEach((c) => {
      try {
        c.destroy();
      } catch {}
    });
    for (const k of Object.keys(charts)) delete charts[k];
  };

  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: {
        ticks: {
          color: isMono ? "rgba(20,20,20,0.82)" : isVibrant ? "rgba(236,238,255,0.9)" : "rgba(255,255,255,0.72)",
        },
        grid: { color: isMono ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.10)" },
      },
      y: {
        ticks: {
          color: isMono ? "rgba(20,20,20,0.82)" : isVibrant ? "rgba(236,238,255,0.9)" : "rgba(255,255,255,0.72)",
        },
        grid: { color: isMono ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.10)" },
      },
    },
  };

  const mkBar = (canvasId, labels, values, label) => {
    const el = document.getElementById(canvasId);
    if (!el) return;
    const ctx = el.getContext("2d");
    charts[canvasId] = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            borderRadius: 12,
            backgroundColor: isMono
              ? "rgba(0,0,0,0.72)"
              : isVibrant
              ? "rgba(0,212,255,0.75)"
              : "rgba(255,0,60,0.70)",
            borderColor: isMono ? "rgba(0,0,0,0.95)" : isVibrant ? "rgba(124,77,255,0.95)" : "rgba(255,0,60,0.95)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        ...baseChartOptions,
        plugins: { ...baseChartOptions.plugins, tooltip: { enabled: true } },
      },
    });
  };

  const mkLine = (canvasId, labels, values, label) => {
    const el = document.getElementById(canvasId);
    if (!el) return;
    const ctx = el.getContext("2d");
    charts[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            borderColor: isMono ? "rgba(0,0,0,0.9)" : isVibrant ? "rgba(255,42,109,0.95)" : "rgba(255,0,60,0.95)",
            backgroundColor: isMono
              ? "rgba(0,0,0,0.14)"
              : isVibrant
              ? "rgba(124,77,255,0.20)"
              : "rgba(255,0,60,0.22)",
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 2.2,
          },
        ],
      },
      options: baseChartOptions,
    });
  };

  const mkScatter = (canvasId, points, label) => {
    const el = document.getElementById(canvasId);
    if (!el) return;
    const ctx = el.getContext("2d");
    charts[canvasId] = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label,
            data: points,
            pointRadius: 3,
            pointHoverRadius: 5,
            backgroundColor: isMono ? "rgba(0,0,0,0.75)" : isVibrant ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.75)",
            borderColor: isMono ? "rgba(0,0,0,0.8)" : isVibrant ? "rgba(0,212,255,0.92)" : "rgba(255,0,60,0.55)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        ...baseChartOptions,
        scales: {
          x: {
            ...baseChartOptions.scales.x,
            title: { display: true, text: "Likes", color: isMono ? "rgba(20,20,20,0.8)" : "rgba(255,255,255,0.72)" },
          },
          y: {
            ...baseChartOptions.scales.y,
            title: {
              display: true,
              text: "Comments",
              color: isMono ? "rgba(20,20,20,0.8)" : "rgba(255,255,255,0.72)",
            },
          },
        },
      },
    });
  };

  // ------- Table -------
  let tableState = { columns: [], rows: [] };

  const renderTable = (needle = "", categoryFilter = "", countryFilter = "") => {
    const wrap = $("#dataTableWrap");
    if (!wrap) return;
    const q = (needle || "").trim().toLowerCase();
    const cols = tableState.columns;
    let rows = tableState.rows;
    if (q) {
      rows = rows.filter((r) =>
        cols.some((c) => String(r[c] ?? "").toLowerCase().includes(q))
      );
    }
    if (categoryFilter) {
      rows = rows.filter((r) => String(r.Category ?? "").toLowerCase() === categoryFilter.toLowerCase());
    }
    if (countryFilter) {
      rows = rows.filter((r) => String(r.Country ?? "").toLowerCase() === countryFilter.toLowerCase());
    }

    // Simple, lightweight HTML table (no extra libs)
    const head = cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
    const body = rows
      .map((r) => {
        const tds = cols
          .map((c) => `<td>${escapeHtml(String(r[c] ?? ""))}</td>`)
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");

    wrap.innerHTML = `
      <div class="tableMeta">
        <span class="tag">Rows shown: <strong>${rows.length}</strong></span>
        <span class="tag">Columns: <strong>${cols.length}</strong></span>
      </div>
      <div class="tableScroll">
        <table class="dataTable">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  };

  const escapeHtml = (s) =>
    s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

  // ------- Data Fetch -------
  const setKpis = (k) => {
    const rows = $("#kpiRows");
    const views = $("#kpiViews");
    const likes = $("#kpiLikes");
    const comments = $("#kpiComments");
    const topCat = $("#kpiTopCategory");
    const topCh = $("#kpiTopChannel");
    if (rows) rows.textContent = fmtInt(k.rows);
    if (views) views.textContent = fmtBig(k.views);
    if (likes) likes.textContent = fmtBig(k.likes);
    if (comments) comments.textContent = fmtBig(k.comments);
    if (topCat) topCat.textContent = k.topCategory || "—";
    if (topCh) topCh.textContent = k.topChannel || "—";
  };

  const renderCharts = (c) => {
    destroyCharts();

    const topCategories = c.topCategories || [];
    mkBar(
      "chartCategories",
      topCategories.map((x) => x.label),
      topCategories.map((x) => x.value),
      "Views"
    );

    const topChannels = c.topChannels || [];
    mkBar(
      "chartChannels",
      topChannels.map((x) => x.label),
      topChannels.map((x) => x.value),
      "Views"
    );

    const growth = c.dailyViewGrowth || [];
    mkLine(
      "chartGrowth",
      growth.map((x) => x.label),
      growth.map((x) => x.value),
      "Views"
    );

    const scatter = c.likeCommentScatter || [];
    mkScatter("chartScatter", scatter, "Engagement");

    const regions = c.regionViews || [];
    mkBar(
      "chartRegions",
      regions.map((x) => x.label),
      regions.map((x) => x.value),
      "Views"
    );
  };

  const showDatasetError = (msg) => {
    const wrap = $("#dataTableWrap");
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="auth__error" role="alert" style="margin:0;">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${escapeHtml(msg || "Failed to load dataset.")}</span>
      </div>
    `;
  };

  const load = async () => {
    try {
      const res = await fetch("/api/dashboard-data", { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showDatasetError(data.error || `Failed to load dataset (${res.status}).`);
        return;
      }

      setKpis(data.kpis || {});
      renderCharts((data && data.charts) || {});

      tableState = {
        columns: (data.table && data.table.columns) || [],
        rows: (data.table && data.table.rows) || [],
      };

      // Populate filters
      const categories = [...new Set(tableState.rows.map(r => r.Category).filter(Boolean))].sort();
      const categorySelect = $("#categoryFilter");
      if (categorySelect) {
        categorySelect.innerHTML = '<option value="">All Categories</option>' + categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
      }

      const countries = [...new Set(tableState.rows.map(r => r.Country).filter(Boolean))].sort();
      const countrySelect = $("#countryFilter");
      if (countrySelect) {
        countrySelect.innerHTML = '<option value="">All Countries</option>' + countries.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
      }

      renderTable($("#tableSearch")?.value || "", $("#categoryFilter")?.value || "", $("#countryFilter")?.value || "");
    } catch (e) {
      showDatasetError("Network error while loading dataset.");
    }
  };

  // Hooks
  const reloadBtn = $("#reloadDataBtn");
  if (reloadBtn) reloadBtn.addEventListener("click", load);

  const tableSearch = $("#tableSearch");
  if (tableSearch) tableSearch.addEventListener("input", () => renderTable(tableSearch.value, $("#categoryFilter")?.value || "", $("#countryFilter")?.value || ""));

  const categoryFilter = $("#categoryFilter");
  if (categoryFilter) categoryFilter.addEventListener("change", () => renderTable($("#tableSearch")?.value || "", categoryFilter.value, $("#countryFilter")?.value || ""));

  const countryFilter = $("#countryFilter");
  if (countryFilter) countryFilter.addEventListener("change", () => renderTable($("#tableSearch")?.value || "", $("#categoryFilter")?.value || "", countryFilter.value));

  const themeToggle = $("#themeToggle");
  if (themeToggle) themeToggle.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("mono-ui") ? "vibrant-ui" : "mono-ui";
    localStorage.setItem(THEME_KEY, nextTheme);
    window.location.reload();
  });

  // Load once at start
  load();
})();

