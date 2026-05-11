const page = document.body.dataset.page;

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getMatchTitle(match) {
  return `${match.home} ${match.score || "vs"} ${match.away}`;
}

function resultClass(result) {
  if (result === "correct") return "good";
  if (result === "close") return "warn";
  if (result === "wrong") return "bad";
  return "";
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function predictionAccuracy(matches) {
  const completed = matches.filter((match) => ["correct", "close", "wrong"].includes(match.prediction?.result));
  if (!completed.length) return 0;
  const points = completed.reduce((sum, match) => {
    if (match.prediction.result === "correct") return sum + 1;
    if (match.prediction.result === "close") return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((points / completed.length) * 100);
}

function playerStats(matches) {
  const stats = new Map();
  matches.forEach((match) => {
    (match.ratings || []).forEach((rating) => {
      if (!stats.has(rating.player)) stats.set(rating.player, { player: rating.player, ratings: [], motm: 0 });
      const entry = stats.get(rating.player);
      entry.ratings.push(Number(rating.rating));
      if (rating.motm) entry.motm += 1;
    });
  });
  return [...stats.values()]
    .map((entry) => ({
      ...entry,
      average: average(entry.ratings),
      appearances: entry.ratings.length,
    }))
    .sort((a, b) => b.average - a.average);
}

function matchCard(match) {
  const card = document.createElement("a");
  card.className = "match-card";
  card.href = `match.html?id=${encodeURIComponent(match.id)}`;
  card.innerHTML = `
    <span class="pill">${match.status}</span>
    <time>${formatDate(match.date)}</time>
    <h3>${getMatchTitle(match)}</h3>
    <p>${match.headline}</p>
    <div class="meta-row">
      <span>${match.competition}</span>
      <span>${match.mood}</span>
    </div>
  `;
  return card;
}

function renderHome(data) {
  const matches = [...data.matches].sort((a, b) => new Date(b.date) - new Date(a.date));
  const played = matches.filter((match) => match.status === "played");
  const upcoming = [...data.matches].filter((match) => match.status === "upcoming").sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = played[0];
  const stats = playerStats(data.matches);

  document.querySelector("#season-mood").textContent = data.season.mood;
  document.querySelector("#season-note").textContent = data.season.note;
  document.querySelector("#prediction-accuracy").textContent = `${predictionAccuracy(data.matches)}%`;
  document.querySelector("#top-player").textContent = stats[0]?.player || "--";
  document.querySelector("#top-player-note").textContent = stats[0] ? `${stats[0].average.toFixed(1)} average rating` : "average rating";

  document.querySelector("#latest-match").innerHTML = latest ? `
    <p class="kicker">latest reaction</p>
    <h2>${getMatchTitle(latest)}</h2>
    <time>${formatDate(latest.date)}</time>
    <p>${latest.reaction}</p>
    <a class="button button-light" href="match.html?id=${encodeURIComponent(latest.id)}">Read Reaction</a>
  ` : `<p class="kicker">latest reaction</p><h2>nothing yet</h2>`;

  document.querySelector("#recent-matches").replaceChildren(...played.slice(0, 4).map(matchCard));
  document.querySelector("#talking-points").replaceChildren(
    ...data.talkingPoints.map((point) => {
      const item = document.createElement("p");
      item.textContent = point;
      return item;
    }),
  );

  const next = upcoming[0];
  document.querySelector("#next-match").innerHTML = next ? `
    <h3>${next.home} vs ${next.away}</h3>
    <time>${formatDate(next.date)}</time>
    <p>${next.prediction.note}</p>
    <strong>${next.prediction.score}</strong>
  ` : `<h3>no upcoming match added</h3><p>add one in data/site.json</p>`;
}

function renderMatches(data) {
  const list = document.querySelector("#matches-list");
  const filters = document.querySelectorAll("[data-filter]");

  function draw(filter = "all") {
    const matches = [...data.matches]
      .filter((match) => filter === "all" || (filter === "reaction" ? match.status === "played" : match.status === "upcoming"))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    list.replaceChildren(...matches.map(matchCard));
  }

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      filters.forEach((entry) => entry.classList.remove("active"));
      button.classList.add("active");
      draw(button.dataset.filter);
    });
  });

  draw();
}

function renderMatch(data) {
  const id = new URLSearchParams(window.location.search).get("id");
  const match = data.matches.find((entry) => entry.id === id);
  const root = document.querySelector("#match-detail");

  if (!match) {
    root.innerHTML = `<a class="back-link" href="matches.html">Back to Matches</a><h1>Match not found</h1><p>That match id does not exist in the JSON.</p>`;
    return;
  }

  document.title = `${getMatchTitle(match)} | Notts County`;
  root.innerHTML = `
    <a class="back-link" href="matches.html">Back to Matches</a>
    <p class="kicker">${match.competition}</p>
    <h1>${getMatchTitle(match)}</h1>
    <time>${formatDate(match.date)} - ${match.venue}</time>
    <div class="match-badges">
      <span>${match.status}</span>
      <span>${match.mood}</span>
      <span>prediction ${match.prediction.score}</span>
    </div>
    <section class="panel detail-section">
      <p class="kicker">reaction</p>
      <p>${match.reaction || "Reaction coming after the match."}</p>
    </section>
    <section class="detail-grid">
      <div class="panel">
        <p class="kicker">talking points</p>
        <ul>${match.talkingPoints.map((point) => `<li>${point}</li>`).join("")}</ul>
      </div>
      <div class="panel">
        <p class="kicker">highlights</p>
        <ul>${(match.highlights.length ? match.highlights : ["not played yet"]).map((point) => `<li>${point}</li>`).join("")}</ul>
      </div>
    </section>
    <section class="panel">
      <p class="kicker">player ratings</p>
      <div class="rating-list">
        ${(match.ratings.length ? match.ratings : [{ player: "ratings pending", rating: "-", note: "check back after the match" }]).map((rating) => `
          <div class="rating-row">
            <strong>${rating.player}</strong>
            <span>${rating.note || ""}</span>
            <b>${rating.rating}</b>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPredictions(data) {
  const completed = data.matches.filter((match) => ["correct", "close", "wrong"].includes(match.prediction?.result));
  document.querySelector("#prediction-page-accuracy").textContent = `${predictionAccuracy(data.matches)}%`;
  document.querySelector("#prediction-boldness").textContent = `${Math.round(average(data.matches.map((match) => match.prediction?.confidence || 0)))}%`;

  document.querySelector("#predictions-list").replaceChildren(
    ...[...data.matches].sort((a, b) => new Date(b.date) - new Date(a.date)).map((match) => {
      const card = document.createElement("article");
      card.className = "match-card";
      card.innerHTML = `
        <span class="pill ${resultClass(match.prediction.result)}">${match.prediction.result}</span>
        <time>${formatDate(match.date)}</time>
        <h3>${match.home} vs ${match.away}</h3>
        <p>${match.prediction.note}</p>
        <div class="meta-row">
          <span>prediction ${match.prediction.score}</span>
          <span>${match.prediction.confidence}% confidence</span>
        </div>
      `;
      return card;
    }),
  );

  if (!completed.length) document.querySelector("#prediction-page-accuracy").textContent = "--%";
}

function renderRatings(data) {
  const stats = playerStats(data.matches);
  document.querySelector("#ratings-leaderboard").innerHTML = stats.map((entry, index) => `
    <div class="rating-row leaderboard-row">
      <strong>${index + 1}. ${entry.player}</strong>
      <span>${entry.appearances} apps - ${entry.motm} MOTM</span>
      <b>${entry.average.toFixed(1)}</b>
    </div>
  `).join("") || `<p>No ratings yet.</p>`;

  document.querySelector("#ratings-by-match").replaceChildren(
    ...data.matches.filter((match) => match.ratings.length).map((match) => {
      const card = document.createElement("a");
      card.className = "match-card";
      card.href = `match.html?id=${encodeURIComponent(match.id)}`;
      const avg = average(match.ratings.map((rating) => Number(rating.rating)));
      const motm = match.ratings.find((rating) => rating.motm);
      card.innerHTML = `
        <span class="pill">ratings</span>
        <time>${formatDate(match.date)}</time>
        <h3>${getMatchTitle(match)}</h3>
        <p>average rating ${avg.toFixed(1)}${motm ? ` - MOTM ${motm.player}` : ""}</p>
      `;
      return card;
    }),
  );
}

async function loadData() {
  const response = await fetch(`data/site.json?v=${Date.now()}`);
  const data = await response.json();
  if (page === "home") renderHome(data);
  if (page === "matches") renderMatches(data);
  if (page === "match") renderMatch(data);
  if (page === "predictions") renderPredictions(data);
  if (page === "ratings") renderRatings(data);
}

loadData().catch((error) => {
  document.querySelector(".app").innerHTML = `<section class="panel"><p class="kicker">error</p><h1>Could not load Notts data</h1><p>${error.message}</p></section>`;
});
