import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc, doc, setDoc, getDoc, deleteDoc, increment, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { varsayilanAlintilar } from "./alintilar.js";

const ADMIN_EMAIL = "haticenisaak00@gmail.com";

const firebaseConfig = {
  apiKey: "AIzaSyAXEbbuDgn4rLXLfai3XEGtKLAQh47Zu7U",
  authDomain: "satir-arasi-43f37.firebaseapp.com",
  projectId: "satir-arasi-43f37",
  storageBucket: "satir-arasi-43f37.firebasestorage.app",
  messagingSenderId: "754200203752",
  appId: "1:754200203752:web:3650d82670ee234ffed45d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const alintilarRef = collection(db, "alintilar");

let alintilar = [];
let aktifKategori = "Tümü";
let mevcutKart = null;
let gecmisKartlar = [];
let gununKartiId = null;
let mevcutKullanici = null;
let yoneticiMi = false;
let yanitlananYazar = null;
let aktifProfilSekmesi = "favs";
let seciliKoleksiyon = null;

let takmaAd = localStorage.getItem("satirArasiNickname") || "";
let begenilenIdler = JSON.parse(localStorage.getItem("satirArasiBegeniler")) || [];
let eklediklerimIdler = JSON.parse(localStorage.getItem("satirArasiEklediklerim")) || [];
let kullaniciTepkileri = JSON.parse(localStorage.getItem("satirArasiTepkiler")) || {};
let koleksiyonlar = JSON.parse(localStorage.getItem("satirArasiKoleksiyonlar")) || {};
let yorumSayim = parseInt(localStorage.getItem("satirArasiYorumSayim") || "0", 10);
let sesAcik = localStorage.getItem("satirArasiSes") !== "kapali";

// DOM
const quoteText = document.getElementById("quoteText");
const quoteAuthor = document.getElementById("quoteAuthor");
const listenLink = document.getElementById("listenLink");
const categoryEl = document.getElementById("category");
const dailyBadge = document.getElementById("dailyBadge");
const featuredBadge = document.getElementById("featuredBadge");
const quoteWrapper = document.getElementById("quoteWrapper");
const adminBar = document.getElementById("adminBar");
const adminFeaturedBtn = document.getElementById("adminFeaturedBtn");
const dedicationBanner = document.getElementById("dedicationBanner");
const likeBtn = document.getElementById("likeBtn");
const heartIcon = document.getElementById("heartIcon");
const likeCount = document.getElementById("likeCount");
const dynamicReactions = document.getElementById("dynamicReactions");
const commentCount = document.getElementById("commentCount");
const commentsDrawer = document.getElementById("commentsDrawer");
const footerCounter = document.getElementById("footerCounter");
const streakCounter = document.getElementById("streakCounter");
const greetingLine = document.getElementById("greetingLine");
const soundBtn = document.getElementById("soundBtn");
const profileBtnLabel = document.getElementById("profileBtnLabel");
const prevQuoteBtn = document.getElementById("prevQuoteBtn");
const reportsBtn = document.getElementById("reportsBtn");

const ICON_SOUND_ON = `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
const ICON_SOUND_OFF = `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;

// --- Saate Göre Karşılama & Günlük Seri (Streak) ---
function karsilamayiGuncelle() {
  const saat = new Date().getHours();
  let selam = "İyi geceler";
  if (saat >= 5 && saat < 12) selam = "Günaydın";
  else if (saat >= 12 && saat < 18) selam = "İyi günler";
  else if (saat >= 18 && saat < 22) selam = "İyi akşamlar";
  const isim = takmaAd.trim() || mevcutKullanici?.displayName?.split(" ")[0] || "";
  greetingLine.textContent = isim ? `${selam}, ${isim}` : selam;
}

function gunlukSeriHesapla() {
  const bugun = new Date().toISOString().slice(0, 10);
  const dunTarih = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let sonGiris = localStorage.getItem("satirArasiSonGiris");
  let seri = parseInt(localStorage.getItem("satirArasiSeri") || "0", 10);

  if (sonGiris !== bugun) {
    seri = (sonGiris === dunTarih) ? seri + 1 : 1;
    localStorage.setItem("satirArasiSonGiris", bugun);
    localStorage.setItem("satirArasiSeri", String(seri));
  }
  streakCounter.textContent = seri > 1 ? `${seri} gündür satır arasındasın` : "Bugün satır arasındasın";
  return seri;
}
const gunlukSeri = gunlukSeriHesapla();

// --- Tema & Yazı Tipi ---
function gorunumUygula(tema, font) {
  document.body.setAttribute("data-theme", tema);
  document.body.setAttribute("data-font", font);
  localStorage.setItem("satirArasiTema", tema);
  localStorage.setItem("satirArasiFont", font);
  document.querySelectorAll("[data-set-theme]").forEach(b => b.classList.toggle("active", b.dataset.setTheme === tema));
  document.querySelectorAll("[data-set-font]").forEach(b => b.classList.toggle("active", b.dataset.setFont === font));
}
gorunumUygula(localStorage.getItem("satirArasiTema") || "light", localStorage.getItem("satirArasiFont") || "lora");
document.querySelectorAll("[data-set-theme]").forEach(b => b.addEventListener("click", () => gorunumUygula(b.dataset.setTheme, document.body.getAttribute("data-font"))));
document.querySelectorAll("[data-set-font]").forEach(b => b.addEventListener("click", () => gorunumUygula(document.body.getAttribute("data-theme"), b.dataset.setFont)));

// --- Kâğıt Sesi ---
soundBtn.innerHTML = sesAcik ? ICON_SOUND_ON : ICON_SOUND_OFF;
soundBtn.addEventListener("click", () => {
  sesAcik = !sesAcik;
  soundBtn.innerHTML = sesAcik ? ICON_SOUND_ON : ICON_SOUND_OFF;
  localStorage.setItem("satirArasiSes", sesAcik ? "acik" : "kapali");
});

let audioCtx = null;
function kagitSesiCal() {
  if (!sesAcik) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const duration = 0.13;
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI) * 0.12;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    noise.connect(filter);
    filter.connect(audioCtx.destination);
    noise.start();
  } catch (e) {}
}

// --- Profil, Rozetler & Google Auth ---
function aktifIsimGetir() {
  if (takmaAd.trim()) return takmaAd.trim();
  if (mevcutKullanici && mevcutKullanici.displayName) return mevcutKullanici.displayName.split(" ")[0];
  return "Anonim";
}

function profilButonuGuncelle() {
  const etiket = takmaAd.trim() || mevcutKullanici?.displayName?.split(" ")[0] || "Profil";
  profileBtnLabel.textContent = yoneticiMi ? `${etiket} ✦` : etiket;
  adminBar.classList.toggle("show", yoneticiMi && !!mevcutKart);
  reportsBtn.style.display = yoneticiMi ? "inline-flex" : "none";
  document.getElementById("adminWeeklyEdit").style.display = yoneticiMi ? "block" : "none";
  karsilamayiGuncelle();
}

onAuthStateChanged(auth, async (user) => {
  mevcutKullanici = user;
  yoneticiMi = !!(user && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (user) {
    const userRef = doc(db, "kullanicilar", user.uid);
    const snap = await getDoc(userRef);
    const veri = snap.exists() ? snap.data() : {};
    if (veri.takmaAd) { takmaAd = veri.takmaAd; localStorage.setItem("satirArasiNickname", takmaAd); }
    if (veri.koleksiyonlar) { koleksiyonlar = { ...koleksiyonlar, ...veri.koleksiyonlar }; localStorage.setItem("satirArasiKoleksiyonlar", JSON.stringify(koleksiyonlar)); }
    begenilenIdler = Array.from(new Set([...(veri.begenilenler || []), ...begenilenIdler]));
    await setDoc(userRef, { begenilenler: begenilenIdler, takmaAd: takmaAd || "", koleksiyonlar }, { merge: true });
    if (yoneticiMi) bildirimSayisiniYukle();
  }
  profilButonuGuncelle();
  if (mevcutKart) tepkileriCiz();
});

function rozetleriCiz(eklenenSayisi) {
  const grid = document.getElementById("badgesGrid");
  const colSayisi = Object.keys(koleksiyonlar).length;
  const rozetler = [
    { ad: "İlk İz", kosul: eklenenSayisi >= 1, aciklama: "İlk satırını ekledi" },
    { ad: "Kalemşor", kosul: eklenenSayisi >= 5, aciklama: "5+ satır ekledi" },
    { ad: "Satır Dostu", kosul: yorumSayim >= 3, aciklama: "3+ yorum bıraktı" },
    { ad: "Sadık Okur", kosul: gunlukSeri >= 3, aciklama: "3+ gün üst üste okudu" },
    { ad: "Koleksiyoncu", kosul: colSayisi >= 1, aciklama: "Kendi koleksiyonunu oluşturdu" }
  ];
  grid.innerHTML = rozetler.map(r => `
    <span class="reader-badge ${r.kosul ? "" : "locked"}" title="${r.aciklama}">
      ${r.kosul ? "✦ " : ""}${r.ad}
    </span>`).join("");
}

function profilModaliniDoldur() {
  document.getElementById("nicknameInput").value = takmaAd;
  const authArea = document.getElementById("profileAuthArea");
  if (mevcutKullanici) {
    authArea.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--input-bg);padding:10px 12px;border-radius:10px;border:1px solid var(--border-color);font-size:0.82rem;">
        <span>${mevcutKullanici.email}</span>
        <button type="button" class="text-link-btn" id="profileLogoutBtn" style="color:var(--heart-color);">Çıkış Yap</button>
      </div>`;
    document.getElementById("profileLogoutBtn").addEventListener("click", async () => { await signOut(auth); profilModaliniDoldur(); });
  } else {
    authArea.innerHTML = `
      <div class="info-note" style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <span>Giriş yaparsan koleksiyonların ve takma adın tüm cihazlarında saklanır.</span>
        <button type="button" class="btn-primary" id="profileLoginBtn" style="padding:6px 12px;font-size:0.78rem;white-space:nowrap;">Google Giriş</button>
      </div>`;
    document.getElementById("profileLoginBtn").addEventListener("click", async () => {
      try { await signInWithPopup(auth, provider); profilModaliniDoldur(); }
      catch (err) { alert("Giriş yapılamadı."); }
    });
  }

  const favoriler = alintilar.filter(a => begenilenIdler.includes(a.id));
  const eklediklerim = alintilar.filter(a => (mevcutKullanici && a.ekleyenUid === mevcutKullanici.uid) || eklediklerimIdler.includes(a.id));
  const colIsimleri = Object.keys(koleksiyonlar);

  rozetleriCiz(eklediklerim.length);
  document.getElementById("profileFavCount").textContent = favoriler.length;
  document.getElementById("profileMineCount").textContent = eklediklerim.length;
  document.getElementById("profileColCount").textContent = colIsimleri.length;

  document.getElementById("tabFavs").classList.toggle("active", aktifProfilSekmesi === "favs");
  document.getElementById("tabMine").classList.toggle("active", aktifProfilSekmesi === "mine");
  document.getElementById("tabCols").classList.toggle("active", aktifProfilSekmesi === "cols");

  const container = document.getElementById("profileListContent");

  if (aktifProfilSekmesi === "cols") {
    if (!colIsimleri.length) {
      container.innerHTML = `<p class="empty-msg">Henüz bir koleksiyonun yok. Kartın sol üstündeki ayraç ikonundan oluşturabilirsin.</p>`;
      return;
    }
    if (!seciliKoleksiyon || !koleksiyonlar[seciliKoleksiyon]) seciliKoleksiyon = colIsimleri[0];
    const chipsHtml = `<div class="col-chip-row">${colIsimleri.map(ad => `<button type="button" class="col-chip ${ad === seciliKoleksiyon ? "active" : ""}" data-col="${ad}">${ad} (${koleksiyonlar[ad].length})</button>`).join("")}</div>`;
    const colAlintilar = alintilar.filter(a => (koleksiyonlar[seciliKoleksiyon] || []).includes(a.id));
    const listHtml = colAlintilar.length
      ? colAlintilar.map(i => `<div class="list-item" data-id="${i.id}"><div class="list-item-text">“${i.metin}”</div><div class="list-item-meta"><span>— ${i.kaynak}</span><span>♥ ${i.begeni || 0}</span></div></div>`).join("")
      : `<p class="empty-msg">Bu koleksiyonda henüz satır yok.</p>`;
    container.innerHTML = chipsHtml + listHtml;
    container.querySelectorAll("[data-col]").forEach(b => b.addEventListener("click", () => { seciliKoleksiyon = b.dataset.col; profilModaliniDoldur(); }));
    container.querySelectorAll(".list-item").forEach(el => el.addEventListener("click", () => {
      const b = alintilar.find(a => a.id === el.dataset.id);
      if (b) kartiGoster(b, true);
      modalKapat("profileModalOverlay");
    }));
    return;
  }

  const liste = aktifProfilSekmesi === "favs" ? favoriler : eklediklerim;
  if (!liste.length) {
    container.innerHTML = `<p class="empty-msg">${aktifProfilSekmesi === "favs" ? "Henüz beğendiğin bir satır yok." : "Henüz bir satır eklemedin."}</p>`;
    return;
  }
  container.innerHTML = liste.map(i => `<div class="list-item" data-id="${i.id}"><div class="list-item-text">“${i.metin}”</div><div class="list-item-meta"><span>— ${i.kaynak} · ${i.kategori}</span><span>♥ ${i.begeni || 0}</span></div></div>`).join("");
  container.querySelectorAll(".list-item").forEach(el => el.addEventListener("click", () => {
    const b = alintilar.find(a => a.id === el.dataset.id);
    if (b) kartiGoster(b, true);
    modalKapat("profileModalOverlay");
  }));
}

document.getElementById("profileBtn").addEventListener("click", () => { profilModaliniDoldur(); modalAc("profileModalOverlay"); });
document.getElementById("tabFavs").addEventListener("click", () => { aktifProfilSekmesi = "favs"; profilModaliniDoldur(); });
document.getElementById("tabMine").addEventListener("click", () => { aktifProfilSekmesi = "mine"; profilModaliniDoldur(); });
document.getElementById("tabCols").addEventListener("click", () => { aktifProfilSekmesi = "cols"; profilModaliniDoldur(); });

document.getElementById("saveNicknameBtn").addEventListener("click", async () => {
  takmaAd = document.getElementById("nicknameInput").value.trim();
  localStorage.setItem("satirArasiNickname", takmaAd);
  if (mevcutKullanici) await setDoc(doc(db, "kullanicilar", mevcutKullanici.uid), { takmaAd }, { merge: true });
  profilButonuGuncelle();
  const btn = document.getElementById("saveNicknameBtn");
  btn.textContent = "Kaydedildi";
  setTimeout(() => btn.textContent = "Kaydet", 1200);
});

// --- Koleksiyona Kaydetme ---
async function koleksiyonlariKaydet() {
  localStorage.setItem("satirArasiKoleksiyonlar", JSON.stringify(koleksiyonlar));
  if (mevcutKullanici) await setDoc(doc(db, "kullanicilar", mevcutKullanici.uid), { koleksiyonlar }, { merge: true });
}

function koleksiyonModaliniCiz() {
  const listEl = document.getElementById("colSelectList");
  const isimler = Object.keys(koleksiyonlar);
  if (!isimler.length) {
    listEl.innerHTML = `<p class="empty-msg">İlk koleksiyonunu aşağıdan oluştur.</p>`;
    return;
  }
  listEl.innerHTML = isimler.map(ad => {
    const icinde = mevcutKart && (koleksiyonlar[ad] || []).includes(mevcutKart.id);
    return `
      <div class="list-item" data-toggle-col="${ad}" style="display:flex;justify-content:space-between;align-items:center;">
        <span>${ad} (${koleksiyonlar[ad].length})</span>
        <span style="font-size:0.8rem;color:var(--accent);">${icinde ? "✓ Eklendi" : "+ Ekle"}</span>
      </div>`;
  }).join("");

  listEl.querySelectorAll("[data-toggle-col]").forEach(el => {
    el.addEventListener("click", async () => {
      if (!mevcutKart) return;
      const ad = el.dataset.toggleCol;
      const arr = koleksiyonlar[ad] || [];
      if (arr.includes(mevcutKart.id)) koleksiyonlar[ad] = arr.filter(id => id !== mevcutKart.id);
      else koleksiyonlar[ad].push(mevcutKart.id);
      await koleksiyonlariKaydet();
      koleksiyonModaliniCiz();
    });
  });
}

document.getElementById("saveToColBtn").addEventListener("click", () => {
  if (!mevcutKart) return;
  koleksiyonModaliniCiz();
  modalAc("collectionModalOverlay");
});

document.getElementById("createColBtn").addEventListener("click", async () => {
  const input = document.getElementById("newColNameInput");
  const ad = input.value.trim();
  if (!ad) return;
  if (!koleksiyonlar[ad]) koleksiyonlar[ad] = [];
  if (mevcutKart && !koleksiyonlar[ad].includes(mevcutKart.id)) koleksiyonlar[ad].push(mevcutKart.id);
  input.value = "";
  await koleksiyonlariKaydet();
  koleksiyonModaliniCiz();
});

// --- Kart Gösterme, Geçmiş & Tepkiler ---
function gununKartiniHesapla() {
  if (!alintilar.length) return null;
  const sirali = [...alintilar].sort((a, b) => a.id.localeCompare(b.id));
  const bugun = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < bugun.length; i++) hash = (hash * 31 + bugun.charCodeAt(i)) % 100000;
  return sirali[hash % sirali.length];
}

function tepkileriCiz() {
  if (!mevcutKart) return;
  const id = mevcutKart.id;
  const begenildi = begenilenIdler.includes(id);
  likeBtn.classList.toggle("liked", begenildi);
  heartIcon.textContent = begenildi ? "♥" : "♡";
  likeCount.textContent = mevcutKart.begeni || 0;
  commentCount.textContent = mevcutKart.yorumSayisi || 0;
  adminFeaturedBtn.classList.toggle("active", !!mevcutKart.kurucuSecimi);

  const tepkiMap = mevcutKart.tepkiler || {};
  const benimTepkiler = kullaniciTepkileri[id] || [];
  dynamicReactions.innerHTML = "";
  Object.entries(tepkiMap)
    .filter(([, sayi]) => sayi > 0)
    .sort((a, b) => b[1] - a[1])
    .forEach(([emoji, sayi]) => {
      const btn = document.createElement("button");
      btn.className = "react-btn" + (benimTepkiler.includes(emoji) ? " active" : "");
      btn.textContent = `${emoji} ${sayi}`;
      btn.addEventListener("click", () => emojiTepkiIsle(emoji));
      dynamicReactions.appendChild(btn);
    });
}

async function emojiTepkiIsle(emoji) {
  if (!mevcutKart || !emoji.trim()) return;
  const temiz = emoji.trim();
  const id = mevcutKart.id;
  if (!kullaniciTepkileri[id]) kullaniciTepkileri[id] = [];
  if (!mevcutKart.tepkiler) mevcutKart.tepkiler = {};

  const varMi = kullaniciTepkileri[id].includes(temiz);
  const artis = varMi ? -1 : 1;
  if (varMi) kullaniciTepkileri[id] = kullaniciTepkileri[id].filter(e => e !== temiz);
  else kullaniciTepkileri[id].push(temiz);

  mevcutKart.tepkiler[temiz] = Math.max(0, (mevcutKart.tepkiler[temiz] || 0) + artis);
  localStorage.setItem("satirArasiTepkiler", JSON.stringify(kullaniciTepkileri));
  tepkileriCiz();

  try {
    await setDoc(doc(db, "alintilar", id), {
      metin: mevcutKart.metin, kaynak: mevcutKart.kaynak, kategori: mevcutKart.kategori,
      tepkiler: { [temiz]: increment(artis) }
    }, { merge: true });
  } catch (e) {}
}

const emojiPopover = document.getElementById("emojiPopover");
document.getElementById("addEmojiBtn").addEventListener("click", (e) => { e.stopPropagation(); emojiPopover.classList.toggle("open"); });
document.addEventListener("click", (e) => { if (!emojiPopover.contains(e.target) && e.target.id !== "addEmojiBtn") emojiPopover.classList.remove("open"); });
document.querySelectorAll(".emoji-opt").forEach(b => b.addEventListener("click", () => { emojiTepkiIsle(b.dataset.emoji); emojiPopover.classList.remove("open"); }));
document.getElementById("customEmojiSubmit").addEventListener("click", () => {
  const val = document.getElementById("customEmojiInput").value.trim();
  if (val) { emojiTepkiIsle(val); document.getElementById("customEmojiInput").value = ""; emojiPopover.classList.remove("open"); }
});

likeBtn.addEventListener("click", async () => {
  if (!mevcutKart) return;
  const id = mevcutKart.id;
  const varMi = begenilenIdler.includes(id);
  const artis = varMi ? -1 : 1;
  if (varMi) begenilenIdler = begenilenIdler.filter(x => x !== id);
  else begenilenIdler.push(id);
  mevcutKart.begeni = Math.max(0, (mevcutKart.begeni || 0) + artis);
  localStorage.setItem("satirArasiBegeniler", JSON.stringify(begenilenIdler));
  tepkileriCiz();
  try {
    await setDoc(doc(db, "alintilar", id), { metin: mevcutKart.metin, kaynak: mevcutKart.kaynak, kategori: mevcutKart.kategori, begeni: increment(artis) }, { merge: true });
    if (mevcutKullanici) await setDoc(doc(db, "kullanicilar", mevcutKullanici.uid), { begenilenler: begenilenIdler }, { merge: true });
  } catch (e) {}
});

function kartiGoster(secilen, sesCal = false, gecmiseEkle = true) {
  if (!secilen) return;
  if (gecmiseEkle && mevcutKart && mevcutKart.id !== secilen.id) {
    gecmisKartlar.push(mevcutKart);
    if (gecmisKartlar.length > 30) gecmisKartlar.shift();
    prevQuoteBtn.disabled = false;
  }
  if (sesCal) kagitSesiCal();
  mevcutKart = secilen;
  yanitlananYazar = null;
  document.getElementById("replyingBar").classList.remove("show");
  quoteWrapper.classList.add("fade-out");
  setTimeout(() => {
    quoteText.textContent = `“${secilen.metin}”`;
    quoteAuthor.textContent = `— ${secilen.kaynak}`;
    categoryEl.textContent = secilen.kategori;
    dailyBadge.classList.toggle("show", secilen.id === gununKartiId);
    featuredBadge.classList.toggle("show", !!secilen.kurucuSecimi);
    adminBar.classList.toggle("show", yoneticiMi);
    if (secilen.link) { listenLink.href = secilen.link; listenLink.classList.add("show"); }
    else listenLink.classList.remove("show");
    tepkileriCiz();
    quoteWrapper.classList.remove("fade-out");
    if (commentsDrawer.classList.contains("open")) yorumlariYukle();
  }, 170);
}

prevQuoteBtn.addEventListener("click", () => {
  if (!gecmisKartlar.length) return;
  const onceki = gecmisKartlar.pop();
  prevQuoteBtn.disabled = gecmisKartlar.length === 0;
  kartiGoster(onceki, true, false);
});

function yeniAlintiGetir(sesCal = true) {
  dedicationBanner.classList.remove("show");
  let havuz = alintilar;
  if (aktifKategori === "Kurucu") havuz = alintilar.filter(a => a.kurucuSecimi);
  else if (aktifKategori !== "Tümü") havuz = alintilar.filter(a => a.kategori === aktifKategori);

  if (!havuz.length) {
    quoteText.textContent = "Bu kategoride henüz bir satır yok. İlkini sen eklemek ister misin?";
    quoteAuthor.textContent = "";
    categoryEl.textContent = aktifKategori === "Kurucu" ? "✦ N.A." : aktifKategori;
    listenLink.classList.remove("show");
    dailyBadge.classList.remove("show");
    featuredBadge.classList.remove("show");
    return;
  }
  let secilen;
  if (havuz.length === 1) secilen = havuz[0];
  else { do { secilen = havuz[Math.floor(Math.random() * havuz.length)]; } while (mevcutKart && secilen.id === mevcutKart.id); }
  kartiGoster(secilen, sesCal, true);
}

// --- Veritabanı Yükleme ---
async function alintilariYukle() {
  const harita = new Map();
  varsayilanAlintilar.forEach(item => harita.set(item.id, { ...item }));
  try {
    const snapshot = await getDocs(alintilarRef);
    snapshot.forEach((d) => {
      const v = d.data();
      if (v.silindi) { harita.delete(d.id); return; }
      if (v.metin) {
        const kat = (v.kategori === "Söz" || v.kategori === "Not") ? "Senin Sözün" : (v.kategori || "Senin Sözün");
        harita.set(d.id, {
          id: d.id, metin: v.metin, kaynak: v.kaynak || "Anonim", kategori: kat,
          begeni: v.begeni || 0, tepkiler: v.tepkiler || {}, yorumSayisi: v.yorumSayisi || 0,
          kurucuSecimi: !!v.kurucuSecimi, ekleyenUid: v.ekleyenUid || null, link: v.link || ""
        });
      }
    });
  } catch (hata) { console.error(hata); }

  alintilar = Array.from(harita.values());
  footerCounter.textContent = `Satır Arası · Şu ana kadar ${alintilar.length} satır birikti`;
  const gunun = gununKartiniHesapla();
  if (gunun) gununKartiId = gunun.id;

  const params = new URLSearchParams(window.location.search);
  const hedefKart = params.get("id") ? alintilar.find(a => a.id === params.get("id")) : null;
  const not = params.get("not");
  const kimden = params.get("kimden");

  if (hedefKart) {
    kartiGoster(hedefKart, false, false);
    if (not || kimden) {
      document.getElementById("envelopeTitle").textContent = kimden ? `${kimden} sana bir satır bıraktı` : "Sana bir satır bırakıldı";
      document.getElementById("envelopeNotePreview").textContent = not ? `“${not}”` : "";
      modalAc("envelopeModalOverlay");
      document.getElementById("openEnvelopeBtn").onclick = () => {
        modalKapat("envelopeModalOverlay");
        kagitSesiCal();
        dedicationBanner.textContent = `${kimden ? kimden + ": " : ""}${not ? "“" + not + "”" : "Sana özel bir satır"}`;
        dedicationBanner.classList.add("show");
      };
    }
  } else if (gunun) kartiGoster(gunun, false, false);
  else yeniAlintiGetir(false);
}

// --- Haftanın Sorusu ---
async function haftaninSorusunuYukle() {
  const qEl = document.getElementById("weeklyQuestionText");
  const listEl = document.getElementById("weeklyAnswersList");
  listEl.innerHTML = `<p class="empty-msg">Yükleniyor...</p>`;
  try {
    const qSnap = await getDoc(doc(db, "ayarlar", "haftaninSorusu"));
    const soru = qSnap.exists() && qSnap.data().soru ? qSnap.data().soru : "Bu hafta aklından çıkmayan bir cümle veya şarkı sözü hangisi?";
    qEl.textContent = soru;
    document.getElementById("weeklyQuestionInput").value = soru;

    const aSnap = await getDocs(query(collection(db, "haftaninSorusuCevaplar"), orderBy("tarih", "desc")));
    if (aSnap.empty) { listEl.innerHTML = `<p class="empty-msg">Henüz cevap yok. İlk sen yaz.</p>`; return; }
    listEl.innerHTML = "";
    aSnap.forEach(d => {
      const c = d.data();
      const div = document.createElement("div");
      div.className = "comment-item";
      div.innerHTML = `
        <div class="comment-head">
          <strong>${c.yazar || "Anonim"}</strong>
          ${yoneticiMi ? `<button type="button" class="text-link-btn" style="color:var(--heart-color);" data-del-wa="${d.id}">Sil</button>` : ""}
        </div>
        <div class="comment-body">${c.metin}</div>`;
      listEl.appendChild(div);
    });
    listEl.querySelectorAll("[data-del-wa]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await deleteDoc(doc(db, "haftaninSorusuCevaplar", btn.dataset.delWa));
        haftaninSorusunuYukle();
      });
    });
  } catch (e) { listEl.innerHTML = `<p class="empty-msg">Yüklenemedi.</p>`; }
}

document.getElementById("weeklyBtn").addEventListener("click", () => { modalAc("weeklyModalOverlay"); haftaninSorusunuYukle(); });

document.getElementById("saveWeeklyQBtn").addEventListener("click", async () => {
  if (!yoneticiMi) return;
  const yeniSoru = document.getElementById("weeklyQuestionInput").value.trim();
  if (!yeniSoru) return;
  await setDoc(doc(db, "ayarlar", "haftaninSorusu"), { soru: yeniSoru, guncelleme: serverTimestamp() }, { merge: true });
  haftaninSorusunuYukle();
});

document.getElementById("weeklyAnswerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("weeklyAnswerInput");
  const metin = input.value.trim();
  if (!metin) return;
  await addDoc(collection(db, "haftaninSorusuCevaplar"), { metin, yazar: aktifIsimGetir(), tarih: serverTimestamp() });
  input.value = "";
  haftaninSorusunuYukle();
});

// --- Bildirme (Moderasyon) ---
async function icerikBildir(tur, hedefId, onizleme) {
  if (!confirm("Bu içeriği yöneticiye bildirmek istiyor musun?")) return;
  try {
    await addDoc(collection(db, "bildirimler"), {
      tur, hedefId, onizleme, bildiren: aktifIsimGetir(), tarih: serverTimestamp()
    });
    alert("Bildirimin yöneticiye iletildi, teşekkürler.");
  } catch (e) { alert("Bildirim gönderilemedi."); }
}

document.getElementById("reportCardBtn").addEventListener("click", () => {
  if (mevcutKart) icerikBildir("Satır", mevcutKart.id, mevcutKart.metin);
});

async function bildirimSayisiniYukle() {
  if (!yoneticiMi) return;
  try {
    const snap = await getDocs(collection(db, "bildirimler"));
    document.getElementById("reportsCount").textContent = snap.size;
    reportsBtn.classList.toggle("alert-dot", snap.size > 0);
  } catch (e) {}
}

reportsBtn.addEventListener("click", async () => {
  if (!yoneticiMi) return;
  modalAc("reportsModalOverlay");
  const listEl = document.getElementById("reportsList");
  listEl.innerHTML = `<p class="empty-msg">Yükleniyor...</p>`;
  const snap = await getDocs(query(collection(db, "bildirimler"), orderBy("tarih", "desc")));
  if (snap.empty) { listEl.innerHTML = `<p class="empty-msg">Bekleyen bildirim yok.</p>`; return; }
  listEl.innerHTML = "";
  snap.forEach(d => {
    const b = d.data();
    const div = document.createElement("div");
    div.className = "comment-item";
    div.innerHTML = `
      <div class="comment-head">
        <strong>${b.tur} · Bildiren: ${b.bildiren}</strong>
        <button type="button" class="text-link-btn" data-dismiss-rep="${d.id}">Kapat</button>
      </div>
      <div class="comment-body">“${b.onizleme}”</div>`;
    listEl.appendChild(div);
  });
  listEl.querySelectorAll("[data-dismiss-rep]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "bildirimler", btn.dataset.dismissRep));
      bildirimSayisiniYukle();
      reportsBtn.click();
    });
  });
});

// --- Kart Altı Yorumlar & Yanıtlama ---
async function yorumlariYukle() {
  if (!mevcutKart) return;
  const listEl = document.getElementById("commentsList");
  listEl.innerHTML = `<p class="empty-msg">Yükleniyor...</p>`;
  try {
    const q = query(collection(db, "alintilar", mevcutKart.id, "yorumlar"), orderBy("tarih", "asc"));
    const snap = await getDocs(q);
    if (snap.empty) { listEl.innerHTML = `<p class="empty-msg">Henüz yorum yok. İlk notu sen bırak.</p>`; return; }
    listEl.innerHTML = "";
    snap.forEach(d => {
      const y = d.data();
      const div = document.createElement("div");
      div.className = "comment-item";
      div.innerHTML = `
        ${y.yanitlanan ? `<div class="comment-reply-tag">↳ @${y.yanitlanan}'a yanıt</div>` : ""}
        <div class="comment-head">
          <strong>${y.yazar || "Anonim"}</strong>
          <div class="comment-actions">
            <button type="button" class="text-link-btn" data-reply-to="${y.yazar || "Anonim"}">Yanıtla</button>
            <button type="button" class="text-link-btn" data-rep-comment="${d.id}" data-rep-text="${y.metin}">Bildir</button>
            ${yoneticiMi ? `<button type="button" class="text-link-btn" style="color:var(--heart-color);" data-del-comment="${d.id}">Sil</button>` : ""}
          </div>
        </div>
        <div class="comment-body">${y.metin}</div>`;
      listEl.appendChild(div);
    });

    listEl.querySelectorAll("[data-reply-to]").forEach(btn => {
      btn.addEventListener("click", () => {
        yanitlananYazar = btn.dataset.replyTo;
        document.getElementById("replyingText").textContent = `@${yanitlananYazar}'a yanıt yazıyorsun`;
        document.getElementById("replyingBar").classList.add("show");
        document.getElementById("commentTextInput").focus();
      });
    });

    listEl.querySelectorAll("[data-rep-comment]").forEach(btn => {
      btn.addEventListener("click", () => icerikBildir("Yorum", btn.dataset.repComment, btn.dataset.repText));
    });

    listEl.querySelectorAll("[data-del-comment]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await deleteDoc(doc(db, "alintilar", mevcutKart.id, "yorumlar", btn.dataset.delComment));
        mevcutKart.yorumSayisi = Math.max(0, (mevcutKart.yorumSayisi || 1) - 1);
        await setDoc(doc(db, "alintilar", mevcutKart.id), { yorumSayisi: mevcutKart.yorumSayisi }, { merge: true });
        tepkileriCiz();
        yorumlariYukle();
      });
    });
  } catch (e) { listEl.innerHTML = `<p class="empty-msg">Henüz yorum yok.</p>`; }
}

document.getElementById("toggleCommentsBtn").addEventListener("click", () => {
  commentsDrawer.classList.toggle("open");
  if (commentsDrawer.classList.contains("open")) yorumlariYukle();
});
document.getElementById("closeCommentsBtn").addEventListener("click", () => commentsDrawer.classList.remove("open"));
document.getElementById("cancelReplyBtn").addEventListener("click", () => { yanitlananYazar = null; document.getElementById("replyingBar").classList.remove("show"); });

document.getElementById("commentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!mevcutKart) return;
  const metin = document.getElementById("commentTextInput").value.trim();
  if (!metin) return;
  const btn = document.getElementById("commentSubmitBtn");
  btn.disabled = true;
  try {
    await addDoc(collection(db, "alintilar", mevcutKart.id, "yorumlar"), {
      metin, yazar: aktifIsimGetir(), yanitlanan: yanitlananYazar || null, tarih: serverTimestamp()
    });
    mevcutKart.yorumSayisi = (mevcutKart.yorumSayisi || 0) + 1;
    yorumSayim += 1;
    localStorage.setItem("satirArasiYorumSayim", String(yorumSayim));
    await setDoc(doc(db, "alintilar", mevcutKart.id), {
      metin: mevcutKart.metin, kaynak: mevcutKart.kaynak, kategori: mevcutKart.kategori,
      yorumSayisi: increment(1)
    }, { merge: true });
    document.getElementById("commentTextInput").value = "";
    yanitlananYazar = null;
    document.getElementById("replyingBar").classList.remove("show");
    tepkileriCiz();
    yorumlariYukle();
  } catch (err) { alert("Yorum gönderilemedi."); }
  finally { btn.disabled = false; }
});

// --- Yönetici İşlemleri ---
adminFeaturedBtn.addEventListener("click", async () => {
  if (!yoneticiMi || !mevcutKart) return;
  mevcutKart.kurucuSecimi = !mevcutKart.kurucuSecimi;
  featuredBadge.classList.toggle("show", mevcutKart.kurucuSecimi);
  adminFeaturedBtn.classList.toggle("active", mevcutKart.kurucuSecimi);
  await setDoc(doc(db, "alintilar", mevcutKart.id), {
    metin: mevcutKart.metin, kaynak: mevcutKart.kaynak, kategori: mevcutKart.kategori, kurucuSecimi: mevcutKart.kurucuSecimi
  }, { merge: true });
});

document.getElementById("adminEditBtn").addEventListener("click", () => {
  if (!yoneticiMi || !mevcutKart) return;
  document.getElementById("formModalTitle").textContent = "Satırı Düzenle";
  document.getElementById("submitBtn").textContent = "Kaydet";
  document.getElementById("editId").value = mevcutKart.id;
  document.getElementById("inputText").value = mevcutKart.metin;
  document.getElementById("inputAuthor").value = mevcutKart.kaynak;
  document.getElementById("inputCategory").value = mevcutKart.kategori;
  document.getElementById("inputLink").value = mevcutKart.link || "";
  modalAc("addModalOverlay");
});

document.getElementById("adminDeleteBtn").addEventListener("click", async () => {
  if (!yoneticiMi || !mevcutKart || !confirm("Bu satırı kalıcı olarak silmek istediğine emin misin?")) return;
  const silinecekId = mevcutKart.id;
  try {
    if (silinecekId.startsWith("def-")) await setDoc(doc(db, "alintilar", silinecekId), { silindi: true }, { merge: true });
    else await deleteDoc(doc(db, "alintilar", silinecekId));
    alintilar = alintilar.filter(a => a.id !== silinecekId);
    footerCounter.textContent = `Satır Arası · Şu ana kadar ${alintilar.length} satır birikti`;
    yeniAlintiGetir(true);
  } catch (e) { alert("Silinemedi."); }
});

// --- Akıllı Paylaşım ---
document.getElementById("shareBtn").addEventListener("click", () => {
  if (!mevcutKart) return;
  const canvas = document.getElementById("storyCanvas");
  const ctx = canvas.getContext("2d");
  const cs = getComputedStyle(document.body);
  const fontMap = { lora: "Lora, Georgia, serif", typewriter: "'Courier Prime', monospace", modern: "Inter, sans-serif" };
  const qFont = fontMap[document.body.getAttribute("data-font")] || "Lora, serif";

  ctx.fillStyle = cs.getPropertyValue("--bg-color").trim();
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = cs.getPropertyValue("--card-bg").trim();
  ctx.strokeStyle = cs.getPropertyValue("--border-color").trim();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(90, 420, 900, 1040, 44);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = cs.getPropertyValue("--accent").trim();
  ctx.font = "600 28px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(mevcutKart.kategori.toUpperCase(), 540, 560);

  ctx.fillStyle = cs.getPropertyValue("--text-main").trim();
  ctx.font = `46px ${qFont}`;
  const kelimeler = `“${mevcutKart.metin}”`.split(" ");
  let satir = "";
  const satirlar = [];
  for (const k of kelimeler) {
    const test = satir + k + " ";
    if (ctx.measureText(test).width > 740 && satir !== "") { satirlar.push(satir.trim()); satir = k + " "; }
    else satir = test;
  }
  if (satir) satirlar.push(satir.trim());

  const lh = 72;
  const totalH = satirlar.length * lh;
  let startY = 920 - totalH / 2;
  satirlar.forEach((s, i) => ctx.fillText(s, 540, startY + i * lh));

  ctx.fillStyle = cs.getPropertyValue("--text-muted").trim();
  ctx.font = `italic 32px ${qFont}`;
  ctx.fillText(`— ${mevcutKart.kaynak}`, 540, startY + totalH + 60);
  ctx.font = "500 26px Inter, sans-serif";
  ctx.fillText("SATIR ARASI", 540, 1680);
  ctx.font = "400 22px Inter, sans-serif";
  ctx.fillText("hnisaak.github.io/satir-arasi", 540, 1720);

  canvas.toBlob(async (blob) => {
    const file = new File([blob], "satir-arasi.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Satır Arası", text: `“${mevcutKart.metin}” — ${mevcutKart.kaynak}` }); return; }
      catch (e) {}
    }
    const link = document.createElement("a");
    link.download = "satir-arasi.png";
    link.href = URL.createObjectURL(blob);
    link.click();
  }, "image/png");
});

// --- Arşiv, Popüler, İthaf, Ekleme ---
function arsiviGoster(filtre = "") {
  document.getElementById("archiveSearchInput").value = filtre;
  const aranan = filtre.trim().toLowerCase();
  const sonuclar = alintilar.filter(a => a.metin.toLowerCase().includes(aranan) || a.kaynak.toLowerCase().includes(aranan) || a.kategori.toLowerCase().includes(aranan));
  const listEl = document.getElementById("archiveList");
  listEl.innerHTML = sonuclar.length
    ? sonuclar.map(i => `<div class="list-item" data-id="${i.id}"><div class="list-item-text">“${i.metin}”</div><div class="list-item-meta"><span>— ${i.kaynak} · ${i.kategori}</span><span>♥ ${i.begeni || 0}</span></div></div>`).join("")
    : `<p class="empty-msg">Eşleşen bir satır bulunamadı.</p>`;
  listEl.querySelectorAll(".list-item").forEach(el => el.addEventListener("click", () => {
    const b = alintilar.find(a => a.id === el.dataset.id);
    if (b) kartiGoster(b, true);
    modalKapat("archiveModalOverlay");
  }));
}

document.getElementById("archiveBtn").addEventListener("click", () => { arsiviGoster(""); modalAc("archiveModalOverlay"); });
document.getElementById("archiveSearchInput").addEventListener("input", (e) => arsiviGoster(e.target.value));
quoteAuthor.addEventListener("click", () => { if (mevcutKart) { arsiviGoster(mevcutKart.kaynak.split(",")[0].split("—")[0].trim()); modalAc("archiveModalOverlay"); } });

document.getElementById("popularBtn").addEventListener("click", () => {
  const listEl = document.getElementById("popList");
  const sirali = [...alintilar].sort((a, b) => (b.begeni || 0) - (a.begeni || 0)).slice(0, 10);
  listEl.innerHTML = sirali.map((i, idx) => `<div class="list-item" data-id="${i.id}"><div class="list-item-text">${idx + 1}. “${i.metin}”</div><div class="list-item-meta"><span>— ${i.kaynak} · ${i.kategori}</span><span>♥ ${i.begeni || 0}</span></div></div>`).join("");
  listEl.querySelectorAll(".list-item").forEach(el => el.addEventListener("click", () => {
    const b = alintilar.find(a => a.id === el.dataset.id);
    if (b) kartiGoster(b, true);
    modalKapat("popModalOverlay");
  }));
  modalAc("popModalOverlay");
});

document.getElementById("giftBtn").addEventListener("click", () => {
  if (!document.getElementById("giftFromInput").value) document.getElementById("giftFromInput").value = takmaAd || mevcutKullanici?.displayName?.split(" ")[0] || "";
  modalAc("giftModalOverlay");
});

document.getElementById("copyGiftLinkBtn").addEventListener("click", () => {
  if (!mevcutKart) return;
  const params = new URLSearchParams({ id: mevcutKart.id });
  const kimden = document.getElementById("giftFromInput").value.trim();
  const not = document.getElementById("giftNoteInput").value.trim();
  if (kimden) params.set("kimden", kimden);
  if (not) params.set("not", not);
  navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?${params.toString()}`).then(() => {
    const btn = document.getElementById("copyGiftLinkBtn");
    btn.textContent = "Kopyalandı!";
    setTimeout(() => { btn.textContent = "Zarf Linkini Kopyala"; modalKapat("giftModalOverlay"); }, 1100);
  });
});

document.getElementById("openModalBtn").addEventListener("click", () => {
  document.getElementById("formModalTitle").textContent = "Yeni Satır Ekle";
  document.getElementById("submitBtn").textContent = "Ekle";
  document.getElementById("editId").value = "";
  document.getElementById("quoteForm").reset();
  modalAc("addModalOverlay");
});

document.getElementById("quoteForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const editId = document.getElementById("editId").value;
  const metin = document.getElementById("inputText").value.trim();
  const kategori = document.getElementById("inputCategory").value;
  const kaynakInput = document.getElementById("inputAuthor").value.trim();
  const kaynak = kaynakInput || (kategori === "Senin Sözün" ? aktifIsimGetir() : "Anonim");
  const link = document.getElementById("inputLink").value.trim();
  if (!metin) return;

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  try {
    if (editId && yoneticiMi) {
      await setDoc(doc(db, "alintilar", editId), { metin, kaynak, kategori, link }, { merge: true });
      const hedef = alintilar.find(a => a.id === editId);
      if (hedef) { hedef.metin = metin; hedef.kaynak = kaynak; hedef.kategori = kategori; hedef.link = link; kartiGoster(hedef, false, false); }
    } else {
      const docRef = await addDoc(alintilarRef, {
        metin, kaynak, kategori, link, begeni: 0, tepkiler: {}, yorumSayisi: 0, kurucuSecimi: false,
        ekleyenUid: mevcutKullanici ? mevcutKullanici.uid : null, tarih: serverTimestamp()
      });
      const yeni = { id: docRef.id, metin, kaynak, kategori, link, begeni: 0, tepkiler: {}, yorumSayisi: 0, kurucuSecimi: false, ekleyenUid: mevcutKullanici ? mevcutKullanici.uid : null };
      alintilar.push(yeni);
      eklediklerimIdler.push(docRef.id);
      localStorage.setItem("satirArasiEklediklerim", JSON.stringify(eklediklerimIdler));
      footerCounter.textContent = `Satır Arası · Şu ana kadar ${alintilar.length} satır birikti`;
      kartiGoster(yeni, true);
    }
    document.getElementById("quoteForm").reset();
    modalKapat("addModalOverlay");
  } catch (hata) { alert("Bir hata oluştu."); }
  finally { submitBtn.disabled = false; }
});

// Genel Modallar ve Butonlar
function modalAc(id) { document.getElementById(id).classList.add("open"); }
function modalKapat(id) { document.getElementById(id).classList.remove("open"); }
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => modalKapat(b.dataset.close)));
document.querySelectorAll(".modal-overlay").forEach(ov => ov.addEventListener("click", (e) => { if (e.target === ov && ov.id !== "envelopeModalOverlay") ov.classList.remove("open"); }));

document.getElementById("appearanceBtn").addEventListener("click", () => modalAc("appearanceModalOverlay"));
document.getElementById("brandHome").addEventListener("click", () => { window.history.replaceState({}, "", window.location.pathname); dedicationBanner.classList.remove("show"); yeniAlintiGetir(true); });
document.getElementById("newQuoteBtn").addEventListener("click", () => yeniAlintiGetir(true));
document.getElementById("copyBtn").addEventListener("click", () => {
  if (!mevcutKart) return;
  navigator.clipboard.writeText(`“${mevcutKart.metin}” — ${mevcutKart.kaynak}`).then(() => {
    const b = document.getElementById("copyBtn"); b.textContent = "Kopyalandı!"; setTimeout(() => b.textContent = "Kopyala", 1300);
  });
});

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    aktifKategori = btn.dataset.cat;
    yeniAlintiGetir(true);
  });
});

profilButonuGuncelle();
alintilariYukle();
