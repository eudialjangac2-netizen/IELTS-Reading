/* =====================================================================
   RENDERER - MCQ (trắc nghiệm nhiều lựa chọn, 1 đáp án đúng)
   =====================================================================
   Dùng cho: bài tập Grammar dạng "chọn ý đúng" (thay cho dạng viết mở
   trong bản Word, để chấm tự động được trên web).

   Schema block kỳ vọng:
   {
     type: "mcq",
     title: "Exercise: Find the MAIN message",
     instructions: "...",
     items: [
       { id: "g1", question: "...", options: [{letter:"A",text:"..."}, ...], answer: "B" }
     ]
   }
   ===================================================================== */

window.MCQRenderer = (function () {

  function render(container, block) {
    const wrap = document.createElement("div");
    wrap.className = "exercise-block";
    wrap.innerHTML = `
      <div class="exercise-title">${block.title}</div>
      <div class="exercise-instruction">${block.instructions || ""}</div>
      <div class="mcq-list"></div>
    `;
    container.appendChild(wrap);

    const list = wrap.querySelector(".mcq-list");
    list.innerHTML = block.items.map(it => `
      <div class="mcq-card">
        <div class="mcq-title">${it.question}</div>
        <div class="mcq-options">
          ${it.options.map(o => `
            <label class="option-label">
              <input type="radio" name="mcq_${it.id}" value="${o.letter}" onchange="PETEngine.onAnswerChange('${it.id}')">
              <span><strong>${o.letter}.</strong> ${o.text}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  function buildPartialConfig(block) {
    const correctMap = {};
    block.items.forEach(it => { correctMap[it.id] = it.answer; });

    return {
      questionIds: block.items.map(it => it.id),
      getSelectedAnswer(qId) {
        const el = document.querySelector(`input[name="mcq_${qId}"]:checked`);
        return el ? el.value : "";
      },
      setAnswerValue(qId, value) {
        const el = document.querySelector(`input[name="mcq_${qId}"][value="${value}"]`);
        if (el) el.checked = true;
      },
      getCorrectAnswer(qId) { return correctMap[qId]; },
      getAlternateAnswer(qId) {
        const item = block.items.find(i => i.id === qId);
        const correct = correctMap[qId];
        const alt = item.options.find(o => o.letter !== correct);
        return alt ? alt.letter : correct;
      },
      clearAllAnswers() {
        block.items.forEach(it => {
          document.querySelectorAll(`input[name="mcq_${it.id}"]`).forEach(r => { r.checked = false; });
        });
      },
    };
  }

  return { render, buildPartialConfig };
})();
