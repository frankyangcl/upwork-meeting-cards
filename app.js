"use strict";

const STORAGE_KEY = "upworkMeetingCards.deck.v2";
const STUDY_STATE_KEY = "upworkMeetingCards.studyState.v2";
const DEFAULT_CARDS = Array.isArray(window.UPWORK_MEETING_CARDS) ? window.UPWORK_MEETING_CARDS : [];

const elements = {
  questionText: document.querySelector("#questionText"),
  answerText: document.querySelector("#answerText"),
  questionTranslation: document.querySelector("#questionTranslation"),
  answerTranslation: document.querySelector("#answerTranslation"),
  answerTranslationLabel: document.querySelector("#answerTranslationLabel"),
  categoryChip: document.querySelector("#categoryChip"),
  answerAngle: document.querySelector("#answerAngle"),
  answerSection: document.querySelector("#answerSection"),
  answerDivider: document.querySelector("#answerDivider"),
  translationPanel: document.querySelector("#translationPanel"),
  answerChoiceWrap: document.querySelector("#answerChoiceWrap"),
  answerTabs: [...document.querySelectorAll(".answer-tab")],
  revealAnswerButton: document.querySelector("#revealAnswerButton"),
  revealTranslationButton: document.querySelector("#revealTranslationButton"),
  nextButton: document.querySelector("#nextButton"),
  previousButton: document.querySelector("#previousButton"),
  skipButton: document.querySelector("#skipButton"),
  restartButton: document.querySelector("#restartButton"),
  progressText: document.querySelector("#progressText"),
  progressFill: document.querySelector("#progressFill"),
  stageChip: document.querySelector("#stageChip"),
  flashcard: document.querySelector("#flashcard"),
  shuffleButton: document.querySelector("#shuffleButton"),
  manageButton: document.querySelector("#manageButton"),
  openDeckButton: document.querySelector("#openDeckButton"),
  deckDrawer: document.querySelector("#deckDrawer"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  closeDrawerButton: document.querySelector("#closeDrawerButton"),
  cardCount: document.querySelector("#cardCount"),
  cardList: document.querySelector("#cardList"),
  searchInput: document.querySelector("#searchInput"),
  addCardButton: document.querySelector("#addCardButton"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  resetDeckButton: document.querySelector("#resetDeckButton"),
  editorDialog: document.querySelector("#editorDialog"),
  editorForm: document.querySelector("#editorForm"),
  editorTitle: document.querySelector("#editorTitle"),
  closeEditorButton: document.querySelector("#closeEditorButton"),
  cancelEditorButton: document.querySelector("#cancelEditorButton"),
  editCategoryEn: document.querySelector("#editCategoryEn"),
  editCategoryZh: document.querySelector("#editCategoryZh"),
  editQuestionEn: document.querySelector("#editQuestionEn"),
  editQuestionZh: document.querySelector("#editQuestionZh"),
  editAngleEn: [0, 1, 2].map((i) => document.querySelector(`#editAngleEn${i}`)),
  editAngleZh: [0, 1, 2].map((i) => document.querySelector(`#editAngleZh${i}`)),
  editAnswerEn: [0, 1, 2].map((i) => document.querySelector(`#editAnswerEn${i}`)),
  editAnswerZh: [0, 1, 2].map((i) => document.querySelector(`#editAnswerZh${i}`)),
  installButton: document.querySelector("#installButton"),
  installDialog: document.querySelector("#installDialog"),
  installContent: document.querySelector("#installContent"),
  closeInstallButton: document.querySelector("#closeInstallButton"),
  toast: document.querySelector("#toast")
};

let cards = loadCards();
let studyOrder = [];
let currentIndex = 0;
let selectedAnswerIndex = 0;
let answerVisible = false;
let translationVisible = false;
let editingCardId = null;
let deferredInstallPrompt = null;
let toastTimer = null;

initializeStudyState();
bindEvents();
render();
setupInstallExperience();
registerServiceWorker();

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cloneDefaultCards() {
  return deepClone(DEFAULT_CARDS);
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createId(prefix = "card") {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeStorageGet(key) {
  try { return window.localStorage.getItem(key); }
  catch (error) { console.warn("Local storage unavailable", error); return null; }
}

function safeStorageSet(key, value) {
  try { window.localStorage.setItem(key, value); return true; }
  catch (error) { console.warn("Could not save", error); return false; }
}

function normalizeAnswer(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  const answerEn = cleanText(raw.answerEn ?? raw.answer ?? "");
  const answerZh = cleanText(raw.answerZh ?? raw.answerTranslation ?? "");
  if (!answerEn || !answerZh) return null;
  return {
    angleEn: cleanText(raw.angleEn) || `Answer direction ${index + 1}`,
    angleZh: cleanText(raw.angleZh) || `回答方向 ${index + 1}`,
    answerEn,
    answerZh
  };
}

function normalizeCards(input) {
  if (!Array.isArray(input)) return [];
  return input.map((item, index) => {
    const questionEn = cleanText(item?.questionEn ?? item?.question ?? "");
    const questionZh = cleanText(item?.questionZh ?? item?.questionTranslation ?? "");
    if (!questionEn || !questionZh) return null;

    let answers = Array.isArray(item?.answers)
      ? item.answers.map(normalizeAnswer).filter(Boolean)
      : [];

    if (!answers.length) {
      const legacy = normalizeAnswer({
        angleEn: "Original answer",
        angleZh: "原有答案",
        answerEn: item?.answerEn ?? item?.answer,
        answerZh: item?.answerZh ?? item?.answerTranslation
      });
      if (legacy) answers = [legacy];
    }
    if (!answers.length) return null;

    return {
      id: cleanText(item?.id) || createId(`card-${index + 1}`),
      categoryEn: cleanText(item?.categoryEn) || "Custom",
      categoryZh: cleanText(item?.categoryZh) || "自定义",
      questionEn,
      questionZh,
      answers: answers.slice(0, 3)
    };
  }).filter(Boolean).filter((card, index, array) => array.findIndex((c) => c.id === card.id) === index);
}

function loadCards() {
  try {
    const raw = safeStorageGet(STORAGE_KEY);
    if (!raw) return cloneDefaultCards();
    const parsed = JSON.parse(raw);
    const normalized = normalizeCards(Array.isArray(parsed) ? parsed : parsed.cards);
    return normalized.length ? normalized : cloneDefaultCards();
  } catch (error) {
    console.warn("Failed to load cards", error);
    return cloneDefaultCards();
  }
}

function saveCards() {
  safeStorageSet(STORAGE_KEY, JSON.stringify({ version: 2, updatedAt: new Date().toISOString(), cards }));
}

function initializeStudyState() {
  const ids = cards.map((card) => card.id);
  let saved = null;
  try { saved = JSON.parse(safeStorageGet(STUDY_STATE_KEY) || "null"); } catch { saved = null; }
  const savedOrder = Array.isArray(saved?.studyOrder) ? saved.studyOrder.filter((id) => ids.includes(id)) : [];
  const missing = ids.filter((id) => !savedOrder.includes(id));
  studyOrder = [...savedOrder, ...missing];
  if (!studyOrder.length) studyOrder = ids;
  const savedIndex = studyOrder.indexOf(cleanText(saved?.currentCardId));
  currentIndex = savedIndex >= 0 ? savedIndex : 0;
  selectedAnswerIndex = Number.isInteger(saved?.selectedAnswerIndex) ? Math.max(0, saved.selectedAnswerIndex) : 0;
  answerVisible = Boolean(saved?.answerVisible);
  translationVisible = Boolean(saved?.translationVisible) && answerVisible;
}

function saveStudyState() {
  safeStorageSet(STUDY_STATE_KEY, JSON.stringify({
    studyOrder,
    currentCardId: getCurrentCard()?.id || null,
    selectedAnswerIndex,
    answerVisible,
    translationVisible
  }));
}

function getCurrentCard() {
  if (!studyOrder.length) return null;
  const id = studyOrder[currentIndex];
  return cards.find((card) => card.id === id) || null;
}

function getCurrentAnswer(card = getCurrentCard()) {
  if (!card?.answers?.length) return null;
  selectedAnswerIndex = Math.min(selectedAnswerIndex, card.answers.length - 1);
  return card.answers[selectedAnswerIndex];
}

function resetCardView() {
  selectedAnswerIndex = 0;
  answerVisible = false;
  translationVisible = false;
}

function syncStudyOrder(preferredCardId = getCurrentCard()?.id) {
  const ids = cards.map((card) => card.id);
  studyOrder = studyOrder.filter((id) => ids.includes(id));
  ids.forEach((id) => { if (!studyOrder.includes(id)) studyOrder.push(id); });
  if (!studyOrder.length) { currentIndex = 0; resetCardView(); return; }
  const preferredIndex = preferredCardId ? studyOrder.indexOf(preferredCardId) : -1;
  currentIndex = preferredIndex >= 0 ? preferredIndex : Math.min(currentIndex, studyOrder.length - 1);
  resetCardView();
}

function bindEvents() {
  elements.revealAnswerButton.addEventListener("click", toggleAnswer);
  elements.revealTranslationButton.addEventListener("click", toggleTranslation);
  elements.nextButton.addEventListener("click", nextCard);
  elements.skipButton.addEventListener("click", nextCard);
  elements.previousButton.addEventListener("click", previousCard);
  elements.restartButton.addEventListener("click", () => { answerVisible = false; translationVisible = false; render(); });
  elements.shuffleButton.addEventListener("click", shuffleDeck);
  elements.answerTabs.forEach((tab) => tab.addEventListener("click", () => selectAnswer(Number(tab.dataset.answerIndex))));

  elements.manageButton.addEventListener("click", openDrawer);
  elements.openDeckButton.addEventListener("click", openDrawer);
  elements.closeDrawerButton.addEventListener("click", closeDrawer);
  elements.drawerBackdrop.addEventListener("click", closeDrawer);
  elements.searchInput.addEventListener("input", renderCardList);
  elements.addCardButton.addEventListener("click", () => openEditor());
  elements.closeEditorButton.addEventListener("click", closeEditor);
  elements.cancelEditorButton.addEventListener("click", closeEditor);
  elements.editorForm.addEventListener("submit", saveEditedCard);
  elements.exportButton.addEventListener("click", exportDeck);
  elements.importInput.addEventListener("change", importDeck);
  elements.resetDeckButton.addEventListener("click", resetDeck);

  elements.installButton.addEventListener("click", handleInstallClick);
  elements.closeInstallButton.addEventListener("click", () => elements.installDialog.close());
  window.addEventListener("keydown", handleKeyboard);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); deferredInstallPrompt = event; elements.installButton.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null; elements.installButton.hidden = true; showToast("已安装到设备");
  });
}

function render() {
  const card = getCurrentCard();
  if (!card) {
    elements.questionText.textContent = "还没有卡片";
    elements.answerText.textContent = "";
    elements.progressText.textContent = "0 / 0";
    elements.progressFill.style.width = "0%";
    elements.stageChip.textContent = "空卡组";
    elements.answerSection.hidden = true;
    elements.answerDivider.hidden = true;
    elements.translationPanel.hidden = true;
    elements.answerChoiceWrap.hidden = true;
    [elements.revealAnswerButton, elements.revealTranslationButton, elements.nextButton, elements.previousButton, elements.skipButton, elements.restartButton].forEach((el) => { el.disabled = true; });
    elements.cardCount.textContent = "0";
    renderCardList(); saveStudyState(); return;
  }

  const answer = getCurrentAnswer(card);
  elements.questionText.textContent = card.questionEn;
  elements.questionTranslation.textContent = card.questionZh;
  elements.categoryChip.textContent = card.categoryEn;
  elements.answerText.textContent = answer?.answerEn || "";
  elements.answerTranslation.textContent = answer?.answerZh || "";
  elements.answerAngle.textContent = answer?.angleEn || "";
  elements.answerTranslationLabel.textContent = answer?.angleZh ? `答案翻译 · ${answer.angleZh}` : "答案翻译";
  elements.answerChoiceWrap.hidden = false;

  elements.answerTabs.forEach((tab, index) => {
    const exists = index < card.answers.length;
    tab.hidden = !exists;
    tab.classList.toggle("active", exists && index === selectedAnswerIndex);
    tab.setAttribute("aria-selected", exists && index === selectedAnswerIndex ? "true" : "false");
    if (exists) tab.textContent = `答案 ${index + 1}`;
  });

  elements.answerSection.hidden = !answerVisible;
  elements.answerDivider.hidden = !answerVisible;
  elements.translationPanel.hidden = !translationVisible;
  elements.revealAnswerButton.textContent = answerVisible ? "遮住答案" : "显示答案";
  elements.revealTranslationButton.textContent = translationVisible ? "遮住翻译" : "显示翻译";
  elements.revealTranslationButton.disabled = !answerVisible;

  elements.progressText.textContent = `${currentIndex + 1} / ${studyOrder.length}`;
  elements.progressFill.style.width = `${((currentIndex + 1) / studyOrder.length) * 100}%`;
  elements.stageChip.textContent = translationVisible ? "已显示翻译" : answerVisible ? `已显示答案 ${selectedAnswerIndex + 1}` : "只看问题";

  const multipleCards = studyOrder.length > 1;
  [elements.revealAnswerButton, elements.nextButton, elements.restartButton].forEach((el) => { el.disabled = false; });
  elements.previousButton.disabled = !multipleCards;
  elements.skipButton.disabled = !multipleCards;
  elements.restartButton.disabled = !answerVisible && !translationVisible;
  elements.cardCount.textContent = String(cards.length);
  renderCardList();
  saveStudyState();
}

function selectAnswer(index) {
  const card = getCurrentCard();
  if (!card || index < 0 || index >= card.answers.length) return;
  selectedAnswerIndex = index;
  translationVisible = false;
  render();
  elements.flashcard.focus({ preventScroll: true });
}

function toggleAnswer() {
  answerVisible = !answerVisible;
  if (!answerVisible) translationVisible = false;
  render();
  elements.flashcard.focus({ preventScroll: true });
}

function toggleTranslation() {
  if (!answerVisible) return;
  translationVisible = !translationVisible;
  render();
  elements.flashcard.focus({ preventScroll: true });
}

function nextCard() {
  if (!studyOrder.length) return;
  const wasLast = currentIndex === studyOrder.length - 1;
  currentIndex = (currentIndex + 1) % studyOrder.length;
  resetCardView(); render(); elements.flashcard.focus({ preventScroll: true });
  if (wasLast && studyOrder.length > 1) showToast("本轮完成，已回到第一张");
}

function previousCard() {
  if (!studyOrder.length) return;
  currentIndex = (currentIndex - 1 + studyOrder.length) % studyOrder.length;
  resetCardView(); render(); elements.flashcard.focus({ preventScroll: true });
}

function shuffleDeck() {
  if (studyOrder.length < 2) { showToast("至少需要两张卡片才能随机排序"); return; }
  const shuffled = [...studyOrder];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  studyOrder = shuffled; currentIndex = 0; resetCardView(); render(); showToast("已随机排序");
}

function handleKeyboard(event) {
  if (event.defaultPrevented || isTypingTarget(event.target) || elements.editorDialog.open || elements.installDialog.open) return;
  const key = event.key.toLowerCase();
  if (event.key === " " || key === "a") { event.preventDefault(); toggleAnswer(); return; }
  if (key === "t") { event.preventDefault(); toggleTranslation(); return; }
  if (["1", "2", "3"].includes(key)) { event.preventDefault(); selectAnswer(Number(key) - 1); return; }
  if (event.key === "ArrowRight" || event.key === "Enter") { event.preventDefault(); nextCard(); return; }
  if (event.key === "ArrowLeft") { event.preventDefault(); previousCard(); return; }
  if (key === "r") { event.preventDefault(); answerVisible = false; translationVisible = false; render(); return; }
  if (key === "e") { event.preventDefault(); const card = getCurrentCard(); if (card) openEditor(card.id); }
}

function isTypingTarget(target) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function openDrawer() {
  elements.drawerBackdrop.hidden = false;
  elements.deckDrawer.classList.add("open");
  elements.deckDrawer.setAttribute("aria-hidden", "false");
  renderCardList();
  setTimeout(() => elements.searchInput.focus(), 80);
}

function closeDrawer() {
  elements.deckDrawer.classList.remove("open");
  elements.deckDrawer.setAttribute("aria-hidden", "true");
  setTimeout(() => { elements.drawerBackdrop.hidden = true; }, 210);
}

function renderCardList() {
  const query = cleanText(elements.searchInput.value).toLocaleLowerCase();
  const currentCardId = getCurrentCard()?.id;
  const filtered = cards.filter((card) => {
    if (!query) return true;
    const answerText = card.answers.map((a) => `${a.angleEn} ${a.angleZh} ${a.answerEn} ${a.answerZh}`).join("\n");
    return [card.categoryEn, card.categoryZh, card.questionEn, card.questionZh, answerText].join("\n").toLocaleLowerCase().includes(query);
  });
  elements.cardList.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("div"); empty.className = "empty-state";
    empty.textContent = cards.length ? "没有找到匹配的卡片。" : "还没有卡片，先新建一张。";
    elements.cardList.append(empty); return;
  }
  filtered.forEach((card) => {
    const originalIndex = cards.findIndex((c) => c.id === card.id);
    const item = document.createElement("div");
    item.className = `card-list-item${card.id === currentCardId ? " current" : ""}`;
    const indexBox = document.createElement("button"); indexBox.type = "button"; indexBox.className = "card-list-index";
    indexBox.textContent = String(originalIndex + 1); indexBox.addEventListener("click", () => jumpToCard(card.id));
    const content = document.createElement("button"); content.type = "button"; content.className = "card-list-content";
    content.style.cssText = "border:0;background:transparent;color:inherit;text-align:left;padding:0;min-width:0;";
    content.addEventListener("click", () => jumpToCard(card.id));
    const category = document.createElement("div"); category.className = "card-list-category"; category.textContent = card.categoryZh;
    const question = document.createElement("div"); question.className = "card-list-question"; question.textContent = card.questionEn;
    const answer = document.createElement("div"); answer.className = "card-list-answer"; answer.textContent = `${card.answers.length} 个回答方向 · ${card.answers.map((a) => a.angleZh).join(" / ")}`;
    content.append(category, question, answer);
    const actions = document.createElement("div"); actions.className = "card-list-actions";
    const editButton = document.createElement("button"); editButton.type = "button"; editButton.className = "mini-button"; editButton.textContent = "✎"; editButton.title = "编辑"; editButton.addEventListener("click", () => openEditor(card.id));
    const deleteButton = document.createElement("button"); deleteButton.type = "button"; deleteButton.className = "mini-button delete"; deleteButton.textContent = "×"; deleteButton.title = "删除"; deleteButton.addEventListener("click", () => deleteCard(card.id));
    actions.append(editButton, deleteButton); item.append(indexBox, content, actions); elements.cardList.append(item);
  });
}

function jumpToCard(cardId) {
  const index = studyOrder.indexOf(cardId); if (index === -1) return;
  currentIndex = index; resetCardView(); render(); closeDrawer(); elements.flashcard.focus({ preventScroll: true });
}

function openEditor(cardId = null) {
  editingCardId = cardId;
  const card = cardId ? cards.find((c) => c.id === cardId) : null;
  elements.editorTitle.textContent = card ? "编辑卡片" : "新建卡片";
  elements.editCategoryEn.value = card?.categoryEn || "Custom";
  elements.editCategoryZh.value = card?.categoryZh || "自定义";
  elements.editQuestionEn.value = card?.questionEn || "";
  elements.editQuestionZh.value = card?.questionZh || "";
  for (let i = 0; i < 3; i += 1) {
    const answer = card?.answers?.[i];
    elements.editAngleEn[i].value = answer?.angleEn || `Answer direction ${i + 1}`;
    elements.editAngleZh[i].value = answer?.angleZh || `回答方向 ${i + 1}`;
    elements.editAnswerEn[i].value = answer?.answerEn || "";
    elements.editAnswerZh[i].value = answer?.answerZh || "";
  }
  if (!elements.editorDialog.open) elements.editorDialog.showModal();
  setTimeout(() => elements.editQuestionEn.focus(), 50);
}

function closeEditor() {
  editingCardId = null;
  if (elements.editorDialog.open) elements.editorDialog.close();
}

function saveEditedCard(event) {
  event.preventDefault();
  const answers = [0, 1, 2].map((i) => ({
    angleEn: cleanText(elements.editAngleEn[i].value),
    angleZh: cleanText(elements.editAngleZh[i].value),
    answerEn: cleanText(elements.editAnswerEn[i].value),
    answerZh: cleanText(elements.editAnswerZh[i].value)
  }));
  const cardData = {
    categoryEn: cleanText(elements.editCategoryEn.value),
    categoryZh: cleanText(elements.editCategoryZh.value),
    questionEn: cleanText(elements.editQuestionEn.value),
    questionZh: cleanText(elements.editQuestionZh.value),
    answers
  };
  const allValues = [cardData.categoryEn, cardData.categoryZh, cardData.questionEn, cardData.questionZh, ...answers.flatMap((a) => Object.values(a))];
  if (allValues.some((value) => !value)) { showToast("问题和三套答案都需要填写"); return; }

  let preferredId;
  if (editingCardId) {
    const index = cards.findIndex((card) => card.id === editingCardId);
    if (index >= 0) cards[index] = { ...cards[index], ...cardData };
    preferredId = editingCardId; showToast("卡片已保存");
  } else {
    const newCard = { id: createId("card"), ...cardData };
    cards.push(newCard); studyOrder.push(newCard.id); preferredId = newCard.id; showToast("已新建卡片");
  }
  saveCards(); syncStudyOrder(preferredId); closeEditor(); render();
}

function deleteCard(cardId) {
  const card = cards.find((c) => c.id === cardId); if (!card) return;
  if (!window.confirm(`确定删除这张卡片吗？\n\n${card.questionEn}`)) return;
  const currentId = getCurrentCard()?.id;
  cards = cards.filter((c) => c.id !== cardId);
  studyOrder = studyOrder.filter((id) => id !== cardId);
  if (currentId === cardId) currentIndex = Math.min(currentIndex, Math.max(studyOrder.length - 1, 0));
  resetCardView(); saveCards(); render(); showToast("卡片已删除");
}

function exportDeck() {
  const payload = { app: "Upwork Meeting Cards", version: 2, exportedAt: new Date().toISOString(), cards };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `upwork-meeting-cards-v2-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); showToast("卡片已导出");
}

async function importDeck(event) {
  const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const imported = normalizeCards(Array.isArray(parsed) ? parsed : parsed.cards);
    if (!imported.length) throw new Error("No valid cards");
    if (!window.confirm(`将用导入的 ${imported.length} 张卡片替换当前卡组。继续吗？`)) return;
    cards = imported; studyOrder = cards.map((card) => card.id); currentIndex = 0; resetCardView();
    saveCards(); saveStudyState(); render(); showToast(`已导入 ${cards.length} 张卡片`);
  } catch (error) { console.error(error); showToast("导入失败：请检查 JSON 格式"); }
}

function resetDeck() {
  if (!window.confirm("恢复内置 100 题会覆盖当前卡组。请先导出备份。继续吗？")) return;
  cards = cloneDefaultCards(); studyOrder = cards.map((card) => card.id); currentIndex = 0; resetCardView();
  saveCards(); saveStudyState(); render(); showToast(`已恢复 ${cards.length} 张内置卡片`);
}

function showToast(message) {
  clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2300);
}

function setupInstallExperience() {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
  if (!standalone) elements.installButton.hidden = false;
}

async function handleInstallClick() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null; elements.installButton.hidden = true; return;
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isMac = /macintosh/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  if (isIOS) elements.installContent.innerHTML = `<p>请使用 <strong>Safari</strong> 打开页面，点击<strong>分享</strong>，再选择<strong>添加到主屏幕</strong>。</p>`;
  else if (isAndroid) elements.installContent.innerHTML = `<p>使用 Chrome 打开页面，点击右上角菜单，选择<strong>安装应用</strong>或<strong>添加到主屏幕</strong>。</p>`;
  else if (isMac) elements.installContent.innerHTML = `<p>在 Chrome 或 Edge 地址栏右侧点击<strong>安装</strong>图标；Safari 可使用“文件 → 添加到程序坞”。</p>`;
  else elements.installContent.innerHTML = `<p>在 Chrome 或 Edge 地址栏右侧点击<strong>安装</strong>图标，或从浏览器菜单选择<strong>安装此应用</strong>。</p>`;
  if (!elements.installDialog.open) elements.installDialog.showModal();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(location.hostname)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch((error) => console.warn(error)));
}
