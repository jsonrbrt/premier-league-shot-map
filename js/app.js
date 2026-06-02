const state = {
  viewMode: "team",
  team: "All",
  shotType: "all",
  player: "",
};

let allShots = [];

// Data loading
async function loadData() {
  const status = document.getElementById("status");

  try {
    // Loading state
    if (status) status.textContent = "Loading shot data...";

    const response = await fetch("./data/epl_shot_25_26_complete.json");

    if (!response.ok) {
      throw new Error("Failed to fetch data");
    }

    allShots = await response.json();

    // Success
    if (status) status.textContent = "";

    initTeamDropdown(allShots);
    initEventListeners();
    initPlayerOptions(allShots);
    // Initial visibility
    updateControlVisibility();
    renderTeam(allShots, state);
  } catch (err) {
    console.error(err);

    if (status) status.textContent = "Failed to load shot data.";
  }
}

// Setup functions

function initTeamDropdown(shots) {
  const select = document.getElementById("teamSelect");

  select.innerHTML = "";

  const teams = [...new Set(shots.map((s) => s.team))].sort();
  teams.unshift("All");

  teams.forEach((team) => {
    const opt = document.createElement("option");
    opt.value = team;
    opt.textContent = team;
    select.appendChild(opt);
  });

  state.team = teams[1];
  renderTeam(shots, state);

  select.addEventListener("change", (e) => {
    state.team = e.target.value;

    renderTeam(shots, state);
  });
}

function initEventListeners() {
  const viewMode = document.getElementById("viewMode");
  const shotFilter = document.getElementById("shotFilter");
  const playerSearch = document.getElementById("playerSearch");

  viewMode.addEventListener("change", (e) => {
    state.viewMode = e.target.value;

    if (state.viewMode === "team") {
      state.player = "";
      document.getElementById("playerSearch").value = "";
    } else {
      state.team = "";
      document.getElementById("teamSelect").value = "All";
    }
    updateControlVisibility();
    renderTeam(allShots, state);
  });

  shotFilter.addEventListener("change", (e) => {
    state.shotType = e.target.value;
    renderTeam(allShots, state);
  });

  playerSearch.addEventListener("input", (e) => {
    state.player = e.target.value;
    renderTeam(allShots, state);
  });
}

function updateControlVisibility() {
  const teamSelect = document.getElementById("teamSelect");
  const playerSearch = document.getElementById("playerSearch");

  if (state.viewMode === "team") {
    teamSelect.style.display = "inline-block";
    playerSearch.style.display = "none";
  } else {
    teamSelect.style.display = "none";
    playerSearch.style.display = "inline-block";
  }
}

function initPlayerOptions(shots) {
  const datalist = document.getElementById("playerOptions");

  const players = [...new Set(shots.map((s) => s.player))].sort();

  datalist.innerHTML = "";

  players.forEach((player) => {
    const option = document.createElement("option");
    option.value = player;
    datalist.appendChild(option);
  });
}

function renderTeam(shots, state) {
  const { viewMode, team, shotType, player } = state;

  // DOM
  const svg = document.getElementById("home-pitch");
  const title = document.getElementById("home-title");
  const subtitle = document.getElementById("subtitle");
  const statsPanel = document.getElementById("stats-panel");

  // Stats data: team and player only
  let statsShots = shots;

  if (state.viewMode === "team") {
    // Team filter
    if (team != "All") {
      statsShots = statsShots.filter((s) => s.team === team);
    }
  }

  // Player filter
  if (state.viewMode === "player" && player.trim() !== "") {
    const search = player.trim().toLowerCase();
    const exactMatches = statsShots.filter(
      (s) => s.player.toLowerCase() === search,
    );
    const partialMatches = statsShots.filter((s) =>
      s.player.toLowerCase().includes(search),
    );

    statsShots = exactMatches.length > 0 ? exactMatches : partialMatches;
  }

  console.log("viewMode:", state.viewMode);
  console.log("player input:", player);
  console.log("statsShots after player filter:", statsShots.length);
  console.log(statsShots.slice(0, 5).map((s) => s.player));

  // Map data: team + player + outcome
  let mapShots = statsShots;

  // Shot type filter
  if (shotType !== "all") {
    if (shotType === "goal") {
      mapShots = mapShots.filter((s) => s.result === "Goal");
    } else if (shotType === "miss") {
      mapShots = mapShots.filter(
        (s) => s.shotType === "miss" || s.shotType === "post",
      );
    } else {
      mapShots = mapShots.filter((s) => s.shotType === shotType);
    }
  }

  // Stats
  const totalShots = statsShots.length;
  const goals = statsShots.filter((s) => s.result === "Goal").length;
  const totalXg = statsShots.reduce((sum, s) => sum + (s.xg || 0), 0);
  const avgXg = totalShots > 0 ? totalXg / totalShots : 0;
  const xgDiff = goals - totalXg;
  const sign = xgDiff >= 0 ? "+" : "";

  // Stats panel
  if (statsShots.length === 0) {
    statsPanel.innerHTML = `
    <div class="stats">
      <span>No shots found for this selection.</span>
    </div>
    `;
  } else {
    statsPanel.innerHTML = `
  <div class="stats">
    <span><b>Shots:</b> ${totalShots}</span>
    <span><b>Goals:</b> ${goals}</span>
    <span><b>xG:</b> ${totalXg.toFixed(2)}</span>
    <span style="color: ${xgDiff >= 0 ? "green" : "red"}">
        <b>Goals - xG:</b> ${sign}${xgDiff.toFixed(2)}
    </span>
    <span><b>xG per shot:</b> ${avgXg.toFixed(2)}</span>
  </div>
    `;
  }

  // Title
  if (state.viewMode === "player" && player.trim() !== "") {
    const uniquePlayers = [...new Set(statsShots.map((s) => s.player))];

    if (uniquePlayers.length === 1) {
      title.textContent = `${uniquePlayers[0]}`;
    } else {
      title.textContent = `${player} | ${uniquePlayers.length} matching players | 2025-26`;
    }
  } else if ((team === "All")) {
    title.textContent = "All Teams | All shots in the Premier League | 2025-26";
  } else {
    title.textContent = `${team} | 2025-26`;
  }

  // Subtitle
  subtitle.textContent =
    "All non own-goal shots, size of dots indicate xG value";

  // Render pitch
  svg.innerHTML = "";
  createHalfPitch("home-pitch");

  plotShots(mapShots, svg);
}

function plotShots(shots, svg) {
  const width = 400;
  const height = 500;

  const NS = "http://www.w3.org/2000/svg";

  function draw(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (let key in attrs) el.setAttribute(key, attrs[key]);
    svg.appendChild(el);
    return el;
  }

  shots.forEach((shot) => {
    const isHistoric = shot.historic === true;
    if (typeof shot.x !== "number" || typeof shot.y !== "number") return;

    let x = shot.x;
    let y = shot.y;

    if (y > 0.5) {
      x = 1 - x;
      y = 1 - y;
    }

    const plotX = x * width;
    const plotY = (y / 0.5) * height;

    const xg = typeof shot.xg === "number" ? shot.xg : 0;
    const radius = 2 + Math.sqrt(xg) * 12;
    const tooltip = document.getElementById("tooltip");

    const circle = draw("circle", {
      cx: plotX,
      cy: plotY,
      r: isHistoric ? radius + 3 : radius,
      fill:
        shot.result === "Goal"
          ? "#e63946"
          : shot.shotType === "save"
            ? "#f4a261"
            : shot.shotType === "block"
              ? "#b5179e"
              : "rgba(100, 149, 237, 0.6)",
      opacity: 0.7,

      stroke: isHistoric ? "#f4c542" : "none",
      "stroke-width": isHistoric ? 3 : 0,
    });

    if (isHistoric) {
      draw("text", {
        x: plotX + 2,
        y: plotY - 14,
        fill: "#b08900",
        "font-size": "11",
        "font-weight": "700",
      }).textContent = "🏆 Historic Goal";
    }

    circle.addEventListener("mousemove", (e) => {
      tooltip.style.display = "block";
      tooltip.style.left = e.pageX + 10 + "px";
      tooltip.style.top = e.pageY + 10 + "px";

      tooltip.innerHTML = `
    <strong>${shot.player || "Unknown"}</strong><br>
    v ${shot.opponent}<br>
    xG: ${xg.toFixed(2)}<br>
    Minute: ${shot.minute}<br>
    Outcome: ${shot.shotType}<br>
    ${
      isHistoric
        ? `<span class="historic-note">${shot.historicLabel}</span>`
        : ""
    }
  `;
    });

    circle.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  });
}

function createHalfPitch(svgId) {
  const svg = document.getElementById(svgId);

  const width = 400;
  const height = 500;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const NS = "http://www.w3.org/2000/svg";

  function draw(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (let key in attrs) el.setAttribute(key, attrs[key]);
    svg.appendChild(el);
    return el;
  }

  // --- REAL PITCH DIMENSIONS (in meters)
  const pitchLength = 52.5; // half pitch
  const pitchWidth = 68;

  const scaleX = width / pitchWidth;
  const scaleY = height / pitchLength;

  // Helper converters
  const mx = (m) => m * scaleX;
  const my = (m) => m * scaleY;

  // Common line style
  const line = {
    stroke: "#222",
    "stroke-width": 1.5,
    fill: "none",
  };

  // --- Background
  draw("rect", {
    width,
    height,
    fill: "#f4f4f4",
  });

  // --- Outer boundary
  draw("rect", {
    x: 0,
    y: 0,
    width,
    height,
    ...line,
  });

  // --- Penalty box (16.5m deep, 40.32m wide)
  const penaltyBoxWidth = 40.32;
  const penaltyBoxDepth = 16.5;

  draw("rect", {
    x: (width - mx(penaltyBoxWidth)) / 2,
    y: 0,
    width: mx(penaltyBoxWidth),
    height: my(penaltyBoxDepth),
    ...line,
  });

  // --- Six-yard box (5.5m deep, 18.32m wide)
  const sixYardWidth = 18.32;
  const sixYardDepth = 5.5;

  draw("rect", {
    x: (width - mx(sixYardWidth)) / 2,
    y: 0,
    width: mx(sixYardWidth),
    height: my(sixYardDepth),
    ...line,
  });

  // --- Goal (7.32m wide, ~2m depth just for visuals)
  const goalWidth = 7.32;

  draw("rect", {
    x: (width - mx(goalWidth)) / 2,
    y: 0,
    width: mx(goalWidth),
    height: 5,
    fill: "#222",
  });

  // --- Penalty spot (11m)
  const spotX = width / 2;
  const spotY = my(11);

  draw("circle", {
    cx: spotX,
    cy: spotY,
    r: 2.5,
    fill: "#222",
  });

  // --- Penalty arc (radius 9.15m)
  const arcRadius = my(9.15);

  const boxEdgeY = my(penaltyBoxDepth);
  const dy = boxEdgeY - spotY;
  const dx = Math.sqrt(arcRadius ** 2 - dy ** 2);

  const arcPath = `
    M ${spotX - dx} ${boxEdgeY}
    A ${arcRadius} ${arcRadius} 0 0 0 ${spotX + dx} ${boxEdgeY}
  `;

  draw("path", {
    d: arcPath,
    ...line,
  });

  // --- Halfway circle (radius 9.15m)
  draw("circle", {
    cx: width / 2,
    cy: height,
    r: my(9.15),
    ...line,
  });
}

loadData();
