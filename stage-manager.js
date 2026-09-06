/* =====================================================================
   IELTS READING - STAGE MANAGER
   =====================================================================
   Đọc ?id= và ?mode= trên URL:
     ?mode=scaffold (mặc định)  -> vocab (nếu có) -> simplified -> original
     ?mode=direct                -> vocab (nếu có) -> original (bỏ qua simplified)

   Đây là "dispatcher" thay thế cho registerRenderer của hệ PET, vì ở đây
   1 bài có NHIỀU tầng thay vì 1 partType cố định.
   ===================================================================== */

(function () {
  let examData = null;
  let stageList = [];      // ví dụ: ["vocab", "simplified", "original"]
  let currentStageIndex = -1;

  async function bootExercise() {
    const params = new URLSearchParams(window.location.search);
    const exerciseId = params.get("id");
    const mode = params.get("mode") === "direct" ? "direct" : "scaffold";

    if (!exerciseId) {
      document.body.innerHTML = "<p style='padding:40px;font-family:sans-serif;'>⚠️ Thiếu tham số <code>?id=</code> trên URL.</p>";
      return;
    }

    try {
      const res = await fetch(`exercises/${exerciseId}.json`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      examData = await res.json();
    } catch (err) {
      document.body.innerHTML = `<p style='padding:40px;font-family:sans-serif;'>⚠️ Không tải được bài <code>${exerciseId}</code>: ${err.message}</p>`;
      return;
    }

    // Xây danh sách tầng dựa theo mode + dữ liệu có sẵn trong JSON
    stageList = [];
    if (examData.vocabulary && examData.vocabulary.length > 0) stageList.push("vocab");
    if (mode === "scaffold" && examData.simplifiedPassage) stageList.push("simplified");
    if (examData.originalPassage) stageList.push("original");

    document.getElementById("appTitle").textContent = "📖 " + examData.exerciseName;
    const loginSubtitle = document.getElementById("loginSubtitle");
    if (loginSubtitle) {
      loginSubtitle.textContent = mode === "scaffold"
        ? "IELTS Reading (có lộ trình từ vựng → bài rút gọn → bài gốc)"
        : "IELTS Reading (bài gốc)";
    }

    // Áp theme Nàng Tiên 4 Mùa NGAY khi tải xong dữ liệu, TRƯỚC khi học sinh login,
    // để màn hình đăng nhập đã hiện đúng nàng tiên + màu sắc của bài này.
    const seasonTheme = getSeasonTheme(examData.season);
    document.documentElement.style.setProperty("--primary", seasonTheme.primary);
    document.documentElement.style.setProperty("--primary-light", seasonTheme.primaryLight);
    document.documentElement.style.setProperty("--accent", seasonTheme.accent);
    document.documentElement.style.setProperty("--bg-main", seasonTheme.bgMain);
    document.documentElement.style.setProperty("--border-color", seasonTheme.borderColor);
    const fairyImg = document.getElementById("loginFairyImg");
    if (fairyImg) fairyImg.src = seasonTheme.avatarImg;
    const fairyLabel = document.getElementById("fairyNameLabel");
    if (fairyLabel) fairyLabel.textContent = "🧚 " + seasonTheme.fairyName;

    // Đợi học sinh login xong (PETEngine sẽ gọi hàm này qua window.onIELTSLoginSuccess)
    window.onIELTSLoginSuccess = function () {
      // Khởi động engine NGAY sau khi login (dù tầng đầu tiên là Vocab hay câu hỏi),
      // để anti-copy/đếm chuyển tab/highlight hoạt động xuyên suốt cả bài,
      // kể cả trong lúc học từ vựng (chưa có câu hỏi để chấm).
      PETEngine.init({
        exerciseName: examData.exerciseName,
        webhookUrl: examData.webhookUrl,
        topic: examData.topic,
        stage: "intro",
        isFinalStage: false,
        questionIds: [],
        getSelectedAnswer: () => "",
        setAnswerValue: () => {},
        getCorrectAnswer: () => "",
        clearAllAnswers: () => {},
      });

      currentStageIndex = -1;
      goToNextStage();
    };
  }

  function goToNextStage() {
    currentStageIndex++;
    if (currentStageIndex >= stageList.length) return; // đã hết tầng (không nên xảy ra)

    const stageName = stageList[currentStageIndex];
    renderStageProgress(stageName);

    if (stageName === "vocab") {
      renderVocabStage();
    } else if (stageName === "simplified") {
      renderQuestionStage("simplified", examData.simplifiedPassage, examData.simplifiedQuestions, "Bài Đọc Rút Gọn");
    } else if (stageName === "original") {
      renderQuestionStage("original", examData.originalPassage, examData.originalQuestions, "Bài Đọc Gốc");
    }
  }
  window.IELTSStageManager = { goToNextStage };

  // ---------------------------------------------------------------------
  // Thanh tiến trình 3 tầng
  // ---------------------------------------------------------------------
  const STAGE_LABELS = { vocab: "📚 Từ Vựng", simplified: "📝 Bài Rút Gọn", original: "🎯 Bài Gốc" };

  function renderStageProgress(activeStage) {
    let el = document.getElementById("stageProgress");
    if (!el) {
      el = document.createElement("div");
      el.id = "stageProgress";
      el.className = "stage-progress";
      const header = document.querySelector(".app-header");
      header.insertAdjacentElement("afterend", el);
    }
    el.innerHTML = stageList.map((s, i) => {
      const cls = s === activeStage ? "active" : (i < currentStageIndex ? "done" : "");
      const icon = i < currentStageIndex ? "✅" : "";
      return `<div class="stage-step ${cls}"><span class="dot"></span>${icon} ${STAGE_LABELS[s]}</div>`
        + (i < stageList.length - 1 ? `<span class="stage-arrow">→</span>` : "");
    }).join("");
  }

  // ---------------------------------------------------------------------
  // Tầng Từ Vựng (không chấm điểm, chỉ yêu cầu xem qua rồi bấm Tiếp tục)
  // ---------------------------------------------------------------------
  function renderVocabStage() {
    const target = document.getElementById("partRenderTarget");
    document.getElementById("mainApp").classList.remove("split-mode");
    document.getElementById("btnSubmit").style.display = "none"; // tầng này không dùng nút Kiểm Tra Đáp Án chung
    document.getElementById("statusText").textContent = "Xem qua các từ vựng bên dưới (bấm vào từng thẻ để xem nghĩa) rồi bấm Tiếp Tục.";

    target.innerHTML = `
      <div class="vocab-intro">
        <h2>📚 Từ Vựng Cần Biết Trước Khi Đọc</h2>
        <p class="vocab-sub">Bấm vào từng thẻ để xem nghĩa và ví dụ. Khi đã xem hết, bấm "Tiếp Tục" để sang bài đọc.</p>
        <div class="vocab-grid" id="vocabGrid"></div>
        <button class="btn-continue-vocab" id="btnContinueVocab" disabled>Tiếp Tục ➜ (0/${examData.vocabulary.length})</button>
      </div>
    `;

    const seen = new Set();
    const btn = document.getElementById("btnContinueVocab");

    document.getElementById("vocabGrid").innerHTML = examData.vocabulary.map((v, i) => `
      <div class="vocab-card" data-idx="${i}">
        <div class="vw-word">${v.word}</div>
        <div class="vw-meaning">${v.meaning}</div>
        <div class="vw-example">${v.example || ""}</div>
        <div class="vw-hint">👆 Bấm để xem nghĩa</div>
      </div>
    `).join("");

    document.querySelectorAll(".vocab-card").forEach(card => {
      card.addEventListener("click", () => {
        card.classList.toggle("flipped");
        seen.add(card.getAttribute("data-idx"));
        btn.textContent = `Tiếp Tục ➜ (${seen.size}/${examData.vocabulary.length})`;
        btn.disabled = seen.size < examData.vocabulary.length;
      });
    });

    btn.addEventListener("click", () => {
      document.getElementById("btnSubmit").style.display = "";
      goToNextStage();
    });
  }

  // ---------------------------------------------------------------------
  // Tầng Simplified / Original (dùng chung TFNGRenderer + PETEngine)
  // ---------------------------------------------------------------------
  function renderQuestionStage(stageName, passage, questionsBlock, rangeLabel) {
    const target = document.getElementById("partRenderTarget");
    document.getElementById("btnSubmit").style.display = "";
    document.getElementById("btnSubmit").setAttribute("onclick", "PETEngine.checkAnswers()");

    // Hiện tại chỉ hỗ trợ questionsBlock.type === "tfng".
    // Khi có thêm dạng câu hỏi mới (gap-fill, matching...), thêm nhánh if ở đây.
    if (questionsBlock.type === "tfng") {
      TFNGRenderer.render(target, passage, questionsBlock, rangeLabel);
      TFNGRenderer.renderExplanation(
        document.getElementById("explanationContainer"),
        examData.explanation[stageName]
      );

      const engineCfg = TFNGRenderer.buildEngineConfig(questionsBlock);
      const isFinal = stageList[stageList.length - 1] === stageName;

      const fullCfg = Object.assign(engineCfg, {
        exerciseName: examData.exerciseName,
        webhookUrl: examData.webhookUrl,
        topic: examData.topic,
        stage: stageName,
        isFinalStage: isFinal,
        onStageComplete: goToNextStage,
      });

      // PETEngine.init() đã chạy ngay sau khi login (xem onIELTSLoginSuccess),
      // nên từ tầng câu hỏi đầu tiên trở đi luôn dùng startNewStage().
      PETEngine.startNewStage(fullCfg);
    } else {
      target.innerHTML = `<p style="padding:24px;">⚠️ Chưa hỗ trợ dạng câu hỏi "${questionsBlock.type}".</p>`;
    }
  }

  window.addEventListener("DOMContentLoaded", bootExercise);
})();
