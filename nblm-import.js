/*
 * =========================================================
 * NHẬP CÂU HỎI JSON TỪ NOTEBOOKLM
 * =========================================================
 *
 * File này phải được tải sau admin.js.
 */

let nblmObserver = null;

/* =========================================================
   KHỞI ĐỘNG
========================================================= */

function startNblmImporter() {
  injectNblmImportButton();

  nblmObserver = new MutationObserver(() => {
    injectNblmImportButton();
  });

  nblmObserver.observe(
    document.querySelector('#app'),
    {
      childList: true,
      subtree: true,
    }
  );
}

/* =========================================================
   CHÈN NÚT VÀO TAB CÂU HỎI
========================================================= */

function injectNblmImportButton() {
  if (
    document.querySelector(
      '#nblm-import-button'
    )
  ) {
    return;
  }

  const heading =
    document.querySelector(
      '.admin-question-panel-heading'
    );

  if (!heading) {
    return;
  }

  const actions =
    heading.querySelector(
      '.nblm-question-heading-actions'
    );

  if (actions) {
    return;
  }

  const addQuestionButton =
    heading.querySelector(
      '#admin-new-question-button'
    );

  if (!addQuestionButton) {
    return;
  }

  const wrapper =
    document.createElement('div');

  wrapper.className =
    'nblm-question-heading-actions';

  const importButton =
    document.createElement('button');

  importButton.id =
    'nblm-import-button';

  importButton.className =
    'nblm-import-button';

  importButton.type = 'button';

  importButton.innerHTML = `
    <span class="nblm-import-icon">
      ⇧
    </span>

    Nhập JSON từ NotebookLM
  `;

  importButton.addEventListener(
    'click',
    openNblmImportModal
  );

  addQuestionButton.parentNode.insertBefore(
    wrapper,
    addQuestionButton
  );

  wrapper.appendChild(
    importButton
  );

  wrapper.appendChild(
    addQuestionButton
  );
}

/* =========================================================
   MỞ HỘP NHẬP JSON
========================================================= */

function openNblmImportModal() {
  const lesson =
    getCurrentNblmLesson();

  if (!lesson) {
    showAdminToast(
      'Không xác định được bài học đang chọn.',
      'error'
    );

    return;
  }

  if (!lesson.quiz?.id) {
    showAdminToast(
      'Bài học chưa có bài kiểm tra.',
      'error'
    );

    return;
  }

  closeNblmImportModal();

  const overlay =
    document.createElement('div');

  overlay.id =
    'nblm-import-overlay';

  overlay.className =
    'nblm-import-overlay';

  overlay.innerHTML = `
    <section
      class="nblm-import-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nblm-import-title"
    >
      <header class="nblm-import-header">
        <div>
          <p class="nblm-import-label">
            NOTEBOOKLM
          </p>

          <h2 id="nblm-import-title">
            Nhập câu hỏi bằng JSON
          </h2>

          <p>
            ${escapeHtml(
              lesson.title
            )}
          </p>
        </div>

        <button
          id="nblm-close-button"
          class="nblm-close-button"
          type="button"
          aria-label="Đóng"
        >
          ×
        </button>
      </header>

      <div class="nblm-import-body">
        <div class="nblm-instruction">
          <strong>Cách thực hiện</strong>

          <p>
            Sao chép JSON được NotebookLM tạo,
            sau đó dán toàn bộ vào ô bên dưới.
          </p>
        </div>

        <label
          class="nblm-json-label"
          for="nblm-json-input"
        >
          Nội dung JSON
        </label>

        <textarea
          id="nblm-json-input"
          class="nblm-json-input"
          rows="18"
          spellcheck="false"
          placeholder='{
  "quiz_title": "Bài kiểm tra...",
  "passing_score": 70,
  "time_limit_minutes": 15,
  "max_attempts": 3,
  "questions": [...]
}'
        ></textarea>

        <div class="nblm-option-row">
          <label class="nblm-replace-option">
            <input
              id="nblm-replace-existing"
              type="checkbox"
              checked
            >

            <span>
              Xóa câu hỏi hiện tại và thay thế
              bằng dữ liệu mới
            </span>
          </label>
        </div>

        <div
          id="nblm-validation-result"
          class="nblm-validation-result"
        >
          Chưa kiểm tra dữ liệu.
        </div>
      </div>

      <footer class="nblm-import-footer">
        <button
          id="nblm-sample-button"
          class="nblm-secondary-button"
          type="button"
        >
          Dán JSON mẫu
        </button>

        <div class="nblm-footer-actions">
          <button
            id="nblm-cancel-button"
            class="nblm-secondary-button"
            type="button"
          >
            Hủy
          </button>

          <button
            id="nblm-validate-button"
            class="nblm-secondary-button"
            type="button"
          >
            Kiểm tra JSON
          </button>

          <button
            id="nblm-submit-button"
            class="primary-button"
            type="button"
          >
            Nhập vào Supabase
          </button>
        </div>
      </footer>
    </section>
  `;

  document.body.appendChild(
    overlay
  );

  document
    .querySelector('#nblm-close-button')
    .addEventListener(
      'click',
      closeNblmImportModal
    );

  document
    .querySelector('#nblm-cancel-button')
    .addEventListener(
      'click',
      closeNblmImportModal
    );

  document
    .querySelector('#nblm-sample-button')
    .addEventListener(
      'click',
      insertNblmSampleJson
    );

  document
    .querySelector('#nblm-validate-button')
    .addEventListener(
      'click',
      validateNblmInput
    );

  document
    .querySelector('#nblm-submit-button')
    .addEventListener(
      'click',
      () => importNblmJson(lesson)
    );

  overlay.addEventListener(
    'click',
    (event) => {
      if (event.target === overlay) {
        closeNblmImportModal();
      }
    }
  );

  document.addEventListener(
    'keydown',
    handleNblmEscape
  );

  document
    .querySelector('#nblm-json-input')
    .focus();
}

function closeNblmImportModal() {
  document
    .querySelector(
      '#nblm-import-overlay'
    )
    ?.remove();

  document.removeEventListener(
    'keydown',
    handleNblmEscape
  );
}

function handleNblmEscape(event) {
  if (event.key === 'Escape') {
    closeNblmImportModal();
  }
}

/* =========================================================
   JSON MẪU
========================================================= */

function insertNblmSampleJson() {
  const lesson =
    getCurrentNblmLesson();

  const sample = {
    quiz_title:
      `Bài kiểm tra: ${
        lesson
          ? stripLessonPrefix(
              lesson.title
            )
          : 'Tên bài học'
      }`,

    passing_score: 70,
    time_limit_minutes: 15,
    max_attempts: 3,

    questions: [
      {
        order_number: 1,

        question_text:
          'Nội dung câu hỏi thứ nhất',

        score: 20,

        explanation:
          'Giải thích ngắn cho đáp án đúng.',

        options: [
          {
            option_text:
              'Phương án thứ nhất',

            is_correct: false,
          },
          {
            option_text:
              'Phương án thứ hai',

            is_correct: true,
          },
          {
            option_text:
              'Phương án thứ ba',

            is_correct: false,
          },
          {
            option_text:
              'Phương án thứ tư',

            is_correct: false,
          },
        ],
      },
    ],
  };

  document
    .querySelector('#nblm-json-input')
    .value =
      JSON.stringify(
        sample,
        null,
        2
      );

  validateNblmInput();
}

/* =========================================================
   ĐỌC VÀ LÀM SẠCH JSON
========================================================= */

function parseNblmJsonInput() {
  const textarea =
    document.querySelector(
      '#nblm-json-input'
    );

  let text =
    String(
      textarea?.value || ''
    ).trim();

  if (!text) {
    throw new Error(
      'Bạn chưa dán nội dung JSON.'
    );
  }

  /*
   * NotebookLM đôi khi bọc JSON trong:
   * ```json
   * ...
   * ```
   */
  text = text
    .replace(
      /^```json\s*/i,
      ''
    )
    .replace(
      /^```\s*/i,
      ''
    )
    .replace(
      /\s*```$/,
      ''
    )
    .trim();

  return JSON.parse(text);
}

/* =========================================================
   KIỂM TRA JSON
========================================================= */

function validateNblmPayload(payload) {
  const errors = [];

  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    errors.push(
      'JSON phải là một object.'
    );

    return {
      valid: false,
      errors,
      questionsCount: 0,
      optionsCount: 0,
    };
  }

  if (
    !Array.isArray(
      payload.questions
    )
  ) {
    errors.push(
      'Thiếu mảng questions.'
    );

    return {
      valid: false,
      errors,
      questionsCount: 0,
      optionsCount: 0,
    };
  }

  if (
    payload.questions.length === 0
  ) {
    errors.push(
      'Phải có ít nhất một câu hỏi.'
    );
  }

  let optionsCount = 0;

  payload.questions.forEach(
    (question, questionIndex) => {
      const number =
        questionIndex + 1;

      if (
        !String(
          question.question_text || ''
        ).trim()
      ) {
        errors.push(
          `Câu ${number} chưa có nội dung.`
        );
      }

      if (
        !Array.isArray(
          question.options
        )
      ) {
        errors.push(
          `Câu ${number} chưa có mảng options.`
        );

        return;
      }

      if (
        question.options.length !== 4
      ) {
        errors.push(
          `Câu ${number} phải có đúng 4 phương án.`
        );
      }

      optionsCount +=
        question.options.length;

      const correctOptions =
        question.options.filter(
          (option) =>
            option.is_correct === true
        );

      if (
        correctOptions.length !== 1
      ) {
        errors.push(
          `Câu ${number} phải có đúng một đáp án đúng.`
        );
      }

      question.options.forEach(
        (option, optionIndex) => {
          if (
            !String(
              option.option_text || ''
            ).trim()
          ) {
            errors.push(
              `Phương án ${
                optionIndex + 1
              } của câu ${number} đang để trống.`
            );
          }
        }
      );
    }
  );

  return {
    valid:
      errors.length === 0,

    errors,

    questionsCount:
      payload.questions.length,

    optionsCount,
  };
}

function validateNblmInput() {
  const resultElement =
    document.querySelector(
      '#nblm-validation-result'
    );

  try {
    const payload =
      parseNblmJsonInput();

    const result =
      validateNblmPayload(
        payload
      );

    if (!result.valid) {
      resultElement.className =
        'nblm-validation-result error';

      resultElement.innerHTML = `
        <strong>
          JSON chưa hợp lệ
        </strong>

        <ul>
          ${result.errors
            .slice(0, 12)
            .map(
              (error) =>
                `<li>${escapeHtml(error)}</li>`
            )
            .join('')}
        </ul>
      `;

      return false;
    }

    resultElement.className =
      'nblm-validation-result success';

    resultElement.innerHTML = `
      <strong>
        JSON hợp lệ
      </strong>

      <p>
        ${result.questionsCount}
        câu hỏi ·
        ${result.optionsCount}
        phương án trả lời.
      </p>
    `;

    return true;
  } catch (error) {
    resultElement.className =
      'nblm-validation-result error';

    resultElement.innerHTML = `
      <strong>
        Không đọc được JSON
      </strong>

      <p>
        ${escapeHtml(
          error.message
        )}
      </p>
    `;

    return false;
  }
}

/* =========================================================
   NHẬP VÀO SUPABASE
========================================================= */

async function importNblmJson(
  lesson
) {
  const submitButton =
    document.querySelector(
      '#nblm-submit-button'
    );

  const resultElement =
    document.querySelector(
      '#nblm-validation-result'
    );

  let payload;

  try {
    payload =
      parseNblmJsonInput();
  } catch (error) {
    validateNblmInput();
    return;
  }

  const validation =
    validateNblmPayload(
      payload
    );

  if (!validation.valid) {
    validateNblmInput();
    return;
  }

  const replaceExisting =
    document
      .querySelector(
        '#nblm-replace-existing'
      )
      .checked;

  if (
    replaceExisting &&
    !window.confirm(
      'Toàn bộ câu hỏi hiện tại của bài kiểm tra sẽ bị xóa và thay thế. Bạn có chắc muốn tiếp tục?'
    )
  ) {
    return;
  }

  submitButton.disabled = true;

  submitButton.textContent =
    'Đang nhập dữ liệu...';

  resultElement.className =
    'nblm-validation-result loading';

  resultElement.textContent =
    'Supabase đang kiểm tra và nhập câu hỏi...';

  const { data, error } =
    await supabaseClient.rpc(
      'admin_import_quiz_json',
      {
        p_quiz_id:
          Number(lesson.quiz.id),

        p_payload:
          payload,

        p_replace_existing:
          replaceExisting,
      }
    );

  if (error) {
    console.error(
      'Lỗi nhập JSON NotebookLM:',
      error
    );

    resultElement.className =
      'nblm-validation-result error';

    resultElement.innerHTML = `
      <strong>
        Không thể nhập dữ liệu
      </strong>

      <p>
        ${escapeHtml(
          getNblmFriendlyError(
            error
          )
        )}
      </p>
    `;

    submitButton.disabled = false;

    submitButton.textContent =
      'Nhập vào Supabase';

    return;
  }

  resultElement.className =
    'nblm-validation-result success';

  resultElement.innerHTML = `
    <strong>
      Nhập dữ liệu thành công
    </strong>

    <p>
      ${escapeHtml(
        data.questions_imported
      )}
      câu hỏi và
      ${escapeHtml(
        data.options_imported
      )}
      phương án đã được thêm.
    </p>

    <p>
      Quiz đã chuyển về trạng thái bản nháp.
    </p>
  `;

  showAdminToast(
    `Đã nhập ${data.questions_imported} câu hỏi từ NotebookLM.`,
    'success'
  );

  await new Promise(
    (resolve) =>
      window.setTimeout(
        resolve,
        900
      )
  );

  closeNblmImportModal();

  await selectAdminLesson(
    lesson.id
  );

  const questionTab =
    document.querySelector(
      '.admin-tab[data-tab="questions"]'
    );

  questionTab?.click();
}

/* =========================================================
   HÀM HỖ TRỢ
========================================================= */

function getCurrentNblmLesson() {
  if (
    typeof selectedAdminLessonId ===
      'undefined' ||
    typeof adminLessons ===
      'undefined'
  ) {
    return null;
  }

  return adminLessons.find(
    (lesson) =>
      Number(lesson.id) ===
      Number(
        selectedAdminLessonId
      )
  ) || null;
}

function getNblmFriendlyError(
  error
) {
  const message =
    String(
      error?.message || ''
    );

  const knownMessages = [
    'Bạn chưa đăng nhập.',
    'Bạn không có quyền quản trị.',
    'Không tìm thấy bài kiểm tra.',
    'Dữ liệu JSON không hợp lệ.',
    'JSON phải có mảng questions.',
    'Bài kiểm tra phải có ít nhất một câu hỏi.',
  ];

  const known =
    knownMessages.find(
      (item) =>
        message.includes(item)
    );

  if (known) {
    return known;
  }

  if (
    message.includes(
      'phải có đúng 4 phương án'
    ) ||
    message.includes(
      'phải có đúng một đáp án đúng'
    ) ||
    message.includes(
      'đang để trống'
    )
  ) {
    return message;
  }

  if (
    message.includes(
      'duplicate key'
    )
  ) {
    return 'Thứ tự câu hỏi đã tồn tại. Hãy chọn chế độ thay thế câu hỏi hiện tại.';
  }

  return (
    'Đã xảy ra lỗi khi nhập dữ liệu. ' +
    message
  );
}

startNblmImporter();
