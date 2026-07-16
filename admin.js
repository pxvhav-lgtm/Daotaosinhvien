/*
 * =========================================================
 * TRANG QUẢN TRỊ HỆ THỐNG ĐÀO TẠO
 * =========================================================
 *
 * File này phải được tải sau:
 * - app.js
 * - video-gate.js
 * - dashboard-v2.js
 */

const renderStudentDashboard =
  window.renderDashboard;

let adminLessons = [];
let selectedAdminLessonId = null;
let editingQuestionId = null;

/* =========================================================
   ĐIỀU HƯỚNG THEO ROLE
========================================================= */

window.renderDashboard = async function (user) {
  renderLoading('Đang kiểm tra quyền truy cập...');

  const { data: profile, error } =
    await supabaseClient
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        role
      `)
      .eq('id', user.id)
      .single();

  if (error) {
    console.error(
      'Lỗi kiểm tra quyền:',
      error
    );

    renderMessage(
      'Không thể kiểm tra quyền tài khoản.'
    );

    return;
  }

  if (profile.role === 'admin') {
    await renderAdminDashboard(
      user,
      profile
    );

    return;
  }

  await renderStudentDashboard(user);
};

/* =========================================================
   DASHBOARD QUẢN TRỊ
========================================================= */

async function renderAdminDashboard(
  user,
  profile
) {
  clearQuizTimer();

  if (
    typeof clearLessonVideoCountdown ===
    'function'
  ) {
    clearLessonVideoCountdown();
  }

  renderLoading(
    'Đang tải dữ liệu quản trị...'
  );

  const { data: lessons, error } =
    await supabaseClient
      .from('lessons')
      .select(`
        id,
        course_id,
        title,
        description,
        content,
        video_url,
        pdf_url,
        image_url,
        order_number,
        passing_score,
        minimum_watch_seconds,
        is_published,
        quizzes (
          id,
          title,
          passing_score,
          time_limit_minutes,
          max_attempts,
          is_published
        )
      `)
      .eq('course_id', 1)
      .order(
        'order_number',
        { ascending: true }
      );

  if (error) {
    console.error(
      'Lỗi tải dữ liệu quản trị:',
      error
    );

    renderMessage(
      'Không tải được danh sách bài học.'
    );

    return;
  }

  adminLessons =
    (lessons || []).map((lesson) => ({
      ...lesson,

      quiz:
        Array.isArray(lesson.quizzes)
          ? lesson.quizzes[0] || null
          : lesson.quizzes || null,
    }));

  app.innerHTML = `
    ${renderAdminHeader(profile)}

    <main class="admin-page">
      <section class="admin-summary-grid">
        ${renderAdminSummaryCards()}
      </section>

      <section class="admin-workspace">
        <aside class="admin-sidebar">
          <div class="admin-sidebar-heading">
            <div>
              <p class="admin-section-label">
                CHƯƠNG TRÌNH ĐÀO TẠO
              </p>

              <h2>23 bài học</h2>
            </div>

            <button
              id="admin-refresh-button"
              class="admin-icon-button"
              type="button"
              title="Tải lại dữ liệu"
            >
              ↻
            </button>
          </div>

          <div class="admin-lesson-list">
            ${adminLessons
              .map(renderAdminLessonItem)
              .join('')}
          </div>
        </aside>

        <section
          id="admin-content"
          class="admin-content"
        >
          <div class="admin-empty-state">
            <div class="admin-empty-icon">
              ⚙
            </div>

            <h2>Chọn một bài học</h2>

            <p>
              Chọn bài học bên trái để nhập video,
              PDF và câu hỏi kiểm tra.
            </p>
          </div>
        </section>
      </section>
    </main>
  `;

  document
    .querySelector('#logout-button')
    .addEventListener(
      'click',
      handleLogout
    );

  document
    .querySelector(
      '#admin-refresh-button'
    )
    .addEventListener(
      'click',
      async () => {
        await renderAdminDashboard(
          user,
          profile
        );
      }
    );

  document
    .querySelectorAll(
      '.admin-lesson-item'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        async () => {
          const lessonId =
            Number(
              button.dataset.lessonId
            );

          await selectAdminLesson(
            lessonId
          );
        }
      );
    });

  if (selectedAdminLessonId) {
    const stillExists =
      adminLessons.some(
        (lesson) =>
          Number(lesson.id) ===
          Number(selectedAdminLessonId)
      );

    if (stillExists) {
      await selectAdminLesson(
        selectedAdminLessonId
      );
    }
  }
}

function renderAdminHeader(profile) {
  return `
    <header class="admin-header">
      <div class="admin-brand">
        <img
          class="admin-logo"
          src="./Logo.png"
          alt="Logo Công ty Cổ phần Thủy điện A Vương"
        >

        <div>
          <p class="admin-brand-label">
            NHÀ MÁY THỦY ĐIỆN A VƯƠNG
          </p>

          <h1>Quản trị chương trình đào tạo</h1>
        </div>
      </div>

      <div class="admin-account">
        <div>
          <span>Đăng nhập với quyền</span>

          <strong>
            ${escapeHtml(
              profile.full_name ||
              'Quản trị viên'
            )}
          </strong>
        </div>

        <button
          id="logout-button"
          class="secondary-button"
          type="button"
        >
          Đăng xuất
        </button>
      </div>
    </header>
  `;
}

/* =========================================================
   THỐNG KÊ
========================================================= */

function renderAdminSummaryCards() {
  const totalLessons =
    adminLessons.length;

  const videoCount =
    adminLessons.filter(
      (lesson) =>
        Boolean(lesson.video_url)
    ).length;

  const pdfCount =
    adminLessons.filter(
      (lesson) =>
        Boolean(lesson.pdf_url)
    ).length;

  const publishedQuizCount =
    adminLessons.filter(
      (lesson) =>
        lesson.quiz?.is_published
    ).length;

  return `
    <article class="admin-summary-card">
      <span>Tổng số bài học</span>
      <strong>${totalLessons}</strong>
      <p>Lộ trình đào tạo hiện tại</p>
    </article>

    <article class="admin-summary-card">
      <span>Đã có video</span>
      <strong>${videoCount}</strong>
      <p>${totalLessons - videoCount} bài chưa có video</p>
    </article>

    <article class="admin-summary-card">
      <span>Đã có PDF</span>
      <strong>${pdfCount}</strong>
      <p>${totalLessons - pdfCount} bài chưa có tài liệu</p>
    </article>

    <article class="admin-summary-card">
      <span>Quiz đã xuất bản</span>
      <strong>${publishedQuizCount}</strong>
      <p>
        ${totalLessons - publishedQuizCount}
        quiz đang là bản nháp
      </p>
    </article>
  `;
}

/* =========================================================
   DANH SÁCH BÀI HỌC
========================================================= */

function renderAdminLessonItem(lesson) {
  const hasVideo =
    Boolean(lesson.video_url);

  const hasPdf =
    Boolean(lesson.pdf_url);

  const quizPublished =
    Boolean(
      lesson.quiz?.is_published
    );

  const isSelected =
    Number(selectedAdminLessonId) ===
    Number(lesson.id);

  return `
    <button
      class="
        admin-lesson-item
        ${isSelected ? 'selected' : ''}
      "
      type="button"
      data-lesson-id="${lesson.id}"
    >
      <span class="admin-lesson-number">
        ${escapeHtml(
          lesson.order_number
        )}
      </span>

      <span class="admin-lesson-item-content">
        <strong>
          ${escapeHtml(
            stripLessonPrefix(
              lesson.title
            )
          )}
        </strong>

        <span class="admin-resource-indicators">
          <span
            class="
              admin-resource-dot
              ${hasVideo ? 'ready' : ''}
            "
          >
            Video
          </span>

          <span
            class="
              admin-resource-dot
              ${hasPdf ? 'ready' : ''}
            "
          >
            PDF
          </span>

          <span
            class="
              admin-resource-dot
              ${quizPublished ? 'ready' : ''}
            "
          >
            Quiz
          </span>
        </span>
      </span>
    </button>
  `;
}

/* =========================================================
   CHỌN BÀI HỌC
========================================================= */

async function selectAdminLesson(
  lessonId
) {
  selectedAdminLessonId = lessonId;
  editingQuestionId = null;

  document
    .querySelectorAll(
      '.admin-lesson-item'
    )
    .forEach((item) => {
      item.classList.toggle(
        'selected',
        Number(item.dataset.lessonId) ===
          Number(lessonId)
      );
    });

  const lesson =
    adminLessons.find(
      (item) =>
        Number(item.id) ===
        Number(lessonId)
    );

  if (!lesson) {
    return;
  }

  const content =
    document.querySelector(
      '#admin-content'
    );

  content.innerHTML = `
    <div class="admin-content-loading">
      <div class="spinner"></div>
      <p>Đang tải nội dung bài học...</p>
    </div>
  `;

  const quiz =
    await ensureAdminQuiz(lesson);

  if (!quiz) {
    return;
  }

  const questions =
    await loadAdminQuestions(
      quiz.id
    );

  renderAdminLessonEditor(
    lesson,
    quiz,
    questions
  );
}

/* =========================================================
   TẠO QUIZ NẾU CHƯA CÓ
========================================================= */

async function ensureAdminQuiz(lesson) {
  if (lesson.quiz) {
    return lesson.quiz;
  }

  const { data, error } =
    await supabaseClient
      .from('quizzes')
      .insert({
        lesson_id: lesson.id,

        title:
          `Bài kiểm tra: ${stripLessonPrefix(
            lesson.title
          )}`,

        passing_score: 70,
        time_limit_minutes: 15,
        max_attempts: 3,
        is_published: false,
      })
      .select(`
        id,
        title,
        passing_score,
        time_limit_minutes,
        max_attempts,
        is_published
      `)
      .single();

  if (error) {
    console.error(
      'Lỗi tạo quiz:',
      error
    );

    showAdminToast(
      'Không thể tạo bài kiểm tra.',
      'error'
    );

    return null;
  }

  lesson.quiz = data;

  return data;
}

/* =========================================================
   TẢI CÂU HỎI
========================================================= */

async function loadAdminQuestions(
  quizId
) {
  const { data, error } =
    await supabaseClient
      .from('questions')
      .select(`
        id,
        quiz_id,
        question_text,
        order_number,
        score,
        explanation,
        answer_options (
          id,
          option_text,
          is_correct,
          order_number
        )
      `)
      .eq('quiz_id', quizId)
      .order(
        'order_number',
        { ascending: true }
      );

  if (error) {
    console.error(
      'Lỗi tải câu hỏi:',
      error
    );

    showAdminToast(
      'Không tải được danh sách câu hỏi.',
      'error'
    );

    return [];
  }

  return (data || []).map(
    (question) => ({
      ...question,

      answer_options:
        (question.answer_options || [])
          .sort(
            (a, b) =>
              a.order_number -
              b.order_number
          ),
    })
  );
}

/* =========================================================
   TRÌNH CHỈNH SỬA BÀI HỌC
========================================================= */

function renderAdminLessonEditor(
  lesson,
  quiz,
  questions
) {
  const content =
    document.querySelector(
      '#admin-content'
    );

  content.innerHTML = `
    <div class="admin-editor-heading">
      <div>
        <p class="admin-section-label">
          BÀI ${escapeHtml(
            lesson.order_number
          )}
        </p>

        <h2>
          ${escapeHtml(
            stripLessonPrefix(
              lesson.title
            )
          )}
        </h2>
      </div>

      <a
        class="admin-preview-link"
        href="#"
        id="admin-preview-button"
      >
        Xem giao diện sinh viên
      </a>
    </div>

    <nav class="admin-tabs">
      <button
        class="admin-tab active"
        type="button"
        data-tab="lesson"
      >
        Nội dung bài học
      </button>

      <button
        class="admin-tab"
        type="button"
        data-tab="quiz"
      >
        Cấu hình kiểm tra
      </button>

      <button
        class="admin-tab"
        type="button"
        data-tab="questions"
      >
        Câu hỏi (${questions.length})
      </button>
    </nav>

    <section
      id="admin-tab-lesson"
      class="admin-tab-panel active"
    >
      ${renderLessonSettingsForm(
        lesson
      )}
    </section>

    <section
      id="admin-tab-quiz"
      class="admin-tab-panel"
    >
      ${renderQuizSettingsForm(
        quiz,
        questions
      )}
    </section>

    <section
      id="admin-tab-questions"
      class="admin-tab-panel"
    >
      ${renderQuestionManagement(
        quiz,
        questions
      )}
    </section>
  `;

  attachAdminTabEvents();

  attachLessonSettingsEvents(
    lesson
  );

  attachQuizSettingsEvents(
    lesson,
    quiz
  );

  attachQuestionManagementEvents(
    lesson,
    quiz,
    questions
  );

  document
    .querySelector(
      '#admin-preview-button'
    )
    .addEventListener(
      'click',
      (event) => {
        event.preventDefault();

        showAdminToast(
          'Hãy đăng nhập bằng tài khoản sinh viên để kiểm tra giao diện học tập.',
          'info'
        );
      }
    );
}

/* =========================================================
   FORM NỘI DUNG BÀI HỌC
========================================================= */

function renderLessonSettingsForm(
  lesson
) {
  return `
    <form
      id="admin-lesson-form"
      class="admin-form"
    >
      <div class="admin-form-grid">
        <div class="admin-field admin-field-full">
          <label for="admin-lesson-title">
            Tiêu đề bài học
          </label>

          <input
            id="admin-lesson-title"
            type="text"
            value="${escapeAttribute(
              lesson.title
            )}"
            required
          >
        </div>

        <div class="admin-field admin-field-full">
          <label for="admin-lesson-description">
            Mô tả ngắn
          </label>

          <textarea
            id="admin-lesson-description"
            rows="3"
          >${escapeHtml(
            lesson.description || ''
          )}</textarea>
        </div>

        <div class="admin-field admin-field-full">
          <label for="admin-video-url">
            Link video Google Drive
          </label>

          <input
            id="admin-video-url"
            type="url"
            value="${escapeAttribute(
              lesson.video_url || ''
            )}"
            placeholder="https://drive.google.com/file/d/.../preview"
          >

          <small>
            Có thể dán link chia sẻ dạng
            /view, hệ thống sẽ tự chuyển sang /preview.
          </small>
        </div>

        <div class="admin-field">
          <label for="admin-minimum-watch">
            Thời gian xem tối thiểu
          </label>

          <div class="admin-input-suffix">
            <input
              id="admin-minimum-watch"
              type="number"
              min="0"
              value="${escapeAttribute(
                lesson.minimum_watch_seconds ||
                0
              )}"
            >

            <span>giây</span>
          </div>
        </div>

        <div class="admin-field">
          <label for="admin-lesson-passing-score">
            Điểm đạt mặc định
          </label>

          <div class="admin-input-suffix">
            <input
              id="admin-lesson-passing-score"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value="${escapeAttribute(
                lesson.passing_score || 70
              )}"
            >

            <span>/100</span>
          </div>
        </div>

        <div class="admin-field admin-field-full">
          <label for="admin-pdf-url">
            Link tài liệu PDF Google Drive
          </label>

          <input
            id="admin-pdf-url"
            type="url"
            value="${escapeAttribute(
              lesson.pdf_url || ''
            )}"
            placeholder="https://drive.google.com/file/d/.../preview"
          >
        </div>

        <div class="admin-field admin-field-full">
          <label for="admin-lesson-content">
            Nội dung văn bản
          </label>

          <textarea
            id="admin-lesson-content"
            rows="7"
            placeholder="Nhập nội dung tóm tắt hoặc hướng dẫn học tập..."
          >${escapeHtml(
            lesson.content || ''
          )}</textarea>
        </div>

        <div class="admin-field admin-field-full">
          <label class="admin-checkbox">
            <input
              id="admin-lesson-published"
              type="checkbox"
              ${
                lesson.is_published
                  ? 'checked'
                  : ''
              }
            >

            <span>
              Xuất bản bài học cho sinh viên
            </span>
          </label>
        </div>
      </div>

      <div class="admin-form-actions">
        <p
          id="admin-lesson-message"
          class="admin-form-message"
        ></p>

        <button
          id="admin-save-lesson-button"
          class="primary-button"
          type="submit"
        >
          Lưu nội dung bài học
        </button>
      </div>
    </form>
  `;
}

function attachLessonSettingsEvents(
  lesson
) {
  document
    .querySelector(
      '#admin-lesson-form'
    )
    .addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        const button =
          document.querySelector(
            '#admin-save-lesson-button'
          );

        const message =
          document.querySelector(
            '#admin-lesson-message'
          );

        button.disabled = true;
        button.textContent =
          'Đang lưu...';

        message.textContent = '';

        const videoUrl =
          normalizeGoogleDriveUrl(
            document
              .querySelector(
                '#admin-video-url'
              )
              .value
          );

        const pdfUrl =
          normalizeGoogleDriveUrl(
            document
              .querySelector(
                '#admin-pdf-url'
              )
              .value
          );

        const updates = {
          title:
            document
              .querySelector(
                '#admin-lesson-title'
              )
              .value
              .trim(),

          description:
            emptyToNull(
              document
                .querySelector(
                  '#admin-lesson-description'
                )
                .value
            ),

          content:
            emptyToNull(
              document
                .querySelector(
                  '#admin-lesson-content'
                )
                .value
            ),

          video_url:
            emptyToNull(videoUrl),

          pdf_url:
            emptyToNull(pdfUrl),

          minimum_watch_seconds:
            Number(
              document
                .querySelector(
                  '#admin-minimum-watch'
                )
                .value
            ) || 0,

          passing_score:
            Number(
              document
                .querySelector(
                  '#admin-lesson-passing-score'
                )
                .value
            ) || 70,

          is_published:
            document
              .querySelector(
                '#admin-lesson-published'
              )
              .checked,

          updated_at:
            new Date().toISOString(),
        };

        const { data, error } =
          await supabaseClient
            .from('lessons')
            .update(updates)
            .eq('id', lesson.id)
            .select()
            .single();

        if (error) {
          console.error(
            'Lỗi cập nhật bài học:',
            error
          );

          message.textContent =
            'Không thể lưu bài học.';

          button.disabled = false;
          button.textContent =
            'Lưu nội dung bài học';

          return;
        }

        Object.assign(
          lesson,
          data
        );

        message.textContent =
          'Đã lưu nội dung bài học.';

        message.classList.add(
          'success'
        );

        button.disabled = false;
        button.textContent =
          'Lưu nội dung bài học';

        showAdminToast(
          'Đã cập nhật bài học.',
          'success'
        );

        refreshAdminLessonSidebarItem(
          lesson
        );
      }
    );
}

/* =========================================================
   FORM CẤU HÌNH QUIZ
========================================================= */

function renderQuizSettingsForm(
  quiz,
  questions
) {
  return `
    <form
      id="admin-quiz-form"
      class="admin-form"
    >
      <div class="admin-form-grid">
        <div class="admin-field admin-field-full">
          <label for="admin-quiz-title">
            Tên bài kiểm tra
          </label>

          <input
            id="admin-quiz-title"
            type="text"
            value="${escapeAttribute(
              quiz.title
            )}"
            required
          >
        </div>

        <div class="admin-field">
          <label for="admin-quiz-passing-score">
            Điểm đạt
          </label>

          <div class="admin-input-suffix">
            <input
              id="admin-quiz-passing-score"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value="${escapeAttribute(
                quiz.passing_score
              )}"
              required
            >

            <span>/100</span>
          </div>
        </div>

        <div class="admin-field">
          <label for="admin-quiz-time-limit">
            Thời gian làm bài
          </label>

          <div class="admin-input-suffix">
            <input
              id="admin-quiz-time-limit"
              type="number"
              min="1"
              value="${escapeAttribute(
                quiz.time_limit_minutes
              )}"
              required
            >

            <span>phút</span>
          </div>
        </div>

        <div class="admin-field">
          <label for="admin-quiz-attempts">
            Số lần làm tối đa
          </label>

          <input
            id="admin-quiz-attempts"
            type="number"
            min="1"
            value="${escapeAttribute(
              quiz.max_attempts
            )}"
            required
          >
        </div>

        <div class="admin-field">
          <label>
            Số câu hỏi hiện có
          </label>

          <div class="admin-readonly-value">
            ${questions.length} câu
          </div>
        </div>

        <div class="admin-field admin-field-full">
          <label class="admin-checkbox">
            <input
              id="admin-quiz-published"
              type="checkbox"
              ${
                quiz.is_published
                  ? 'checked'
                  : ''
              }
            >

            <span>
              Xuất bản bài kiểm tra
            </span>
          </label>

          <small>
            Chỉ xuất bản khi mỗi câu có ít nhất
            hai phương án và đúng một đáp án đúng.
          </small>
        </div>
      </div>

      <div class="admin-quiz-validation">
        ${renderQuizValidationSummary(
          questions
        )}
      </div>

      <div class="admin-form-actions">
        <p
          id="admin-quiz-message"
          class="admin-form-message"
        ></p>

        <button
          id="admin-save-quiz-button"
          class="primary-button"
          type="submit"
        >
          Lưu cấu hình kiểm tra
        </button>
      </div>
    </form>
  `;
}

function renderQuizValidationSummary(
  questions
) {
  const invalidQuestions =
    questions.filter((question) => {
      const options =
        question.answer_options || [];

      const correctCount =
        options.filter(
          (option) =>
            option.is_correct
        ).length;

      return (
        options.length < 2 ||
        correctCount !== 1
      );
    });

  if (questions.length === 0) {
    return `
      <div class="admin-validation-warning">
        Bài kiểm tra chưa có câu hỏi.
      </div>
    `;
  }

  if (invalidQuestions.length > 0) {
    return `
      <div class="admin-validation-warning">
        Có ${invalidQuestions.length}
        câu hỏi chưa hợp lệ.
      </div>
    `;
  }

  return `
    <div class="admin-validation-success">
      Bài kiểm tra đã đủ điều kiện xuất bản.
    </div>
  `;
}

function attachQuizSettingsEvents(
  lesson,
  quiz
) {
  document
    .querySelector(
      '#admin-quiz-form'
    )
    .addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        const button =
          document.querySelector(
            '#admin-save-quiz-button'
          );

        const message =
          document.querySelector(
            '#admin-quiz-message'
          );

        const shouldPublish =
          document
            .querySelector(
              '#admin-quiz-published'
            )
            .checked;

        button.disabled = true;
        button.textContent =
          'Đang lưu...';

        message.textContent = '';

        if (shouldPublish) {
          const validation =
            await validateQuizForPublish(
              quiz.id
            );

          if (!validation.valid) {
            message.textContent =
              validation.message;

            button.disabled = false;
            button.textContent =
              'Lưu cấu hình kiểm tra';

            return;
          }
        }

        const updates = {
          title:
            document
              .querySelector(
                '#admin-quiz-title'
              )
              .value
              .trim(),

          passing_score:
            Number(
              document
                .querySelector(
                  '#admin-quiz-passing-score'
                )
                .value
            ),

          time_limit_minutes:
            Number(
              document
                .querySelector(
                  '#admin-quiz-time-limit'
                )
                .value
            ),

          max_attempts:
            Number(
              document
                .querySelector(
                  '#admin-quiz-attempts'
                )
                .value
            ),

          is_published:
            shouldPublish,
        };

        const { data, error } =
          await supabaseClient
            .from('quizzes')
            .update(updates)
            .eq('id', quiz.id)
            .select()
            .single();

        if (error) {
          console.error(
            'Lỗi cập nhật quiz:',
            error
          );

          message.textContent =
            'Không thể lưu cấu hình bài kiểm tra.';

          button.disabled = false;
          button.textContent =
            'Lưu cấu hình kiểm tra';

          return;
        }

        Object.assign(
          quiz,
          data
        );

        lesson.quiz = quiz;

        message.textContent =
          'Đã lưu cấu hình bài kiểm tra.';

        message.classList.add(
          'success'
        );

        button.disabled = false;
        button.textContent =
          'Lưu cấu hình kiểm tra';

        refreshAdminLessonSidebarItem(
          lesson
        );

        showAdminToast(
          'Đã cập nhật bài kiểm tra.',
          'success'
        );
      }
    );
}

/* =========================================================
   KIỂM TRA ĐIỀU KIỆN XUẤT BẢN
========================================================= */

async function validateQuizForPublish(
  quizId
) {
  const questions =
    await loadAdminQuestions(
      quizId
    );

  if (questions.length === 0) {
    return {
      valid: false,
      message:
        'Bài kiểm tra phải có ít nhất một câu hỏi.',
    };
  }

  for (const question of questions) {
    const options =
      question.answer_options || [];

    if (options.length < 2) {
      return {
        valid: false,
        message:
          `Câu ${question.order_number} phải có ít nhất hai phương án.`,
      };
    }

    const correctCount =
      options.filter(
        (option) =>
          option.is_correct
      ).length;

    if (correctCount !== 1) {
      return {
        valid: false,
        message:
          `Câu ${question.order_number} phải có đúng một đáp án đúng.`,
      };
    }
  }

  return {
    valid: true,
    message: '',
  };
}

/* =========================================================
   QUẢN LÝ CÂU HỎI
========================================================= */

function renderQuestionManagement(
  quiz,
  questions
) {
  return `
    <div class="admin-question-layout">
      <section class="admin-question-list-panel">
        <div class="admin-question-panel-heading">
          <div>
            <h3>Danh sách câu hỏi</h3>

            <p>
              ${questions.length}
              câu hỏi hiện có
            </p>
          </div>

          <button
            id="admin-new-question-button"
            class="secondary-button"
            type="button"
          >
            + Thêm câu hỏi
          </button>
        </div>

        <div
          id="admin-question-list"
          class="admin-question-list"
        >
          ${
            questions.length > 0
              ? questions
                  .map(
                    renderAdminQuestionItem
                  )
                  .join('')
              : `
                <div class="admin-question-empty">
                  Chưa có câu hỏi.
                </div>
              `
          }
        </div>
      </section>

      <section class="admin-question-editor-panel">
        <div class="admin-question-editor-heading">
          <h3 id="admin-question-form-title">
            Thêm câu hỏi mới
          </h3>

          <button
            id="admin-cancel-question-button"
            class="admin-text-button"
            type="button"
            hidden
          >
            Hủy chỉnh sửa
          </button>
        </div>

        ${renderQuestionForm(
          quiz,
          questions
        )}
      </section>
    </div>
  `;
}

function renderAdminQuestionItem(
  question
) {
  const correctOption =
    question.answer_options?.find(
      (option) =>
        option.is_correct
    );

  return `
    <article
      class="admin-question-item"
      data-question-id="${question.id}"
    >
      <div class="admin-question-order">
        ${escapeHtml(
          question.order_number
        )}
      </div>

      <div class="admin-question-item-content">
        <h4>
          ${escapeHtml(
            question.question_text
          )}
        </h4>

        <p>
          Đáp án đúng:
          <strong>
            ${escapeHtml(
              correctOption?.option_text ||
              'Chưa xác định'
            )}
          </strong>
        </p>

        <span>
          ${question.answer_options?.length || 0}
          phương án ·
          ${escapeHtml(
            question.score
          )}
          điểm
        </span>
      </div>

      <div class="admin-question-actions">
        <button
          class="admin-edit-question-button"
          type="button"
          data-question-id="${question.id}"
        >
          Sửa
        </button>

        <button
          class="admin-delete-question-button"
          type="button"
          data-question-id="${question.id}"
        >
          Xóa
        </button>
      </div>
    </article>
  `;
}

function renderQuestionForm(
  quiz,
  questions
) {
  const nextOrderNumber =
    questions.length > 0
      ? Math.max(
          ...questions.map(
            (question) =>
              Number(
                question.order_number
              )
          )
        ) + 1
      : 1;

  return `
    <form
      id="admin-question-form"
      class="admin-question-form"
    >
      <div class="admin-field">
        <label for="admin-question-order">
          Thứ tự câu hỏi
        </label>

        <input
          id="admin-question-order"
          type="number"
          min="1"
          value="${nextOrderNumber}"
          required
        >
      </div>

      <div class="admin-field">
        <label for="admin-question-score">
          Điểm câu hỏi
        </label>

        <input
          id="admin-question-score"
          type="number"
          min="0.01"
          step="0.01"
          value="20"
          required
        >
      </div>

      <div class="admin-field admin-field-full">
        <label for="admin-question-text">
          Nội dung câu hỏi
        </label>

        <textarea
          id="admin-question-text"
          rows="4"
          required
        ></textarea>
      </div>

      <div class="admin-field admin-field-full">
        <label for="admin-question-explanation">
          Giải thích đáp án
        </label>

        <textarea
          id="admin-question-explanation"
          rows="3"
          placeholder="Giải thích ngắn sau khi chấm bài..."
        ></textarea>
      </div>

      <fieldset class="admin-answer-fieldset">
        <legend>
          Các phương án trả lời
        </legend>

        ${[0, 1, 2, 3]
          .map(
            (index) => `
              <div class="admin-answer-row">
                <label class="admin-correct-radio">
                  <input
                    type="radio"
                    name="admin-correct-answer"
                    value="${index}"
                    ${
                      index === 0
                        ? 'checked'
                        : ''
                    }
                  >

                  <span>
                    ${String.fromCharCode(
                      65 + index
                    )}
                  </span>
                </label>

                <input
                  class="admin-answer-input"
                  type="text"
                  data-option-index="${index}"
                  placeholder="Phương án ${String.fromCharCode(
                    65 + index
                  )}"
                  required
                >
              </div>
            `
          )
          .join('')}
      </fieldset>

      <div class="admin-form-actions">
        <p
          id="admin-question-message"
          class="admin-form-message"
        ></p>

        <button
          id="admin-save-question-button"
          class="primary-button"
          type="submit"
        >
          Thêm câu hỏi
        </button>
      </div>
    </form>
  `;
}

/* =========================================================
   SỰ KIỆN QUẢN LÝ CÂU HỎI
========================================================= */

function attachQuestionManagementEvents(
  lesson,
  quiz,
  questions
) {
  document
    .querySelector(
      '#admin-new-question-button'
    )
    .addEventListener(
      'click',
      () => {
        resetAdminQuestionForm(
          questions
        );
      }
    );

  document
    .querySelector(
      '#admin-cancel-question-button'
    )
    .addEventListener(
      'click',
      () => {
        resetAdminQuestionForm(
          questions
        );
      }
    );

  document
    .querySelectorAll(
      '.admin-edit-question-button'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const questionId =
            Number(
              button.dataset.questionId
            );

          const question =
            questions.find(
              (item) =>
                Number(item.id) ===
                questionId
            );

          if (question) {
            populateAdminQuestionForm(
              question
            );
          }
        }
      );
    });

  document
    .querySelectorAll(
      '.admin-delete-question-button'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        async () => {
          const questionId =
            Number(
              button.dataset.questionId
            );

          await deleteAdminQuestion(
            lesson,
            quiz,
            questionId
          );
        }
      );
    });

  document
    .querySelector(
      '#admin-question-form'
    )
    .addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        await saveAdminQuestion(
          lesson,
          quiz
        );
      }
    );
}

/* =========================================================
   THÊM HOẶC SỬA CÂU HỎI
========================================================= */

async function saveAdminQuestion(
  lesson,
  quiz
) {
  const button =
    document.querySelector(
      '#admin-save-question-button'
    );

  const message =
    document.querySelector(
      '#admin-question-message'
    );

  const optionInputs =
    Array.from(
      document.querySelectorAll(
        '.admin-answer-input'
      )
    );

  const options =
    optionInputs.map(
      (input, index) => ({
        option_text:
          input.value.trim(),

        order_number:
          index + 1,
      })
    );

  if (
    options.some(
      (option) =>
        !option.option_text
    )
  ) {
    message.textContent =
      'Vui lòng nhập đầy đủ bốn phương án.';

    return;
  }

  const correctIndex =
    Number(
      document.querySelector(
        'input[name="admin-correct-answer"]:checked'
      ).value
    );

  button.disabled = true;
  button.textContent =
    'Đang lưu...';

  message.textContent = '';

  const questionPayload = {
    quiz_id: quiz.id,

    question_text:
      document
        .querySelector(
          '#admin-question-text'
        )
        .value
        .trim(),

    order_number:
      Number(
        document
          .querySelector(
            '#admin-question-order'
          )
          .value
      ),

    score:
      Number(
        document
          .querySelector(
            '#admin-question-score'
          )
          .value
      ),

    explanation:
      emptyToNull(
        document
          .querySelector(
            '#admin-question-explanation'
          )
          .value
      ),
  };

  let questionId =
    editingQuestionId;

  if (editingQuestionId) {
    const { error } =
      await supabaseClient
        .from('questions')
        .update(questionPayload)
        .eq(
          'id',
          editingQuestionId
        );

    if (error) {
      handleQuestionSaveError(
        error,
        button,
        message
      );

      return;
    }

    const { error: deleteError } =
      await supabaseClient
        .from('answer_options')
        .delete()
        .eq(
          'question_id',
          editingQuestionId
        );

    if (deleteError) {
      handleQuestionSaveError(
        deleteError,
        button,
        message
      );

      return;
    }
  } else {
    const { data, error } =
      await supabaseClient
        .from('questions')
        .insert(questionPayload)
        .select('id')
        .single();

    if (error) {
      handleQuestionSaveError(
        error,
        button,
        message
      );

      return;
    }

    questionId = data.id;
  }

  const optionRows =
    options.map(
      (option, index) => ({
        question_id: questionId,

        option_text:
          option.option_text,

        order_number:
          option.order_number,

        is_correct:
          index === correctIndex,
      })
    );

  const { error: optionError } =
    await supabaseClient
      .from('answer_options')
      .insert(optionRows);

  if (optionError) {
    console.error(
      'Lỗi lưu đáp án:',
      optionError
    );

    if (!editingQuestionId) {
      await supabaseClient
        .from('questions')
        .delete()
        .eq('id', questionId);
    }

    handleQuestionSaveError(
      optionError,
      button,
      message
    );

    return;
  }

  showAdminToast(
    editingQuestionId
      ? 'Đã cập nhật câu hỏi.'
      : 'Đã thêm câu hỏi.',
    'success'
  );

  editingQuestionId = null;

  await selectAdminLesson(
    lesson.id
  );
}

function handleQuestionSaveError(
  error,
  button,
  message
) {
  console.error(
    'Lỗi lưu câu hỏi:',
    error
  );

  if (
    String(error.message).includes(
      'questions_quiz_id_order_number_key'
    )
  ) {
    message.textContent =
      'Thứ tự câu hỏi đã tồn tại.';
  } else {
    message.textContent =
      'Không thể lưu câu hỏi.';
  }

  button.disabled = false;
  button.textContent =
    editingQuestionId
      ? 'Cập nhật câu hỏi'
      : 'Thêm câu hỏi';
}

/* =========================================================
   ĐIỀN FORM KHI SỬA
========================================================= */

function populateAdminQuestionForm(
  question
) {
  editingQuestionId =
    question.id;

  document
    .querySelector(
      '#admin-question-form-title'
    )
    .textContent =
      `Sửa câu ${question.order_number}`;

  document
    .querySelector(
      '#admin-cancel-question-button'
    )
    .hidden = false;

  document
    .querySelector(
      '#admin-question-order'
    )
    .value =
      question.order_number;

  document
    .querySelector(
      '#admin-question-score'
    )
    .value =
      question.score;

  document
    .querySelector(
      '#admin-question-text'
    )
    .value =
      question.question_text;

  document
    .querySelector(
      '#admin-question-explanation'
    )
    .value =
      question.explanation || '';

  const optionInputs =
    document.querySelectorAll(
      '.admin-answer-input'
    );

  optionInputs.forEach(
    (input, index) => {
      input.value =
        question.answer_options?.[
          index
        ]?.option_text || '';
    }
  );

  const correctIndex =
    question.answer_options
      ?.findIndex(
        (option) =>
          option.is_correct
      );

  const correctRadio =
    document.querySelector(
      `input[name="admin-correct-answer"][value="${
        correctIndex >= 0
          ? correctIndex
          : 0
      }"]`
    );

  if (correctRadio) {
    correctRadio.checked = true;
  }

  document
    .querySelector(
      '#admin-save-question-button'
    )
    .textContent =
      'Cập nhật câu hỏi';

  document
    .querySelector(
      '.admin-question-editor-panel'
    )
    .scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
}

function resetAdminQuestionForm(
  questions
) {
  editingQuestionId = null;

  const form =
    document.querySelector(
      '#admin-question-form'
    );

  form.reset();

  const nextOrderNumber =
    questions.length > 0
      ? Math.max(
          ...questions.map(
            (question) =>
              Number(
                question.order_number
              )
          )
        ) + 1
      : 1;

  document
    .querySelector(
      '#admin-question-order'
    )
    .value =
      nextOrderNumber;

  document
    .querySelector(
      '#admin-question-score'
    )
    .value = 20;

  document
    .querySelector(
      'input[name="admin-correct-answer"][value="0"]'
    )
    .checked = true;

  document
    .querySelector(
      '#admin-question-form-title'
    )
    .textContent =
      'Thêm câu hỏi mới';

  document
    .querySelector(
      '#admin-cancel-question-button'
    )
    .hidden = true;

  document
    .querySelector(
      '#admin-save-question-button'
    )
    .textContent =
      'Thêm câu hỏi';

  document
    .querySelector(
      '#admin-question-message'
    )
    .textContent = '';
}

/* =========================================================
   XÓA CÂU HỎI
========================================================= */

async function deleteAdminQuestion(
  lesson,
  quiz,
  questionId
) {
  const confirmed =
    window.confirm(
      'Bạn có chắc muốn xóa câu hỏi này?'
    );

  if (!confirmed) {
    return;
  }

  const { error } =
    await supabaseClient
      .from('questions')
      .delete()
      .eq('id', questionId);

  if (error) {
    console.error(
      'Lỗi xóa câu hỏi:',
      error
    );

    showAdminToast(
      'Không thể xóa câu hỏi.',
      'error'
    );

    return;
  }

  showAdminToast(
    'Đã xóa câu hỏi.',
    'success'
  );

  await selectAdminLesson(
    lesson.id
  );
}

/* =========================================================
   TAB
========================================================= */

function attachAdminTabEvents() {
  document
    .querySelectorAll(
      '.admin-tab'
    )
    .forEach((tab) => {
      tab.addEventListener(
        'click',
        () => {
          const tabName =
            tab.dataset.tab;

          document
            .querySelectorAll(
              '.admin-tab'
            )
            .forEach((item) => {
              item.classList.toggle(
                'active',
                item === tab
              );
            });

          document
            .querySelectorAll(
              '.admin-tab-panel'
            )
            .forEach((panel) => {
              panel.classList.toggle(
                'active',
                panel.id ===
                  `admin-tab-${tabName}`
              );
            });
        }
      );
    });
}

/* =========================================================
   CẬP NHẬT SIDEBAR
========================================================= */

function refreshAdminLessonSidebarItem(
  lesson
) {
  const oldElement =
    document.querySelector(
      `.admin-lesson-item[data-lesson-id="${lesson.id}"]`
    );

  if (!oldElement) {
    return;
  }

  const wrapper =
    document.createElement('div');

  wrapper.innerHTML =
    renderAdminLessonItem(lesson);

  const newElement =
    wrapper.firstElementChild;

  newElement.addEventListener(
    'click',
    async () => {
      await selectAdminLesson(
        lesson.id
      );
    }
  );

  oldElement.replaceWith(
    newElement
  );
}

/* =========================================================
   THÔNG BÁO
========================================================= */

function showAdminToast(
  message,
  type = 'info'
) {
  document
    .querySelector(
      '#admin-toast'
    )
    ?.remove();

  const toast =
    document.createElement('div');

  toast.id = 'admin-toast';

  toast.className =
    `admin-toast ${type}`;

  toast.textContent = message;

  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('visible');
  }, 20);

  window.setTimeout(() => {
    toast.classList.remove('visible');

    window.setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3200);
}

/* =========================================================
   HÀM HỖ TRỢ
========================================================= */

function normalizeGoogleDriveUrl(
  value
) {
  const url =
    String(value || '').trim();

  if (!url) {
    return '';
  }

  const fileMatch =
    url.match(
      /\/file\/d\/([a-zA-Z0-9_-]+)/
    );

  if (fileMatch) {
    return (
      'https://drive.google.com/file/d/' +
      fileMatch[1] +
      '/preview'
    );
  }

  const idMatch =
    url.match(
      /[?&]id=([a-zA-Z0-9_-]+)/
    );

  if (idMatch) {
    return (
      'https://drive.google.com/file/d/' +
      idMatch[1] +
      '/preview'
    );
  }

  return url;
}

function emptyToNull(value) {
  const text =
    String(value || '').trim();

  return text || null;
}

function stripLessonPrefix(title) {
  return String(title || '')
    .replace(
      /^Bài\s+\d+\s*:\s*/i,
      ''
    )
    .trim();
}
