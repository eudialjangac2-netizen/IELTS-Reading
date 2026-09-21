/* =====================================================================
   RENDERER - FILL BLANK (ô nhập text, có thể kèm word bank)
   =====================================================================
   Dùng cho: Vocab Exercise 2 (Vocabulary in context), các ô điền 1-từ
   trong Grammar ("Step 3: Discover the pattern").

   Schema block kỳ vọng:
   {
     type: "fillblank",
     title: "Exercise 2: Vocabulary in context",
     instructions: "Complete the sentences with words from the box.",
     wordBank: ["navigable", "coves", ...],   // optional, chỉ hiển thị gợi ý
     items: [
       { id: "f1", sentenceHTML: "Ships had to follow certain {{blank}} routes...",
         answers: ["navigable"] }             // mảng biến thể chấp nhận được
     ]
   }
   Token {{blank}} trong sentenceHTML sẽ được thay bằng 1 ô input.
   ===================================================================== */

window.FillBlankRenderer = (function () {

  function render(container, block) {
    const wrap = document.createElement("div");
    wrap.className = "exercise-block";
    wrap.innerHTML = `
      <div class="exercise-title">${block.title}</div>
      <div class="exercise-instruction">${block.instructions || ""}</div>
      ${block.wordBank ? `<div class="word-bank">${block.wordBank.join(" • ")}</div>` : ""}
      <div class="fillblank-list"></div>
    `;
    container.appendChild(wrap);

    const list = wrap.querySelector(".fillblank-list");
    list.innerHTML = block.items.map(it => {
      const html = it.sentenceHTML.replace(
        "{{blank}}",
        `<input type="text" class="fillblank-input" id="fb_${it.id}" data-q="${it.id}"
                oninput="PETEngine.onAnswerChange('${it.id}')" autocomplete="off" spellcheck="false">`
      );
      return `<div class="fillblank-row">${html}</div>`;
    }).join("");
  }

  function buildPartialConfig(block) {
    const correctMap = {};
    block.items.forEach(it => { correctMap[it.id] = it.answers; });

    return {
      questionIds: block.items.map(it => it.id),
      getSelectedAnswer(qId) {
        const el = document.getElementById(`fb_${qId}`);
        return el ? el.value.trim() : "";
      },
      setAnswerValue(qId, value) {
        const el = document.getElementById(`fb_${qId}`);
        if (el) el.value = value;
      },
      getCorrectAnswer(qId) { return correctMap[qId][0]; },
      getAlternateAnswer(qId) { return "sai_" + qId; },
      isCorrectMatch(qId, userVal) {
        const allowed = correctMap[qId].map(a => a.toLowerCase());
        return allowed.includes((userVal || "").toLowerCase());
      },
      clearAllAnswers() {
        block.items.forEach(it => {
          const el = document.getElementById(`fb_${it.id}`);
          if (el) el.value = "";
        });
      },
    };
  }

  return { render, buildPartialConfig };
})();
