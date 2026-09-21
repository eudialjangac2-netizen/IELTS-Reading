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
  const completedStages = new Set(); // các tầng đã đạt 100% ít nhất 1 lần
  let reviewModeActive = false;      // đang ở chế độ XEM LẠI (không sửa được) hay không

  // Grammar là tầng KHÔNG BẮT BUỘC: học sinh không cần hoàn thành nó để được
  // tính là "đã xong bài". Tầng bắt buộc CUỐI CÙNG trong danh sách mới là tầng
  // quyết định khi nào hiện màn "Hoàn Thành Xuất Sắc" + nút "Làm Bài Mới".
  const OPTIONAL_STAGES = new Set(["grammar"]);
  function isStageFinal(stageName) {
    for (let i = stageList.length - 1; i >= 0; i--) {
      if (!OPTIONAL_STAGES.has(stageList[i])) return stageList[i] === stageName;
    }
    return stageList[stageList.length - 1] === stageName; // fallback nếu tất cả đều optional
  }

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
    if (examData.vocabularyExercises && examData.vocabularyExercises.length > 0) stageList.push("vocab-exercises");
    if (mode === "scaffold" && examData.simplifiedPassage) stageList.push("simplified");
    if (examData.originalPassage) stageList.push("original");
    if (examData.grammarTools && examData.grammarTools.length > 0) stageList.push("grammar");

    document.getElementById("appTitle").textContent = "📖 " + examData.exerciseName;
    const loginSubtitle = document.getElementById("loginSubtitle");
    if (loginSubtitle) {
      loginSubtitle.textContent = mode === "scaffold"
        ? "IELTS Reading (có lộ trình từ vựng → bài rút gọn → bài gốc)"
        : "IELTS Reading (bài gốc)";
    }

    // Nút "Xuất File Word" trong Teacher Toolbar: chỉ hiện khi bài này có sẵn
    // file .docx đi kèm (field wordDocUrl trong JSON). File Word KHÔNG được
    // tự sinh ra từ dữ liệu bài - đây là tài liệu soạn thủ công riêng, chỉ
    // gắn link tải về tương ứng với từng bài.
    const exportBtn = document.getElementById("btnExportWord");
    if (exportBtn) {
      if (examData.wordDocUrl) {
        exportBtn.href = examData.wordDocUrl;
        exportBtn.setAttribute("download", examData.wordDocUrl.split("/").pop());
        exportBtn.style.display = "inline-block";
      } else {
        exportBtn.style.display = "none";
      }
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

    wireResultModalContinueButton();

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
    goToStage(currentStageIndex + 1);
  }

  // Cho phép nhảy tự do tới BẤT KỲ tầng nào (không khoá tuần tự) - gọi khi
  // học sinh bấm vào 1 pill trên thanh tiến trình, hoặc khi 1 tầng hoàn thành
  // và tự động chuyển sang tầng kế tiếp.
  function goToStage(index) {
    if (index < 0 || index >= stageList.length) return;
    currentStageIndex = index;

    const stageName = stageList[currentStageIndex];
    renderStageProgress(stageName);

    if (stageName === "vocab") {
      renderVocabStage();
    } else if (stageName === "vocab-exercises") {
      renderVocabExercisesStage();
    } else if (stageName === "simplified") {
      renderQuestionStage("simplified", examData.simplifiedPassage, examData.simplifiedQuestions, "Bài Đọc Rút Gọn");
    } else if (stageName === "original") {
      renderQuestionStage("original", examData.originalPassage, examData.originalQuestions, "Bài Đọc Gốc");
    } else if (stageName === "grammar") {
      renderGrammarStage();
    }
  }
  window.IELTSStageManager = { goToNextStage, goToStage };

  // Đánh dấu 1 tầng đã hoàn thành (đạt 100% ít nhất 1 lần) - gọi TRƯỚC khi
  // chuyển sang tầng kế tiếp, để thanh tiến trình hiện đúng dấu ✅.
  function markStageComplete(index) {
    completedStages.add(index);
  }
  window.IELTSStageManager.markStageComplete = markStageComplete;

  // ---------------------------------------------------------------------
  // CHẾ ĐỘ XEM LẠI (review mode) - khi học sinh bấm vào 1 tầng ĐÃ HOÀN THÀNH
  // (dấu ✅), tầng đó được render như bình thường nhưng: điền sẵn đáp án đúng,
  // khoá không cho sửa, ẩn nút nộp bài, và có nút riêng để mở bảng giải thích.
  // Vì hệ thống yêu cầu 100% đúng mới coi là hoàn thành, "xem lại" 1 tầng đã
  // xong nghĩa là xem lại đáp án ĐÚNG + giải thích, không cần làm lại từ đầu.
  // ---------------------------------------------------------------------
  function exitReviewModeIfNeeded() {
    reviewModeActive = false;
    const reviewBtn = document.getElementById("btnReviewExplanation");
    if (reviewBtn) reviewBtn.style.display = "none";
  }

  function applyReviewModeIfNeeded() {
    if (!completedStages.has(currentStageIndex)) return;
    reviewModeActive = true;

    // Điền sẵn đáp án đúng (dùng lại đúng cơ chế Auto-Fill của Teacher Mode)
    // rồi khoá toàn bộ input lại để chỉ xem, không sửa được.
    PETEngine.teacherAutoFill(true);
    document.querySelectorAll("#partRenderTarget input, #partRenderTarget select").forEach(el => {
      el.disabled = true;
    });

    const btnSubmit = document.getElementById("btnSubmit");
    if (btnSubmit) btnSubmit.style.display = "none";

    const statusText = document.getElementById("statusText");
    if (statusText) {
      statusText.textContent = "📋 Bạn đang xem lại tầng đã hoàn thành - đáp án đúng đã được điền sẵn.";
      statusText.style.color = "var(--primary)";
    }

    let reviewBtn = document.getElementById("btnReviewExplanation");
    if (!reviewBtn) {
      reviewBtn = document.createElement("button");
      reviewBtn.id = "btnReviewExplanation";
      reviewBtn.className = "btn-submit";
      document.querySelector(".submit-footer").appendChild(reviewBtn);
    }
    reviewBtn.textContent = "📖 Xem Giải Thích Đáp Án";
    reviewBtn.style.display = "";
    reviewBtn.onclick = () => {
      document.getElementById("btnResultContinue").textContent = "Đóng";
      document.getElementById("resultModal").style.display = "block";
    };
  }

  // Nút "Tiếp Tục" trong resultModal: khi đang ở review mode thì chỉ ĐÓNG modal
  // (không chuyển tầng lại từ đầu); khi đang làm bài bình thường thì giữ nguyên
  // hành vi cũ (PETEngine.handleResultContinue tự quyết định chuyển tầng/reload).
  function wireResultModalContinueButton() {
    const continueBtn = document.getElementById("btnResultContinue");
    if (!continueBtn) return;
    continueBtn.onclick = function () {
      if (reviewModeActive) {
        document.getElementById("resultModal").style.display = "none";
      } else {
        PETEngine.handleResultContinue();
      }
    };
  }

  // ---------------------------------------------------------------------
  // Thanh tiến trình 3 tầng
  // ---------------------------------------------------------------------
  const STAGE_LABELS = { vocab: "📚 Từ Vựng", "vocab-exercises": "✏️ Luyện Từ Vựng", simplified: "📝 Bài Rút Gọn", original: "🎯 Bài Gốc", grammar: "🧩 Ngữ Pháp" };

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
      const cls = s === activeStage ? "active" : (completedStages.has(i) ? "done" : "");
      const icon = completedStages.has(i) ? "✅" : "";
      const optionalTag = OPTIONAL_STAGES.has(s) ? `<span class="optional-tag">tuỳ chọn</span>` : "";
      return `<div class="stage-step ${cls}" data-stage-index="${i}">${icon ? "" : `<span class="dot"></span>`}${icon} ${STAGE_LABELS[s]}${optionalTag}</div>`
        + (i < stageList.length - 1 ? `<span class="stage-arrow">→</span>` : "");
    }).join("");

    // Tự do di chuyển: bấm vào bất kỳ pill nào để nhảy tới tầng đó, không
    // cần hoàn thành tầng hiện tại trước.
    el.querySelectorAll(".stage-step").forEach(pill => {
      pill.addEventListener("click", () => {
        const idx = parseInt(pill.getAttribute("data-stage-index"), 10);
        if (idx !== currentStageIndex) goToStage(idx);
      });
    });
  }

  // ---------------------------------------------------------------------
  // Tầng Từ Vựng (không chấm điểm, chỉ yêu cầu xem qua rồi bấm Tiếp tục)
  // ---------------------------------------------------------------------
  function renderVocabStage() {
    exitReviewModeIfNeeded();
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
      markStageComplete(currentStageIndex);
      goToNextStage();
    });
  }

  // ---------------------------------------------------------------------
  // Tầng Luyện Từ Vựng (vocab-exercises) - gộp nhiều exercise block, chấm
  // chung 1 lần bằng ExerciseCombinator + PETEngine như các tầng câu hỏi khác.
  // ---------------------------------------------------------------------
  function renderVocabExercisesStage() {
    exitReviewModeIfNeeded();
    const target = document.getElementById("partRenderTarget");
    document.getElementById("mainApp").classList.remove("split-mode");
    document.getElementById("btnSubmit").style.display = "";
    document.getElementById("btnSubmit").setAttribute("onclick", "PETEngine.checkAnswers()");

    const wrapper = document.createElement("div");
    wrapper.className = "questions-scroll-area";
    target.innerHTML = "";
    target.appendChild(wrapper);

    const partialCfg = ExerciseCombinator.renderAll(wrapper, examData.vocabularyExercises);

    // Bảng giải thích trong resultModal: với bài tập từ vựng, hiện lại đáp án đúng dạng đơn giản
    const expContainer = document.getElementById("explanationContainer");
    expContainer.innerHTML = `<p style="font-size:14px;color:var(--text-muted);">Đáp án đúng đã được đánh dấu trong bài làm của bạn.</p>`;

    const isFinal = isStageFinal("vocab-exercises");
    const fullCfg = Object.assign(partialCfg, {
      exerciseName: examData.exerciseName,
      webhookUrl: examData.webhookUrl,
      topic: examData.topic,
      stage: "vocab-exercises",
      isFinalStage: isFinal,
      onStageComplete: () => { markStageComplete(currentStageIndex); goToNextStage(); },
      checkDuplicates: false,
      spamThresholdSeconds: 2,
    });

    // PETEngine.init() đã chạy ngay sau khi login (xem onIELTSLoginSuccess),
    // nên từ đây trở đi luôn dùng startNewStage() - không gọi init() lại lần nữa
    // (gọi lại sẽ đăng ký trùng các event listener chống gian lận).
    PETEngine.startNewStage(fullCfg);
    applyReviewModeIfNeeded();
  }

  // ---------------------------------------------------------------------
  // Tầng Grammar - mỗi grammarTool gồm: static intro -> fillblank (Step 3)
  // -> static reading-tool -> mcq (Exercise: Apply) -> static return-to-task.
  // Tất cả grammarTools được gộp chung vào 1 lần nộp bài (đúng theo yêu cầu:
  // Grammar là tầng bắt buộc tuần tự, chấm 1 lần cho toàn bộ).
  // ---------------------------------------------------------------------
  function renderGrammarStage() {
    exitReviewModeIfNeeded();
    const target = document.getElementById("partRenderTarget");
    document.getElementById("mainApp").classList.remove("split-mode");
    document.getElementById("btnSubmit").style.display = "";
    document.getElementById("btnSubmit").setAttribute("onclick", "PETEngine.checkAnswers()");

    const wrapper = document.createElement("div");
    wrapper.className = "questions-scroll-area";
    target.innerHTML = "";
    target.appendChild(wrapper);

    // Build danh sách block xen kẽ static/graded từ tất cả grammarTools
    const blocks = [];
    examData.grammarTools.forEach(tool => {
      blocks.push({ type: "static", html: `<h2 class="article-title" style="margin-top:24px;">${tool.title}</h2>` });
      blocks.push({ type: "static", html: tool.staticIntroHTML });
      blocks.push(tool.patternExercise);
      blocks.push({ type: "static", html: tool.staticReadingToolHTML });
      blocks.push(tool.applyExercise);
      blocks.push({ type: "static", html: tool.staticReturnHTML });
    });

    const partialCfg = ExerciseCombinator.renderAll(wrapper, blocks);

    const expContainer = document.getElementById("explanationContainer");
    expContainer.innerHTML = `<p style="font-size:14px;color:var(--text-muted);">Đáp án đúng đã được đánh dấu trong bài làm của bạn.</p>`;

    const isFinal = isStageFinal("grammar");
    const fullCfg = Object.assign(partialCfg, {
      exerciseName: examData.exerciseName,
      webhookUrl: examData.webhookUrl,
      topic: examData.topic,
      stage: "grammar",
      isFinalStage: isFinal,
      onStageComplete: () => { markStageComplete(currentStageIndex); goToNextStage(); },
      checkDuplicates: false,
      spamThresholdSeconds: 2,
    });

    // PETEngine.init() đã chạy ngay sau khi login (xem onIELTSLoginSuccess),
    // nên từ đây trở đi luôn dùng startNewStage().
    PETEngine.startNewStage(fullCfg);
    applyReviewModeIfNeeded();
  }

  // ---------------------------------------------------------------------
  // Tầng Simplified / Original (dùng chung TFNGRenderer + PETEngine)
  // ---------------------------------------------------------------------
  function renderQuestionStage(stageName, passage, questionsBlock, rangeLabel) {
    exitReviewModeIfNeeded();
    const target = document.getElementById("partRenderTarget");
    document.getElementById("btnSubmit").style.display = "";
    document.getElementById("btnSubmit").setAttribute("onclick", "PETEngine.checkAnswers()");

    // Hỗ trợ 2 dạng: "tfng" (1 dạng câu hỏi cố định, dùng TFNGRenderer) và
    // "combo" (nhiều dạng câu hỏi trộn lẫn trong 1 đề thật, dùng ComboRenderer).
    if (questionsBlock.type === "tfng") {
      TFNGRenderer.render(target, passage, questionsBlock, rangeLabel);
      TFNGRenderer.renderExplanation(
        document.getElementById("explanationContainer"),
        examData.explanation[stageName]
      );

      const engineCfg = TFNGRenderer.buildEngineConfig(questionsBlock);
      const isFinal = isStageFinal(stageName);

      const fullCfg = Object.assign(engineCfg, {
        exerciseName: examData.exerciseName,
        webhookUrl: examData.webhookUrl,
        topic: examData.topic,
        stage: stageName,
        isFinalStage: isFinal,
        onStageComplete: () => { markStageComplete(currentStageIndex); goToNextStage(); },
      });

      // PETEngine.init() đã chạy ngay sau khi login (xem onIELTSLoginSuccess),
      // nên từ tầng câu hỏi đầu tiên trở đi luôn dùng startNewStage().
      PETEngine.startNewStage(fullCfg);
      applyReviewModeIfNeeded();
    } else if (questionsBlock.type === "combo") {
      const engineCfg = ComboRenderer.render(target, passage, questionsBlock, rangeLabel);
      TFNGRenderer.renderExplanation(
        document.getElementById("explanationContainer"),
        examData.explanation[stageName]
      );

      const isFinal = isStageFinal(stageName);
      const fullCfg = Object.assign(engineCfg, {
        exerciseName: examData.exerciseName,
        webhookUrl: examData.webhookUrl,
        topic: examData.topic,
        stage: stageName,
        isFinalStage: isFinal,
        checkDuplicates: false,
        onStageComplete: () => { markStageComplete(currentStageIndex); goToNextStage(); },
      });

      PETEngine.startNewStage(fullCfg);
      applyReviewModeIfNeeded();
    } else {
      target.innerHTML = `<p style="padding:24px;">⚠️ Chưa hỗ trợ dạng câu hỏi "${questionsBlock.type}".</p>`;
    }
  }

  window.addEventListener("DOMContentLoaded", bootExercise);
})();
