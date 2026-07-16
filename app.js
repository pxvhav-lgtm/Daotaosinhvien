const SUPABASE_URL =
  'https://lzkdoyboahaucbdpdrlq.supabase.co';

/*
 * Chỉ dùng Publishable key hoặc anon public key.
 * Không dùng service_role, secret key hoặc mật khẩu database.
 */
const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_gfl2uPclIdwKz2R1I84LxA_tURJONRG';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const app = document.querySelector('#app');

let quizTimerId = null;

/* =========================================================
   KHỞI ĐỘNG
========================================================= */

async function init() {
  if (
    !SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY.includes('DAN_')
  ) {
    renderMessage(
      'Chưa cấu hình Publishable key của Supabase.'
    );

    return;
  }

  const {
    data: { session },
    error,
  } = await supabaseClient.auth.getSession();

  if (error) {
    console.error('Lỗi kiểm tra phiên:', error);

    renderMessage(
      'Không thể kiểm tra phiên đăng nhập.'
    );

    return;
  }

  if (session) {
    await renderDashboard(session.user);
  } else {
    renderLogin();
  }
}

/* =========================================================
   ĐĂNG NHẬP
========================================================= */

function renderLogin() {
  clearQuizTimer();

  app.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <img
          class="company-logo login-logo"
          src="./Logo.png"
          alt="Logo Nhà máy thủy điện A Vương"
        >

        <p class="eyebrow">
          NHÀ MÁY THỦY ĐIỆN A VƯƠNG
        </p>

        <h1>Đào tạo sinh viên thực tập</h1>

        <p class="description">
          Đăng nhập để học bài và làm bài kiểm tra.
        </p>

        <form
          id="login-form"
          class="login-form"
        >
          <label for="email">
            Email
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
          >

          <label for="password">
            Mật khẩu
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          >

          <p
            id="login-message"
            class="form-message"
            role="alert"
          ></p>

          <button
            id="login-button"
            class="primary-button"
            type="submit"
          >
            Đăng nhập
          </button>
        </form>
      </section>
    </main>
  `;

  document
    .querySelector('#login-form')
    .addEventListener('submit', handleLogin);
}

async function handleLogin(event) {
  event.preventDefault();

  const button =
    document.querySelector('#login-button');

  const message =
    document.querySelector('#login-message');

  const formData =
    new FormData(event.currentTarget);

  const email =
    String(formData.get('email') || '')
      .trim()
      .toLowerCase();

  const password =
    String(formData.get('password') || '');

  button.disabled = true;
  button.textContent = 'Đang đăng nhập...';
  message.textContent = '';

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    console.error('Lỗi đăng nhập:', error);

    message.textContent =
      'Email hoặc mật khẩu không chính xác.';

    button.disabled = false;
    button.textContent = 'Đăng nhập';

    return;
  }

  await renderDashboard(data.user);
}

/* =========================================================
   ĐĂNG XUẤT
========================================================= */

async function handleLogout() {
  clearQuizTimer();

  const { error } =
    await supabaseClient.auth.signOut();

  if (error) {
    console.error('Lỗi đăng xuất:', error);
  }

  renderLogin();
}

/* =========================================================
   DASHBOARD
========================================================= */

async function renderDashboard(user) {
  clearQuizTimer();
  renderLoading('Đang tải dữ liệu...');

  const [profileResult, enrollmentResult] =
    await Promise.all([
      supabaseClient
        .from('profiles')
        .select(`
          full_name,
          email,
          student_code,
          university,
          major
        `)
        .eq('id', user.id)
        .single(),

      supabaseClient
        .from('course_enrollments')
        .select(`
          id,
          status,
          courses (
            id,
            title,
            description,
            passing_score
          )
        `)
        .eq('student_id', user.id),
    ]);

  if (profileResult.error) {
    console.error(
      'Lỗi tải hồ sơ:',
      profileResult.error
    );

    renderMessage(
      'Không tải được hồ sơ sinh viên.'
    );

    return;
  }

  if (enrollmentResult.error) {
    console.error(
      'Lỗi tải khóa học:',
      enrollmentResult.error
    );

    renderMessage(
      'Không tải được danh sách khóa học.'
    );

    return;
  }

  const profile = profileResult.data;

  const enrollments =
    enrollmentResult.data ?? [];

  app.innerHTML = `
    ${renderMainHeader(
      'Hệ thống đào tạo sinh viên thực tập',
      false
    )}

    <main class="dashboard-page">
      <section class="profile-card">
        <p>Xin chào,</p>

        <h2>
          ${escapeHtml(profile.full_name)}
        </h2>

        <div class="profile-grid">
          <div>
            <span>Mã sinh viên</span>

            <strong>
              ${escapeHtml(
                profile.student_code ||
                'Chưa cập nhật'
              )}
            </strong>
          </div>

          <div>
            <span>Trường</span>

            <strong>
              ${escapeHtml(
                profile.university ||
                'Chưa cập nhật'
              )}
            </strong>
          </div>

          <div>
            <span>Chuyên ngành</span>

            <strong>
              ${escapeHtml(
                profile.major ||
                'Chưa cập nhật'
              )}
            </strong>
          </div>
        </div>
      </section>

      <section class="course-section">
        <h2>Khóa học của bạn</h2>

        <div class="course-list">
          ${
            enrollments.length > 0
              ? enrollments
                  .map(renderCourseCard)
                  .join('')
              : `
                <div class="empty-state">
                  Bạn chưa được phân công khóa học.
                </div>
              `
          }
        </div>
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
    .querySelectorAll('.course-button')
    .forEach((button) => {
      button.addEventListener(
        'click',
        async () => {
          const courseId =
            Number(button.dataset.courseId);

          if (!courseId) {
            alert(
              'Không xác định được khóa học.'
            );

            return;
          }

          await renderCoursePage(
            courseId,
            user
          );
        }
      );
    });
}

function renderCourseCard(enrollment) {
  const course = enrollment.courses;

  if (!course) {
    return '';
  }

  return `
    <article class="course-card">
      <div>
        <p class="status">
          ${formatCourseStatus(
            enrollment.status
          )}
        </p>

        <h3>
          ${escapeHtml(course.title)}
        </h3>

        <p>
          ${escapeHtml(
            course.description || ''
          )}
        </p>

        <p>
          Điểm đạt:
          <strong>
            ${escapeHtml(
              course.passing_score
            )}
          </strong>
        </p>
      </div>

      <button
        class="course-button"
        type="button"
        data-course-id="${course.id}"
      >
        Xem khóa học
      </button>
    </article>
  `;
}

/* =========================================================
   DANH SÁCH BÀI HỌC
========================================================= */

async function renderCoursePage(
  courseId,
  user
) {
  clearQuizTimer();
  renderLoading('Đang tải khóa học...');

  const [
    courseResult,
    lessonsResult,
    progressResult,
  ] = await Promise.all([
    supabaseClient
      .from('courses')
      .select(`
        id,
        title,
        description,
        passing_score
      `)
      .eq('id', courseId)
      .single(),

    supabaseClient
      .from('lessons')
      .select(`
        id,
        course_id,
        title,
        description,
        order_number,
        passing_score
      `)
      .eq('course_id', courseId)
      .order(
        'order_number',
        { ascending: true }
      ),

    supabaseClient
      .from('lesson_progress')
      .select(`
        lesson_id,
        status,
        best_score,
        attempt_count
      `)
      .eq('student_id', user.id),
  ]);

  if (courseResult.error) {
    console.error(
      'Lỗi tải khóa học:',
      courseResult.error
    );

    renderMessage(
      'Không tải được thông tin khóa học.'
    );

    return;
  }

  if (lessonsResult.error) {
    console.error(
      'Lỗi tải bài học:',
      lessonsResult.error
    );

    renderMessage(
      'Không tải được danh sách bài học.'
    );

    return;
  }

  if (progressResult.error) {
    console.error(
      'Lỗi tải tiến độ:',
      progressResult.error
    );

    renderMessage(
      'Không tải được tiến độ học tập.'
    );

    return;
  }

  const course = courseResult.data;
  const lessons = lessonsResult.data ?? [];

  const progressList =
    progressResult.data ?? [];

  const lessonsWithProgress =
    lessons.map((lesson) => {
      const progress =
        progressList.find(
          (item) =>
            Number(item.lesson_id) ===
            Number(lesson.id)
        );

      return {
        ...lesson,

        progress:
          progress || {
            status: 'locked',
            best_score: null,
            attempt_count: 0,
          },
      };
    });

  app.innerHTML = `
    ${renderMainHeader(
      course.title,
      true
    )}

    <main class="dashboard-page">
      <section class="course-overview-card">
        <h2>Thông tin khóa học</h2>

        <p>
          ${escapeHtml(
            course.description || ''
          )}
        </p>

        <p>
          Điểm đạt:
          <strong>
            ${escapeHtml(
              course.passing_score
            )}
          </strong>
        </p>
      </section>

      <section class="lesson-section">
        <h2>Danh sách bài học</h2>

        <div class="lesson-list">
          ${
            lessonsWithProgress.length > 0
              ? lessonsWithProgress
                  .map(renderLessonCard)
                  .join('')
              : `
                <div class="empty-state">
                  Khóa học chưa có bài học.
                </div>
              `
          }
        </div>
      </section>
    </main>
  `;

  document
    .querySelector('#back-button')
    .addEventListener(
      'click',
      async () => {
        await renderDashboard(user);
      }
    );

  document
    .querySelector('#logout-button')
    .addEventListener(
      'click',
      handleLogout
    );

  document
    .querySelectorAll('.lesson-button')
    .forEach((button) => {
      button.addEventListener(
        'click',
        async () => {
          const lessonId =
            Number(button.dataset.lessonId);

          const status =
            button.dataset.status;

          if (
            !lessonId ||
            status === 'locked'
          ) {
            return;
          }

          await renderLessonPage(
            lessonId,
            courseId,
            user
          );
        }
      );
    });
}

function renderLessonCard(lesson) {
  const status =
    lesson.progress.status;

  const isLocked =
    status === 'locked';

  return `
    <article
      class="lesson-card ${isLocked ? 'locked' : ''}"
    >
      <div class="lesson-number">
        ${escapeHtml(
          lesson.order_number
        )}
      </div>

      <div class="lesson-content">
        <p
          class="lesson-status ${escapeAttribute(status)}"
        >
          ${formatLessonStatus(status)}
        </p>

        <h3>
          ${escapeHtml(lesson.title)}
        </h3>

        <p>
          ${escapeHtml(
            lesson.description || ''
          )}
        </p>

        ${
          lesson.progress.best_score !== null
            ? `
              <p class="score-line">
                Điểm cao nhất:
                <strong>
                  ${escapeHtml(
                    lesson.progress.best_score
                  )}
                </strong>
              </p>
            `
            : ''
        }

        ${
          lesson.progress.attempt_count > 0
            ? `
              <p class="attempt-line">
                Số lần đã làm:
                <strong>
                  ${escapeHtml(
                    lesson.progress.attempt_count
                  )}
                </strong>
              </p>
            `
            : ''
        }
      </div>

      <button
        class="lesson-button"
        type="button"
        data-lesson-id="${lesson.id}"
        data-status="${escapeAttribute(status)}"
        ${isLocked ? 'disabled' : ''}
      >
        ${
          isLocked
            ? 'Chưa mở khóa'
            : status === 'passed'
              ? 'Xem lại bài'
              : 'Học bài'
        }
      </button>
    </article>
  `;
}

/* =========================================================
   NỘI DUNG BÀI HỌC
========================================================= */

async function renderLessonPage(
  lessonId,
  courseId,
  user
) {
  clearQuizTimer();
  renderLoading('Đang tải bài học...');

  const [lessonResult, progressResult] =
    await Promise.all([
      supabaseClient
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
          passing_score
        `)
        .eq('id', lessonId)
        .single(),

      supabaseClient
        .from('lesson_progress')
        .select(`
          status,
          best_score,
          attempt_count
        `)
        .eq('student_id', user.id)
        .eq('lesson_id', lessonId)
        .single(),
    ]);

  if (lessonResult.error) {
    console.error(
      'Lỗi tải bài học:',
      lessonResult.error
    );

    renderMessage(
      'Không tải được nội dung bài học.'
    );

    return;
  }

  if (progressResult.error) {
    console.error(
      'Lỗi tải tiến độ bài học:',
      progressResult.error
    );

    renderMessage(
      'Không tải được trạng thái bài học.'
    );

    return;
  }

  const lesson = lessonResult.data;
  const progress = progressResult.data;

  if (progress.status === 'locked') {
    renderMessage(
      'Bài học này chưa được mở khóa.'
    );

    return;
  }

  app.innerHTML = `
    ${renderMainHeader(
      lesson.title,
      true
    )}

    <main class="dashboard-page">
      <article class="lesson-detail-card">
        <p class="lesson-order">
          Bài ${escapeHtml(
            lesson.order_number
          )}
        </p>

        <h2>
          ${escapeHtml(lesson.title)}
        </h2>

        <p class="lesson-description">
          ${escapeHtml(
            lesson.description || ''
          )}
        </p>

        ${
          progress.best_score !== null
            ? `
              <div class="lesson-result-summary">
                <span>
                  Điểm cao nhất
                </span>

                <strong>
                  ${escapeHtml(
                    progress.best_score
                  )}/100
                </strong>
              </div>
            `
            : ''
        }

        ${
          lesson.video_url
            ? renderVideo(
                lesson.video_url
              )
            : ''
        }

        ${
          lesson.pdf_url
            ? renderPdf(
                lesson.pdf_url
              )
            : ''
        }

        ${
          lesson.image_url
            ? `
              <section class="lesson-media-section">
                <h3>Hình ảnh minh họa</h3>

                <img
                  class="lesson-image"
                  src="${escapeAttribute(
                    lesson.image_url
                  )}"
                  alt="Hình ảnh minh họa bài học"
                >
              </section>
            `
            : ''
        }

        ${
          lesson.content
            ? `
              <section class="lesson-text-content">
                <h3>Nội dung bài học</h3>

                <p>
                  ${escapeHtml(
                    lesson.content
                  )}
                </p>
              </section>
            `
            : ''
        }

        <div class="lesson-actions">
          <button
            id="quiz-button"
            class="primary-button"
            type="button"
          >
            ${
              progress.status === 'passed'
                ? 'Làm lại bài kiểm tra'
                : 'Làm bài kiểm tra'
            }
          </button>
        </div>
      </article>
    </main>
  `;

  document
    .querySelector('#back-button')
    .addEventListener(
      'click',
      async () => {
        await renderCoursePage(
          courseId,
          user
        );
      }
    );

  document
    .querySelector('#logout-button')
    .addEventListener(
      'click',
      handleLogout
    );

  document
    .querySelector('#quiz-button')
    .addEventListener(
      'click',
      async () => {
        await renderQuizPage(
          lessonId,
          courseId,
          user
        );
      }
    );
}

/* =========================================================
   BÀI KIỂM TRA
========================================================= */

async function renderQuizPage(
  lessonId,
  courseId,
  user
) {
  clearQuizTimer();
  renderLoading('Đang tải bài kiểm tra...');

  const { data, error } =
    await supabaseClient.rpc(
      'get_quiz_for_student',
      {
        p_lesson_id: lessonId,
      }
    );

  if (error) {
    console.error(
      'Lỗi tải bài kiểm tra:',
      error
    );

    renderMessage(
      getFriendlyRpcError(
        error,
        'Không tải được bài kiểm tra.'
      )
    );

    return;
  }

  const quiz = data;

  if (!quiz) {
    renderMessage(
      'Bài học chưa có bài kiểm tra.'
    );

    return;
  }

  const questions =
    Array.isArray(quiz.questions)
      ? quiz.questions
      : [];

  const remainingAttempts =
    Number(quiz.remaining_attempts ?? 0);

  if (remainingAttempts <= 0) {
    renderNoAttemptsPage(
      quiz,
      lessonId,
      courseId,
      user
    );

    return;
  }

  app.innerHTML = `
    ${renderMainHeader(
      quiz.title,
      true
    )}

    <main class="quiz-page">
      <section class="quiz-information-card">
        <div>
          <p class="eyebrow">
            BÀI KIỂM TRA
          </p>

          <h2>
            ${escapeHtml(quiz.title)}
          </h2>
        </div>

        <div class="quiz-meta-grid">
          <div>
            <span>Điểm đạt</span>

            <strong>
              ${escapeHtml(
                quiz.passing_score
              )}/100
            </strong>
          </div>

          <div>
            <span>Số câu hỏi</span>

            <strong>
              ${questions.length}
            </strong>
          </div>

          <div>
            <span>Lần còn lại</span>

            <strong>
              ${remainingAttempts}
            </strong>
          </div>

          <div>
            <span>Thời gian</span>

            <strong id="quiz-timer">
              ${formatSeconds(
                Number(
                  quiz.time_limit_minutes
                ) * 60
              )}
            </strong>
          </div>
        </div>
      </section>

      <form
        id="quiz-form"
        class="quiz-form"
      >
        ${
          questions.length > 0
            ? questions
                .map(
                  (
                    question,
                    questionIndex
                  ) =>
                    renderQuizQuestion(
                      question,
                      questionIndex
                    )
                )
                .join('')
            : `
              <div class="empty-state">
                Bài kiểm tra chưa có câu hỏi.
              </div>
            `
        }

        ${
          questions.length > 0
            ? `
              <section class="quiz-submit-card">
                <p
                  id="quiz-message"
                  class="form-message"
                  role="alert"
                ></p>

                <button
                  id="submit-quiz-button"
                  class="primary-button"
                  type="submit"
                >
                  Nộp bài
                </button>
              </section>
            `
            : ''
        }
      </form>
    </main>
  `;

  document
    .querySelector('#back-button')
    .addEventListener(
      'click',
      async () => {
        const shouldLeave =
          window.confirm(
            'Bạn có chắc muốn rời bài kiểm tra? Các đáp án chưa nộp sẽ bị mất.'
          );

        if (!shouldLeave) {
          return;
        }

        clearQuizTimer();

        await renderLessonPage(
          lessonId,
          courseId,
          user
        );
      }
    );

  document
    .querySelector('#logout-button')
    .addEventListener(
      'click',
      async () => {
        const shouldLogout =
          window.confirm(
            'Bạn có chắc muốn đăng xuất khi đang làm bài?'
          );

        if (!shouldLogout) {
          return;
        }

        await handleLogout();
      }
    );

  const form =
    document.querySelector('#quiz-form');

  if (form) {
    form.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        await submitQuiz(
          quiz,
          questions,
          lessonId,
          courseId,
          user
        );
      }
    );
  }

  startQuizTimer(
    Number(quiz.time_limit_minutes) * 60,
    async () => {
      alert(
        'Đã hết thời gian. Vui lòng kiểm tra và nộp bài.'
      );
    }
  );
}

function renderQuizQuestion(
  question,
  questionIndex
) {
  const options =
    Array.isArray(question.options)
      ? question.options
      : [];

  return `
    <section
      class="question-card"
      data-question-id="${question.id}"
    >
      <div class="question-heading">
        <span class="question-number">
          ${questionIndex + 1}
        </span>

        <h3>
          ${escapeHtml(
            question.question_text
          )}
        </h3>
      </div>

      <div class="answer-list">
        ${
          options.length > 0
            ? options
                .map(
                  (
                    option,
                    optionIndex
                  ) => `
                    <label
                      class="answer-option"
                    >
                      <input
                        type="radio"
                        name="question-${question.id}"
                        value="${option.id}"
                      >

                      <span class="answer-letter">
                        ${getAnswerLetter(
                          optionIndex
                        )}
                      </span>

                      <span class="answer-text">
                        ${escapeHtml(
                          option.option_text
                        )}
                      </span>
                    </label>
                  `
                )
                .join('')
            : `
              <p>
                Câu hỏi chưa có phương án trả lời.
              </p>
            `
        }
      </div>
    </section>
  `;
}

/* =========================================================
   NỘP BÀI
========================================================= */

async function submitQuiz(
  quiz,
  questions,
  lessonId,
  courseId,
  user
) {
  const submitButton =
    document.querySelector(
      '#submit-quiz-button'
    );

  const message =
    document.querySelector(
      '#quiz-message'
    );

  if (
    submitButton &&
    submitButton.disabled
  ) {
    return;
  }

  const answers = questions
    .map((question) => {
      const selected =
        document.querySelector(
          `input[name="question-${question.id}"]:checked`
        );

      if (!selected) {
        return null;
      }

      return {
        question_id:
          Number(question.id),

        option_id:
          Number(selected.value),
      };
    })
    .filter(Boolean);

  if (answers.length !== questions.length) {
    if (message) {
      message.textContent =
        'Bạn phải trả lời đầy đủ tất cả câu hỏi.';
    }

    const firstUnanswered =
      questions.find((question) => {
        return !document.querySelector(
          `input[name="question-${question.id}"]:checked`
        );
      });

    if (firstUnanswered) {
      document
        .querySelector(
          `[data-question-id="${firstUnanswered.id}"]`
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
    }

    return;
  }

  const confirmed =
    window.confirm(
      'Bạn có chắc muốn nộp bài kiểm tra?'
    );

  if (!confirmed) {
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent =
      'Đang chấm bài...';
  }

  if (message) {
    message.textContent = '';
  }

  clearQuizTimer();

  const { data, error } =
    await supabaseClient.rpc(
      'submit_quiz_attempt',
      {
        p_quiz_id:
          Number(quiz.quiz_id),

        p_answers: answers,
      }
    );

  if (error) {
    console.error(
      'Lỗi nộp bài:',
      error
    );

    if (message) {
      message.textContent =
        getFriendlyRpcError(
          error,
          'Không thể nộp bài kiểm tra.'
        );
    }

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        'Nộp bài';
    }

    return;
  }

  renderQuizResultPage(
    data,
    lessonId,
    courseId,
    user
  );
}

/* =========================================================
   KẾT QUẢ KIỂM TRA
========================================================= */

function renderQuizResultPage(
  result,
  lessonId,
  courseId,
  user
) {
  clearQuizTimer();

  const isPassed =
    Boolean(result.is_passed);

  const score =
    Number(result.score ?? 0);

  const remainingAttempts =
    Number(
      result.remaining_attempts ?? 0
    );

  app.innerHTML = `
    ${renderMainHeader(
      'Kết quả bài kiểm tra',
      false
    )}

    <main class="result-page">
      <section
        class="result-card ${isPassed ? 'passed' : 'failed'}"
      >
        <div class="result-icon">
          ${isPassed ? '✓' : '!'}
        </div>

        <p class="result-label">
          ${
            isPassed
              ? 'CHÚC MỪNG'
              : 'CHƯA ĐẠT'
          }
        </p>

        <h2>
          ${
            isPassed
              ? 'Bạn đã hoàn thành bài học'
              : 'Bạn cần ôn lại bài học'
          }
        </h2>

        <div class="result-score">
          <strong>
            ${escapeHtml(score)}
          </strong>

          <span>/100</span>
        </div>

        <p>
          Điểm đạt yêu cầu:
          <strong>
            ${escapeHtml(
              result.passing_score
            )}/100
          </strong>
        </p>

        <p>
          Lần làm bài:
          <strong>
            ${escapeHtml(
              result.attempt_number
            )}
          </strong>
        </p>

        ${
          !isPassed
            ? `
              <p>
                Số lần còn lại:
                <strong>
                  ${remainingAttempts}
                </strong>
              </p>
            `
            : ''
        }

        ${
          isPassed &&
          result.next_lesson_id
            ? `
              <div class="success-notice">
                Bài học tiếp theo đã được mở khóa.
              </div>
            `
            : ''
        }

        ${
          result.course_completed
            ? `
              <div class="success-notice">
                Bạn đã hoàn thành toàn bộ khóa học.
              </div>
            `
            : ''
        }

        <div class="result-actions">
          <button
            id="back-course-result-button"
            class="secondary-button"
            type="button"
          >
            Xem danh sách bài học
          </button>

          ${
            !isPassed &&
            remainingAttempts > 0
              ? `
                <button
                  id="retry-quiz-button"
                  class="primary-button"
                  type="button"
                >
                  Làm lại bài kiểm tra
                </button>
              `
              : ''
          }
        </div>
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
      '#back-course-result-button'
    )
    .addEventListener(
      'click',
      async () => {
        await renderCoursePage(
          courseId,
          user
        );
      }
    );

  const retryButton =
    document.querySelector(
      '#retry-quiz-button'
    );

  if (retryButton) {
    retryButton.addEventListener(
      'click',
      async () => {
        await renderQuizPage(
          lessonId,
          courseId,
          user
        );
      }
    );
  }
}

function renderNoAttemptsPage(
  quiz,
  lessonId,
  courseId,
  user
) {
  clearQuizTimer();

  app.innerHTML = `
    ${renderMainHeader(
      quiz.title,
      true
    )}

    <main class="result-page">
      <section class="result-card failed">
        <div class="result-icon">!</div>

        <p class="result-label">
          HẾT LƯỢT LÀM BÀI
        </p>

        <h2>
          Bạn đã sử dụng hết số lần làm bài
        </h2>

        <p>
          Số lần tối đa:
          <strong>
            ${escapeHtml(
              quiz.max_attempts
            )}
          </strong>
        </p>

        <p>
          Vui lòng liên hệ cán bộ hướng dẫn
          để được hỗ trợ.
        </p>

        <div class="result-actions">
          <button
            id="back-lesson-button"
            class="secondary-button"
            type="button"
          >
            Quay lại bài học
          </button>
        </div>
      </section>
    </main>
  `;

  document
    .querySelector('#back-button')
    .addEventListener(
      'click',
      async () => {
        await renderLessonPage(
          lessonId,
          courseId,
          user
        );
      }
    );

  document
    .querySelector('#logout-button')
    .addEventListener(
      'click',
      handleLogout
    );

  document
    .querySelector(
      '#back-lesson-button'
    )
    .addEventListener(
      'click',
      async () => {
        await renderLessonPage(
          lessonId,
          courseId,
          user
        );
      }
    );
}

/* =========================================================
   VIDEO VÀ PDF
========================================================= */

function renderVideo(url) {
  return `
    <section class="lesson-media-section">
      <h3>Video bài học</h3>

      <div class="video-wrapper">
        <iframe
          src="${escapeAttribute(url)}"
          title="Video bài học"
          allow="autoplay; fullscreen"
          allowfullscreen
        ></iframe>
      </div>
    </section>
  `;
}

function renderPdf(url) {
  const fileId = getGoogleDriveFileId(url);

  const previewUrl = fileId
    ? `https://drive.google.com/file/d/${fileId}/preview`
    : url;

  const viewUrl = fileId
    ? `https://drive.google.com/file/d/${fileId}/view`
    : url;

  const downloadUrl = fileId
    ? `https://drive.google.com/uc?export=download&id=${fileId}`
    : url;

  return `
    <section class="lesson-media-section pdf-learning-section">
      <div class="document-heading">
        <div>
          <p class="document-label">
            TÀI LIỆU HỌC TẬP
          </p>

          <h3>Tài liệu PDF của bài học</h3>
        </div>

        <span class="document-type">
          PDF
        </span>
      </div>

      <iframe
        class="pdf-viewer"
        src="${escapeAttribute(previewUrl)}"
        title="Tài liệu PDF bài học"
        loading="lazy"
      ></iframe>

      <div class="document-actions">
        <a
          class="document-button secondary-document-button"
          href="${escapeAttribute(viewUrl)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Mở toàn màn hình
        </a>

        <a
          class="document-button primary-document-button"
          href="${escapeAttribute(downloadUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          download
        >
          Tải tài liệu PDF
        </a>
      </div>

      <p class="document-note">
        Tài liệu được lưu trên Google Drive.
      </p>
    </section>
  `;
}

function getGoogleDriveFileId(url) {
  const value = String(url || '');

  const filePathMatch = value.match(
    /\/file\/d\/([a-zA-Z0-9_-]+)/
  );

  if (filePathMatch) {
    return filePathMatch[1];
  }

  const queryMatch = value.match(
    /[?&]id=([a-zA-Z0-9_-]+)/
  );

  return queryMatch
    ? queryMatch[1]
    : null;
}
}

/* =========================================================
   HEADER CÓ LOGO
========================================================= */

function renderMainHeader(
  title,
  showBackButton
) {
  return `
    <header class="header">
      <div class="header-brand">
        <img
          class="company-logo header-logo"
          src="./Logo.png"
          alt="Logo Nhà máy thủy điện A Vương"
        >

        <div class="header-title">
          <p class="eyebrow">
            NHÀ MÁY THỦY ĐIỆN A VƯƠNG
          </p>

          <h1>
            ${escapeHtml(title)}
          </h1>
        </div>
      </div>

      <div class="header-actions">
        ${
          showBackButton
            ? `
              <button
                id="back-button"
                class="secondary-button"
                type="button"
              >
                Quay lại
              </button>
            `
            : ''
        }

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
   ĐỒNG HỒ
========================================================= */

function startQuizTimer(
  totalSeconds,
  onTimeUp
) {
  clearQuizTimer();

  let remainingSeconds =
    Math.max(totalSeconds, 0);

  const timerElement =
    document.querySelector(
      '#quiz-timer'
    );

  if (!timerElement) {
    return;
  }

  timerElement.textContent =
    formatSeconds(remainingSeconds);

  quizTimerId =
    window.setInterval(async () => {
      remainingSeconds -= 1;

      timerElement.textContent =
        formatSeconds(
          Math.max(remainingSeconds, 0)
        );

      if (remainingSeconds <= 60) {
        timerElement.classList.add(
          'timer-warning'
        );
      }

      if (remainingSeconds <= 0) {
        clearQuizTimer();
        await onTimeUp();
      }
    }, 1000);
}

function clearQuizTimer() {
  if (quizTimerId !== null) {
    window.clearInterval(
      quizTimerId
    );

    quizTimerId = null;
  }
}

function formatSeconds(seconds) {
  const safeSeconds =
    Math.max(Number(seconds) || 0, 0);

  const minutes =
    Math.floor(safeSeconds / 60);

  const remaining =
    safeSeconds % 60;

  return `${String(minutes).padStart(
    2,
    '0'
  )}:${String(remaining).padStart(
    2,
    '0'
  )}`;
}

/* =========================================================
   TIỆN ÍCH
========================================================= */

function renderLoading(message) {
  app.innerHTML = `
    <main class="loading-page">
      <div class="loading-box">
        <div class="spinner"></div>

        <p>
          ${escapeHtml(message)}
        </p>
      </div>
    </main>
  `;
}

function renderMessage(message) {
  clearQuizTimer();

  app.innerHTML = `
    <main class="message-page">
      <section class="message-card">
        <img
          class="company-logo message-logo"
          src="./Logo.png"
          alt="Logo Nhà máy thủy điện A Vương"
        >

        <h1>Không tải được hệ thống</h1>

        <p>
          ${escapeHtml(message)}
        </p>

        <button
          id="reload-button"
          class="primary-button"
          type="button"
        >
          Tải lại trang
        </button>
      </section>
    </main>
  `;

  document
    .querySelector('#reload-button')
    .addEventListener(
      'click',
      () => {
        window.location.reload();
      }
    );
}

function formatCourseStatus(status) {
  const labels = {
    assigned: 'Đã phân công',
    in_progress: 'Đang học',
    completed: 'Đã hoàn thành',
  };

  return labels[status] || status;
}

function formatLessonStatus(status) {
  const labels = {
    available: 'Có thể học',
    studying: 'Đang học',
    passed: 'Đã hoàn thành',
    locked: 'Chưa mở khóa',
  };

  return labels[status] || status;
}

function getAnswerLetter(index) {
  return String.fromCharCode(
    65 + index
  );
}

function getFriendlyRpcError(
  error,
  fallbackMessage
) {
  const message =
    String(error?.message || '');

  if (
    message.includes(
      'Bạn đã sử dụng hết số lần làm bài'
    )
  ) {
    return 'Bạn đã sử dụng hết số lần làm bài.';
  }

  if (
    message.includes(
      'Bài học này chưa được mở khóa'
    ) ||
    message.includes(
      'Bài học chưa được mở khóa'
    )
  ) {
    return 'Bài học này chưa được mở khóa.';
  }

  if (
    message.includes(
      'Bạn phải trả lời đầy đủ'
    )
  ) {
    return 'Bạn phải trả lời đầy đủ tất cả câu hỏi.';
  }

  if (
    message.includes(
      'Bài học chưa có bài kiểm tra'
    )
  ) {
    return 'Bài học chưa có bài kiểm tra.';
  }

  if (
    message.includes(
      'Bạn chưa đăng nhập'
    )
  ) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }

  return fallbackMessage;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

// init() sẽ được gọi trong index.html
// sau khi tất cả file JavaScript đã tải xong.
