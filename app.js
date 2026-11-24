import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { varsayilanAlintilar } from "./alintilar.js";

const firebaseConfig = {
  apiKey: "AIzaSyAXEbbuDgn4rLXLfai3XEGtKLAQh47Zu7U",
  authDomain: "satir-arasi-43f37.firebaseapp.com",
  projectId: "satir-arasi-43f37",
  storageBucket: "satir-arasi-43f37.firebasestorage.app",
  messagingSenderId: "754200203752",
  appId: "1:754200203752:web:3650d82670ee234ffed45d"
};

const ADMIN_EMAIL = "haticenisaak00@gmail.com";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ======================================================
// 2. DURUM (STATE) VE YEREL VERİLER
// ======================================================
let allQuotes = [...varsayilanAlintilar];
let filteredQuotes = [...allQuotes];
let currentQuote = null;
let historyStack = [];
let activeCategory = "Tümü";
let currentUser = null;
let isAdmin = false;
let replyingTo = null;
let activeProfileTab = "favs";
let activeSearchTab = "quotes";
let activePublicProfile = null;

const ls = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

let userProfile = ls.get("sa_profile", {
  nickname: "",
  bio: "",
  avatar: "",
  anonOpen: true
});
let favIds = ls.get("sa_favs", []);
let myCollections = ls.get("sa_cols", [{ id: "col-1", name: "Favori Satırlarım", items: [] }]);
let stats = ls.get("sa_stats", { readCount: 0, catCounts: {}, streak: 1, lastDay: "", commentCount: 0, giftCount: 0 });
let soundEnabled = ls.get("sa_sound", true);

const BAD_WORDS = ["salak", "aptal", "gerizekalı", "mal", "orospu", "piç", "siktir", "amk", "aq", "yavşak", "şerefsiz"];
const containsProfanity = (txt) => BAD_WORDS.some(w => txt.toLowerCase().includes(w));

// ======================================================
// 3. DOM ELEMENTLERİ
// ======================================================
const $ = (id) => document.getElementById(id);

const els = {
  greetingLine: $("greetingLine"),
  brandHome: $("brandHome"),
  mainCard: $("mainCard"),
  quoteWrapper: $("quoteWrapper"),
  category: $("category"),
  dailyBadge: $("dailyBadge"),
  featuredBadge: $("featuredBadge"),
  quoteText: $("quoteText"),
  quoteAuthor: $("quoteAuthor"),
  likeBtn: $("likeBtn"),
  heartIcon: $("heartIcon"),
  likeCount: $("likeCount"),
  dynamicReactions: $("dynamicReactions"),
  addEmojiBtn: $("addEmojiBtn"),
  emojiPopover: $("emojiPopover"),
  customEmojiInput: $("customEmojiInput"),
  customEmojiSubmit: $("customEmojiSubmit"),
  toggleCommentsBtn: $("toggleCommentsBtn"),
  commentCount: $("commentCount"),
  commentsDrawer: $("commentsDrawer"),
  closeCommentsBtn: $("closeCommentsBtn"),
  commentsList: $("commentsList"),
  replyingBar: $("replyingBar"),
  replyingText: $("replyingText"),
  cancelReplyBtn: $("cancelReplyBtn"),
  commentForm: $("commentForm"),
  commentTextInput: $("commentTextInput"),
  prevQuoteBtn: $("prevQuoteBtn"),
  newQuoteBtn: $("newQuoteBtn"),
  shareBtn: $("shareBtn"),
  giftBtn: $("giftBtn"),
  copyBtn: $("copyBtn"),
  openModalBtn: $("openModalBtn"),
  footerCounter: $("footerCounter"),
  streakCounter: $("streakCounter"),
  adminBar: $("adminBar"),
  adminFeaturedBtn: $("adminFeaturedBtn"),
  adminEditBtn: $("adminEditBtn"),
  adminDeleteBtn: $("adminDeleteBtn"),
  reportsBtn: $("reportsBtn"),
  reportsCount: $("reportsCount"),
  soundBtn: $("soundBtn"),
  navAvatar: $("navAvatar"),
  navAvatarIcon: $("navAvatarIcon"),
  profileBtnLabel: $("profileBtnLabel"),
  dedicationBanner: $("dedicationBanner")
};

// ======================================================
// 4. YARDIMCI FONKSİYONLAR (SES, MODAL, TARİH, TEMA)
// ======================================================
function openModal(id) { $(id)?.classList.add("open"); }
function closeModal(id) { $(id)?.classList.remove("open"); }

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});
document.querySelectorAll(".modal-overlay").forEach(ov => {
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.classList.remove("open"); });
});

function playPaperSound() {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {}
}

function updateSoundIcon() {
  if (!els.soundBtn) return;
  els.soundBtn.innerHTML = soundEnabled
    ? `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
    : `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
}
els.soundBtn?.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  ls.set("sa_sound", soundEnabled);
  updateSoundIcon();
});

function applyAppearance() {
  const theme = ls.get("sa_theme", "light");
  const font = ls.get("sa_font", "lora");
  const navMode = ls.get("sa_nav_mode", "classic");
  document.body.dataset.theme = theme;
  document.body.dataset.font = font;
  document.body.dataset.navMode = navMode;

  document.querySelectorAll("[data-set-theme]").forEach(b => b.classList.toggle("active", b.dataset.setTheme === theme));
  document.querySelectorAll("[data-set-font]").forEach(b => b.classList.toggle("active", b.dataset.setFont === font));
  document.querySelectorAll("[data-set-nav]").forEach(b => b.classList.toggle("active", b.dataset.setNav === navMode));
}

$("appearanceBtn")?.addEventListener("click", () => openModal("appearanceModalOverlay"));
document.querySelectorAll("[data-set-theme]").forEach(b => b.addEventListener("click", () => { ls.set("sa_theme", b.dataset.setTheme); applyAppearance(); }));
document.querySelectorAll("[data-set-font]").forEach(b => b.addEventListener("click", () => { ls.set("sa_font", b.dataset.setFont); applyAppearance(); }));
document.querySelectorAll("[data-set-nav]").forEach(b => b.addEventListener("click", () => { ls.set("sa_nav_mode", b.dataset.setNav); applyAppearance(); }));

function updateGreetingAndStreak() {
  const h = new Date().getHours();
  const greet = h < 6 ? "Gece okuru hoş geldin" : h < 12 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar";
  if (els.greetingLine) {
    els.greetingLine.textContent = userProfile.nickname ? `${greet}, ${userProfile.nickname}` : greet;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (stats.lastDay !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    stats.streak = stats.lastDay === yesterday ? (stats.streak || 0) + 1 : 1;
    stats.lastDay = today;
    ls.set("sa_stats", stats);
  }
  if (els.streakCounter) {
    els.streakCounter.textContent = `${stats.streak} günlük okuma serisi`;
  }
}

// ======================================================
// 5. KART GÖSTERİMİ, FİLTRE, ŞARKI LİNKİ VE SWIPE
// ======================================================
function getDailyQuoteId() {
  const d = new Date();
  const seed = d.getFullYear() * 1000 + (d.getMonth() + 1) * 40 + d.getDate();
  return allQuotes[seed % allQuotes.length]?.id;
}

function applyFilter(cat) {
  activeCategory = cat;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b.dataset.cat === cat));
  if (cat === "Tümü") filteredQuotes = [...allQuotes];
  else if (cat === "Kurucu") filteredQuotes = allQuotes.filter(q => q.kurucuSecimi);
  else filteredQuotes = allQuotes.filter(q => q.kategori === cat);
  if (!filteredQuotes.length) filteredQuotes = [...allQuotes];
  showRandomQuote();
}

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => applyFilter(btn.dataset.cat));
});

function extractMusicLink(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  const url = match[0];
  const lower = url.toLowerCase();
  if (lower.includes("spotify.com") || lower.includes("youtube.com") || lower.includes("youtu.be")) {
    const cleanText = text.replace(url, "").trim();
    const label = lower.includes("spotify.com") ? "♪ Spotify'da Dinle" : "♪ YouTube'da Dinle";
    return { url, cleanText, label };
  }
  return null;
}

function renderQuote(q, pushHistory = true) {
  if (!q) return;
  if (pushHistory && currentQuote && currentQuote.id !== q.id) {
    historyStack.push(currentQuote);
    if (els.prevQuoteBtn) els.prevQuoteBtn.disabled = false;
  }
  currentQuote = q;

  stats.readCount = (stats.readCount || 0) + 1;
  stats.catCounts[q.kategori] = (stats.catCounts[q.kategori] || 0) + 1;
  ls.set("sa_stats", stats);

  els.quoteWrapper?.classList.add("fade-out");
  setTimeout(() => {
    const musicInfo = extractMusicLink(q.metin) || extractMusicLink(q.kaynak);

    if (els.category) els.category.textContent = q.kategori;
    if (els.quoteText) {
      const displayText = (extractMusicLink(q.metin)?.cleanText) || q.metin;
      els.quoteText.textContent = `“${displayText}”`;
    }
    if (els.quoteAuthor) {
      const cleanAuthor = (extractMusicLink(q.kaynak)?.cleanText) || (q.kaynak || "Anonim");
      els.quoteAuthor.innerHTML = "";
      els.quoteAuthor.append(`— ${cleanAuthor}`);
      if (musicInfo) {
        const link = document.createElement("a");
        link.href = musicInfo.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = ` · ${musicInfo.label}`;
        link.style.marginLeft = "6px";
        els.quoteAuthor.appendChild(link);
      }
    }

    els.dailyBadge?.classList.toggle("show", q.id === getDailyQuoteId());
    els.featuredBadge?.classList.toggle("show", !!q.kurucuSecimi);
    els.adminBar?.classList.toggle("show", isAdmin);
    els.adminFeaturedBtn?.classList.toggle("active", !!q.kurucuSecimi);

    const isFav = favIds.includes(q.id);
    els.likeBtn?.classList.toggle("liked", isFav);
    if (els.heartIcon) els.heartIcon.textContent = isFav ? "♥" : "♡";
    if (els.likeCount) els.likeCount.textContent = q.begeni || 0;
    if (els.commentCount) els.commentCount.textContent = q.yorumSayisi || 0;

    renderReactions(q);
    els.quoteWrapper?.classList.remove("fade-out");
    if (els.footerCounter) els.footerCounter.textContent = `Satır Arası · ${allQuotes.length} satır birikti`;
    if (els.commentsDrawer?.classList.contains("open")) loadComments(q.id);
  }, 160);
}

function showRandomQuote() {
  playPaperSound();
  const pool = filteredQuotes.length > 1 ? filteredQuotes.filter(q => q.id !== currentQuote?.id) : filteredQuotes;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  renderQuote(pick, true);
}

els.newQuoteBtn?.addEventListener("click", showRandomQuote);
els.prevQuoteBtn?.addEventListener("click", () => {
  if (!historyStack.length) return;
  const prev = historyStack.pop();
  els.prevQuoteBtn.disabled = historyStack.length === 0;
  playPaperSound();
  renderQuote(prev, false);
});

// Kaydırmalı (Swipe) Kart Geçişi (Mobil + Masaüstü)
let swipeStartX = 0;
let swipeDeltaX = 0;
let swipeActive = false;

function startSwipe(x, target) {
  if (document.body.dataset.navMode !== "swipe") return;
  if (target && target.closest("button, input, textarea, select, a")) return;
  swipeActive = true;
  swipeStartX = x;
  swipeDeltaX = 0;
  els.mainCard?.classList.add("swiping");
}

function moveSwipe(x) {
  if (!swipeActive || !els.mainCard) return;
  swipeDeltaX = x - swipeStartX;
  els.mainCard.style.transform = `translateX(${swipeDeltaX * 0.45}px) rotate(${swipeDeltaX * 0.02}deg)`;
}

function endSwipe() {
  if (!swipeActive) return;
  swipeActive = false;
  if (els.mainCard) {
    els.mainCard.classList.remove("swiping");
    els.mainCard.style.transform = "";
  }

  if (swipeDeltaX < -70) {
    showRandomQuote();
  } else if (swipeDeltaX > 70) {
    if (historyStack.length > 0) {
      els.prevQuoteBtn?.click();
    } else {
      showRandomQuote();
    }
  }
  swipeDeltaX = 0;
}

els.mainCard?.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) startSwipe(e.touches[0].clientX, e.target);
}, { passive: true });

els.mainCard?.addEventListener("touchmove", (e) => {
  if (e.touches.length === 1) moveSwipe(e.touches[0].clientX);
}, { passive: true });

els.mainCard?.addEventListener("touchend", endSwipe);

els.mainCard?.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") startSwipe(e.clientX, e.target);
});
window.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse" && swipeActive) moveSwipe(e.clientX);
});
window.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse" && swipeActive) endSwipe();
});

// ======================================================
// 6. BEĞENİ, TEPKİLER VE YORUMLAR
// ======================================================
function renderReactions(q) {
  if (!els.dynamicReactions) return;
  els.dynamicReactions.innerHTML = "";
  const tepkiler = q.tepkiler || {};
  Object.entries(tepkiler).forEach(([emoji, count]) => {
    if (count <= 0) return;
    const btn = document.createElement("button");
    btn.className = "react-btn";
    btn.textContent = `${emoji} ${count}`;
    btn.addEventListener("click", () => addReaction(emoji));
    els.dynamicReactions.appendChild(btn);
  });
}

async function addReaction(emoji) {
  if (!currentQuote || !emoji) return;
  currentQuote.tepkiler = currentQuote.tepkiler || {};
  currentQuote.tepkiler[emoji] = (currentQuote.tepkiler[emoji] || 0) + 1;
  renderReactions(currentQuote);
  els.emojiPopover?.classList.remove("open");
  try {
    if (!currentQuote.id.startsWith("def-")) {
      await updateDoc(doc(db, "alintilar", currentQuote.id), { [`tepkiler.${emoji}`]: increment(1) });
    }
  } catch {}
}

els.likeBtn?.addEventListener("click", async () => {
  if (!currentQuote) return;
  const idx = favIds.indexOf(currentQuote.id);
  const adding = idx === -1;
  if (adding) { favIds.push(currentQuote.id); currentQuote.begeni = (currentQuote.begeni || 0) + 1; }
  else { favIds.splice(idx, 1); currentQuote.begeni = Math.max(0, (currentQuote.begeni || 1) - 1); }
  ls.set("sa_favs", favIds);
  els.likeBtn.classList.toggle("liked", adding);
  if (els.heartIcon) els.heartIcon.textContent = adding ? "♥" : "♡";
  if (els.likeCount) els.likeCount.textContent = currentQuote.begeni;
  try {
    if (!currentQuote.id.startsWith("def-")) {
      await updateDoc(doc(db, "alintilar", currentQuote.id), { begeni: increment(adding ? 1 : -1) });
    }
  } catch {}
});

els.addEmojiBtn?.addEventListener("click", (e) => { e.stopPropagation(); els.emojiPopover?.classList.toggle("open"); });
document.addEventListener("click", (e) => { if (!e.target.closest(".reactions-wrap")) els.emojiPopover?.classList.remove("open"); });
document.querySelectorAll(".emoji-opt").forEach(b => b.addEventListener("click", () => addReaction(b.dataset.emoji)));
els.customEmojiSubmit?.addEventListener("click", () => {
  const val = els.customEmojiInput?.value.trim();
  if (val) { addReaction(val); els.customEmojiInput.value = ""; }
});

// Yorumlar
els.toggleCommentsBtn?.addEventListener("click", () => {
  els.commentsDrawer?.classList.toggle("open");
  if (els.commentsDrawer?.classList.contains("open") && currentQuote) loadComments(currentQuote.id);
});
els.closeCommentsBtn?.addEventListener("click", () => els.commentsDrawer?.classList.remove("open"));
els.cancelReplyBtn?.addEventListener("click", () => { replyingTo = null; els.replyingBar?.classList.remove("show"); });

async function loadComments(quoteId) {
  if (!els.commentsList) return;
  els.commentsList.innerHTML = `<p class="empty-msg">Yorumlar yükleniyor...</p>`;
  try {
    const q = query(collection(db, "yorumlar"), where("quoteId", "==", quoteId), orderBy("tarih", "asc"));
    const snap = await getDocs(q);
    if (snap.empty) { els.commentsList.innerHTML = `<p class="empty-msg">İlk yorumu sen bırak.</p>`; return; }
    els.commentsList.innerHTML = "";
    snap.forEach(d => {
      const c = d.data();
      const div = document.createElement("div");
      div.className = "comment-item";
      div.innerHTML = `
        ${c.yanitlanan ? `<div class="comment-reply-tag">↳ ${c.yanitlanan} yanıtlandı</div>` : ""}
        <div class="comment-head">
          <strong>${c.yazar || "Anonim"}</strong>
          <div class="comment-actions">
            <button type="button" class="text-link-btn reply-btn">Yanıtla</button>
          </div>
        </div>
        <div class="comment-body"></div>`;
      div.querySelector(".comment-body").textContent = c.metin;
      div.querySelector(".reply-btn").addEventListener("click", () => {
        replyingTo = c.yazar || "Anonim";
        if (els.replyingText) els.replyingText.textContent = `${replyingTo} kişisine yanıt veriliyor`;
        els.replyingBar?.classList.add("show");
        els.commentTextInput?.focus();
      });
      els.commentsList.appendChild(div);
    });
  } catch {
    els.commentsList.innerHTML = `<p class="empty-msg">Henüz yorum yok.</p>`;
  }
}

els.commentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentQuote || !els.commentTextInput) return;
  const metin = els.commentTextInput.value.trim();
  if (!metin) return;
  const yazar = userProfile.nickname || currentUser?.displayName || "Anonim";
  els.commentTextInput.value = "";
  try {
    await addDoc(collection(db, "yorumlar"), {
      quoteId: currentQuote.id,
      yazar,
      metin,
      yanitlanan: replyingTo || "",
      tarih: serverTimestamp()
    });
    stats.commentCount = (stats.commentCount || 0) + 1;
    ls.set("sa_stats", stats);
    replyingTo = null;
    els.replyingBar?.classList.remove("show");
    currentQuote.yorumSayisi = (currentQuote.yorumSayisi || 0) + 1;
    if (els.commentCount) els.commentCount.textContent = currentQuote.yorumSayisi;
    loadComments(currentQuote.id);
  } catch {
    alert("Yorum gönderilemedi.");
  }
});

// ======================================================
// 7. PROFİL, AVATAR, SEVİYELİ ROZETLER & ANONİM KUTU
// ======================================================
function updateNavProfileUI() {
  if (els.profileBtnLabel) els.profileBtnLabel.textContent = userProfile.nickname || "Profil";
  if (userProfile.avatar && els.navAvatar) {
    els.navAvatar.src = userProfile.avatar;
    els.navAvatar.classList.add("show");
    if (els.navAvatarIcon) els.navAvatarIcon.style.display = "none";
  } else {
    els.navAvatar?.classList.remove("show");
    if (els.navAvatarIcon) els.navAvatarIcon.style.display = "block";
  }
  updateGreetingAndStreak();
}

$("avatarFileInput")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 160; c.height = 160;
      const ctx = c.getContext("2d");
      const min = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, 160, 160);
      userProfile.avatar = c.toDataURL("image/jpeg", 0.78);
      renderAvatarPreview();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

function renderAvatarPreview() {
  const box = $("avatarPreview");
  if (!box) return;
  const initial = (userProfile.nickname || "?").slice(0, 1).toUpperCase();
  const input = $("avatarFileInput");
  box.innerHTML = userProfile.avatar ? `<img src="${userProfile.avatar}" alt="">` : `<span>${initial}</span>`;
  if (input) box.appendChild(input);
}

function computeBadges(myQuotesCount, totalLikes, commentCount) {
  return [
    {
      title: myQuotesCount >= 25 ? "Altın Kalem" : myQuotesCount >= 10 ? "Gümüş Kalem" : "Bronz Kalem",
      cur: myQuotesCount,
      target: myQuotesCount >= 10 ? 25 : myQuotesCount >= 3 ? 10 : 3,
      unit: "paylaşım",
      unlocked: myQuotesCount >= 3
    },
    {
      title: totalLikes >= 50 ? "İlham Kaynağı" : "Ufak Kıvılcım",
      cur: totalLikes,
      target: totalLikes >= 5 ? 50 : 5,
      unit: "beğeni",
      unlocked: totalLikes >= 5
    },
    {
      title: "Söz Dostu",
      cur: commentCount,
      target: 15,
      unit: "yorum",
      unlocked: commentCount >= 15
    }
  ];
}

function renderBadgesGrid(container, myQuotesCount, totalLikes, commentCount) {
  if (!container) return;
  const list = computeBadges(myQuotesCount, totalLikes, commentCount);
  container.innerHTML = list.map(b => {
    const pct = Math.min(100, Math.round((b.cur / b.target) * 100));
    return `
      <div class="badge-card ${b.unlocked ? "unlocked" : ""}">
        <div class="badge-title">${b.unlocked ? "✦ " : ""}${b.title}</div>
        <div class="badge-sub">${b.cur}/${b.target} ${b.unit}</div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join("");
}

$("saveProfileBtn")?.addEventListener("click", async () => {
  const nick = $("nicknameInput")?.value.trim().replace(/\s+/g, "").slice(0, 24);
  const bio = $("bioInput")?.value.trim().slice(0, 120) || "";
  if (!nick) { alert("Lütfen bir takma ad yaz."); return; }
  userProfile.nickname = nick;
  userProfile.bio = bio;
  ls.set("sa_profile", userProfile);
  updateNavProfileUI();
  renderAvatarPreview();
  try {
    await setDoc(doc(db, "okurlar", nick.toLowerCase()), {
      nickname: nick,
      bio,
      avatar: userProfile.avatar || "",
      anonOpen: userProfile.anonOpen !== false,
      uid: currentUser?.uid || "",
      guncelleme: serverTimestamp()
    }, { merge: true });
    alert("Profilin kaydedildi!");
  } catch {
    alert("Profilin bu cihaza kaydedildi.");
  }
});

$("copyProfileLinkBtn")?.addEventListener("click", () => {
  if (!userProfile.nickname) { alert("Önce bir takma ad belirleyip Profili Kaydet'e bas."); return; }
  const url = `${location.origin}${location.pathname}?profil=${encodeURIComponent(userProfile.nickname)}`;
  navigator.clipboard.writeText(url);
  alert("Paylaşılabilir profil linkin kopyalandı!");
});

$("profileBtn")?.addEventListener("click", () => {
  if ($("nicknameInput")) $("nicknameInput").value = userProfile.nickname || "";
  if ($("bioInput")) $("bioInput").value = userProfile.bio || "";
  renderAvatarPreview();
  checkWrappedBanner();

  const myQuotes = allQuotes.filter(q => q.ekleyen && userProfile.nickname && q.ekleyen.toLowerCase() === userProfile.nickname.toLowerCase());
  const totalLikes = myQuotes.reduce((s, q) => s + (q.begeni || 0), 0);
  renderBadgesGrid($("badgesGrid"), myQuotes.length, totalLikes, stats.commentCount || 0);

  if ($("profileFavCount")) $("profileFavCount").textContent = favIds.length;
  if ($("profileMineCount")) $("profileMineCount").textContent = myQuotes.length;
  if ($("profileColCount")) $("profileColCount").textContent = myCollections.length;

  renderAuthArea();
  renderProfileTab(activeProfileTab);
  openModal("profileModalOverlay");
});

function renderAuthArea() {
  const area = $("profileAuthArea");
  if (!area) return;
  if (currentUser) {
    area.innerHTML = `<div class="switch-row"><span>Giriş yapıldı: <strong>${currentUser.email}</strong></span><button type="button" class="text-link-btn" id="logoutBtn">Çıkış</button></div>`;
    $("logoutBtn")?.addEventListener("click", () => signOut(auth));
  } else {
    area.innerHTML = `<button type="button" class="btn-secondary" id="googleLoginBtn" style="width:100%;justify-content:center;">Google ile Giriş Yap</button>`;
    $("googleLoginBtn")?.addEventListener("click", () => signInWithPopup(auth, provider).catch(() => {}));
  }
}

["Favs", "Mine", "Cols", "Inbox"].forEach(t => {
  $(`tab${t}`)?.addEventListener("click", () => {
    activeProfileTab = t.toLowerCase();
    ["Favs", "Mine", "Cols", "Inbox"].forEach(x => $(`tab${x}`)?.classList.toggle("active", x === t));
    renderProfileTab(activeProfileTab);
  });
});

async function renderProfileTab(tab) {
  const box = $("profileListContent");
  if (!box) return;
  if (tab === "favs") {
    const list = allQuotes.filter(q => favIds.includes(q.id));
    box.innerHTML = list.length ? "" : `<p class="empty-msg">Henüz beğendiğin bir satır yok.</p>`;
    list.forEach(q => box.appendChild(createQuoteListItem(q, "profileModalOverlay")));
  } else if (tab === "mine") {
    const list = allQuotes.filter(q => q.ekleyen && userProfile.nickname && q.ekleyen.toLowerCase() === userProfile.nickname.toLowerCase());
    box.innerHTML = list.length ? "" : `<p class="empty-msg">Henüz eklediğin bir satır yok.</p>`;
    list.forEach(q => box.appendChild(createQuoteListItem(q, "profileModalOverlay")));
  } else if (tab === "cols") {
    box.innerHTML = "";
    myCollections.forEach(c => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `<div class="list-item-text">${c.name}</div><div class="list-item-meta"><span>${c.items.length} satır</span></div>`;
      box.appendChild(div);
    });
  } else if (tab === "inbox") {
    box.innerHTML = `
      <div class="switch-row">
        <span>Anonim satır alımı: <strong>${userProfile.anonOpen !== false ? "Açık" : "Kapalı"}</strong></span>
        <button type="button" class="btn-secondary" id="toggleAnonBtn" style="padding:4px 10px;font-size:0.76rem;">${userProfile.anonOpen !== false ? "Kapat" : "Aç"}</button>
      </div>
      <div id="inboxItems"><p class="empty-msg">Gelen kutusu yükleniyor...</p></div>`;
    $("toggleAnonBtn")?.addEventListener("click", async () => {
      userProfile.anonOpen = userProfile.anonOpen === false;
      ls.set("sa_profile", userProfile);
      if (userProfile.nickname) {
        try { await setDoc(doc(db, "okurlar", userProfile.nickname.toLowerCase()), { anonOpen: userProfile.anonOpen }, { merge: true }); } catch {}
      }
      renderProfileTab("inbox");
    });
    if (!userProfile.nickname) { if ($("inboxItems")) $("inboxItems").innerHTML = `<p class="empty-msg">Gelen kutusu için önce bir takma ad kaydet.</p>`; return; }
    try {
      const q = query(collection(db, "anonimMesajlar"), where("hedef", "==", userProfile.nickname.toLowerCase()));
      const snap = await getDocs(q);
      if ($("profileInboxCount")) $("profileInboxCount").textContent = snap.size;
      if (snap.empty) { if ($("inboxItems")) $("inboxItems").innerHTML = `<p class="empty-msg">Henüz anonim bir satır gelmedi. Profil linkini arkadaşlarınla paylaş!</p>`; return; }
      if ($("inboxItems")) $("inboxItems").innerHTML = "";
      snap.forEach(d => {
        const m = d.data();
        const div = document.createElement("div");
        div.className = "list-item";
        div.style.cursor = "default";
        div.innerHTML = `<div class="list-item-text"></div><div class="list-item-meta"><span>Anonim</span><button type="button" class="text-link-btn del-anon">Sil</button></div>`;
        div.querySelector(".list-item-text").textContent = `“${m.metin}”`;
        div.querySelector(".del-anon").addEventListener("click", async () => {
          try { await deleteDoc(doc(db, "anonimMesajlar", d.id)); div.remove(); } catch {}
        });
        $("inboxItems")?.appendChild(div);
      });
    } catch {
      if ($("inboxItems")) $("inboxItems").innerHTML = `<p class="empty-msg">Gelen kutusu şu an yüklenemedi.</p>`;
    }
  }
}

async function openPublicProfile(nickname) {
  const key = nickname.toLowerCase();
  activePublicProfile = { nickname, bio: "", avatar: "", anonOpen: true };
  try {
    const snap = await getDoc(doc(db, "okurlar", key));
    if (snap.exists()) activePublicProfile = { ...activePublicProfile, ...snap.data() };
  } catch {}

  if ($("pubProfileTitle")) $("pubProfileTitle").textContent = `@${activePublicProfile.nickname}`;
  if ($("pubName")) $("pubName").textContent = activePublicProfile.nickname;
  if ($("pubBio")) $("pubBio").textContent = activePublicProfile.bio || "Satır Arası okuru";
  if ($("pubAvatar")) {
    $("pubAvatar").innerHTML = activePublicProfile.avatar
      ? `<img src="${activePublicProfile.avatar}" alt="">`
      : `<span>${activePublicProfile.nickname.slice(0, 1).toUpperCase()}</span>`;
  }

  const theirQuotes = allQuotes.filter(q => q.ekleyen && q.ekleyen.toLowerCase() === key);
  const totalLikes = theirQuotes.reduce((s, q) => s + (q.begeni || 0), 0);
  renderBadgesGrid($("pubBadgesGrid"), theirQuotes.length, totalLikes, 0);

  if ($("pubAnonBox")) $("pubAnonBox").style.display = activePublicProfile.anonOpen === false ? "none" : "block";
  const listEl = $("pubQuotesList");
  if (listEl) {
    listEl.innerHTML = theirQuotes.length ? "" : `<p class="empty-msg">Henüz paylaştığı bir satır yok.</p>`;
    theirQuotes.forEach(q => listEl.appendChild(createQuoteListItem(q, "publicProfileModalOverlay")));
  }

  openModal("publicProfileModalOverlay");
}

$("sendAnonForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activePublicProfile || !$("anonMsgInput")) return;
  const lastSent = ls.get("sa_last_anon", 0);
  if (Date.now() - lastSent < 30000) { alert("Spam koruması: Yeni bir not bırakmak için 30 saniye bekle."); return; }
  const metin = $("anonMsgInput").value.trim();
  if (!metin) return;
  if (containsProfanity(metin)) { alert("Lütfen saygılı ve temiz bir dil kullan."); return; }
  try {
    await addDoc(collection(db, "anonimMesajlar"), {
      hedef: activePublicProfile.nickname.toLowerCase(),
      metin,
      tarih: serverTimestamp()
    });
    ls.set("sa_last_anon", Date.now());
    $("anonMsgInput").value = "";
    alert("Anonim satırın gizlice iletildi!");
  } catch {
    alert("Gönderilemedi, lütfen tekrar dene.");
  }
});

// ======================================================
// 8. GELİŞMİŞ ARAMA (ALINTILAR + OKURLAR)
// ======================================================
function createQuoteListItem(q, modalToClose) {
  const div = document.createElement("div");
  div.className = "list-item";
  const cleanText = (extractMusicLink(q.metin)?.cleanText) || q.metin;
  const cleanAuthor = (extractMusicLink(q.kaynak)?.cleanText) || (q.kaynak || "Anonim");
  div.innerHTML = `<div class="list-item-text">“${cleanText}”</div><div class="list-item-meta"><span>${cleanAuthor}</span><span>${q.kategori}</span></div>`;
  div.addEventListener("click", () => { renderQuote(q, true); closeModal(modalToClose); });
  return div;
}

$("archiveBtn")?.addEventListener("click", () => {
  if ($("archiveSearchInput")) $("archiveSearchInput").value = "";
  renderSearchResults();
  openModal("archiveModalOverlay");
});
$("searchTabQuotes")?.addEventListener("click", () => {
  activeSearchTab = "quotes";
  $("searchTabQuotes")?.classList.add("active");
  $("searchTabReaders")?.classList.remove("active");
  renderSearchResults();
});
$("searchTabReaders")?.addEventListener("click", () => {
  activeSearchTab = "readers";
  $("searchTabReaders")?.classList.add("active");
  $("searchTabQuotes")?.classList.remove("active");
  renderSearchResults();
});
$("archiveSearchInput")?.addEventListener("input", renderSearchResults);

async function renderSearchResults() {
  const term = $("archiveSearchInput")?.value.trim().toLowerCase() || "";
  const list = $("archiveList");
  if (!list) return;
  if (activeSearchTab === "quotes") {
    const matches = allQuotes.filter(q =>
      q.metin.toLowerCase().includes(term) || (q.kaynak || "").toLowerCase().includes(term) || q.kategori.toLowerCase().includes(term)
    ).slice(0, 40);
    list.innerHTML = matches.length ? "" : `<p class="empty-msg">Eşleşen satır bulunamadı.</p>`;
    matches.forEach(q => list.appendChild(createQuoteListItem(q, "archiveModalOverlay")));
  } else {
    list.innerHTML = `<p class="empty-msg">Okurlar aranıyor...</p>`;
    try {
      const snap = await getDocs(collection(db, "okurlar"));
      const readers = [];
      snap.forEach(d => readers.push(d.data()));
      const filtered = readers.filter(r => (r.nickname || "").toLowerCase().includes(term) || (r.bio || "").toLowerCase().includes(term));
      list.innerHTML = filtered.length ? "" : `<p class="empty-msg">Eşleşen okur profili bulunamadı.</p>`;
      filtered.forEach(r => {
        const row = document.createElement("div");
        row.className = "reader-row";
        row.innerHTML = `
          <div class="avatar-circle">${r.avatar ? `<img src="${r.avatar}" alt="">` : `<span>${(r.nickname || "?")[0].toUpperCase()}</span>`}</div>
          <div><div style="font-weight:600;font-size:0.9rem;">@${r.nickname}</div><div style="font-size:0.78rem;color:var(--text-muted);">${r.bio || "Satır Arası okuru"}</div></div>`;
        row.addEventListener("click", () => { closeModal("archiveModalOverlay"); openPublicProfile(r.nickname); });
        list.appendChild(row);
      });
    } catch {
      list.innerHTML = `<p class="empty-msg">Okur listesi şu an alınamadı.</p>`;
    }
  }
}

// ======================================================
// 9. GÜNÜN DÜELLOSU & 13 ARALIK WRAPPED
// ======================================================
$("duelBtn")?.addEventListener("click", () => {
  const today = new Date().toISOString().slice(0, 10);
  const seed = parseInt(today.replace(/-/g, ""), 10);
  const qA = allQuotes[seed % allQuotes.length];
  const qB = allQuotes[(seed + 17) % allQuotes.length];
  const voted = ls.get(`sa_duel_${today}`, null);
  const votes = ls.get(`sa_duel_counts_${today}`, { a: 12 + (seed % 9), b: 10 + (seed % 7) });

  const renderDuel = (choice) => {
    const total = votes.a + votes.b;
    const pctA = Math.round((votes.a / total) * 100);
    const pctB = 100 - pctA;
    const box = $("duelContainer");
    if (!box) return;
    box.className = choice ? "duel-voted" : "";
    box.innerHTML = `
      <button type="button" class="duel-option ${choice === "a" ? "voted" : ""}" id="duelA">
        <div class="list-item-text">“${qA.metin}”</div>
        <div class="list-item-meta"><span>${qA.kaynak}</span></div>
        <div class="duel-bar-bg"><div class="duel-bar-fill" style="width:${pctA}%"></div></div>
        <div class="duel-pct">%${pctA} tercih etti</div>
      </button>
      <button type="button" class="duel-option ${choice === "b" ? "voted" : ""}" id="duelB">
        <div class="list-item-text">“${qB.metin}”</div>
        <div class="list-item-meta"><span>${qB.kaynak}</span></div>
        <div class="duel-bar-bg"><div class="duel-bar-fill" style="width:${pctB}%"></div></div>
        <div class="duel-pct">%${pctB} tercih etti</div>
      </button>`;
    if (!choice) {
      $("duelA")?.addEventListener("click", () => { votes.a++; ls.set(`sa_duel_${today}`, "a"); ls.set(`sa_duel_counts_${today}`, votes); renderDuel("a"); });
      $("duelB")?.addEventListener("click", () => { votes.b++; ls.set(`sa_duel_${today}`, "b"); ls.set(`sa_duel_counts_${today}`, votes); renderDuel("b"); });
    }
  };
  renderDuel(voted);
  openModal("duelModalOverlay");
});

function checkWrappedBanner() {
  const now = new Date();
  const isDec13 = (now.getMonth() === 11 && now.getDate() >= 13);
  $("wrappedBanner")?.classList.toggle("show", isDec13 || isAdmin);
}

$("openWrappedBtn")?.addEventListener("click", () => {
  const topCat = Object.entries(stats.catCounts || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "Kitap";
  if ($("wrappedContent")) {
    $("wrappedContent").innerHTML = `
      <div style="font-size:0.78rem;letter-spacing:1.4px;text-transform:uppercase;color:var(--accent);margin-bottom:6px;">✦ Satır Arası ${new Date().getFullYear()}</div>
      <h3 style="font-family:'Lora',serif;font-size:1.3rem;margin-bottom:6px;">${userProfile.nickname || "Okur"} · Yılın Özeti</h3>
      <div class="wrapped-stat-grid">
        <div class="wrapped-stat"><span>Okunan Satır</span><strong>${stats.readCount || 0}</strong></div>
        <div class="wrapped-stat"><span>En Uzun Seri</span><strong>${stats.streak || 1} Gün</strong></div>
        <div class="wrapped-stat"><span>Favori Kategori</span><strong>${topCat}</strong></div>
        <div class="wrapped-stat"><span>Beğenilenler</span><strong>${favIds.length}</strong></div>
      </div>
      <p style="font-size:0.82rem;color:var(--text-muted);">Bu yıl kelimelerin arasında güzel izler bıraktın.</p>`;
  }
  openModal("wrappedModalOverlay");
});

$("shareWrappedBtn")?.addEventListener("click", () => {
  if (!currentQuote) return;
  downloadStoryCard({
    kategori: "13 ARALIK ÖZETİ",
    metin: `${stats.readCount || 0} satır okudum, ${stats.streak || 1} gün seri yaptım.`,
    kaynak: `${userProfile.nickname || "Satır Arası"} · ${new Date().getFullYear()}`
  });
});

// ======================================================
// 10. ALINTI EKLEME, PAYLAŞMA, İTHAF, POPÜLER, HAFTANIN SORUSU
// ======================================================
$("openModalBtn")?.addEventListener("click", () => {
  if ($("editId")) $("editId").value = "";
  if ($("formModalTitle")) $("formModalTitle").textContent = "Yeni Satır Ekle";
  $("quoteForm")?.reset();
  openModal("addModalOverlay");
});

$("quoteForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const metin = $("inputText")?.value.trim();
  const kategori = $("inputCategory")?.value || "Kitap";
  const kaynak = $("inputAuthor")?.value.trim() || userProfile.nickname || "Anonim";
  const editId = $("editId")?.value || "";
  if (!metin) return;

  try {
    if (editId && !editId.startsWith("def-")) {
      await updateDoc(doc(db, "alintilar", editId), { metin, kategori, kaynak });
      const target = allQuotes.find(q => q.id === editId);
      if (target) { target.metin = metin; target.kategori = kategori; target.kaynak = kaynak; renderQuote(target, false); }
    } else {
      const ref = await addDoc(collection(db, "alintilar"), {
        metin, kategori, kaynak, begeni: 0, tepkiler: {}, yorumSayisi: 0,
        kurucuSecimi: false, ekleyen: userProfile.nickname || "", tarih: serverTimestamp()
      });
      const yeni = { id: ref.id, metin, kategori, kaynak, begeni: 0, tepkiler: {}, yorumSayisi: 0, ekleyen: userProfile.nickname || "" };
      allQuotes.unshift(yeni);
      filteredQuotes.unshift(yeni);
      renderQuote(yeni, true);
    }
    closeModal("addModalOverlay");
  } catch {
    alert("Kaydedilemedi.");
  }
});

function downloadStoryCard(q) {
  const c = $("storyCanvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  const style = getComputedStyle(document.body);
  ctx.fillStyle = style.getPropertyValue("--bg-color").trim() || "#f6f4f0";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = style.getPropertyValue("--accent").trim() || "#8c5e58";
  ctx.font = "500 34px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`✦  ${q.kategori.toUpperCase()}  ✦`, 540, 620);

  ctx.fillStyle = style.getPropertyValue("--text-main").trim() || "#2b2927";
  ctx.font = "52px Lora, Georgia, serif";
  const words = `“${q.metin}”`.split(" ");
  let line = "", y = 780;
  for (const w of words) {
    const test = line + w + " ";
    if (ctx.measureText(test).width > 840 && line) { ctx.fillText(line.trim(), 540, y); line = w + " "; y += 78; }
    else line = test;
  }
  ctx.fillText(line.trim(), 540, y);

  ctx.fillStyle = style.getPropertyValue("--text-muted").trim() || "#78736e";
  ctx.font = "italic 36px Lora, Georgia, serif";
  ctx.fillText(`— ${q.kaynak || "Anonim"}`, 540, y + 110);
  ctx.font = "500 28px Inter, sans-serif";
  ctx.fillText("✦ Satır Arası", 540, 1740);

  const a = document.createElement("a");
  a.download = "satir-arasi.png";
  a.href = c.toDataURL("image/png");
  a.click();
}

els.shareBtn?.addEventListener("click", () => currentQuote && downloadStoryCard(currentQuote));
els.copyBtn?.addEventListener("click", () => {
  if (!currentQuote || !els.copyBtn) return;
  navigator.clipboard.writeText(`“${currentQuote.metin}” — ${currentQuote.kaynak || "Anonim"}`);
  els.copyBtn.textContent = "Kopyalandı";
  setTimeout(() => (els.copyBtn.textContent = "Kopyala"), 1500);
});

$("popularBtn")?.addEventListener("click", () => {
  const top = [...allQuotes].sort((a, b) => (b.begeni || 0) - (a.begeni || 0)).slice(0, 20);
  const list = $("popList");
  if (!list) return;
  list.innerHTML = "";
  top.forEach(q => list.appendChild(createQuoteListItem(q, "popModalOverlay")));
  openModal("popModalOverlay");
});

els.giftBtn?.addEventListener("click", () => openModal("giftModalOverlay"));
$("copyGiftLinkBtn")?.addEventListener("click", () => {
  if (!currentQuote) return;
  const from = $("giftFromInput")?.value.trim() || "";
  const note = $("giftNoteInput")?.value.trim() || "";
  const params = new URLSearchParams({ id: currentQuote.id });
  if (from) params.set("kimden", from);
  if (note) params.set("not", note);
  navigator.clipboard.writeText(`${location.origin}${location.pathname}?${params.toString()}`);
  alert("Zarf linki kopyalandı!");
  closeModal("giftModalOverlay");
});

$("saveToColBtn")?.addEventListener("click", () => {
  if (!currentQuote) return;
  const list = $("colSelectList");
  if (!list) return;
  list.innerHTML = "";
  myCollections.forEach(c => {
    const has = c.items.includes(currentQuote.id);
    const btn = document.createElement("button");
    btn.className = `col-chip ${has ? "active" : ""}`;
    btn.style.margin = "0 6px 6px 0";
    btn.textContent = `${has ? "✓ " : "+ "}${c.name}`;
    btn.addEventListener("click", () => {
      if (has) c.items = c.items.filter(id => id !== currentQuote.id);
      else c.items.push(currentQuote.id);
      ls.set("sa_cols", myCollections);
      closeModal("collectionModalOverlay");
    });
    list.appendChild(btn);
  });
  openModal("collectionModalOverlay");
});
$("createColBtn")?.addEventListener("click", () => {
  const name = $("newColNameInput")?.value.trim();
  if (!name) return;
  myCollections.push({ id: `col-${Date.now()}`, name, items: currentQuote ? [currentQuote.id] : [] });
  ls.set("sa_cols", myCollections);
  if ($("newColNameInput")) $("newColNameInput").value = "";
  closeModal("collectionModalOverlay");
});

$("weeklyBtn")?.addEventListener("click", () => {
  if ($("weeklyQuestionText")) {
    $("weeklyQuestionText").textContent = ls.get("sa_weekly_q", "Seni en çok etkileyen tek bir kitap veya şarkı cümlesi hangisi?");
  }
  if ($("adminWeeklyEdit")) $("adminWeeklyEdit").style.display = isAdmin ? "block" : "none";
  openModal("weeklyModalOverlay");
});
$("saveWeeklyQBtn")?.addEventListener("click", () => {
  const q = $("weeklyQuestionInput")?.value.trim();
  if (q && $("weeklyQuestionInput")) {
    ls.set("sa_weekly_q", q);
    if ($("weeklyQuestionText")) $("weeklyQuestionText").textContent = q;
    $("weeklyQuestionInput").value = "";
  }
});

$("reportCardBtn")?.addEventListener("click", async () => {
  if (!currentQuote) return;
  if (!confirm("Bu içeriği yöneticiye bildirmek istiyor musun?")) return;
  try {
    await addDoc(collection(db, "bildirimler"), { quoteId: currentQuote.id, metin: currentQuote.metin, tarih: serverTimestamp() });
    alert("Bildirimin iletildi.");
  } catch {}
});

els.adminFeaturedBtn?.addEventListener("click", async () => {
  if (!isAdmin || !currentQuote) return;
  currentQuote.kurucuSecimi = !currentQuote.kurucuSecimi;
  els.featuredBadge?.classList.toggle("show", currentQuote.kurucuSecimi);
  els.adminFeaturedBtn.classList.toggle("active", currentQuote.kurucuSecimi);
  if (!currentQuote.id.startsWith("def-")) {
    try { await updateDoc(doc(db, "alintilar", currentQuote.id), { kurucuSecimi: currentQuote.kurucuSecimi }); } catch {}
  }
});

els.adminEditBtn?.addEventListener("click", () => {
  if (!isAdmin || !currentQuote) return;
  if ($("editId")) $("editId").value = currentQuote.id;
  if ($("formModalTitle")) $("formModalTitle").textContent = "Satırı Düzenle";
  if ($("inputCategory")) $("inputCategory").value = currentQuote.kategori;
  if ($("inputText")) $("inputText").value = currentQuote.metin;
  if ($("inputAuthor")) $("inputAuthor").value = currentQuote.kaynak || "";
  openModal("addModalOverlay");
});

els.adminDeleteBtn?.addEventListener("click", async () => {
  if (!isAdmin || !currentQuote || currentQuote.id.startsWith("def-")) return;
  if (!confirm("Bu satırı kalıcı olarak silmek istiyor musun?")) return;
  try {
    await deleteDoc(doc(db, "alintilar", currentQuote.id));
    allQuotes = allQuotes.filter(q => q.id !== currentQuote.id);
    applyFilter(activeCategory);
  } catch {}
});

// ======================================================
// 11. BAŞLATMA VE FIREBASE VERİ ÇEKME
// ======================================================
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  isAdmin = !!(user && user.email === ADMIN_EMAIL);
  if (els.adminBar) els.adminBar.classList.toggle("show", isAdmin);
  checkWrappedBanner();
});

async function init() {
  applyAppearance();
  updateSoundIcon();
  updateNavProfileUI();

  try {
    const snap = await getDocs(collection(db, "alintilar"));
    const fbQuotes = [];
    snap.forEach(d => fbQuotes.push({ id: d.id, ...d.data() }));
    allQuotes = [...fbQuotes, ...varsayilanAlintilar];
    filteredQuotes = [...allQuotes];
  } catch {}

  const params = new URLSearchParams(location.search);
  const profilParam = params.get("profil");
  const idParam = params.get("id");
  const notParam = params.get("not");
  const kimdenParam = params.get("kimden");

  if (idParam) {
    const found = allQuotes.find(q => q.id === idParam);
    if (found) {
      renderQuote(found, false);
      if (notParam) {
        if ($("envelopeTitle")) $("envelopeTitle").textContent = kimdenParam ? `${kimdenParam} sana bir satır bıraktı` : "Sana bir satır bırakıldı";
        if ($("envelopeNotePreview")) $("envelopeNotePreview").textContent = `“${notParam}”`;
        openModal("envelopeModalOverlay");
        if ($("openEnvelopeBtn")) {
          $("openEnvelopeBtn").onclick = () => {
            closeModal("envelopeModalOverlay");
            if (els.dedicationBanner) {
              els.dedicationBanner.textContent = `${kimdenParam ? kimdenParam + ": " : ""}“${notParam}”`;
              els.dedicationBanner.classList.add("show");
            }
          };
        }
      }
    } else {
      showRandomQuote();
    }
  } else {
    showRandomQuote();
  }

  if (profilParam) openPublicProfile(profilParam);
}

init();
