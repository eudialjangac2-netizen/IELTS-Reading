/* =====================================================================
   RENDERER - MATCHING (dropdown-select, tái dùng cho nhiều loại bài tập)
   =====================================================================
   Dùng cho: Vocab Exercise 1 (Match the meaning), Vocab Exercise 3
   (Spot the IELTS paraphrase). Cơ chế giống renderers/part2.js của hệ PET
   (mỗi câu bên trái có 1 dropdown chọn đáp án bên phải), nhưng viết thành
   hàm tái sử dụng thay vì gắn cứng vào 1 JSON.

   Schema block kỳ vọng:
   {
     type: "matching",
     title: "Exercise 1: Match the meaning",
     instructions: "Match the words with their meanings.",
     items: [ { id: "m1", left: "misfits", answer: "E" }, ... ],
     options: [ { letter: "A", text: "..." }, ... ]
   }
   ===================================================================== */

window.MatchingRenderer = (function () {

  // Render vào 1 container có sẵn (KHÔNG tự tạo split-container - dùng trong
  // trang gộp nhiều bài tập, nên chỉ render nội dung của riêng exercise này).
  function render(container, block) {
    const wrap = document.createElement("div");
    wrap.className = "exercise-block";
    wrap.innerHTML = `
      <div class="exercise-title">${block.title}</div>
      <div class="exercise-instruction">${block.instructions || ""}</div>
      <div class="matching-list"></div>
    `;
    container.appendChild(wrap);

    const list = wrap.querySelector(".matching-list");
    list.innerHTML = block.items.map(it => `
      <div class="matching-row">
        <span class="matching-left">${it.left}</span>
        <select class="matching-select" data-q="${it.id}" onchange="PETEngine.onAnswerChange('${it.id}')">
          <option value="">-- Chọn --</option>
          ${block.options.map(o => `<option value="${o.letter}">${o.letter}. ${o.text}</option>`).join("")}
        </select>
      </div>
    `).join("");
  }

  // Trả về { questionIds, getSelectedAnswer, setAnswerValue, getCorrectAnswer,
  // getAlternateAnswer, clearAllAnswers } CHỈ CHO RIÊNG exercise này.
  // Dùng để nhét vào bộ combinator gộp nhiều exercise lại (xem exercise-combinator.js).
  function buildPartialConfig(block) {
    const correctMap = {};
    block.items.forEach(it => { correctMap[it.id] = it.answer; });

    return {
      questionIds: block.items.map(it => it.id),
      getSelectedAnswer(qId) {
        const el = document.querySelector(`.matching-select[data-q="${qId}"]`);
        return el ? el.value : "";
      },
      setAnswerValue(qId, value) {
        const el = document.querySelector(`.matching-select[data-q="${qId}"]`);
        if (el) el.value = value;
      },
      getCorrectAnswer(qId) { return correctMap[qId]; },
      getAlternateAnswer(qId) {
        const correct = correctMap[qId];
        const alt = block.options.find(o => o.letter !== correct);
        return alt ? alt.letter : correct;
      },
      clearAllAnswers() {
        block.items.forEach(it => {
          const el = document.querySelector(`.matching-select[data-q="${it.id}"]`);
          if (el) el.value = "";
        });
      },
    };
  }

  return { render, buildPartialConfig };
})();
