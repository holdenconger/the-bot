const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const output = document.getElementById("output");
const modeSelect = document.getElementById("mode-select");
const queryCounts = new Map();

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
  const repeatCount = recordQuery(query);

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
    await imageOnlyMode(query, repeatCount);
    return;
  }

  await answerTextMode(query, currentMode, repeatCount);
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

async function answerTextMode(query, mode, repeatCount) {
  appendLine("system", "FETCHING WIKIPEDIA + DUCKDUCKGO...");

  const [wikiResult, duckResult] = await Promise.allSettled([
    getWikiResults(query, 5),
    getDuckResult(query),
  ]);

  const wikiItemsRaw = wikiResult.status === "fulfilled" ? wikiResult.value : [];
  const wikiItems = selectRelevantWiki(query, wikiItemsRaw);
  const duck = duckResult.status === "fulfilled" ? duckResult.value : null;

  const built = buildFullAnswer(query, wikiItems, duck, repeatCount);
  const longAnswer = built.text;
  if (!longAnswer) {
    appendLine("error", "No useful result. Try a more specific question.");
    return;
  }

  if (mode === "summarize") {
    const summarySeed = buildSummarySeed(query, wikiItems, duck, repeatCount) || longAnswer;
    const summarized = await summarizeSmart(summarySeed, query, repeatCount);
    if (summarized.source === "browser-api") {
      appendLine("system", "SUMMARIZER API: BROWSER MODEL");
    } else {
      appendLine("system", "SUMMARIZER API UNAVAILABLE: LOCAL FALLBACK");
    }
    typeLine("ai", summarized.text);
  } else {
    typeLine("ai", longAnswer);
  }

  if (built.primaryWiki?.image) {
    appendImage(built.primaryWiki.image, built.primaryWiki.title || "Wikipedia image");
  } else if (wikiItems?.[0]?.image) {
    appendImage(wikiItems[0].image, wikiItems[0].title || "Wikipedia image");
  }
}

async function imageOnlyMode(query, repeatCount = 0) {
  appendLine("system", "IMAGE MODE ACTIVE: FETCHING IMAGES...");
  const images = await getTopicImages(query, 6, repeatCount);

  if (!images.length) {
    appendLine("error", "No images found. Try a clearer topic.");
    return;
  }

  appendLine("ai", `Showing ${images.length} image(s) for "${query}"`);
  for (const item of images) {
    appendImage(item.src, item.caption);
  }
}

function buildFullAnswer(query, wikiItems, duck, repeatCount) {
  const safeRepeatCount = Math.max(0, repeatCount || 0);
  const parts = [];
  const normalizedWiki = Array.isArray(wikiItems) ? wikiItems.filter((x) => x?.summary) : [];
  let primaryWiki = null;

  if (normalizedWiki.length) {
    const firstIndex = safeRepeatCount % normalizedWiki.length;
    const secondIndex = (firstIndex + 1) % normalizedWiki.length;
    primaryWiki = normalizedWiki[firstIndex];
    parts.push(`${primaryWiki.title || "Wikipedia"}: ${primaryWiki.summary}`);
    if (normalizedWiki.length > 1) {
      const secondaryWiki = normalizedWiki[secondIndex];
      parts.push(`Another source (${secondaryWiki.title || "Wikipedia"}): ${secondaryWiki.summary}`);
    }
  }

  const duckChoices = [
    duck?.text || "",
    ...(duck?.relatedTexts || []),
  ].filter(Boolean);
  if (duckChoices.length) {
    const idx = safeRepeatCount % duckChoices.length;
    parts.push(`DuckDuckGo: ${duckChoices[idx]}`);
  }

  if (!parts.length) return { text: "", primaryWiki: null };

  if (!normalizedWiki.length && !duckChoices.length) {
    parts.push(`No direct match found for "${query}".`);
  }

  if (safeRepeatCount > 0) {
    parts.push(`Fresh angle: response mix #${safeRepeatCount + 1}.`);
  }

  return {
    text: parts.join("\n\n"),
    primaryWiki,
  };
}

async function summarizeSmart(text, query, repeatCount) {
  const styleCycle = ["tl;dr", "key-points", "teaser"];
  const lengthCycle = ["short", "medium", "short"];
  const style = styleCycle[repeatCount % styleCycle.length];
  const length = lengthCycle[repeatCount % lengthCycle.length];

  const browserSummary = await summarizeWithBrowserAPI(text, style, length);
  if (browserSummary) {
    return { text: trimToChars(browserSummary, 520), source: "browser-api" };
  }

  const localSummary = summarizeLocally(text, query, repeatCount > 0 ? 3 : 2, repeatCount > 0 ? 420 : 320);
  return { text: localSummary, source: "local" };
}

function buildSummarySeed(query, wikiItems, duck, repeatCount) {
  const safeRepeatCount = Math.max(0, repeatCount || 0);
  const parts = [];
  const wiki = Array.isArray(wikiItems) ? wikiItems.filter((x) => x?.summary) : [];

  if (wiki.length) {
    const idx = safeRepeatCount % wiki.length;
    const oneLine = firstSentence(wiki[idx].summary, 220);
    parts.push(`${wiki[idx].title || "Topic"}: ${oneLine}`);
  }

  const duckChoices = [
    duck?.text || "",
    ...(duck?.relatedTexts || []),
  ].filter(Boolean);
  if (duckChoices.length) {
    const idx = safeRepeatCount % duckChoices.length;
    parts.push(`Web note: ${firstSentence(duckChoices[idx], 180)}`);
  }

  if (!parts.length) {
    parts.push(`No summary result found for "${query}".`);
  }

  return parts.join(" ");
}

function firstSentence(text, maxChars = 220) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const first = clean.match(/[^.!?]+[.!?]?/);
  const sentence = first ? first[0].trim() : clean;
  return trimToChars(sentence, maxChars);
}

async function summarizeWithBrowserAPI(text, type = "tl;dr", length = "short") {
  if (!("Summarizer" in window)) return "";
  try {
    const availability = await window.Summarizer.availability();
    if (availability === "unavailable") return "";

    const summarizer = await window.Summarizer.create({
      type,
      format: "plain-text",
      length,
    });

    const result = await summarizer.summarize(text);
    if (typeof summarizer.destroy === "function") summarizer.destroy();
    return typeof result === "string" ? result.trim() : "";
  } catch {
    return "";
  }
}

function recordQuery(query) {
  const key = normalizeQuery(query);
  const count = queryCounts.get(key) || 0;
  queryCounts.set(key, count + 1);
  return count;
}

function normalizeQuery(query) {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

function filterTitlesByRelevance(query, titles) {
  const q = normalizeQuery(query);
  const qWords = q.split(" ").filter(Boolean);
  const exactWord = new RegExp(`\\b${escapeRegex(q)}\\b`, "i");
  const shortPlural = new RegExp(`\\b${escapeRegex(q)}s\\b`, "i");

  return (titles || []).filter((title) => {
    const t = normalizeQuery(title || "");
    if (!t) return false;

    // Keep exact word matches for short searches like "cat".
    if (q.length <= 4) {
      return exactWord.test(title) || shortPlural.test(title);
    }
    if (t === q || t.includes(q) || q.includes(t)) return true;

    const overlap = qWords.reduce((count, word) => {
      const rx = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
      return count + (rx.test(title) ? 1 : 0);
    }, 0);

    return overlap >= Math.ceil(qWords.length / 2);
  });
}

function selectRelevantWiki(query, wikiItems) {
  const filtered = (wikiItems || []).filter((item) => item?.title || item?.summary);
  if (!filtered.length) return [];

  const titleFiltered = filterTitlesByRelevance(
    query,
    filtered.map((x) => x.title || "")
  );
  if (!titleFiltered.length) return filtered;

  const titleSet = new Set(titleFiltered.map((x) => normalizeQuery(x)));
  const narrowed = filtered.filter((item) => titleSet.has(normalizeQuery(item.title || "")));
  return narrowed.length ? narrowed : filtered;
}

function rotateArray(items, shiftBy = 0) {
  if (!Array.isArray(items) || !items.length) return [];
  const shift = ((shiftBy % items.length) + items.length) % items.length;
  if (shift === 0) return [...items];
  return items.slice(shift).concat(items.slice(0, shift));
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

async function getWikiResults(query, limit = 5) {
  const titles = await wikiSearchTitles(query, limit);
  if (!titles.length) return [];

  const results = await Promise.all(
    titles.map(async (title) => {
      try {
        return await getWikiSummary(title);
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

async function getTopicImages(topic, limit = 6, repeatCount = 0) {
  const offset = Math.max(0, repeatCount) * limit;
  const titles = await wikiSearchTitles(topic, Math.max(limit * 4, 20), offset);
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

  const relevantSummaries = selectRelevantWiki(topic, summaries.filter(Boolean));
  const images = [];
  const seen = new Set();
  for (const item of relevantSummaries) {
    if (!item?.image) continue;
    if (seen.has(item.image)) continue;
    seen.add(item.image);
    images.push({
      src: item.image,
      caption: item.title || topic,
    });
    if (images.length >= limit) break;
  }
  if (!images.length) return [];
  const rotated = rotateArray(images, Math.max(0, repeatCount));
  return rotated.slice(0, limit);
}

async function wikiSearchTitles(query, limit = 1, offset = 0) {
  const cleanQuery = (query || "").trim();
  if (!cleanQuery) return [];

  const phrase = `"${cleanQuery.replace(/"/g, "")}"`;
  const srsearch = cleanQuery.includes(" ")
    ? `${phrase} ${cleanQuery}`
    : `intitle:${phrase} ${cleanQuery}`;

  const searchUrl =
    `https://en.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(srsearch)}` +
    `&srlimit=${Math.min(Math.max(limit, 1), 50)}` +
    `&sroffset=${Math.max(0, offset)}` +
    `&srnamespace=0&format=json&origin=*`;

  try {
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error("search failed");
    const data = await res.json();
    const titles = Array.isArray(data?.query?.search)
      ? data.query.search.map((x) => x.title).filter(Boolean)
      : [];
    const relevant = filterTitlesByRelevance(cleanQuery, titles);
    return (relevant.length ? relevant : titles).slice(0, limit);
  } catch {
    // Fallback if search endpoint fails.
    const fallbackUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanQuery)}&limit=${limit}&namespace=0&format=json&origin=*`;
    const fallbackRes = await fetch(fallbackUrl);
    if (!fallbackRes.ok) return [];
    const fallbackData = await fallbackRes.json();
    const titles = Array.isArray(fallbackData?.[1]) ? fallbackData[1] : [];
    const relevant = filterTitlesByRelevance(cleanQuery, titles);
    return (relevant.length ? relevant : titles).slice(0, limit);
  }
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
  const relatedTexts = collectRelatedTopics(data.RelatedTopics || [], []);
  if (!text) text = relatedTexts[0] || "";
  if (!text && !relatedTexts.length) return null;

  return { text, relatedTexts };
}

function collectRelatedTopics(topics, bucket = []) {
  for (const item of topics) {
    if (item?.Text) {
      bucket.push(item.Text);
    }
    if (Array.isArray(item?.Topics)) {
      collectRelatedTopics(item.Topics, bucket);
    }
  }
  return bucket;
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
