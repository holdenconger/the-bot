const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const output = document.getElementById("output");
const modeSelect = document.getElementById("mode-select");

let currentMode = modeSelect.value;

modeSelect.addEventListener("change", () => {
  currentMode = modeSelect.value;
  appendLine("system", `MODE SET: ${labelForMode(currentMode)}`);
});

sendBtn.addEventListener("click", onSend);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onSend();
});

async function onSend() {
  const query = input.value.trim();
  if (!query) return;

  input.value = "";
  appendLine("user", query);

  if (handleCommand(query)) return;

  if (isMathExpression(query) && currentMode !== "images") {
    try {
      const result = safeMath(query);
      typeLine("ai", `CALCULATION: ${result}`);
      return;
    } catch {
      // If parsing fails, continue to web search.
    }
  }

  if (currentMode === "images") {
    await imageOnlyMode(query);
    return;
  }

  await answerTextMode(query, currentMode);
}

function handleCommand(query) {
  const q = query.toLowerCase();

  if (q === "/clear") {
    output.innerHTML = "";
    appendLine("system", "CLEARED.");
    return true;
  }

  if (q.startsWith("/mode ")) {
    const next = q.slice(6).trim();
    if (!["full", "summarize", "images"].includes(next)) {
      appendLine("error", "Use /mode full, /mode summarize, or /mode images");
      return true;
    }
    currentMode = next;
    modeSelect.value = next;
    appendLine("system", `MODE SET: ${labelForMode(currentMode)}`);
    return true;
  }

  return false;
}

function labelForMode(mode) {
  if (mode === "full") return "FULL ANSWER";
  if (mode === "summarize") return "SUMMARIZE";
  return "IMAGE ONLY";
}

async function answerTextMode(query, mode) {
  appendLine("system", "FETCHING WIKIPEDIA + DUCKDUCKGO...");

  const [wikiResult, duckResult] = await Promise.allSettled([
    getBestWikiResult(query),
    getDuckResult(query),
  ]);

  const wiki = wikiResult.status === "fulfilled" ? wikiResult.value : null;
  const duck = duckResult.status === "fulfilled" ? duckResult.value : null;

  const longAnswer = buildFullAnswer(query, wiki, duck);
  if (!longAnswer) {
    appendLine("error", "No useful result. Try a more specific question.");
    return;
  }

  if (mode === "summarize") {
    // Local summarizer: no external summarize API call.
    const summarized = summarizeLocally(longAnswer, query, 2, 300);
    typeLine("ai", summarized);
  } else {
    typeLine("ai", longAnswer);
  }

  if (wiki?.image) {
    appendImage(wiki.image, wiki.title || "Wikipedia image");
  }
}

async function imageOnlyMode(query) {
  appendLine("system", "IMAGE MODE ACTIVE: FETCHING IMAGES...");
  const images = await getTopicImages(query, 6);

  if (!images.length) {
    appendLine("error", "No images found. Try a clearer topic.");
    return;
  }

  appendLine("ai", `Showing ${images.length} image(s) for "${query}"`);
  for (const item of images) {
    appendImage(item.src, item.caption);
  }
}

function buildFullAnswer(query, wiki, duck) {
  const parts = [];

  if (wiki?.title || wiki?.summary) {
    const heading = wiki.title ? `${wiki.title}` : "Wikipedia";
    const body = wiki.summary || "";
    if (body) parts.push(`${heading}: ${body}`);
  }

  if (duck?.text) {
    parts.push(`DuckDuckGo: ${duck.text}`);
  }

  if (!parts.length) return "";

  if (!wiki?.summary && !duck?.text) {
    parts.push(`No direct match found for "${query}".`);
  }

  return parts.join("\n\n");
}

function summarizeLocally(text, query, maxSentences = 2, maxChars = 320) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "No summary available.";

  const sentences = clean.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) || [];
  if (!sentences.length) return clean.slice(0, maxChars);

  if (sentences.length <= maxSentences) {
    return trimToChars(sentences.join(" "), maxChars);
  }

  const queryTerms = tokenize(query);
  const scored = sentences.map((sentence, idx) => {
    const words = tokenize(sentence);
    const overlap = words.reduce((acc, w) => acc + (queryTerms.has(w) ? 1 : 0), 0);
    const lengthBonus = Math.min(words.length, 24) / 24;
    return { idx, sentence, score: overlap * 2 + lengthBonus };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxSentences).sort((a, b) => a.idx - b.idx).map((x) => x.sentence);
  return trimToChars(top.join(" "), maxChars);
}

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((x) => x.length > 2)
  );
}

function trimToChars(text, maxChars) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3).trim()}...`;
}

async function getBestWikiResult(query) {
  const titles = await wikiSearchTitles(query, 1);
  if (!titles.length) return null;
  return getWikiSummary(titles[0]);
}

async function getTopicImages(topic, limit = 6) {
  const titles = await wikiSearchTitles(topic, Math.max(limit, 6));
  if (!titles.length) return [];

  const summaries = await Promise.all(
    titles.slice(0, 10).map(async (title) => {
      try {
        return await getWikiSummary(title);
      } catch {
        return null;
      }
    })
  );

  const images = [];
  const seen = new Set();
  for (const item of summaries) {
    if (!item?.image) continue;
    if (seen.has(item.image)) continue;
    seen.add(item.image);
    images.push({
      src: item.image,
      caption: item.title || topic,
    });
    if (images.length >= limit) break;
  }
  return images;
}

async function wikiSearchTitles(query, limit = 1) {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.[1]) ? data[1] : [];
}

async function getWikiSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    title: data.title || title,
    summary: data.extract || "",
    image: data.thumbnail?.source || "",
    url: data.content_urls?.desktop?.page || "",
  };
}

async function getDuckResult(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();

  let text = data.AbstractText || data.Answer || data.Definition || "";
  if (!text) text = firstRelatedTopic(data.RelatedTopics || []);
  if (!text) return null;

  return { text };
}

function firstRelatedTopic(topics) {
  for (const item of topics) {
    if (item?.Text) return item.Text;
    if (Array.isArray(item?.Topics)) {
      const nested = firstRelatedTopic(item.Topics);
      if (nested) return nested;
    }
  }
  return "";
}

function isMathExpression(text) {
  return /^[0-9+\-*/().%\s^]+$/.test(text);
}

function safeMath(expr) {
  const cleaned = expr.replace(/\^/g, "**").replace(/\s+/g, "");
  if (!/^[0-9+\-*/().%*]+$/.test(cleaned)) throw new Error("Invalid expression");
  const value = Function(`"use strict"; return (${cleaned});`)();
  if (!Number.isFinite(value)) throw new Error("Math failed");
  return value;
}

function appendLine(role, text) {
  const line = document.createElement("div");
  line.className = `line ${role}`;
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function typeLine(role, text) {
  const line = document.createElement("div");
  line.className = `line ${role}`;
  const span = document.createElement("span");
  span.className = "typing";
  line.appendChild(span);
  output.appendChild(line);

  let i = 0;
  const timer = setInterval(() => {
    span.textContent = text.slice(0, i++);
    output.scrollTop = output.scrollHeight;
    if (i > text.length) {
      clearInterval(timer);
      span.classList.remove("typing");
    }
  }, 14);
}

function appendImage(src, caption = "") {
  const wrap = document.createElement("div");
  wrap.className = "image-card";

  const img = document.createElement("img");
  img.src = src;
  img.alt = caption || "Result image";
  wrap.appendChild(img);

  if (caption) {
    const cap = document.createElement("div");
    cap.className = "image-caption";
    cap.textContent = caption;
    wrap.appendChild(cap);
  }

  output.appendChild(wrap);
  output.scrollTop = output.scrollHeight;
}
