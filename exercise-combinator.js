/* =====================================================================
   EXERCISE COMBINATOR
   =====================================================================
   1 tầng (vd: "vocab-exercises" hoặc "grammar") có thể gồm NHIỀU block bài
   tập khác nhau (matching + fillblank + mcq...) nhưng chỉ có 1 nút "Kiểm
   Tra Đáp Án" chung, 1 lần chấm chung. Combinator render tất cả block vào
   1 container rồi gộp cfg (questionIds/getSelectedAnswer/...) của từng
   block lại thành 1 cfg duy nhất truyền cho PETEngine.

   RENDERERS chứa theo type: matching -> MatchingRenderer, fillblank ->
   FillBlankRenderer, mcq -> MCQRenderer. Thêm renderer mới thì chỉ cần
   đăng ký thêm 1 dòng vào map bên dưới.
   ===================================================================== */

window.ExerciseCombinator = (function () {
  const RENDERERS = {
    matching: window.MatchingRenderer,
    fillblank: window.FillBlankRenderer,
    mcq: window.MCQRenderer,
  };

  // Block "static": chỉ render HTML thuyết minh, không đóng góp câu hỏi nào.
  function renderStatic(container, block) {
    const div = document.createElement("div");
    div.className = "grammar-static-block";
    div.innerHTML = block.html || "";
    container.appendChild(div);
  }

  // container: DOM element rỗng sẽ chứa tất cả block, theo đúng thứ tự trong blocks[]
  // Trả về 1 cfg gộp (chưa gồm exerciseName/webhookUrl/stage/... - phần đó do
  // stage-manager tự thêm vào sau).
  function renderAll(container, blocks) {
    container.innerHTML = "";
    const partials = blocks.map(block => {
      if (block.type === "static") {
        renderStatic(container, block);
        return null;
      }
      const renderer = RENDERERS[block.type];
      if (!renderer) {
        container.innerHTML += `<p style="color:red;">⚠️ Chưa hỗ trợ loại bài tập "${block.type}"</p>`;
        return null;
      }
      renderer.render(container, block);
      return renderer.buildPartialConfig(block);
    }).filter(Boolean);

    return mergePartials(partials);
  }

  function mergePartials(partials) {
    const questionIds = [];
    const getSelectedAnswerMap = {};
    const setAnswerValueMap = {};
    const getCorrectAnswerMap = {};
    const getAlternateAnswerMap = {};
    const isCorrectMatchMap = {};
    const clearFns = [];

    partials.forEach(p => {
      p.questionIds.forEach(id => {
        questionIds.push(id);
        getSelectedAnswerMap[id] = p.getSelectedAnswer;
        setAnswerValueMap[id] = p.setAnswerValue;
        getCorrectAnswerMap[id] = p.getCorrectAnswer;
        getAlternateAnswerMap[id] = p.getAlternateAnswer;
        if (p.isCorrectMatch) isCorrectMatchMap[id] = p.isCorrectMatch;
      });
      clearFns.push(p.clearAllAnswers);
    });

    return {
      questionIds,
      getSelectedAnswer(qId) { return getSelectedAnswerMap[qId](qId); },
      setAnswerValue(qId, value) { setAnswerValueMap[qId](qId, value); },
      getCorrectAnswer(qId) { return getCorrectAnswerMap[qId](qId); },
      getAlternateAnswer(qId) { return getAlternateAnswerMap[qId](qId); },
      isCorrectMatch(qId, userVal) {
        if (isCorrectMatchMap[qId]) return isCorrectMatchMap[qId](qId, userVal);
        return userVal === getCorrectAnswerMap[qId](qId);
      },
      clearAllAnswers() { clearFns.forEach(fn => fn()); },
    };
  }

  return { renderAll };
})();
