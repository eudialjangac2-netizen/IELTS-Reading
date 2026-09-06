/* =====================================================================
   RENDERER - TRUE / FALSE / NOT GIVEN (dùng chung cho tầng simplified & original)
   =====================================================================
   Khác với renderers/partN.js của hệ PET (mỗi file tự gọi registerRenderer
   và tự quản lý toàn bộ DOM #partRenderTarget dựa theo 1 JSON cố định),
   TFNGRenderer ở đây được viết thành 1 module dùng lại NHIỀU LẦN trong
   1 phiên làm bài (Stage Manager gọi 1 lần cho tầng simplified, 1 lần
   nữa cho tầng original với dữ liệu khác nhau).

   Schema questionsBlock kỳ vọng:
   {
     type: "tfng",
     instructions: "Đọc đoạn văn và cho biết mỗi câu là TRUE / FALSE / NOT GIVEN",
     items: [
       { id: 1, statement: "...", answer: "TRUE", hint: "..." },
       ...
     ]
   }
   ===================================================================== */

window.TFNGRenderer = (function () {

  const ANSWER_LABELS = {
    TRUE: "TRUE",
    FALSE: "FALSE",
    "NOT GIVEN": "NOT GIVEN",
  };

  // Render passage (trái) + câu hỏi TFNG (phải) vào 1 khối split-container
  // rootTarget: DOM element rỗng sẽ được đổ nội dung vào (thường là #partRenderTarget)
  function render(rootTarget, passage, questionsBlock, rangeLabel) {
    rootTarget.innerHTML = `
      <div class="split-container">
        <div class="left-pane" id="leftPane">
          <h2 class="article-title">${passage.title}</h2>
          ${passage.author ? `<div class="article-author">${passage.author}</div>` : ""}
          <div class="article-content" id="articleContent"></div>
        </div>
        <div class="right-pane" id="rightPane">
          <h2 style="color:var(--primary); font-size:18px; margin-bottom:8px;">QUESTIONS ${rangeLabel ? "(" + rangeLabel + ")" : ""}</h2>
          <p style="font-size:13.5px; color:var(--text-muted); margin-bottom:16px;">${questionsBlock.instructions || ""}</p>
          <div id="tfngQuestionsContainer"></div>
        </div>
      </div>
    `;
    document.getElementById("mainApp").classList.add("split-mode");

    let articleHTML = "";
    if (passage.image) {
      articleHTML += `<div class="article-image-box"><img src="${passage.image}" alt="Passage"></div>`;
    }
    articleHTML += passage.paragraphs.map(p => `<p style="margin-bottom:14px;">${p}</p>`).join("");
    document.getElementById("articleContent").innerHTML = articleHTML;

    document.getElementById("tfngQuestionsContainer").innerHTML = questionsBlock.items.map(q => `
      <div class="mcq-card">
        <div class="mcq-title">${q.id}. ${q.statement}</div>
        <div class="mcq-options tfng-options">
          ${Object.keys(ANSWER_LABELS).map(key => `
            <label class="option-label tfng-option-label">
              <input type="radio" name="tfng_q_${q.id}" value="${key}"
                     onchange="PETEngine.onAnswerChange(${q.id})">
              <span>${ANSWER_LABELS[key]}</span>
            </label>
          `).join("")}
        </div>
        <div class="hint-box" id="hint-${q.id}">${q.hint || ""}</div>
      </div>
    `).join("");
  }

  // Render bảng giải thích đáp án (dùng cho explanationContainer trong resultModal)
  function renderExplanation(container, explanationItems) {
    container.innerHTML = `
      <table class="explanation-table">
        <thead><tr><th>Câu</th><th>Đáp án</th><th>Giải thích chi tiết</th></tr></thead>
        <tbody>
          ${explanationItems.map(e => `
            <tr>
              <td><strong>Câu ${e.q}</strong></td>
              <td><strong style="color:var(--primary);">${e.ans}</strong></td>
              <td>${e.key}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  // Xây object cfg dùng để truyền vào PETEngine.init() / PETEngine.startNewStage()
  // questionsBlock.items[].answer phải là 1 trong "TRUE" | "FALSE" | "NOT GIVEN"
  function buildEngineConfig(questionsBlock) {
    const items = questionsBlock.items;
    const correctMap = {};
    items.forEach(q => { correctMap[q.id] = q.answer; });

    return {
      questionIds: items.map(q => q.id),
      checkDuplicates: false,
      spamThresholdSeconds: 2,
      highlightScope: "left",

      getSelectedAnswer(qId) {
        const el = document.querySelector(`input[name="tfng_q_${qId}"]:checked`);
        return el ? el.value : "";
      },
      setAnswerValue(qId, value) {
        const el = document.querySelector(`input[name="tfng_q_${qId}"][value="${value}"]`);
        if (el) el.checked = true;
      },
      getCorrectAnswer(qId) {
        return correctMap[qId];
      },
      getAlternateAnswer(qId) {
        const keys = Object.keys(ANSWER_LABELS);
        const wrong = keys.find(k => k !== correctMap[qId]);
        return wrong || correctMap[qId];
      },
      clearAllAnswers() {
        document.querySelectorAll('#tfngQuestionsContainer input[type="radio"]').forEach(r => { r.checked = false; });
      },
    };
  }

  return { render, renderExplanation, buildEngineConfig };
})();
