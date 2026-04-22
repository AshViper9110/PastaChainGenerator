const form = document.querySelector("#generator-form");
const sourceText = document.querySelector("#source-text");
const orderInput = document.querySelector("#order");
const lengthInput = document.querySelector("#length");
const allowLoop = document.querySelector("#allow-loop");
const result = document.querySelector("#result");
const historyList = document.querySelector("#history-list");
const clearHistory = document.querySelector("#clear-history");
const shuffleSource = document.querySelector("#shuffle-source");
const voiceRate = document.querySelector("#voice-rate");
const autoSpeak = document.querySelector("#auto-speak");
const speakResult = document.querySelector("#speak-result");
const stopSpeech = document.querySelector("#stop-speech");

const fallbackWords = [
  "\u5927\u89aa\u53cb",
  "\u306e",
  "\u5f7c\u5973",
  "\u306e",
  "\u9023\u308c",
  "\u304a\u3044\u3057\u3044",
  "\u30d1\u30b9\u30bf",
  "\u4f5c\u3063\u305f",
  "\u304a\u524d",
];
const history = [];

function parseWords(text) {
  const labels = text
    .split(/\r?\n/)
    .map((word) => word.trim())
    .filter(Boolean);
  const source = labels.length > 0 ? labels : fallbackWords;

  return source.map((label, index) => ({ label, id: `${index}:${label}` }));
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildChain(words, order) {
  const chain = new Map();

  for (let index = 0; index <= words.length - order; index += 1) {
    const state = words
      .slice(index, index + order)
      .map((word) => word.id)
      .join("\u0000");
    const next = words[index + order] ?? null;
    const bucket = chain.get(state) ?? [];
    bucket.push(next);
    chain.set(state, bucket);
  }

  return chain;
}

function generateMarkov(words, order, targetLength, shouldLoop) {
  const safeOrder = Math.min(order, Math.max(1, words.length - 1));
  const chain = buildChain(words, safeOrder);
  const states = [...chain.keys()];
  const wordsById = new Map(words.map((word) => [word.id, word]));
  const safeLength = Math.min(targetLength, words.length);

  if (states.length === 0) {
    return words.map((word) => word.label).join(" ");
  }

  let current = pick(states);
  let output = [];
  const used = new Set();

  for (const wordId of current.split("\u0000")) {
    const word = wordsById.get(wordId);
    if (word && !used.has(word.id) && output.length < safeLength) {
      output.push(word);
      used.add(word.id);
    }
  }

  while (output.length < safeLength) {
    const key = output
      .slice(-safeOrder)
      .map((word) => word.id)
      .join("\u0000");
    const options = (chain.get(key) ?? []).filter(
      (word) => word && !used.has(word.id),
    );

    if (!options || options.length === 0) {
      if (!shouldLoop) break;
      const restart = states
        .map((state) => state.split("\u0000"))
        .filter((stateWords) => stateWords.some((wordId) => !used.has(wordId)));

      if (restart.length === 0) break;

      for (const wordId of pick(restart)) {
        const word = wordsById.get(wordId);
        if (word && !used.has(word.id) && output.length < safeLength) {
          output.push(word);
          used.add(word.id);
        }
      }
      continue;
    }

    const next = pick(options);
    output.push(next);
    used.add(next.id);
  }

  return output
    .slice(0, safeLength)
    .map((word) => word.label)
    .join(" ");
}

function renderHistory() {
  historyList.replaceChildren(
    ...history.map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }),
  );
}

function addHistory(text) {
  history.unshift(text);
  history.splice(10);
  renderHistory();
}

function speak(text) {
  if (
    !("speechSynthesis" in window) ||
    !("SpeechSynthesisUtterance" in window)
  ) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = Number(voiceRate.value);
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

function generate(shouldSpeak = false) {
  const words = parseWords(sourceText.value);
  const order = Number(orderInput.value);
  const targetLength = Number(lengthInput.value);
  const generated = generateMarkov(
    words,
    order,
    targetLength,
    allowLoop.checked,
  );

  result.textContent = generated;
  addHistory(generated);

  if (shouldSpeak && autoSpeak.checked) {
    speak(generated);
  }
}

function shuffledSource() {
  const words = parseWords(sourceText.value).map((word) => word.label);

  for (let index = words.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [words[index], words[swapIndex]] = [words[swapIndex], words[index]];
  }

  sourceText.value = words.join("\n");
  generate(autoSpeak.checked);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generate(true);
});

shuffleSource.addEventListener("click", shuffledSource);

speakResult.addEventListener("click", () => {
  speak(result.textContent);
});

stopSpeech.addEventListener("click", () => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
});

clearHistory.addEventListener("click", () => {
  history.length = 0;
  renderHistory();
});

generate();
