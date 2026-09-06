/* =====================================================================
   IELTS READING - SHARED ENGINE (fork từ PET shared-engine.js)
   =====================================================================
   Khác biệt so với bản gốc PET:
   1. Hỗ trợ NHIỀU TẦNG (stage) trong 1 phiên làm bài: vocab -> simplified
      -> original. Học sinh chỉ login 1 lần, sau đó Stage Manager gọi
      PETEngine.startNewStage(cfg) để nạp bộ câu hỏi mới mà KHÔNG reload
      trang, không mất tabSwitchCount (đếm dồn xuyên suốt cả bài).
   2. cfg có thêm:
        stage: "vocab" | "simplified" | "original"   (để gắn nhãn khi ghi Sheet)
        topic: "Environment" | ...                    (để ghi Sheet, phục vụ thống kê)
        isFinalStage: true/false                       (tầng cuối mới hiện nút "Làm bài mới")
        onStageComplete: function() {...}               (Stage Manager truyền vào, gọi khi
                                                           HS đạt 100% ở tầng KHÔNG PHẢI tầng cuối)
   3. Khi đạt 100%:
        - Nếu isFinalStage = true  -> giữ nguyên hành vi cũ (hiện resultModal, nút reload trang)
        - Nếu isFinalStage = false -> hiện resultModal với nút "Tiếp Tục ➜", bấm vào sẽ gọi
          cfg.onStageComplete() thay vì reload trang
   4. Mỗi tầng gửi 1 dòng riêng lên Google Sheets (có cột "stage") để GV thấy
      HS mất bao lâu / sai bao nhiêu ở từng tầng.

   Toàn bộ phần còn lại (anti-copy, anti-spam, highlight, watermark, teacher
   mode...) giữ nguyên 100% so với bản PET để không phải học lại cách dùng.
   ===================================================================== */

(function (window, document) {
  "use strict";

  const PETEngine = {};

  // ---------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------
  let cfg = null;
  let studentName = "";
  let isTeacher = false;
  let startTime = null;        // thời điểm login (dùng cho tổng thời gian cả bài)
  let stageStartTime = null;   // thời điểm bắt đầu TẦNG hiện tại (dùng để log riêng từng tầng)
  let attemptCount = 0;
  let tabSwitchCount = 0;      // đếm DỒN xuyên suốt cả bài, không reset khi chuyển tầng
  let spamViolations = 0;
  let lastChangedQuestion = null;
  let lastChangeTimestamp = 0;
  let firstSubmissionDataSent = false;
  let antiCheatBypassed = false;
  let currentSelectionRange = null;

  // ---------------------------------------------------------------------
  // INIT (gọi 1 lần duy nhất cho tầng ĐẦU TIÊN của bài)
  // ---------------------------------------------------------------------
  PETEngine.init = function (config) {
    cfg = Object.assign(
      {
        studentCode: "IERB",
        teacherName: "GVIERB",
        teacherCode: "IE9.0",
        highlightScope: "left",
        spamThresholdSeconds: 1.5,
        checkDuplicates: false,
        questionIds: [],
        stage: "single",
        isFinalStage: true,
      },
      config
    );

    if (cfg.theme) applyTheme(cfg.theme);
    wireAntiCopy();
    wireTabSwitchCounter();
    wireHighlightListener();
    stageStartTime = new Date();

    validateAnswersState();
  };

  // ---------------------------------------------------------------------
  // CHUYỂN TẦNG (điểm khác biệt cốt lõi so với bản PET)
  // ---------------------------------------------------------------------
  // Gọi khi HS đã hoàn thành 1 tầng và chuyển sang tầng tiếp theo.
  // KHÔNG reset: studentName, isTeacher, startTime, tabSwitchCount (đếm dồn cả bài)
  // CÓ reset: attemptCount, spamViolations, firstSubmissionDataSent, stageStartTime
  PETEngine.startNewStage = function (newCfg) {
    cfg = Object.assign({}, cfg, newCfg);
    attemptCount = 0;
    spamViolations = 0;
    firstSubmissionDataSent = false;
    lastChangedQuestion = null;
    lastChangeTimestamp = 0;
    stageStartTime = new Date();

    const resultModal = document.getElementById("resultModal");
    const modalOverlay = document.getElementById("modalOverlay");
    if (resultModal) resultModal.style.display = "none";
    if (modalOverlay) modalOverlay.style.display = "none";

    validateAnswersState();
  };

  // ---------------------------------------------------------------------
  // THEME
  // ---------------------------------------------------------------------
  function applyTheme(theme) {
    const root = document.documentElement.style;
    if (theme.primary) root.setProperty("--primary", theme.primary);
    if (theme.primaryLight) root.setProperty("--primary-light", theme.primaryLight);
    if (theme.accent) root.setProperty("--accent", theme.accent);
    if (theme.bgMain) root.setProperty("--bg-main", theme.bgMain);
    if (theme.borderColor) root.setProperty("--border-color", theme.borderColor);
  }

  // ---------------------------------------------------------------------
  // ANTI-COPY (giữ nguyên như bản PET)
  // ---------------------------------------------------------------------
  function wireAntiCopy() {
    document.addEventListener("copy", function (e) {
      if (antiCheatBypassed) return;
      e.preventDefault();
      if (e.clipboardData) e.clipboardData.setData("text/plain", "");
      alert("⚠️ Hệ thống đã khóa chức năng Sao Chép (Copy)!");
    });
    document.addEventListener("cut", function (e) { if (!antiCheatBypassed) e.preventDefault(); });
    document.addEventListener("contextmenu", function (e) { if (!antiCheatBypassed) e.preventDefault(); });
    document.addEventListener("dragstart", function (e) { if (!antiCheatBypassed) e.preventDefault(); });
    document.addEventListener("keydown", function (e) {
      if (antiCheatBypassed) return;
      if ((e.ctrlKey || e.metaKey) && ["c", "C", "x", "X", "p", "P"].includes(e.key)) {
        e.preventDefault();
        alert("⚠️ Thao tác sao chép / in ấn bị cấm!");
      }
    });
  }

  // ---------------------------------------------------------------------
  // TAB-SWITCH COUNTER (đếm dồn xuyên suốt cả bài, không reset khi đổi tầng)
  // ---------------------------------------------------------------------
  function wireTabSwitchCounter() {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && !antiCheatBypassed) {
        tabSwitchCount++;
        updateTabBadge();
      }
    });
  }

  function updateTabBadge() {
    const badge = document.getElementById("tabBadge");
    if (badge) badge.textContent = `Chuyển tab: ${tabSwitchCount} lần`;
  }

  // ---------------------------------------------------------------------
  // LOGIN (chỉ chạy 1 lần cho toàn bộ 3 tầng)
  // ---------------------------------------------------------------------
  PETEngine.startExercise = function () {
    const nameInput = (document.getElementById("studentName").value || "").trim();
    const codeInput = (document.getElementById("accessCode").value || "").trim();
    if (!nameInput) { alert("Vui lòng nhập Họ và Tên!"); return; }

    if (nameInput === cfg.teacherName && codeInput === cfg.teacherCode) {
      isTeacher = true;
      antiCheatBypassed = true;
      const toolbar = document.getElementById("teacherToolbar");
      if (toolbar) toolbar.style.display = "flex";
    } else if (codeInput !== cfg.studentCode) {
      alert("Mã xác nhận bài tập không đúng!");
      return;
    }

    studentName = nameInput;
    startTime = new Date();
    stageStartTime = new Date();
    buildWatermark();
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainApp").style.display = "flex";

    if (typeof window.onIELTSLoginSuccess === "function") {
      window.onIELTSLoginSuccess(); // Stage Manager sẽ hook vào đây để render tầng đầu tiên
    }
  };

  PETEngine.getStudentName = function () { return studentName; };
  PETEngine.isTeacherMode = function () { return isTeacher; };

  function buildWatermark() {
    const wm = document.getElementById("watermark");
    if (!wm) return;
    const label = (studentName || cfg.exerciseName || "IELTS Reading") + " • " + new Date().toLocaleDateString("vi-VN");
    const html = [];
    for (let i = 0; i < 40; i++) html.push(`<span>${label}</span>`);
    wm.innerHTML = html.join("");
  }

  // ---------------------------------------------------------------------
  // HIGHLIGHT (giữ nguyên như bản PET)
  // ---------------------------------------------------------------------
  function wireHighlightListener() {
    document.addEventListener("selectionchange", function () {
      const selection = window.getSelection();
      const hlPopup = document.getElementById("hlPopup");
      if (!hlPopup) return;

      const scopeEl = cfg.highlightScope === "left" ? document.getElementById("leftPane") : document;

      if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
        const anchorNode = selection.anchorNode;
        const inScope = cfg.highlightScope === "left"
          ? (scopeEl && scopeEl.contains(anchorNode))
          : true;

        if (inScope) {
          try {
            const range = selection.getRangeAt(0);
            currentSelectionRange = range.cloneRange();
            const rect = range.getBoundingClientRect();
            hlPopup.style.display = "flex";
            hlPopup.style.top = (window.scrollY + rect.top - 45) + "px";
            hlPopup.style.left = (window.scrollX + rect.left + (rect.width / 2) - 75) + "px";
            return;
          } catch (e) { /* ignore */ }
        }
      }

      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) hlPopup.style.display = "none";
      }, 200);
    });
  }

  PETEngine.applyHighlight = function (color) {
    let range = currentSelectionRange;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) range = selection.getRangeAt(0);
    if (!range) return;

    if (color === "remove") {
      const container = range.commonAncestorContainer;
      let markElem = container.nodeType === 3 ? container.parentElement : container;
      while (markElem && markElem.tagName !== "MARK" && markElem.parentElement) {
        markElem = markElem.parentElement;
      }
      if (markElem && markElem.tagName === "MARK") {
        const textNode = document.createTextNode(markElem.textContent);
        markElem.parentNode.replaceChild(textNode, markElem);
      }
    } else {
      const mark = document.createElement("mark");
      mark.className = "hl-" + color;
      try {
        mark.appendChild(range.extractContents());
        range.insertNode(mark);
      } catch (e) { /* ignore */ }
    }
    if (selection) selection.removeAllRanges();
    const hlPopup = document.getElementById("hlPopup");
    if (hlPopup) hlPopup.style.display = "none";
    currentSelectionRange = null;
  };

  // ---------------------------------------------------------------------
  // ANSWER CHANGE + ANTI-SPAM (giữ nguyên như bản PET)
  // ---------------------------------------------------------------------
  PETEngine.onAnswerChange = function (qId) {
    const now = Date.now();
    if (!antiCheatBypassed && lastChangedQuestion !== null && lastChangedQuestion !== qId) {
      if ((now - lastChangeTimestamp) / 1000 < cfg.spamThresholdSeconds) {
        triggerSpamPenalty();
      }
    }
    lastChangedQuestion = qId;
    lastChangeTimestamp = now;
    validateAnswersState();
  };

  function triggerSpamPenalty() {
    spamViolations++;
    const overlay = document.getElementById("lockOverlay");
    const timerElem = document.getElementById("lockTimer");
    const titleElem = document.getElementById("lockTitle");
    if (!overlay) return;

    let lockSeconds = 5;
    if (spamViolations === 1) lockSeconds = 5;
    else if (spamViolations === 2) lockSeconds = 10;
    else if (spamViolations === 3) lockSeconds = 30;
    else if (spamViolations >= 4) {
      if (typeof cfg.clearAllAnswers === "function") cfg.clearAllAnswers();
      validateAnswersState();
      alert("⚠️ Vi phạm thao tác nhiều lần! Hệ thống đã xóa toàn bộ đáp án.");
      return;
    }

    if (titleElem) titleElem.textContent = `⚠️ CẢNH BÁO THAO TÁC QUÁ NHANH (LẦN ${spamViolations})`;
    if (timerElem) timerElem.textContent = lockSeconds;
    overlay.style.display = "flex";

    let remaining = lockSeconds;
    const interval = setInterval(() => {
      remaining--;
      if (timerElem) timerElem.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(interval);
        overlay.style.display = "none";
      }
    }, 1000);
  }

  // ---------------------------------------------------------------------
  // VALIDATE STATE
  // ---------------------------------------------------------------------
  function validateAnswersState() {
    if (!cfg) return;
    const btnSubmit = document.getElementById("btnSubmit");
    const statusText = document.getElementById("statusText");
    const dupTooltip = document.getElementById("dupTooltip");
    const total = cfg.questionIds.length;

    const currentValues = cfg.questionIds.map(qId => cfg.getSelectedAnswer(qId));
    const answeredCount = currentValues.filter(v => v && v !== "").length;

    if (cfg.checkDuplicates) {
      const filled = currentValues.filter(v => v && v !== "");
      const hasDup = new Set(filled).size !== filled.length;
      if (hasDup) {
        if (btnSubmit) btnSubmit.disabled = true;
        if (dupTooltip) dupTooltip.style.display = "block";
        if (statusText) {
          statusText.textContent = "Phát hiện đáp án trùng lặp giữa các câu!";
          statusText.style.color = "#c53030";
        }
        return;
      } else if (dupTooltip) {
        dupTooltip.style.display = "none";
      }
    }

    if (!btnSubmit || !statusText) return;

    if (answeredCount === total) {
      btnSubmit.disabled = false;
      statusText.textContent = "Đã hoàn thành tất cả câu hỏi. Sẵn sàng nộp bài!";
      statusText.style.color = "var(--primary)";
    } else {
      btnSubmit.disabled = true;
      statusText.textContent = `Đã làm ${answeredCount}/${total} câu. Vui lòng hoàn thành tất cả.`;
      statusText.style.color = "var(--text-muted)";
    }
  }
  PETEngine.validateAnswersState = validateAnswersState;

  // ---------------------------------------------------------------------
  // CHECK ANSWERS
  // ---------------------------------------------------------------------
  PETEngine.checkAnswers = function () {
    attemptCount++;
    const userAnswers = {};
    let correctCount = 0;

    cfg.questionIds.forEach(qId => {
      const val = cfg.getSelectedAnswer(qId);
      userAnswers[qId] = val;
      const isCorrect = typeof cfg.isCorrectMatch === "function"
        ? cfg.isCorrectMatch(qId, val)
        : (val === cfg.getCorrectAnswer(qId));
      if (isCorrect) correctCount++;
    });

    if (!firstSubmissionDataSent) {
      sendDataToGoogleSheets(correctCount);
      firstSubmissionDataSent = true;
    }

    const total = cfg.questionIds.length;

    if (correctCount === total) {
      renderResultSummary();
      const continueBtn = document.getElementById("btnResultContinue");
      if (continueBtn) {
        continueBtn.textContent = cfg.isFinalStage ? "Làm Bài Mới 🔄" : "Tiếp Tục Sang Tầng Tiếp Theo ➜";
      }
      const resultModal = document.getElementById("resultModal");
      if (resultModal) resultModal.style.display = "block";
    } else {
      const modalDesc = document.getElementById("modalDesc");
      if (modalDesc) {
        modalDesc.textContent = `Bạn làm đúng ${correctCount}/${total} câu. Bạn cần làm đúng 100% để hoàn thành.`;
      }
      const modalOverlay = document.getElementById("modalOverlay");
      if (modalOverlay) modalOverlay.style.display = "flex";

      if (attemptCount >= 2) {
        cfg.questionIds.forEach(qId => {
          const isCorrect = typeof cfg.isCorrectMatch === "function"
            ? cfg.isCorrectMatch(qId, userAnswers[qId])
            : (userAnswers[qId] === cfg.getCorrectAnswer(qId));
          if (!isCorrect) {
            const hintElem = document.getElementById("hint-" + qId);
            if (hintElem) hintElem.style.display = "block";
          }
        });
      }
    }
  };

  PETEngine.closeModal = function () {
    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay) modalOverlay.style.display = "none";
  };

  // Nút trong resultModal gọi hàm này thay vì location.reload() trực tiếp,
  // để engine tự quyết định: tầng cuối -> reload; chưa phải tầng cuối -> chuyển tầng.
  PETEngine.handleResultContinue = function () {
    const resultModal = document.getElementById("resultModal");
    if (resultModal) resultModal.style.display = "none";

    if (cfg.isFinalStage) {
      location.reload();
    } else if (typeof cfg.onStageComplete === "function") {
      cfg.onStageComplete();
    }
  };

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds} giây`;
    return `${minutes} phút ${seconds} giây`;
  }

  function renderResultSummary() {
    const box = document.getElementById("resultSummaryBox");
    if (!box) return;
    const now = new Date();
    const stageDurationText = stageStartTime ? formatDuration(now - stageStartTime) : "-";
    box.innerHTML = `
      <div class="result-summary-item">
        <span class="label">👤 Học sinh</span>
        <span class="value">${studentName || "-"}</span>
      </div>
      <div class="result-summary-item">
        <span class="label">📍 Tầng vừa hoàn thành</span>
        <span class="value">${stageLabel(cfg.stage)}</span>
      </div>
      <div class="result-summary-item">
        <span class="label">⏱️ Thời gian tầng này</span>
        <span class="value">${stageDurationText}</span>
      </div>
    `;
  }

  function stageLabel(stage) {
    if (stage === "simplified") return "Bài đọc rút gọn";
    if (stage === "original") return "Bài đọc gốc";
    return stage || "-";
  }

  // ---------------------------------------------------------------------
  // GOOGLE SHEETS LOGGING (mỗi tầng gửi 1 dòng riêng, có cột "stage")
  // ---------------------------------------------------------------------
  function sendDataToGoogleSheets(firstScore) {
    if (!cfg.webhookUrl || cfg.webhookUrl.includes("YOUR_WEBHOOK_URL")) {
      console.warn("Chưa cấu hình Google Webhook URL hợp lệ.");
      return;
    }
    const total = cfg.questionIds.length;
    const now = new Date();
    const payload = {
      exerciseName: cfg.exerciseName,
      topic: cfg.topic || "",
      stage: cfg.stage || "",
      studentName: studentName + (isTeacher ? " [TEST]" : ""),
      stageStartTime: stageStartTime ? stageStartTime.toLocaleString("vi-VN") : "",
      stageEndTime: now.toLocaleString("vi-VN"),
      stageDurationSeconds: stageStartTime ? Math.round((now - stageStartTime) / 1000) : "",
      firstScore: `${firstScore}/${total}`,
      attemptCount: attemptCount,
      tabSwitchCount: tabSwitchCount,
      status: firstScore === total ? "Hoàn thành 100% lần 1" : "Đã nộp lần 1 (Đang làm lại)",
    };

    fetch(cfg.webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    })
      .then(() => console.log("Đã gửi dữ liệu tầng '" + cfg.stage + "' thành công tới Google Sheets!"))
      .catch(err => console.log("Google Sheets logging error: ", err));
  }

  PETEngine.changeWebhookUrl = function () {
    const newUrl = prompt("Nhập Google Apps Script Webhook URL mới:", cfg.webhookUrl);
    if (newUrl !== null && newUrl.trim() !== "") {
      cfg.webhookUrl = newUrl.trim();
      alert("Đã cập nhật Webhook URL thành công!");
    }
  };

  // ---------------------------------------------------------------------
  // TEACHER TOOLS (giữ nguyên như bản PET)
  // ---------------------------------------------------------------------
  PETEngine.teacherAutoFill = function (isCorrect) {
    const tempBypass = antiCheatBypassed;
    antiCheatBypassed = true;

    cfg.questionIds.forEach((qId, index) => {
      let targetVal = cfg.getCorrectAnswer(qId);
      if (!isCorrect && index < 2 && typeof cfg.getAlternateAnswer === "function") {
        targetVal = cfg.getAlternateAnswer(qId);
      }
      cfg.setAnswerValue(qId, targetVal);
    });

    validateAnswersState();
    antiCheatBypassed = tempBypass;
  };

  PETEngine.toggleAntiCheat = function () {
    antiCheatBypassed = !antiCheatBypassed;
    alert("Anti-Cheat / Anti-Spam: " + (antiCheatBypassed ? "ĐÃ TẮT" : "ĐÃ BẬT"));
  };

  // ---------------------------------------------------------------------
  window.PETEngine = PETEngine;
})(window, document);
