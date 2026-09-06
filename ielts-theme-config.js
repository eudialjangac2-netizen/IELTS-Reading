/* =====================================================================
   IELTS READING - THEME 4 NÀNG TIÊN 4 MÙA
   =====================================================================
   Mỗi bài (passage) được gán 1 "season" trong JSON (spring/summer/autumn/winter).
   Theme quyết định: màu chủ đạo của trang + ảnh nàng tiên hiện ở màn login.

   Ảnh thật nằm trong assets/ (spring.jpg, summer.jpg, autumn.jpg, winter.jpg).
   Muốn đổi ảnh: chỉ cần thay file trong assets/ (giữ nguyên tên file) —
   không cần sửa gì trong code.
   ===================================================================== */

window.IELTS_SEASON_THEMES = {
  spring: {
    // spring.jpg: nàng áo cam chơi đàn tỳ bà, hoa mẫu đơn hồng
    primary: "#c17a1e", primaryLight: "#f0cb8f", accent: "#dba24a",
    bgMain: "#fdf7ec", borderColor: "#f0e0bd",
    fairyName: "Nàng Tiên Mùa Xuân",
    avatarImg: "assets/spring.jpg",
  },
  summer: {
    // summer.jpg: nàng áo đỏ đội nón lá, cầm hoa sen
    primary: "#a13347", primaryLight: "#e8a7b4", accent: "#c25a71",
    bgMain: "#fdf1f2", borderColor: "#f2d4da",
    fairyName: "Nàng Tiên Mùa Hạ",
    avatarImg: "assets/summer.jpg",
  },
  autumn: {
    // fall.jpg: nàng áo xanh ngọc cầm quạt, hoa cúc vàng
    primary: "#2f9e97", primaryLight: "#a6ded9", accent: "#5cc2ba",
    bgMain: "#f0fbfa", borderColor: "#c3ece8",
    fairyName: "Nàng Tiên Mùa Thu",
    avatarImg: "assets/autumn.jpg",
  },
  winter: {
    // winter.jpg: nàng áo tím ôm mèo, hoa nhiệt đới
    primary: "#6b3ba7", primaryLight: "#d3bce8", accent: "#9268c4",
    bgMain: "#f6f2fb", borderColor: "#e3d5f0",
    fairyName: "Nàng Tiên Mùa Đông",
    avatarImg: "assets/winter.jpg",
  },
};

// Màu nền chung của bộ tranh (đo trực tiếp từ ảnh gốc) - dùng cho .login-fairy-pane
// để nền trang và nền tranh hòa vào nhau, không bị lộ viền khung chữ nhật.
window.IELTS_ILLUSTRATION_BG = "#e8e2d4";

function getSeasonTheme(season) {
  return window.IELTS_SEASON_THEMES[season] || window.IELTS_SEASON_THEMES.spring;
}
window.getSeasonTheme = getSeasonTheme;
