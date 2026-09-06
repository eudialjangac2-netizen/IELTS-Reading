/* =====================================================================
   IELTS READING - THEME 4 NÀNG TIÊN 4 MÙA
   =====================================================================
   Mỗi bài (passage) được gán 1 "season" trong JSON (spring/summer/autumn/winter).
   Theme quyết định: màu chủ đạo của trang, ảnh nàng tiên hiện ở màn login.

   ⚠️ avatarImg hiện đang là PLACEHOLDER (hình khối đơn giản dựng bằng SVG),
   CHỈ để xem trước layout. Khi bạn gửi ảnh nàng tiên thật (PNG nền trong suốt),
   chỉ cần thay giá trị avatarImg bằng base64 của ảnh thật — không cần đổi
   bất kỳ chỗ nào khác trong toàn bộ hệ thống.
   ===================================================================== */

function placeholderFairySVG(bgFrom, bgTo, emoji, label) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="500" height="700" viewBox="0 0 500 700">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${bgFrom}"/>
          <stop offset="1" stop-color="${bgTo}"/>
        </linearGradient>
      </defs>
      <ellipse cx="250" cy="620" rx="150" ry="30" fill="black" opacity="0.08"/>
      <path d="M250 60 C 130 120, 110 350, 160 560 C 200 640, 300 640, 340 560 C 390 350, 370 120, 250 60 Z" fill="url(#g)"/>
      <circle cx="250" cy="230" r="70" fill="#fff" opacity="0.85"/>
      <text x="250" y="255" font-size="70" text-anchor="middle">${emoji}</text>
      <text x="250" y="600" font-size="26" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="700">${label}</text>
    </svg>
  `;
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

window.IELTS_SEASON_THEMES = {
  spring: {
    primary: "#4caf7d", primaryLight: "#b7efc5", accent: "#8fd9a8",
    bgMain: "#f2fbf3", borderColor: "#cdeed8",
    fairyName: "Nàng Tiên Mùa Xuân",
    avatarImg: placeholderFairySVG("#a7e8bd", "#4caf7d", "🌸", "Mùa Xuân"),
  },
  summer: {
    primary: "#e0a318", primaryLight: "#fbe380", accent: "#f6c94c",
    bgMain: "#fffaf0", borderColor: "#f3e0a1",
    fairyName: "Nàng Tiên Mùa Hạ",
    avatarImg: placeholderFairySVG("#ffe08a", "#e0a318", "☀️", "Mùa Hạ"),
  },
  autumn: {
    primary: "#c1682c", primaryLight: "#f3bd8c", accent: "#e08a45",
    bgMain: "#fff5ec", borderColor: "#f0d3b8",
    fairyName: "Nàng Tiên Mùa Thu",
    avatarImg: placeholderFairySVG("#f3c48c", "#c1682c", "🍂", "Mùa Thu"),
  },
  winter: {
    primary: "#4a90d9", primaryLight: "#bcdcf7", accent: "#7ab6ea",
    bgMain: "#f0f8ff", borderColor: "#cfe6f7",
    fairyName: "Nàng Tiên Mùa Đông",
    avatarImg: placeholderFairySVG("#cfe9fb", "#4a90d9", "❄️", "Mùa Đông"),
  },
};

function getSeasonTheme(season) {
  return window.IELTS_SEASON_THEMES[season] || window.IELTS_SEASON_THEMES.spring;
}
window.getSeasonTheme = getSeasonTheme;
