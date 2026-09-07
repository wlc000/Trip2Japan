const board = document.getElementById("spot-board");
const dayTabsEl = document.getElementById("day-tabs");
const planTableEl = document.getElementById("plan-table");
const modal = document.getElementById("modal");

const liked = new Set(JSON.parse(localStorage.getItem("liked-spots") || "[]"));

function stars(n) {
  return "●".repeat(n) + "○".repeat(5 - n);
}

function xhsUrl(keyword) {
  return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`;
}

function beatXhs(beat) {
  if (beat.xhs) return beat.xhs;
  if (beat.spotId) {
    const spot = TRIP.spots.find((s) => s.id === beat.spotId);
    if (spot && spot.xhs && spot.xhs[0]) return spot.xhs[0];
  }
  return "";
}

function photoItem(item) {
  if (!item) return null;
  if (item.imgs || item.img || item.photo) return item;
  if (item.spotId) return TRIP.spots.find((s) => s.id === item.spotId) || null;
  return null;
}

function sizedPhoto(url, width) {
  if (!url) return "";
  const w = Math.max(80, Math.min(width || 1280, 1920));
  let raw = String(url).split("?")[0];
  if (raw.includes("wikimedia.org")) {
    raw = raw.replace("https://thumb.wikimedia.org/", "https://upload.wikimedia.org/");
    const thumb = raw.match(/\/commons\/thumb\/([^/])\/([^/]{2})\/([^/]+)\/\d+px-(.+)$/);
    if (thumb) {
      return `https://upload.wikimedia.org/wikipedia/commons/thumb/${thumb[1]}/${thumb[2]}/${thumb[3]}/${w}px-${thumb[4]}`;
    }
    const orig = raw.match(/\/commons\/([^/])\/([^/]{2})\/([^/]+)$/);
    if (orig) {
      return `https://upload.wikimedia.org/wikipedia/commons/thumb/${orig[1]}/${orig[2]}/${orig[3]}/${w}px-${orig[3]}`;
    }
    return raw;
  }
  if (raw.includes("bkimg.cdn.bcebos.com")) {
    return `${raw}?x-bce-process=image/resize,m_lfit,w_${w}/format,f_auto`;
  }
  return raw;
}

function photoList(item) {
  const source = photoItem(item);
  if (!source) return [];
  if (Array.isArray(source.imgs) && source.imgs.length) return source.imgs.filter(Boolean);
  if (source.img) return [source.img];
  return [];
}

function photoSrc(item, width, index) {
  return sizedPhoto(photoList(item)[index || 0], width);
}

function baikeUrl(item) {
  const source = photoItem(item);
  if (!source || !source.photo) return "https://baike.baidu.com/";
  return `https://baike.baidu.com/item/${encodeURIComponent(source.photo)}`;
}

function galleryHtml(item, name) {
  const urls = photoList(item);
  if (!urls.length) return "";
  const many = urls.length > 1;
  return `<div class="sheet-gallery" data-gallery data-urls="${encodeURIComponent(JSON.stringify(urls))}">
    <div class="sheet-photo">
      <img data-gallery-main src="${sizedPhoto(urls[0], 1400)}" alt="${name}" referrerpolicy="no-referrer" />
      ${
        many
          ? `<button class="gal-nav prev" type="button" data-gal="-1" aria-label="上一张">‹</button>
      <button class="gal-nav next" type="button" data-gal="1" aria-label="下一张">›</button>
      <span class="gal-count" data-gallery-count>1 / ${urls.length}</span>`
          : ""
      }
      <a class="photo-credit" href="${baikeUrl(item)}" target="_blank" rel="noreferrer">图：百度百科</a>
    </div>
    ${
      many
        ? `<div class="gal-thumbs">${urls
            .map(
              (url, i) =>
                `<button type="button" data-thumb="${i}" class="${i === 0 ? "is-on" : ""}"><img src="${sizedPhoto(url, 200)}" alt="" referrerpolicy="no-referrer" /></button>`
            )
            .join("")}</div>`
        : ""
    }
  </div>`;
}

function bindGallery(root) {
  const box = root.querySelector("[data-gallery]");
  if (!box) return;
  let urls = [];
  try {
    urls = JSON.parse(decodeURIComponent(box.dataset.urls || "[]"));
  } catch (err) {
    urls = [];
  }
  if (urls.length < 2) return;
  let i = 0;
  const main = box.querySelector("[data-gallery-main]");
  const count = box.querySelector("[data-gallery-count]");
  function show(n) {
    i = (n + urls.length) % urls.length;
    if (main) main.src = sizedPhoto(urls[i], 1400);
    if (count) count.textContent = `${i + 1} / ${urls.length}`;
    box.querySelectorAll("[data-thumb]").forEach((el, idx) => el.classList.toggle("is-on", idx === i));
  }
  box.addEventListener("click", (e) => {
    const step = e.target.closest("[data-gal]");
    if (step) {
      e.preventDefault();
      e.stopPropagation();
      show(i + Number(step.dataset.gal));
    }
    const thumb = e.target.closest("[data-thumb]");
    if (thumb) {
      e.preventDefault();
      e.stopPropagation();
      show(Number(thumb.dataset.thumb));
    }
  });
  box._galleryShow = show;
  box._galleryIndex = () => i;
}

function dayHeading(day) {
  const n = String(day.id).padStart(2, "0");
  const date = day.date ? ` · ${day.date}` : "";
  return `DAY ${n}${date} · ${day.title}`;
}

function spotWhenLabel(spot) {
  if (spot.optional || !spot.day) return "备选";
  const meta = (TRIP.days || []).find((d) => d.id === spot.day);
  const n = String(spot.day).padStart(2, "0");
  return meta && meta.date ? `DAY ${n} · ${meta.date}` : `DAY ${n}`;
}

function groupedSpots() {
  const dayMeta = new Map((TRIP.days || []).map((d) => [d.id, d]));
  const buckets = new Map();
  TRIP.spots.forEach((spot) => {
    const optional = !!spot.optional || !spot.day;
    const key = optional ? "optional" : String(spot.day);
    if (!buckets.has(key)) {
      if (optional) {
        buckets.set(key, { title: "备选", day: 99, optional: true, spots: [] });
      } else {
        const meta = dayMeta.get(spot.day);
        const n = String(spot.day).padStart(2, "0");
        const title = meta ? dayHeading(meta) : `DAY ${n}`;
        buckets.set(key, { title, day: spot.day, optional: false, spots: [] });
      }
    }
    buckets.get(key).spots.push(spot);
  });
  return [...buckets.values()].sort((a, b) => {
    if (a.optional !== b.optional) return a.optional ? 1 : -1;
    return a.day - b.day;
  });
}

function cardPhotos(spot) {
  const urls = photoList(spot).slice(0, 3);
  if (!urls.length) return `<div class="card-photos n-0"></div>`;
  return `<div class="card-photos n-${urls.length}">${urls
    .map(
      (url, i) =>
        `<img src="${sizedPhoto(url, i === 0 ? 900 : 480)}" alt="${i === 0 ? spot.name : ""}" loading="lazy" />`
    )
    .join("")}</div>`;
}

function renderSpots() {
  if (!board) return;
  board.innerHTML = groupedSpots()
    .map((group) => {
      return `
        <section class="spot-group">
          <div class="spot-group-head">
            <h3>${group.title}</h3>
            <span>${group.spots.length} 处</span>
          </div>
          <div class="spot-grid">
            ${group.spots
              .map(
                (spot) => `
              <button class="spot-card" data-id="${spot.id}" type="button">
                ${cardPhotos(spot)}
                <div class="spot-body">
                  <div class="en">${spot.en}</div>
                  <h3>${spot.name}</h3>
                  <p>${spot.area} · 建议停留 ${spot.duration}</p>
                </div>
              </button>`
              )
              .join("")}
          </div>
        </section>`;
    })
    .join("");
}

const TYPE_LABEL = { spot: "景点", commute: "通勤", meal: "吃饭", hotel: "酒店" };
let planDay = 1;
let activeBeatId = "";
let planMap = null;
let planLayer = null;
let planLine = null;
let planHighlight = null;
let planMarkers = {};

function currentDay() {
  return TRIP.days.find((d) => d.id === planDay) || TRIP.days[0];
}

function beatLatLng(beat) {
  if (beat.spotId) {
    const spot = TRIP.spots.find((s) => s.id === beat.spotId);
    if (spot) return [spot.lat, spot.lng];
  }
  if (beat.lat != null && beat.lng != null) return [beat.lat, beat.lng];
  return null;
}

function pinLabel(beat) {
  if (beat.spotId) {
    const spot = TRIP.spots.find((s) => s.id === beat.spotId);
    if (spot) return spot.name;
  }
  const rest = beat.name.includes("·") ? beat.name.split("·").pop().trim() : beat.name;
  return rest.replace(/（.*）/g, "").replace(/\(.*\)/g, "").trim();
}

function mappedBeats(day) {
  return day.beats
    .map((beat) => ({ beat, ll: beatLatLng(beat) }))
    .filter((x) => x.ll);
}

function samePoint(a, b) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) < 0.0008 && Math.abs(a[1] - b[1]) < 0.0008;
}

function previousDayEnd(day) {
  const i = TRIP.days.findIndex((d) => d.id === day.id);
  for (let d = i - 1; d >= 0; d--) {
    const mapped = mappedBeats(TRIP.days[d]);
    if (mapped.length) return mapped[mapped.length - 1].ll;
  }
  return null;
}

function commuteSegment(day, beat) {
  const mapped = mappedBeats(day);
  const i = mapped.findIndex((x) => x.beat.id === beat.id);
  if (i < 0) return null;
  const end = mapped[i].ll;
  let start = null;
  for (let j = i - 1; j >= 0; j--) {
    if (!samePoint(mapped[j].ll, end)) {
      start = mapped[j].ll;
      break;
    }
  }
  if (!start) {
    const prev = previousDayEnd(day);
    if (prev && !samePoint(prev, end)) start = prev;
  }
  if (start) return [start, end];
  for (let j = i + 1; j < mapped.length; j++) {
    if (!samePoint(mapped[j].ll, end)) return [end, mapped[j].ll];
  }
  return null;
}

function renderDayTabs() {
  dayTabsEl.innerHTML = TRIP.days
    .map(
      (day) =>
        `<button class="chip${day.id === planDay ? " is-on" : ""}" data-plan-day="${day.id}">${dayHeading(day)}</button>`
    )
    .join("");
}

function budget() {
  const b = TRIP.budget || {};
  const stays = b.stays && b.stays.length
    ? b.stays
    : [{ city: "酒店", nights: b.hotelNights || 6, roomJpy: b.hotelRoomJpy || 20000 }];
  const nights = stays.reduce((sum, x) => sum + (x.nights || 0), 0);
  const hotelYen = stays.reduce((sum, x) => sum + (x.nights || 0) * (x.roomJpy || 0), 0);
  return {
    jpyToCny: b.jpyToCny || 0.048,
    stays,
    nights,
    hotelYen
  };
}

function toRmb(yen) {
  return Math.round((Number(yen) || 0) * budget().jpyToCny);
}

function hotelRoomYen(beat) {
  if (!beat || beat.type !== "hotel" || beat.checkout) return 0;
  if (beat.cost != null) return beat.cost;
  const stays = budget().stays;
  return (stays[stays.length - 1] && stays[stays.length - 1].roomJpy) || 20000;
}

function beatCostEach(beat) {
  if (beat.type === "hotel") return hotelRoomYen(beat) / 2;
  if (beat.cost == null) return 0;
  if (beat.share) return beat.cost / 2;
  return beat.cost;
}

function formatRmb(yen, suffix) {
  if (yen == null) return "—";
  if (yen === 0) return "免费";
  return suffix ? `约 ${toRmb(yen)} 元${suffix}` : `约 ${toRmb(yen)} 元`;
}

function formatCost(beat) {
  if (beat.type === "hotel") {
    const room = hotelRoomYen(beat);
    return room ? formatRmb(room, " / 间") : "退房";
  }
  if (beat.cost == null) return "—";
  if (beat.cost === 0) return "免费";
  if (beat.share) return formatRmb(beat.cost, " / 车");
  return formatRmb(beat.cost);
}

function dayCost(day) {
  const perYen = day.beats.reduce((sum, b) => sum + beatCostEach(b), 0);
  const hotelYen = day.beats.reduce((sum, b) => sum + (b.type === "hotel" ? hotelRoomYen(b) : 0), 0);
  return {
    per: toRmb(perYen),
    two: toRmb(perYen * 2),
    hasHotel: hotelYen > 0
  };
}

function tripCost() {
  const cfg = budget();
  const playYen = TRIP.days.reduce((sum, day) => {
    return sum + day.beats.reduce((s, b) => s + (b.type === "hotel" ? 0 : beatCostEach(b)), 0);
  }, 0);
  return {
    playPer: toRmb(playYen),
    playTwo: toRmb(playYen * 2),
    hotel: toRmb(cfg.hotelYen),
    nights: cfg.nights,
    stays: cfg.stays,
    per: toRmb(playYen + cfg.hotelYen / 2),
    two: toRmb(playYen * 2 + cfg.hotelYen),
    rate: cfg.jpyToCny
  };
}

function beatDetailText(beat) {
  if (beat.detail) return beat.detail;
  if (beat.spotId) {
    const spot = TRIP.spots.find((s) => s.id === beat.spotId);
    if (spot) return `${spot.enter}建议停留 ${spot.duration}。${spot.note}`;
  }
  return "点这一行，右侧地图会标出大概位置。";
}

function spotGuideBlock(spot) {
  if (!spot || !spot.guide) return "";
  return `<div class="spot-guide"><h4>导游说</h4><p>${spot.guide}</p></div>`;
}

function renderBeatDetail() {
  const el = document.getElementById("beat-detail");
  if (!el) return;
  const day = currentDay();
  const beat = day.beats.find((b) => b.id === activeBeatId) || day.beats[0];
  if (!beat) {
    el.innerHTML = "";
    return;
  }
  const xhs = beatXhs(beat);
  const mode = beat.mode ? ` · ${beat.mode}` : "";
  const linked = beat.spotId ? TRIP.spots.find((s) => s.id === beat.spotId) : null;
  el.innerHTML = `
    <div class="k">${beat.time} · ${TYPE_LABEL[beat.type] || ""}${mode}</div>
    <h3>${beat.name}</h3>
    <p class="beat-cost">基础花销：${formatCost(beat)}</p>
    ${spotGuideBlock(linked)}
    <p>${beatDetailText(beat)}</p>
    ${
      linked
        ? `<p><button class="guide-open" type="button" data-open-spot="${linked.id}">打开图文介绍</button></p>`
        : ""
    }
    ${
      xhs
        ? `<p><a class="xhs-inline" href="${xhsUrl(xhs)}" target="_blank" rel="noreferrer" data-xhs>小红书上看看</a></p>`
        : ""
    }
  `;
}

function renderDayOverview() {
  const el = document.getElementById("day-overview");
  if (!el) return;
  const day = currentDay();
  const prep = day.prep || [];
  const cost = dayCost(day);
  el.innerHTML = `
    <div class="day-nodes">
      <div class="day-node"><span class="k">日期</span><strong>${day.date || "—"}</strong></div>
      <div class="day-node"><span class="k">从哪出发</span><strong>${day.from || "—"}</strong></div>
      <div class="day-node"><span class="k">当天去哪</span><strong>${day.where || "—"}</strong></div>
      <div class="day-node"><span class="k">晚上住哪</span><strong>${day.stay || "—"}</strong></div>
      <div class="day-node day-node-cost"><span class="k">当日花销预估</span><strong>人均约 ${cost.per} 元</strong><small>两人约 ${cost.two} 元${cost.hasHotel ? "，含今晚标间" : "，不含酒店"}</small></div>
    </div>
    <p class="day-path">${day.path || ""}</p>
    ${
      prep.length
        ? `<div class="day-prep">
        <h4>当天要提前准备</h4>
        <ul>
          ${prep
            .map(
              (p) =>
                `<li><span class="need">${p.need}</span>${p.item}${
                  p.xhs
                    ? ` <a class="xhs-inline" href="${xhsUrl(p.xhs)}" target="_blank" rel="noreferrer" data-xhs>小红书</a>`
                    : ""
                }</li>`
            )
            .join("")}
        </ul>
      </div>`
        : ""
    }
  `;
}

function renderPrepDays() {
  const el = document.getElementById("prep-days");
  if (!el) return;
  el.innerHTML = TRIP.days
    .map((day) => {
      const prep = day.prep || [];
      return `
        <article class="guide-card">
          <h3>${dayHeading(day)}</h3>
          <p>住 ${day.stay || "—"}。${day.path || ""}</p>
          <ul>
            ${prep
              .map(
                (p) =>
                  `<li><strong>${p.need}</strong> — ${p.item}${
                    p.xhs
                      ? ` <a class="xhs-inline" href="${xhsUrl(p.xhs)}" target="_blank" rel="noreferrer">小红书</a>`
                      : ""
                  }</li>`
              )
              .join("")}
          </ul>
        </article>`;
    })
    .join("");
}

function renderPlanTable() {
  const day = currentDay();
  planTableEl.innerHTML = `
    <thead>
      <tr><th>时间</th><th>类型</th><th>内容</th><th>花销（元）</th></tr>
    </thead>
    <tbody>
      ${day.beats
        .map((b) => {
          const mode = b.mode ? `<span class="mode">${b.mode}</span>` : "";
          const xhs = beatXhs(b)
            ? ` <a class="xhs-inline" href="${xhsUrl(beatXhs(b))}" target="_blank" rel="noreferrer" data-xhs>小红书</a>`
            : "";
          return `
        <tr class="plan-row ${b.type}${b.id === activeBeatId ? " is-on" : ""}" data-beat="${b.id}">
          <td class="plan-time">${b.time}</td>
          <td><span class="kind kind-${b.type}">${TYPE_LABEL[b.type]}</span></td>
          <td>${mode}${b.name}${xhs}</td>
          <td class="plan-cost">${formatCost(b)}</td>
        </tr>`;
        })
        .join("")}
    </tbody>`;
}

function planIcon(on) {
  return L.divIcon({
    className: "",
    html: `<div class="plan-pin hotel${on ? " is-on" : ""}"><span></span><b>住</b></div>`,
    iconSize: [30, 38],
    iconAnchor: [15, 36]
  });
}

function photoIcon(beat, on) {
  const src = photoSrc(beat, 240);
  const label = pinLabel(beat);
  return L.divIcon({
    className: "",
    html: `<div class="photo-pin ${beat.type}${on ? " is-on" : ""}">${
      src ? `<img src="${src}" alt="${label}" referrerpolicy="no-referrer" />` : ""
    }<span class="tag">${label}</span></div>`,
    iconSize: [54, 62],
    iconAnchor: [27, 58]
  });
}

function renderPlanMap(mode) {
  if (!planMap) return;
  const day = currentDay();
  planLayer.clearLayers();
  planMarkers = {};
  if (planLine) planMap.removeLayer(planLine);
  if (planHighlight) planMap.removeLayer(planHighlight);
  planLine = null;
  planHighlight = null;

  const mapped = mappedBeats(day);
  const pts = mapped.map((x) => x.ll);
  if (pts.length > 1) {
    planLine = L.polyline(pts, {
      color: "#6a736c",
      weight: 3,
      opacity: 0.42,
      dashArray: "7 7"
    }).addTo(planMap);
  }

  mapped.forEach(({ beat, ll }) => {
    if (beat.type === "commute") return;
    const on = beat.id === activeBeatId;
    const icon = beat.type === "hotel" ? planIcon(on) : photoIcon(beat, on);
    const marker = L.marker(ll, {
      icon,
      zIndexOffset: on ? 800 : beat.type === "hotel" ? 0 : 240
    });
    marker.on("click", () => {
      focusBeat(beat.id, true);
      if (beat.type === "spot" || beat.type === "meal") openBeatSheet(beat);
    });
    marker.addTo(planLayer);
    planMarkers[beat.id] = marker;
  });

  const active = day.beats.find((b) => b.id === activeBeatId);
  if (active && active.type === "commute") {
    const seg = commuteSegment(day, active);
    if (seg) {
      planHighlight = L.polyline(seg, {
        color: "#b85c38",
        weight: 6,
        opacity: 0.92
      }).addTo(planMap);
    }
  }

  if (mode === "focus" && active) {
    if (active.type === "commute") {
      const seg = commuteSegment(day, active);
      if (seg) {
        planMap.fitBounds(L.latLngBounds(seg), { padding: [48, 48], maxZoom: 15, animate: true });
      } else {
        const ll = beatLatLng(active);
        if (ll) planMap.flyTo(ll, Math.max(planMap.getZoom() || 14, 14), { duration: 0.45 });
      }
    } else {
      const ll = beatLatLng(active);
      if (ll) planMap.flyTo(ll, Math.max(planMap.getZoom() || 14, 15), { duration: 0.45 });
    }
  } else if (pts.length) {
    planMap.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 14 });
  }
  requestAnimationFrame(() => planMap.invalidateSize());
}

function focusBeat(id, scroll) {
  activeBeatId = id;
  renderPlanTable();
  renderBeatDetail();
  renderPlanMap("focus");
  if (scroll) {
    const row = planTableEl.querySelector(`[data-beat="${id}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }
}

function renderTripBudget() {
  const el = document.getElementById("trip-budget");
  if (!el) return;
  const cost = tripCost();
  const rateText = (cost.rate * 100).toFixed(1).replace(/\.0$/, "");
  const stayText = cost.stays.map((s) => `${s.city} ${s.nights} 晚`).join(" + ");
  el.innerHTML = `
    <div class="trip-budget-main">
      <span class="k">全程花销预估</span>
      <strong>人均约 ${cost.per} 元</strong>
      <small>两人约 ${cost.two} 元 · 不含机票</small>
    </div>
    <ul>
      <li>玩乐、吃饭、交通：人均约 <strong>${cost.playPer}</strong> 元（两人约 ${cost.playTwo} 元，含大阪→东京机票）</li>
      <li>住宿 ${cost.nights} 晚：人均约 <strong>${Math.round(cost.hotel / 2)}</strong> 元（${cost.hotel} 元 / 两城标间，${stayText}）</li>
    </ul>
    <p>按 100 日元 ≈ ${rateText} 元估算。大阪难波一晚约 1.8 万日元，东京新宿一晚约 2 万日元。全程含 10/05 入住当晚，10/12 退房不再计房费。不含往返机票。</p>
  `;
}

function renderExtraDays() {
  const el = document.getElementById("extra-days");
  if (!el) return;
  const list = TRIP.extraDays || [];
  if (!list.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <h3>如果能多玩 1 天</h3>
    <p>主线是 10/05 启程、10/12 返程。下面是机票或酒店能再改时的加一天选项，不要塞进现有七天。</p>
    <div class="extra-grid">
      ${list
        .map(
          (item) => `
        <article class="extra-card">
          <h4>${item.title}</h4>
          <p class="extra-when">${item.when}</p>
          <p>${item.why}</p>
          <small>${item.where} · ${item.cost}</small>
        </article>`
        )
        .join("")}
    </div>
  `;
}

function renderDays() {
  const day = currentDay();
  if (!activeBeatId || !day.beats.some((b) => b.id === activeBeatId)) {
    activeBeatId = day.beats[0].id;
  }
  renderDayTabs();
  renderTripBudget();
  renderExtraDays();
  renderDayOverview();
  renderBeatDetail();
  renderPlanTable();
  renderPlanMap("day");
}

function initPlanMap() {
  planMap = L.map("plan-map", {
    scrollWheelZoom: false,
    zoomControl: true
  }).setView([35.6812, 139.7671], 12);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    maxZoom: 19,
    subdomains: "abcd"
  }).addTo(planMap);
  planLayer = L.layerGroup().addTo(planMap);
  planMap.on("click", () => planMap.scrollWheelZoom.enable());
  planMap.on("mouseout", () => planMap.scrollWheelZoom.disable());
  renderPlanMap();
}

function syncPlanMap() {
  if (typeof L === "undefined") return;
  const run = () => {
    if (!planMap) initPlanMap();
    else {
      planMap.invalidateSize();
      renderPlanMap();
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
}

function openSpot(id) {
  const spot = TRIP.spots.find((s) => s.id === id);
  if (!spot) return;
  const saved = liked.has(spot.id);
  const keywords = spot.xhs || [];
  modal.hidden = false;
  modal.classList.add("is-open");
  modal.innerHTML = `
    <div class="sheet">
      ${galleryHtml(spot, spot.name)}
      <div class="sheet-body">
        <button class="close" type="button" data-close>×</button>
        <div class="en">${spot.group || ""} · ${spot.area}</div>
        <h2>${spot.name}</h2>
        <p style="margin:0;color:var(--muted);">${spot.en}</p>
        ${spotGuideBlock(spot)}
        <dl>
          <dt>进入</dt><dd>${spot.enter}</dd>
          <dt>时长</dt><dd>${spot.duration}</dd>
          <dt>注意</dt><dd>${spot.note}</dd>
        </dl>
        ${
          keywords.length
            ? `<div class="sheet-xhs-links">
          <div class="xhs-kicker">小红书</div>
          <div class="xhs-chips">
            ${keywords.map((kw) => `<a href="${xhsUrl(kw)}" target="_blank" rel="noreferrer">${kw}</a>`).join("")}
          </div>
        </div>`
            : ""
        }
        <div class="actions">
          <button class="btn primary" data-like="${spot.id}">${saved ? "已收藏" : "收藏这个点"}</button>
          ${
            keywords[0]
              ? `<a class="btn ghost" target="_blank" rel="noreferrer" href="${xhsUrl(keywords[0])}">打开小红书</a>`
              : ""
          }
          <a class="btn ghost" target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.map)}">打开地图</a>
        </div>
      </div>
    </div>`;
  bindGallery(modal);
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.hidden = true;
  modal.innerHTML = "";
}

function openBeatSheet(beat) {
  if (!beat) return;
  if (beat.spotId) {
    openSpot(beat.spotId);
    return;
  }
  const xhs = beatXhs(beat);
  modal.hidden = false;
  modal.classList.add("is-open");
  modal.innerHTML = `
    <div class="sheet">
      ${galleryHtml(beat, beat.name)}
      <div class="sheet-body">
        <button class="close" type="button" data-close>×</button>
        <div class="en">${TYPE_LABEL[beat.type] || ""} · ${beat.time}${beat.mode ? " · " + beat.mode : ""}</div>
        <h2>${beat.name}</h2>
        <p class="beat-cost">基础花销：${formatCost(beat)}</p>
        <p>${beatDetailText(beat)}</p>
        ${
          xhs
            ? `<div class="sheet-xhs-links">
          <div class="xhs-kicker">小红书</div>
          <div class="xhs-chips">
            <a href="${xhsUrl(xhs)}" target="_blank" rel="noreferrer">${xhs}</a>
          </div>
        </div>`
            : ""
        }
      </div>
    </div>`;
  bindGallery(modal);
}

if (board) {
  board.addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (card) openSpot(card.dataset.id);
  });
}

modal.addEventListener("click", (e) => {
  if (e.target === modal || e.target.dataset.close !== undefined) closeModal();
  const like = e.target.closest("[data-like]");
  if (like) {
    const id = like.dataset.like;
    if (liked.has(id)) liked.delete(id);
    else liked.add(id);
    localStorage.setItem("liked-spots", JSON.stringify([...liked]));
    openSpot(id);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
  const box = modal.querySelector("[data-gallery]");
  if (!box || !box._galleryShow || modal.hidden) return;
  if (e.key === "ArrowRight") box._galleryShow(box._galleryIndex() + 1);
  if (e.key === "ArrowLeft") box._galleryShow(box._galleryIndex() - 1);
});

const atlasList = document.getElementById("atlas-list");
let leafletMap = null;
let markerLayer = null;
let markersById = {};
let activeMapId = "";

function mapSpots() {
  return TRIP.spots
    .filter((spot) => spot.lat != null && spot.lng != null && spot.onMap !== false)
    .slice()
    .sort((a, b) => {
      const da = a.optional || !a.day ? 99 : a.day;
      const db = b.optional || !b.day ? 99 : b.day;
      return da - db;
    });
}

function spotDayKey(spot) {
  return spot.optional || !spot.day ? "opt" : "d" + spot.day;
}

function spotDayLabel(spot) {
  return spot.optional || !spot.day ? "备选" : "D" + spot.day;
}

function pinIcon(spot, on) {
  const src = photoSrc(spot, 240);
  const day = spotDayKey(spot);
  return L.divIcon({
    className: "",
    html: `<div class="photo-pin map spot day-${day}${on ? " is-on" : ""}">${
      src ? `<img src="${src}" alt="${spot.name}" />` : ""
    }<span class="day-mark">${spotDayLabel(spot)}</span><span class="tag">${spot.name}</span></div>`,
    iconSize: [56, 66],
    iconAnchor: [28, 62]
  });
}

function renderAtlasList(spots) {
  if (!atlasList) return;
  if (!spots.length) {
    atlasList.innerHTML = `<p style="margin:12px 8px;color:var(--muted);font-size:14px;">暂时没有可标在图上的点。</p>`;
    return;
  }
  atlasList.innerHTML = spots
    .map(
      (spot, i) => `
      <button class="atlas-item day-${spotDayKey(spot)}${spot.id === activeMapId ? " is-on" : ""}" data-map-id="${spot.id}">
        <span class="n">${photoList(spot).length ? `<img src="${photoSrc(spot, 200)}" alt="" />` : i + 1}</span>
        <span>
          <h3>${spot.name}</h3>
          <small>${spot.area || ""}</small>
        </span>
        <span class="day-tag">${spotWhenLabel(spot)}</span>
      </button>`
    )
    .join("");
}

function popupHtml(spot) {
  const when = spotWhenLabel(spot);
  return `
    <div class="map-pop">
      <strong>${spot.name}</strong>
      <em>${when} · ${spot.en} · ${spot.area}</em>
      <span>建议 ${spot.duration}</span>
      <button type="button" data-open-spot="${spot.id}">查看详情</button>
    </div>`;
}

function fitToSpots(spots) {
  if (!spots.length) return;
  const bounds = L.latLngBounds(spots.map((s) => [s.lat, s.lng]));
  leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
}

function renderMap() {
  if (!leafletMap) return;
  const spots = mapSpots();
  markerLayer.clearLayers();
  markersById = {};
  spots.forEach((spot) => {
    const marker = L.marker([spot.lat, spot.lng], {
      icon: pinIcon(spot, spot.id === activeMapId),
      zIndexOffset: spot.id === activeMapId ? 800 : 0
    });
    marker.on("click", () => {
      activeMapId = spot.id;
      refreshAtlasIcons();
      renderAtlasList(spots);
      openSpot(spot.id);
    });
    marker.addTo(markerLayer);
    markersById[spot.id] = marker;
  });
  renderAtlasList(spots);
  fitToSpots(spots);
  requestAnimationFrame(() => leafletMap.invalidateSize());
}

function refreshAtlasIcons() {
  mapSpots().forEach((spot) => {
    const marker = markersById[spot.id];
    if (marker) {
      marker.setIcon(pinIcon(spot, spot.id === activeMapId));
      marker.setZIndexOffset(spot.id === activeMapId ? 800 : 0);
    }
  });
}

function focusSpot(id) {
  const spots = mapSpots();
  const spot = spots.find((s) => s.id === id);
  if (!spot || !markersById[id]) return;
  activeMapId = id;
  refreshAtlasIcons();
  renderAtlasList(spots);
  leafletMap.flyTo([spot.lat, spot.lng], Math.max(leafletMap.getZoom(), 14), { duration: 0.6 });
  openSpot(id);
}

function initMap() {
  leafletMap = L.map("leaflet-map", {
    scrollWheelZoom: false,
    zoomControl: true
  }).setView([35.6812, 139.7671], 12);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    maxZoom: 19,
    subdomains: "abcd"
  }).addTo(leafletMap);

  markerLayer = L.layerGroup().addTo(leafletMap);
  leafletMap.on("click", () => leafletMap.scrollWheelZoom.enable());
  leafletMap.on("mouseout", () => leafletMap.scrollWheelZoom.disable());
  renderMap();
}

atlasList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-map-id]");
  if (btn) focusSpot(btn.dataset.mapId);
});

dayTabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-plan-day]");
  if (!btn) return;
  planDay = Number(btn.dataset.planDay);
  activeBeatId = "";
  renderDays();
});

const noteJump = document.getElementById("note-jump");
if (noteJump) {
  noteJump.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-scroll]");
    if (!btn) return;
    const target = document.getElementById(btn.dataset.scroll);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

planTableEl.addEventListener("click", (e) => {
  if (e.target.closest("[data-xhs]")) return;
  const row = e.target.closest("[data-beat]");
  if (row) focusBeat(row.dataset.beat, false);
});

document.addEventListener("click", (e) => {
  const open = e.target.closest("[data-open-spot]");
  if (open) openSpot(open.dataset.openSpot);
});

renderSpots();
renderDays();
renderPrepDays();

const PANELS = ["plan", "spots", "atlas", "notes", "geo", "posts"];
const stage = document.querySelector(".stage");

function currentPanel() {
  const id = location.hash.replace("#", "");
  return PANELS.includes(id) ? id : "plan";
}

function syncMap() {
  if (typeof L === "undefined") {
    const box = document.getElementById("leaflet-map");
    if (box && !box.dataset.failed) {
      box.dataset.failed = "1";
      box.innerHTML = '<p style="padding:28px;color:#7a7268;">地图脚本没有加载出来，刷新页面或检查网络后再试。</p>';
    }
    return;
  }
  const run = () => {
    if (!leafletMap) initMap();
    else {
      leafletMap.invalidateSize();
      renderMap();
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
}

function showPanel(id, push) {
  if (!PANELS.includes(id)) id = "plan";
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("is-on", panel.id === id);
  });
  document.querySelectorAll("[data-panel]").forEach((el) => {
    el.classList.toggle("is-on", el.dataset.panel === id);
  });
  if (stage) stage.scrollTop = 0;
  if (push && location.hash !== "#" + id) {
    history.pushState({ panel: id }, "", "#" + id);
  }
  if (id === "atlas") syncMap();
  if (id === "plan") syncPlanMap();
}

document.querySelector(".app").addEventListener("click", (e) => {
  const link = e.target.closest("[data-panel]");
  if (!link) return;
  e.preventDefault();
  showPanel(link.dataset.panel, true);
});

window.addEventListener("popstate", () => showPanel(currentPanel(), false));

function resizeMaps() {
  if (planMap) planMap.invalidateSize();
  if (leafletMap) leafletMap.invalidateSize();
}

function setSidebarCollapsed(collapsed) {
  const app = document.querySelector(".app");
  const btn = document.querySelector(".side-toggle");
  app.classList.toggle("is-side-collapsed", collapsed);
  if (btn) {
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.title = collapsed ? "展开侧栏" : "折叠侧栏";
  }
  localStorage.setItem("side-collapsed", collapsed ? "1" : "0");
  requestAnimationFrame(() => requestAnimationFrame(resizeMaps));
}

const sideToggle = document.querySelector(".side-toggle");
if (sideToggle) {
  sideToggle.addEventListener("click", () => {
    setSidebarCollapsed(!document.querySelector(".app").classList.contains("is-side-collapsed"));
  });
}
setSidebarCollapsed(localStorage.getItem("side-collapsed") === "1");

showPanel(currentPanel(), false);
