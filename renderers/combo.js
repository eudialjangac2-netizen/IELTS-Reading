/* =====================================================================
   RENDERER - COMBO (bài đọc + NHIỀU dạng câu hỏi trộn lẫn trong 1 tầng)
   =====================================================================
   Dùng khi 1 tầng (simplified hoặc original) có nhiều dạng câu hỏi khác
   nhau trong cùng 1 đề thật, ví dụ: Matching Information + Choose TWO
   letters + Summary Completion - đúng cấu trúc 1 đề IELTS Reading thật.

   Khác TFNGRenderer (chỉ 1 dạng câu hỏi cố định), ComboRenderer dùng lại
   ExerciseCombinator để gộp NHIỀU block (matching/fillblank/mcq/mcq-multi)
   vào 1 lần chấm chung.

   Schema passage kỳ vọng (khác TFNG ở chỗ paragraphs có thể có "label"
   để hiện nhãn đoạn A/B/C... - cần thiết cho dạng Matching Information):
   {
     title, author, image,
     paragraphs: [ { label: "A", text: "..." }, { label: "B", text: "..." }, ... ]
                  // hoặc mảng string thường (không có label) vẫn chạy được
   }

   Schema questionsBlock kỳ vọng:
   { type: "combo", blocks: [ {type:"matching",...}, {type:"mcq-multi",...}, ... ] }
   ===================================================================== */

window.ComboRenderer = (function () {

  function render(rootTarget, passage, comboBlock, rangeLabel) {
    rootTarget.innerHTML = `
      <div class="split-container">
        <div class="left-pane" id="leftPane">
          <h2 class="article-title">${passage.title}</h2>
          ${passage.author ? `<div class="article-author">${passage.author}</div>` : ""}
          <div class="article-content" id="articleContent"></div>
        </div>
        <div class="right-pane" id="rightPane">
          <h2 style="color:var(--primary); font-size:18px; margin-bottom:8px;">QUESTIONS ${rangeLabel ? "(" + rangeLabel + ")" : ""}</h2>
          <div id="comboQuestionsContainer"></div>
        </div>
      </div>
    `;
    document.getElementById("mainApp").classList.add("split-mode");

    let articleHTML = "";
    if (passage.image) {
      articleHTML += `<div class="article-image-box"><img src="${passage.image}" alt="Passage"></div>`;
    }
    articleHTML += passage.paragraphs.map(p => {
      if (typeof p === "string") return `<p style="margin-bottom:14px;">${p}</p>`;
      return `<p style="margin-bottom:14px;"><span class="para-label-badge">${p.label}</span>${p.text}</p>`;
    }).join("");
    document.getElementById("articleContent").innerHTML = articleHTML;

    const container = document.getElementById("comboQuestionsContainer");
    return ExerciseCombinator.renderAll(container, comboBlock.blocks);
  }

  return { render };
})();
