/* =====================================================================
   RENDERER - MCQ MULTI (chọn ĐÚNG N đáp án bằng checkbox)
   =====================================================================
   Dùng cho dạng "Choose TWO letters, A-E" trong đề IELTS thật (khác MCQ
   thường - MCQ thường chỉ chọn 1 đáp án bằng radio).

   Schema block kỳ vọng:
   {
     type: "mcq-multi",
     title: "Questions 20 and 21",
     instructions: "Choose TWO letters, A-E.",
     items: [
       { id: "q20_21", question: "Which TWO of the following...",
         options: [{letter:"A",text:"..."}, ...], answers: ["B","D"] }
     ]
   }
   Chấm đúng/sai theo TẬP HỢP đáp án (không quan tâm thứ tự chọn).
   ===================================================================== */

window.MCQMultiRenderer = (function () {

  function render(container, block) {
    const wrap = document.createElement("div");
    wrap.className = "exercise-block";
    wrap.innerHTML = `
      <div class="exercise-title">${block.title}</div>
      <div class="exercise-instruction">${block.instructions || ""}</div>
      <div class="mcqmulti-list"></div>
    `;
    container.appendChild(wrap);

    const list = wrap.querySelector(".mcqmulti-list");
    list.innerHTML = block.items.map(it => `
      <div class="mcq-card">
        <div class="mcq-title">${it.question}</div>
        <div class="mcq-options">
          ${it.options.map(o => `
            <label class="option-label">
              <input type="checkbox" name="mcqm_${it.id}" value="${o.letter}" onchange="PETEngine.onAnswerChange('${it.id}')">
              <span><strong>${o.letter}.</strong> ${o.text}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  function buildPartialConfig(block) {
    const correctMap = {};
    block.items.forEach(it => { correctMap[it.id] = [...it.answers].sort().join(","); });

    return {
      questionIds: block.items.map(it => it.id),
      getSelectedAnswer(qId) {
        const checked = Array.from(document.querySelectorAll(`input[name="mcqm_${qId}"]:checked`)).map(el => el.value);
        return checked.sort().join(",");
      },
      setAnswerValue(qId, value) {
        // value: chuỗi các letter phân tách bởi dấu phẩy, vd "B,D"
        const letters = (value || "").split(",").filter(Boolean);
        document.querySelectorAll(`input[name="mcqm_${qId}"]`).forEach(el => {
          el.checked = letters.includes(el.value);
        });
      },
      getCorrectAnswer(qId) { return correctMap[qId]; },
      getAlternateAnswer(qId) {
        const item = block.items.find(i => i.id === qId);
        const wrong = item.options.filter(o => !item.answers.includes(o.letter)).slice(0, 2).map(o => o.letter);
        return wrong.join(",") || correctMap[qId];
      },
      isCorrectMatch(qId, userVal) { return userVal === correctMap[qId]; },
      clearAllAnswers() {
        block.items.forEach(it => {
          document.querySelectorAll(`input[name="mcqm_${it.id}"]`).forEach(el => { el.checked = false; });
        });
      },
    };
  }

  return { render, buildPartialConfig };
})();
