const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const output = document.getElementById("output");
const modeSelect = document.getElementById("mode-select");
const voiceBtn = document.getElementById("voice-btn");
const voiceStatus = document.getElementById("voice-status");
const imageModal = document.getElementById("image-modal");
const imageModalImg = document.getElementById("image-modal-img");
const imageModalCaption = document.getElementById("image-modal-caption");
const imageModalClose = document.getElementById("image-modal-close");
const queryCounts = new Map();
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
const hasSpeechSynthesis = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

let currentMode = modeSelect.value;
let recognition = null;
let voiceListening = false;
let voiceDetectedText = false;
let voiceLoopEnabled = false;
let speechNoticeShown = false;

modeSelect.addEventListener("change", () => {
  currentMode = modeSelect.value;
  appendLine("system", `MODE SET: ${labelForMode(currentMode)}`);
  applyModeSideEffects();
});

sendBtn.addEventListener("click", onSend);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onSend();
  if (e.key === "Escape") closeImageModal();
});
voiceBtn.addEventListener("click", toggleVoiceInput);
imageModalClose.addEventListener("click", closeImageModal);
imageModal.addEventListener("click", (e) => {
  if (e.target === imageModal) closeImageModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeImageModal();
    if (voiceListening) stopVoiceInput();
  }
});
setupVoiceInput();

function isVoiceTalkMode() {
  return currentMode === "voice";
}

function applyModeSideEffects() {
  if (!recognition) return;
  if (isVoiceTalkMode()) {
    voiceLoopEnabled = true;
    voiceStatus.textContent = "Voice mode: listening...";
    if (!voiceListening) startVoiceInput();
    return;
  }

  voiceLoopEnabled = false;
  if (voiceListening) stopVoiceInput();
  stopSpeaking();
  voiceStatus.textContent = "Voice: ready";
}

function setupVoiceInput() {
  if (!SpeechRecognitionAPI) {
    voiceBtn.disabled = true;
    voiceStatus.textContent = "Voice: not supported in this browser";
    appendLine("system", "Voice input unavailable in this browser.");
    return;
  }

  recognition = new SpeechRecognitionAPI();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = () => {
    voiceListening = true;
    voiceDetectedText = false;
    voiceBtn.classList.add("active");
    voiceStatus.textContent = isVoiceTalkMode() ? "Voice mode: listening..." : "Voice: listening...";
  };

  recognition.onresult = (event) => {
    let transcript = "";
    let hasFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) hasFinal = true;
    }
    if (transcript.trim()) {
      input.value = transcript.trim();
      voiceDetectedText = voiceDetectedText || hasFinal || input.value.length > 0;
    }
  };

  recognition.onerror = (event) => {
    voiceStatus.textContent = `Voice error: ${event.error}`;
    voiceBtn.classList.remove("active");
    voiceListening = false;
  };

  recognition.onend = () => {
    const said = input.value.trim();
    voiceBtn.classList.remove("active");
    voiceListening = false;
    if (voiceDetectedText && said) {
      onSend();
      return;
    }
    if (isVoiceTalkMode() && voiceLoopEnabled) {
      voiceStatus.textContent = "Voice mode: listening...";
      setTimeout(() => {
        if (isVoiceTalkMode() && voiceLoopEnabled && !voiceListening) startVoiceInput();
      }, 240);
      return;
    }
    voiceStatus.textContent = "Voice: off";
  };

  voiceStatus.textContent = isVoiceTalkMode() ? "Voice mode: ready" : "Voice: ready";
}

function toggleVoiceInput() {
  if (!recognition) {
    voiceStatus.textContent = "Voice: unavailable";
    return;
  }
  if (voiceListening) {
    voiceLoopEnabled = false;
    stopVoiceInput();
    voiceStatus.textContent = isVoiceTalkMode() ? "Voice mode: paused" : "Voice: off";
  } else {
    if (isVoiceTalkMode()) voiceLoopEnabled = true;
    startVoiceInput();
  }
}

function startVoiceInput() {
  try {
    recognition.start();
  } catch {
    // Recognition can throw when already active.
  }
}

function stopVoiceInput() {
  try {
    recognition.stop();
  } catch {
    // No-op when already stopped.
  }
}

async function onSend() {
  const query = input.value.trim();
  if (!query) return;

  input.value = "";
  appendLine("user", query);
  if (isVoiceTalkMode()) voiceStatus.textContent = "Voice mode: searching...";

  if (query.toLowerCase().startsWith("/create ")) {
    const prompt = query.slice(8).trim();
    if (!prompt) {
      appendLine("error", "Usage: /create your image prompt");
      if (isVoiceTalkMode()) await speakAndMaybeRelisten("Usage is create, then your image prompt.");
      return;
    }
    const msg = createLocalImage(prompt);
    if (isVoiceTalkMode()) await speakAndMaybeRelisten(msg);
    return;
  }

  if (handleCommand(query)) return;
  const repeatCount = recordQuery(query);

  if (isMathExpression(query) && currentMode !== "images") {
    try {
      const result = safeMath(query);
      const msg = `CALCULATION: ${result}`;
      typeLine("ai", msg);
      if (isVoiceTalkMode()) await speakAndMaybeRelisten(msg);
      return;
    } catch {
      // If parsing fails, continue to web search.
    }
  }

  if (currentMode === "images") {
    const msg = await imageOnlyMode(query, repeatCount);
    if (isVoiceTalkMode()) await speakAndMaybeRelisten(msg);
    return;
  }

  const msg = await answerTextMode(query, currentMode, repeatCount);
  if (isVoiceTalkMode()) await speakAndMaybeRelisten(msg);
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
    if (!["full", "summarize", "images", "voice"].includes(next)) {
      appendLine("error", "Use /mode full, /mode summarize, /mode images, or /mode voice");
      return true;
    }
    currentMode = next;
    modeSelect.value = next;
    appendLine("system", `MODE SET: ${labelForMode(currentMode)}`);
    applyModeSideEffects();
    return true;
  }

  return false;
}

function labelForMode(mode) {
  if (mode === "full") return "FULL ANSWER";
  if (mode === "summarize") return "SUMMARIZE";
  if (mode === "voice") return "VOICE TALK";
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
    const msg = "No useful result. Try a more specific question.";
    appendLine("error", msg);
    return msg;
  }

  let spokenText = longAnswer;
  if (mode === "summarize") {
    const summarySeed = buildSummarySeed(query, wikiItems, duck, repeatCount) || longAnswer;
    const summarized = await summarizeSmart(summarySeed, query, repeatCount);
    if (summarized.source === "browser-api") {
      appendLine("system", "SUMMARIZER API: BROWSER MODEL");
    } else {
      appendLine("system", "SUMMARIZER API UNAVAILABLE: LOCAL FALLBACK");
    }
    typeLine("ai", summarized.text);
    spokenText = summarized.text;
  } else {
    typeLine("ai", longAnswer);
  }

  if (built.primaryWiki?.image) {
    appendImage(built.primaryWiki.image, built.primaryWiki.title || "Wikipedia image");
  } else if (wikiItems?.[0]?.image) {
    appendImage(wikiItems[0].image, wikiItems[0].title || "Wikipedia image");
  }

  return spokenText;
}

async function imageOnlyMode(query, repeatCount = 0) {
  appendLine("system", "IMAGE MODE ACTIVE: FETCHING IMAGES...");
  const images = await getTopicImages(query, 6, repeatCount);

  if (!images.length) {
    const msg = "No images found. Try a clearer topic.";
    appendLine("error", msg);
    return msg;
  }

  const msg = `I found ${images.length} images for ${query}.`;
  appendLine("ai", `Showing ${images.length} image(s) for "${query}"`);
  for (const item of images) {
    appendImage(item.src, item.caption);
  }
  return msg;
}

function createLocalImage(prompt) {
  appendLine("system", "LOCAL IMAGE GENERATOR: NO API");
  const dataUrl = generateProceduralImage(prompt);
  const msg = `Generated local image for ${prompt}.`;
  appendLine("ai", `Generated local image for "${prompt}"`);
  appendImage(dataUrl, `Local generated image: ${prompt}`);
  return msg;
}

async function speakAndMaybeRelisten(text) {
  const clean = speechFriendlyText(text);
  if (clean) {
    voiceStatus.textContent = "Voice mode: speaking...";
    await speakText(clean);
  }
  if (isVoiceTalkMode() && voiceLoopEnabled) {
    voiceStatus.textContent = "Voice mode: listening...";
    setTimeout(() => {
      if (isVoiceTalkMode() && voiceLoopEnabled && !voiceListening) startVoiceInput();
    }, 260);
  } else if (!voiceListening) {
    voiceStatus.textContent = "Voice: off";
  }
}

function speechFriendlyText(text) {
  return trimToChars(
    String(text || "")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\s+/g, " ")
      .trim(),
    280
  );
}

function speakText(text) {
  return new Promise((resolve) => {
    if (!hasSpeechSynthesis) {
      if (!speechNoticeShown) {
        appendLine("system", "Voice output unavailable in this browser.");
        speechNoticeShown = true;
      }
      resolve();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

function stopSpeaking() {
  if (!hasSpeechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
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

function isRelevantImageTitle(topic, title) {
  const q = normalizeQuery(topic);
  const t = normalizeQuery(String(title || "").replace(/^file:/i, ""));
  if (!q || !t) return false;

  if (q.length <= 4) {
    const word = new RegExp(`\\b${escapeRegex(q)}s?\\b`, "i");
    return word.test(title);
  }

  if (t.includes(q) || q.includes(t)) return true;
  const qWords = q.split(" ").filter(Boolean);
  const overlap = qWords.reduce((count, word) => {
    const rx = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
    return count + (rx.test(title) ? 1 : 0);
  }, 0);
  return overlap >= Math.ceil(qWords.length / 2);
}

function dedupeImages(images) {
  const seen = new Set();
  const out = [];
  for (const item of images) {
    const src = String(item?.src || "");
    if (!src) continue;
    if (seen.has(src)) continue;
    seen.add(src);
    out.push(item);
  }
  return out;
}

function generateProceduralImage(prompt, width = 1024, height = 640) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const seed = hashString(prompt || "image");
  const spec = parseImagePrompt(prompt);
  const horizon = Math.floor(height * 0.62);

  drawSky(ctx, width, height, horizon, spec, seed);
  drawEnvironment(ctx, width, height, horizon, spec, seed);
  drawForeground(ctx, width, height, horizon, spec, seed);
  drawSubject(ctx, width, height, horizon, spec, seed);
  drawFilmOverlay(ctx, width, height, spec);

  return canvas.toDataURL("image/png");
}

function parseImagePrompt(prompt) {
  const text = normalizeQuery(prompt || "");
  const count = readSubjectCount(text);

  const subject = pickFirst(text, [
    "cat",
    "dog",
    "bird",
    "robot",
    "car",
    "house",
    "tree",
    "dragon",
  ]) || "shape";

  const scene = pickFirst(text, [
    "city",
    "ocean",
    "beach",
    "forest",
    "mountain",
    "desert",
    "space",
    "galaxy",
    "snow",
  ]) || "land";

  const style = pickFirst(text, ["neon", "cyberpunk", "retro", "pixel", "pastel"]) || "default";
  const time = pickFirst(text, ["night", "sunset", "dawn", "day"]) || "day";
  const colorWord = pickFirst(text, [
    "red",
    "blue",
    "green",
    "purple",
    "pink",
    "yellow",
    "orange",
    "teal",
    "white",
    "black",
  ]) || "";

  return { text, subject, scene, style, time, colorWord, count };
}

function readSubjectCount(text) {
  const map = { one: 1, two: 2, three: 3, four: 4 };
  for (const [word, num] of Object.entries(map)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return num;
  }
  const digit = text.match(/\b([1-4])\b/);
  if (digit) return Number(digit[1]);
  return 1;
}

function pickFirst(text, choices) {
  for (const item of choices) {
    if (new RegExp(`\\b${escapeRegex(item)}\\b`, "i").test(text)) return item;
  }
  return "";
}

function drawSky(ctx, width, height, horizon, spec, seed) {
  const palette = getSkyPalette(spec, seed);
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, palette.top);
  g.addColorStop(0.55, palette.mid);
  g.addColorStop(1, palette.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, horizon);

  if (spec.time === "night" || spec.scene === "space" || spec.scene === "galaxy") {
    const stars = 80 + (seed % 80);
    for (let i = 0; i < stars; i++) {
      const x = seededFloat(seed + i * 13) * width;
      const y = seededFloat(seed + i * 29) * (horizon - 6);
      const r = 0.6 + seededFloat(seed + i * 43) * 2.4;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + seededFloat(seed + i * 7) * 0.7})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const orbX = width * (0.2 + seededFloat(seed + 101) * 0.6);
  const orbY = horizon * (0.16 + seededFloat(seed + 103) * 0.28);
  const orbR = Math.max(24, Math.floor(width * 0.05));
  ctx.beginPath();
  ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2);
  ctx.fillStyle = spec.time === "night" ? "rgba(240,245,255,0.85)" : "rgba(255,240,210,0.9)";
  ctx.fill();
}

function getSkyPalette(spec, seed) {
  if (spec.style === "neon" || spec.style === "cyberpunk") {
    return {
      top: "hsl(256 90% 20%)",
      mid: "hsl(286 85% 30%)",
      bottom: "hsl(198 95% 48%)",
    };
  }
  if (spec.time === "night" || spec.scene === "space") {
    return {
      top: "hsl(228 52% 12%)",
      mid: "hsl(238 45% 19%)",
      bottom: "hsl(251 42% 30%)",
    };
  }
  if (spec.time === "sunset" || spec.time === "dawn") {
    return {
      top: "hsl(18 88% 56%)",
      mid: "hsl(32 85% 62%)",
      bottom: "hsl(45 92% 74%)",
    };
  }
  const base = Math.floor(seededFloat(seed + 61) * 40) + 190;
  return {
    top: `hsl(${base} 70% 36%)`,
    mid: `hsl(${base - 10} 66% 52%)`,
    bottom: `hsl(${base - 20} 70% 66%)`,
  };
}

function drawEnvironment(ctx, width, height, horizon, spec, seed) {
  if (spec.scene === "ocean" || spec.scene === "beach") {
    drawOcean(ctx, width, height, horizon, seed, spec);
    if (spec.scene === "beach") drawBeach(ctx, width, height, horizon);
    return;
  }
  if (spec.scene === "city") {
    drawGround(ctx, width, height, horizon, "hsl(220 15% 18%)");
    drawCity(ctx, width, height, horizon, seed, spec);
    return;
  }
  if (spec.scene === "forest") {
    drawGround(ctx, width, height, horizon, "hsl(132 30% 28%)");
    drawMountains(ctx, width, height, horizon, seed, "hsl(145 23% 24%)");
    drawForest(ctx, width, height, horizon, seed);
    return;
  }
  if (spec.scene === "mountain" || spec.scene === "snow") {
    drawGround(ctx, width, height, horizon, spec.scene === "snow" ? "hsl(210 30% 88%)" : "hsl(132 20% 24%)");
    drawMountains(ctx, width, height, horizon, seed, spec.scene === "snow" ? "hsl(214 18% 68%)" : "hsl(212 15% 30%)");
    return;
  }
  if (spec.scene === "desert") {
    drawGround(ctx, width, height, horizon, "hsl(38 65% 62%)");
    drawDunes(ctx, width, height, horizon, seed);
    return;
  }
  if (spec.scene === "space" || spec.scene === "galaxy") {
    drawGround(ctx, width, height, horizon, "hsl(244 30% 12%)");
    drawNebula(ctx, width, height, horizon, seed);
    return;
  }

  drawGround(ctx, width, height, horizon, "hsl(126 28% 34%)");
  drawMountains(ctx, width, height, horizon, seed, "hsl(212 14% 36%)");
}

function drawForeground(ctx, width, height, horizon, spec, seed) {
  if (spec.style === "neon" || spec.style === "cyberpunk") {
    ctx.strokeStyle = "rgba(80,255,240,0.5)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(width / 2, horizon);
      ctx.stroke();
    }
  }
  if (spec.style === "retro") {
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }
  }

  // Prompt text at bottom for traceability.
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "22px monospace";
  ctx.fillText(trimToChars(spec.text || "local image", 68), 20, height - 18);

  if (spec.style === "pixel") {
    pixelateCanvas(ctx, width, height, 4);
  }

  // subtle deterministic noise dots
  const dots = 90;
  for (let i = 0; i < dots; i++) {
    const x = seededFloat(seed + i * 71) * width;
    const y = horizon + seededFloat(seed + i * 89) * (height - horizon);
    ctx.fillStyle = `rgba(0,0,0,${0.03 + seededFloat(seed + i * 97) * 0.06})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawSubject(ctx, width, height, horizon, spec, seed) {
  const color = getSubjectColor(spec, seed);
  const n = Math.max(1, Math.min(3, spec.count || 1));
  const span = Math.min(width * 0.55, 540);
  const startX = width / 2 - span / 2;
  const step = n === 1 ? 0 : span / (n - 1);

  for (let i = 0; i < n; i++) {
    const x = n === 1 ? width * 0.5 : startX + step * i;
    const s = 0.9 + seededFloat(seed + i * 41) * 0.5;
    const y = horizon + 18 + seededFloat(seed + i * 47) * 26;
    if (spec.subject === "cat") drawCat(ctx, x, y, 95 * s, color);
    else if (spec.subject === "dog") drawDog(ctx, x, y, 95 * s, color);
    else if (spec.subject === "bird") drawBird(ctx, x, y - 120, 64 * s, color);
    else if (spec.subject === "robot") drawRobot(ctx, x, y, 88 * s, color);
    else if (spec.subject === "car") drawCar(ctx, x, y + 10, 110 * s, color);
    else if (spec.subject === "house") drawHouse(ctx, x, y + 10, 110 * s, color);
    else if (spec.subject === "tree") drawTree(ctx, x, y + 16, 115 * s, color);
    else if (spec.subject === "dragon") drawDragon(ctx, x, y - 10, 120 * s, color);
    else drawAbstractSubject(ctx, x, y, 100 * s, color);
  }
}

function getSubjectColor(spec, seed) {
  const map = {
    red: "hsl(4 75% 52%)",
    blue: "hsl(213 70% 52%)",
    green: "hsl(129 52% 42%)",
    purple: "hsl(280 54% 52%)",
    pink: "hsl(331 74% 62%)",
    yellow: "hsl(47 90% 58%)",
    orange: "hsl(28 88% 56%)",
    teal: "hsl(178 62% 46%)",
    white: "hsl(0 0% 92%)",
    black: "hsl(0 0% 12%)",
  };
  if (map[spec.colorWord]) return map[spec.colorWord];
  const hue = Math.floor(seededFloat(seed + 177) * 360);
  return `hsl(${hue} 60% 46%)`;
}

function drawGround(ctx, width, height, horizon, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, horizon, width, height - horizon);
}

function drawMountains(ctx, width, height, horizon, seed, color) {
  ctx.fillStyle = color;
  const peaks = 6;
  const step = width / (peaks - 1);
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let i = 0; i < peaks; i++) {
    const x = i * step;
    const y = horizon - (60 + seededFloat(seed + i * 53) * 120);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, horizon);
  ctx.closePath();
  ctx.fill();
}

function drawOcean(ctx, width, height, horizon, seed, spec) {
  const top = spec.style === "neon" ? "hsl(196 90% 42%)" : "hsl(199 62% 44%)";
  const bot = spec.style === "neon" ? "hsl(229 90% 24%)" : "hsl(205 56% 30%)";
  const g = ctx.createLinearGradient(0, horizon, 0, height);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, width, height - horizon);

  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 14; i++) {
    const y = horizon + 6 + i * 18;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 20) {
      const wave = Math.sin((x / 55) + i + seededFloat(seed + i) * 6) * (2 + i * 0.18);
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
}

function drawBeach(ctx, width, height, horizon) {
  ctx.fillStyle = "rgba(237,208,142,0.9)";
  ctx.beginPath();
  ctx.moveTo(0, horizon + 30);
  ctx.lineTo(width, horizon + 8);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
}

function drawCity(ctx, width, height, horizon, seed, spec) {
  const base = spec.style === "neon" ? "hsl(242 36% 18%)" : "hsl(218 16% 22%)";
  const win = spec.style === "neon" ? "rgba(56,255,232,0.86)" : "rgba(255,228,146,0.72)";
  const buildings = 26;
  const wStep = Math.ceil(width / buildings);

  for (let i = 0; i < buildings; i++) {
    const x = i * wStep;
    const bw = wStep + seededFloat(seed + i * 7) * 16;
    const bh = 80 + seededFloat(seed + i * 19) * 210;
    const y = horizon - bh;
    ctx.fillStyle = base;
    ctx.fillRect(x, y, bw, bh);

    ctx.fillStyle = win;
    for (let wy = y + 8; wy < y + bh - 8; wy += 12) {
      for (let wx = x + 6; wx < x + bw - 6; wx += 10) {
        if (seededFloat(seed + wx * 3 + wy * 5) > 0.45) ctx.fillRect(wx, wy, 4, 5);
      }
    }
  }
}

function drawForest(ctx, width, height, horizon, seed) {
  for (let i = 0; i < 45; i++) {
    const x = seededFloat(seed + i * 23) * width;
    const s = 0.5 + seededFloat(seed + i * 31) * 1.2;
    drawTree(ctx, x, horizon + 18, 64 * s, "hsl(130 48% 30%)");
  }
}

function drawDunes(ctx, width, height, horizon, seed) {
  ctx.fillStyle = "rgba(214,174,98,0.78)";
  for (let i = 0; i < 5; i++) {
    const y = horizon + 28 + i * 28;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += 22) {
      const r = Math.sin((x / 90) + i + seededFloat(seed + i * 13) * 4) * 10;
      ctx.lineTo(x, y + r);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawNebula(ctx, width, height, horizon, seed) {
  for (let i = 0; i < 10; i++) {
    const x = seededFloat(seed + i * 67) * width;
    const y = seededFloat(seed + i * 71) * (horizon - 20);
    const r = 60 + seededFloat(seed + i * 73) * 120;
    const c = colorFromSeed(seed + i * 79, 80, 62, 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function drawCat(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.35, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + size * 0.22, y - size * 0.2, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + size * 0.1, y - size * 0.28);
  ctx.lineTo(x + size * 0.18, y - size * 0.42);
  ctx.lineTo(x + size * 0.26, y - size * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + size * 0.22, y - size * 0.29);
  ctx.lineTo(x + size * 0.3, y - size * 0.43);
  ctx.lineTo(x + size * 0.34, y - size * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.045);
  ctx.beginPath();
  ctx.moveTo(x - size * 0.3, y - size * 0.05);
  ctx.quadraticCurveTo(x - size * 0.5, y - size * 0.45, x - size * 0.18, y - size * 0.44);
  ctx.stroke();
}

function drawDog(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.37, size * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + size * 0.28, y - size * 0.18, size * 0.17, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + size * 0.36, y - size * 0.25, size * 0.08, size * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawBird(ctx, x, y, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.07);
  ctx.beginPath();
  ctx.moveTo(x - size * 0.5, y);
  ctx.quadraticCurveTo(x - size * 0.2, y - size * 0.35, x, y);
  ctx.quadraticCurveTo(x + size * 0.2, y - size * 0.35, x + size * 0.5, y);
  ctx.stroke();
}

function drawRobot(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - size * 0.22, y - size * 0.35, size * 0.44, size * 0.44);
  ctx.fillRect(x - size * 0.17, y + size * 0.1, size * 0.34, size * 0.32);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(x - size * 0.12, y - size * 0.22, size * 0.08, size * 0.06);
  ctx.fillRect(x + size * 0.04, y - size * 0.22, size * 0.08, size * 0.06);
}

function drawCar(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - size * 0.42, y - size * 0.12, size * 0.84, size * 0.24);
  ctx.beginPath();
  ctx.moveTo(x - size * 0.26, y - size * 0.12);
  ctx.lineTo(x - size * 0.1, y - size * 0.3);
  ctx.lineTo(x + size * 0.2, y - size * 0.3);
  ctx.lineTo(x + size * 0.32, y - size * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(22,22,22,0.95)";
  ctx.beginPath();
  ctx.arc(x - size * 0.24, y + size * 0.16, size * 0.12, 0, Math.PI * 2);
  ctx.arc(x + size * 0.24, y + size * 0.16, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawHouse(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - size * 0.24, y - size * 0.08, size * 0.48, size * 0.36);
  ctx.beginPath();
  ctx.moveTo(x - size * 0.3, y - size * 0.08);
  ctx.lineTo(x, y - size * 0.34);
  ctx.lineTo(x + size * 0.3, y - size * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(x - size * 0.08, y + size * 0.09, size * 0.16, size * 0.19);
}

function drawTree(ctx, x, y, size, color) {
  ctx.fillStyle = "hsl(30 50% 25%)";
  ctx.fillRect(x - size * 0.06, y - size * 0.1, size * 0.12, size * 0.34);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.2, size * 0.2, 0, Math.PI * 2);
  ctx.arc(x - size * 0.16, y - size * 0.1, size * 0.17, 0, Math.PI * 2);
  ctx.arc(x + size * 0.16, y - size * 0.08, size * 0.15, 0, Math.PI * 2);
  ctx.fill();
}

function drawDragon(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.34, size * 0.19, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + size * 0.1, y - size * 0.1);
  ctx.lineTo(x + size * 0.4, y - size * 0.28);
  ctx.lineTo(x + size * 0.2, y + size * 0.03);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - size * 0.15, y - size * 0.08);
  ctx.lineTo(x - size * 0.42, y - size * 0.27);
  ctx.lineTo(x - size * 0.24, y + size * 0.04);
  ctx.closePath();
  ctx.fill();
}

function drawAbstractSubject(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.1, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - size * 0.16, y - size * 0.08, size * 0.32, size * 0.36);
}

function drawFilmOverlay(ctx, width, height, spec) {
  const strength = spec.style === "retro" ? 0.1 : 0.06;
  ctx.fillStyle = `rgba(0,0,0,${strength})`;
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1);
  }
}

function pixelateCanvas(ctx, width, height, block = 4) {
  const copy = ctx.getImageData(0, 0, width, height);
  const temp = document.createElement("canvas");
  temp.width = Math.max(1, Math.floor(width / block));
  temp.height = Math.max(1, Math.floor(height / block));
  const tctx = temp.getContext("2d");
  tctx.imageSmoothingEnabled = false;
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  source.getContext("2d").putImageData(copy, 0, 0);
  tctx.drawImage(source, 0, 0, temp.width, temp.height);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(temp, 0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
}

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededFloat(seed) {
  let x = (seed >>> 0) + 0x6d2b79f5;
  x = Math.imul(x ^ (x >>> 15), 1 | x);
  x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

function colorFromSeed(seed, sat = 70, light = 50, alpha = 1) {
  const hue = Math.floor(seededFloat(seed) * 360);
  return `hsla(${hue} ${sat}% ${light}% / ${alpha})`;
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
  const [wikiImagesResult, commonsImagesResult] = await Promise.allSettled([
    getWikipediaTopicImages(topic, limit, repeatCount),
    getWikimediaImages(topic, Math.max(limit * 4, 18), repeatCount),
  ]);

  const wikiImages = wikiImagesResult.status === "fulfilled" ? wikiImagesResult.value : [];
  const commonsImages = commonsImagesResult.status === "fulfilled" ? commonsImagesResult.value : [];
  const merged = dedupeImages([...commonsImages, ...wikiImages]);
  if (!merged.length) return [];

  const rotated = rotateArray(merged, Math.max(0, repeatCount));
  return rotated.slice(0, limit);
}

async function getWikipediaTopicImages(topic, limit = 6, repeatCount = 0) {
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
  return images;
}

async function getWikimediaImages(topic, limit = 24, repeatCount = 0) {
  const gsrOffset = Math.max(0, repeatCount) * Math.max(6, Math.floor(limit / 2));
  const search = `${topic} filetype:bitmap`;
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(search)}` +
    `&gsrnamespace=6&gsrlimit=${Math.min(Math.max(limit, 1), 50)}` +
    `&gsroffset=${gsrOffset}` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});
    const images = [];
    const seen = new Set();

    for (const page of pages) {
      const title = String(page?.title || "");
      const imageInfo = page?.imageinfo?.[0] || {};
      const src = imageInfo.thumburl || imageInfo.url || "";
      if (!src) continue;
      if (!/\.(png|jpe?g|webp|gif)(\?|$)/i.test(src)) continue;
      if (!isRelevantImageTitle(topic, title)) continue;
      if (seen.has(src)) continue;
      seen.add(src);
      images.push({
        src,
        caption: title.replace(/^File:/i, ""),
      });
    }
    return images;
  } catch {
    return [];
  }
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
  img.addEventListener("click", () => openImageModal(src, caption || "Result image"));
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

function openImageModal(src, caption) {
  imageModalImg.src = src;
  imageModalCaption.textContent = caption || "";
  imageModal.classList.remove("hidden");
  imageModal.setAttribute("aria-hidden", "false");
}

function closeImageModal() {
  imageModal.classList.add("hidden");
  imageModal.setAttribute("aria-hidden", "true");
}
