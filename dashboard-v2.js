/*
 * Dashboard sinh viên dạng nhiều màn hình.
 *
 * Các màn hình:
 * - Tổng quan
 * - Khóa học
 * - Bài kiểm tra
 * - Tài liệu
 * - Trợ lý AI
 *
 * Điều hướng bằng hash:
 * #home
 * #courses
 * #quizzes
 * #documents
 * #ai
 */

const TRAINING_MODULES = [
  {
    id: 1,
    title:
      'Tổng quan và sơ đồ điện',
    description:
      'Kiến thức nền tảng về nhà máy và sơ đồ điện chính.',
    from: 1,
    to: 2,
  },
  {
    id: 2,
    title:
      'Các hệ thống phụ trợ',
    description:
      'Các hệ thống phục vụ vận hành an toàn và liên tục.',
    from: 3,
    to: 8,
  },
  {
    id: 3,
    title:
      'Thiết bị điện và cơ khí chính',
    description:
      'Máy biến áp, thiết bị đầu cực, van và tổ máy.',
    from: 9,
    to: 13,
  },
  {
    id: 4,
    title:
      'Điều khiển và bảo vệ',
    description:
      'Các hệ thống điều khiển, bảo vệ, điều tốc và kích từ.',
    from: 14,
    to: 17,
  },
  {
    id: 5,
    title:
      'Thị trường điện và thiết bị trạm 220 kV',
    description:
      'Thị trường điện và thiết bị nhất thứ ngoài trời.',
    from: 18,
    to: 21,
  },
  {
    id: 6,
    title:
      'Đập tràn và đánh giá cuối khóa',
    description:
      'Thiết bị tại Đập tràn và bài đánh giá tổng hợp.',
    from: 22,
    to: 23,
  },
];

const DASHBOARD_VIEWS = [
  'home',
  'courses',
  'quizzes',
  'documents',
  'ai',
];

const MAX_QUIZ_ATTEMPTS = 3;

let dashboardState = null;
let dashboardHashListenerBound =
  false;

/* =========================================================
   DASHBOARD CHÍNH
========================================================= */

window.renderDashboard =
  async function (user) {
    clearQuizTimer();

    if (
      typeof clearLessonVideoCountdown ===
      'function'
    ) {
      clearLessonVideoCountdown();
    }

    renderLoading(
      'Đang tải dữ liệu đào tạo...'
    );

    const [
      profileResult,
      enrollmentResult,
      lessonsResult,
      progressResult,
    ] = await Promise.all([
      supabaseClient
        .from('profiles')
        .select(`
          full_name,
          email,
          student_code,
          university,
          major,
          internship_start,
          internship_end
        `)
        .eq('id', user.id)
        .single(),

      supabaseClient
        .from('course_enrollments')
        .select(`
          id,
          course_id,
          status,
          assigned_at,
          started_at,
          completed_at,
          courses (
            id,
            title,
            description,
            passing_score
          )
        `)
        .eq('student_id', user.id)
        .limit(1)
        .maybeSingle(),

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
          passing_score,
          is_published
        `)
        .eq('course_id', 1)
        .eq('is_published', true)
        .order(
          'order_number',
          {
            ascending: true,
          }
        ),

      supabaseClient
        .from('lesson_progress')
        .select(`
          lesson_id,
          status,
          best_score,
          attempt_count,
          video_completed
        `)
        .eq(
          'student_id',
          user.id
        ),
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

    const profile =
      profileResult.data || {};

    const enrollment =
      enrollmentResult.data;

    const course =
      enrollment?.courses || {
        id: 1,
        title:
          'Đào tạo sinh viên thực tập tại Nhà máy thủy điện A Vương',
        description: '',
        passing_score: 70,
      };

    const lessons =
      lessonsResult.data || [];

    const progressList =
      progressResult.data || [];

    const lessonsWithProgress =
      lessons.map(
        (lesson) => {
          const progress =
            progressList.find(
              (item) =>
                Number(
                  item.lesson_id
                ) ===
                Number(
                  lesson.id
                )
            );

          return {
            ...lesson,

            progress:
              progress || {
                status:
                  'locked',
                best_score:
                  null,
                attempt_count:
                  0,
                video_completed:
                  false,
              },
          };
        }
      );

    const totalLessons =
      lessonsWithProgress.length;

    const passedLessons =
      lessonsWithProgress.filter(
        (lesson) =>
          lesson.progress.status ===
          'passed'
      ).length;

    const availableLessons =
      lessonsWithProgress.filter(
        (lesson) =>
          [
            'available',
            'studying',
          ].includes(
            lesson.progress.status
          )
      ).length;

    const scoredLessons =
      lessonsWithProgress.filter(
        (lesson) =>
          lesson.progress
            .best_score !==
            null &&
          lesson.progress
            .best_score !==
            undefined
      );

    const averageScore =
      scoredLessons.length > 0
        ? Math.round(
            scoredLessons.reduce(
              (
                total,
                lesson
              ) =>
                total +
                Number(
                  lesson
                    .progress
                    .best_score ||
                    0
                ),
              0
            ) /
              scoredLessons.length
          )
        : 0;

    const progressPercent =
      totalLessons > 0
        ? Math.round(
            (
              passedLessons /
              totalLessons
            ) * 100
          )
        : 0;

    const nextLesson =
      lessonsWithProgress.find(
        (lesson) =>
          lesson.progress.status ===
          'studying'
      ) ||
      lessonsWithProgress.find(
        (lesson) =>
          lesson.progress.status ===
          'available'
      );

    dashboardState = {
      user,
      profile,
      enrollment,
      course,
      lessons:
        lessonsWithProgress,
      totalLessons,
      passedLessons,
      availableLessons,
      averageScore,
      progressPercent,
      nextLesson,
      selectedAiLessonNumber:
        getDefaultAiLessonNumber(
          lessonsWithProgress
        ),
    };

    renderDashboardShell();

    bindDashboardHashListener();

    const currentView =
      getDashboardViewFromHash();

    showDashboardView(
      currentView,
      false
    );
  };

/* =========================================================
   KHUNG DASHBOARD
========================================================= */

function renderDashboardShell() {
  const {
    profile,
    totalLessons,
    passedLessons,
    progressPercent,
  } = dashboardState;

  app.innerHTML = `
    ${renderMainHeader(
      'Hệ thống đào tạo sinh viên thực tập',
      false
    )}

    <main class="digital-dashboard">
      <button
        id="dashboard-menu-toggle"
        class="dashboard-menu-toggle"
        type="button"
        aria-label="Mở menu"
        aria-expanded="false"
      >
        ☰
      </button>

      <div
        id="dashboard-sidebar-overlay"
        class="dashboard-sidebar-overlay"
      ></div>

      <aside
        id="dashboard-sidebar"
        class="dashboard-sidebar"
      >
        <div class="sidebar-brand">
          <img
            src="./Logo.png"
            alt="Logo Nhà máy thủy điện A Vương"
          >

          <div>
            <strong>
              A VƯƠNG
            </strong>

            <span>
              Training Platform
            </span>
          </div>
        </div>

        <nav
          class="dashboard-navigation"
          aria-label="Điều hướng hệ thống"
        >
          ${renderDashboardNavButton(
            'home',
            '◫',
            'Tổng quan'
          )}

          ${renderDashboardNavButton(
            'courses',
            '▤',
            'Khóa học'
          )}

          ${renderDashboardNavButton(
            'quizzes',
            '✓',
            'Bài kiểm tra'
          )}

          ${renderDashboardNavButton(
            'documents',
            '▣',
            'Tài liệu'
          )}

          ${renderDashboardNavButton(
            'ai',
            '✦',
            'Trợ lý AI'
          )}
        </nav>

        <div class="sidebar-course-progress">
          <span>
            Tiến độ khóa học
          </span>

          <strong>
            ${passedLessons}/${totalLessons}
            bài
          </strong>

          <div class="sidebar-progress-track">
            <div
              class="sidebar-progress-value"
              style="
                width:
                ${progressPercent}%;
              "
            ></div>
          </div>

          <small>
            ${progressPercent}%
            hoàn thành
          </small>
        </div>

        <div class="sidebar-student-card">
          <div class="sidebar-avatar">
            ${getInitials(
              profile.full_name ||
              'Sinh viên'
            )}
          </div>

          <div>
            <strong>
              ${escapeHtml(
                profile.full_name ||
                'Sinh viên'
              )}
            </strong>

            <span>
              ${escapeHtml(
                profile.student_code ||
                'Chưa có mã sinh viên'
              )}
            </span>
          </div>
        </div>
      </aside>

      <section
        class="dashboard-main-content"
      >
        <div
          id="dashboard-view"
          class="dashboard-view"
        ></div>
      </section>
    </main>
  `;

  bindDashboardShellEvents();
}

function renderDashboardNavButton(
  view,
  icon,
  label
) {
  return `
    <button
      class="dashboard-nav-item"
      type="button"
      data-dashboard-view="${view}"
    >
      <span
        class="dashboard-nav-icon"
      >
        ${icon}
      </span>

      <span>
        ${label}
      </span>
    </button>
  `;
}

/* =========================================================
   ĐIỀU HƯỚNG
========================================================= */

function bindDashboardShellEvents() {
  const logoutButton =
    document.querySelector(
      '#logout-button'
    );

  logoutButton?.addEventListener(
    'click',
    handleLogout
  );

  const sidebar =
    document.querySelector(
      '#dashboard-sidebar'
    );

  const overlay =
    document.querySelector(
      '#dashboard-sidebar-overlay'
    );

  const menuButton =
    document.querySelector(
      '#dashboard-menu-toggle'
    );

  const closeSidebar = () => {
    sidebar?.classList.remove(
      'open'
    );

    overlay?.classList.remove(
      'visible'
    );

    menuButton?.setAttribute(
      'aria-expanded',
      'false'
    );
  };

  menuButton?.addEventListener(
    'click',
    () => {
      const isOpen =
        sidebar?.classList.toggle(
          'open'
        );

      overlay?.classList.toggle(
        'visible',
        Boolean(isOpen)
      );

      menuButton.setAttribute(
        'aria-expanded',
        String(Boolean(isOpen))
      );
    }
  );

  overlay?.addEventListener(
    'click',
    closeSidebar
  );

  document
    .querySelectorAll(
      '[data-dashboard-view]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const view =
              button.dataset
                .dashboardView;

            showDashboardView(
              view
            );

            closeSidebar();
          }
        );
      }
    );
}

function bindDashboardHashListener() {
  if (
    dashboardHashListenerBound
  ) {
    return;
  }

  dashboardHashListenerBound =
    true;

  window.addEventListener(
    'hashchange',
    () => {
      if (!dashboardState) {
        return;
      }

      showDashboardView(
        getDashboardViewFromHash(),
        false
      );
    }
  );
}

function getDashboardViewFromHash() {
  const hash =
    String(
      window.location.hash ||
      ''
    )
      .replace('#', '')
      .trim()
      .toLowerCase();

  if (
    DASHBOARD_VIEWS.includes(
      hash
    )
  ) {
    return hash;
  }

  return 'home';
}

function showDashboardView(
  view,
  updateHash = true
) {
  if (
    !DASHBOARD_VIEWS.includes(
      view
    )
  ) {
    view = 'home';
  }

  if (
    updateHash &&
    window.location.hash !==
      `#${view}`
  ) {
    window.location.hash =
      view;

    return;
  }

  setActiveDashboardNav(
    view
  );

  const viewContainer =
    document.querySelector(
      '#dashboard-view'
    );

  if (!viewContainer) {
    return;
  }

  removeStandaloneLessonChat();

  switch (view) {
    case 'courses':
      renderCoursesView(
        viewContainer
      );
      break;

    case 'quizzes':
      renderQuizzesView(
        viewContainer
      );
      break;

    case 'documents':
      renderDocumentsView(
        viewContainer
      );
      break;

    case 'ai':
      renderAiView(
        viewContainer
      );
      break;

    case 'home':
    default:
      renderHomeView(
        viewContainer
      );
      break;
  }

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}

function setActiveDashboardNav(
  view
) {
  document
    .querySelectorAll(
      '.dashboard-nav-item'
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          'active',
          button.dataset
            .dashboardView ===
            view
        );
      }
    );
}

/* =========================================================
   HEADER TRANG CON
========================================================= */

function renderDashboardViewHeader({
  eyebrow,
  title,
  description,
  showBackButton = true,
}) {
  return `
    <section class="dashboard-view-header">
      <div>
        <p class="dashboard-eyebrow">
          ${escapeHtml(eyebrow)}
        </p>

        <h1>
          ${escapeHtml(title)}
        </h1>

        <p>
          ${escapeHtml(
            description || ''
          )}
        </p>
      </div>

      ${
        showBackButton
          ? `
            <button
              class="dashboard-back-home-button"
              type="button"
              data-dashboard-view="home"
            >
              ← Quay về Tổng quan
            </button>
          `
          : ''
      }
    </section>
  `;
}

/* =========================================================
   TRANG TỔNG QUAN
========================================================= */

function renderHomeView(
  container
) {
  const {
    profile,
    course,
    totalLessons,
    passedLessons,
    availableLessons,
    averageScore,
    progressPercent,
    nextLesson,
    enrollment,
    lessons,
  } = dashboardState;

  const attemptedLessons =
    lessons.filter(
      (lesson) =>
        Number(
          lesson.progress
            .attempt_count ||
            0
        ) > 0
    ).length;

  const videoCompleted =
    lessons.filter(
      (lesson) =>
        lesson.progress
          .video_completed ===
        true
    ).length;

  const currentModule =
    nextLesson
      ? TRAINING_MODULES.find(
          (module) =>
            nextLesson
              .order_number >=
              module.from &&
            nextLesson
              .order_number <=
              module.to
        )
      : null;

  container.innerHTML = `
    <section class="dashboard-hero">
      <div class="dashboard-hero-copy">
        <p class="dashboard-eyebrow">
          CHƯƠNG TRÌNH THỰC TẬP
        </p>

        <h1>
          ${getGreetingText()},
          ${escapeHtml(
            getFirstName(
              profile.full_name ||
              'Sinh viên'
            )
          )}
        </h1>

        <p>
          ${escapeHtml(
            course.title
          )}
        </p>

        ${
          currentModule
            ? `
              <div
                class="dashboard-current-module"
              >
                <span>
                  Chuyên đề hiện tại
                </span>

                <strong>
                  ${escapeHtml(
                    currentModule.title
                  )}
                </strong>
              </div>
            `
            : ''
        }
      </div>

      <div
        class="dashboard-hero-actions"
      >
        <button
          class="dashboard-outline-button"
          type="button"
          data-dashboard-view="courses"
        >
          Xem khóa học
        </button>

        ${
          nextLesson
            ? `
              <button
                class="
                  dashboard-primary-action
                  dashboard-open-lesson-button
                "
                type="button"
                data-lesson-id="${nextLesson.id}"
                data-status="${escapeAttribute(
                  nextLesson
                    .progress
                    .status
                )}"
              >
                Tiếp tục học
              </button>
            `
            : ''
        }
      </div>
    </section>

    <section
      class="dashboard-statistics"
    >
      ${renderStatisticCard(
        '▦',
        totalLessons,
        'Tổng bài học',
        'blue'
      )}

      ${renderStatisticCard(
        '✓',
        passedLessons,
        'Đã hoàn thành',
        'green'
      )}

      ${renderStatisticCard(
        '▶',
        availableLessons,
        'Đang mở',
        'cyan'
      )}

      ${renderStatisticCard(
        '★',
        averageScore > 0
          ? averageScore
          : '--',
        'Điểm trung bình',
        'orange'
      )}
    </section>

    <div class="dashboard-content-grid">
      <div class="dashboard-primary-column">
        <section
          class="dashboard-panel"
        >
          <div
            class="dashboard-panel-heading"
          >
            <div>
              <p
                class="dashboard-eyebrow"
              >
                TIẾN ĐỘ HỌC TẬP
              </p>

              <h2>
                ${passedLessons}/${totalLessons}
                bài đã hoàn thành
              </h2>

              <p>
                ${
                  nextLesson
                    ? `
                      Bài tiếp theo:
                      <strong>
                        Bài
                        ${escapeHtml(
                          nextLesson
                            .order_number
                        )}
                        -
                        ${escapeHtml(
                          nextLesson.title
                        )}
                      </strong>
                    `
                    : `
                      Bạn đã hoàn thành
                      toàn bộ lộ trình.
                    `
                }
              </p>
            </div>

            <div
              class="modern-progress-ring"
              style="
                --progress:
                ${progressPercent}
              "
            >
              <div>
                <strong>
                  ${progressPercent}%
                </strong>

                <span>
                  Hoàn thành
                </span>
              </div>
            </div>
          </div>

          <div
            class="main-progress-track"
          >
            <div
              class="main-progress-value"
              style="
                width:
                ${progressPercent}%;
              "
            ></div>
          </div>

          <div class="progress-footer">
            <span>
              Trạng thái:
              <strong>
                ${formatCourseStatus(
                  enrollment?.status ||
                  'assigned'
                )}
              </strong>
            </span>

            <span>
              Còn lại:
              <strong>
                ${Math.max(
                  totalLessons -
                    passedLessons,
                  0
                )}
                bài
              </strong>
            </span>
          </div>
        </section>

        ${
          nextLesson
            ? renderNextLessonHomeCard(
                nextLesson
              )
            : renderCompletedHomeCard()
        }

        <section
          class="dashboard-quick-links"
        >
          ${renderQuickLinkCard(
            'courses',
            '▤',
            'Khóa học',
            'Xem toàn bộ 23 bài học và tiến độ từng bài.'
          )}

          ${renderQuickLinkCard(
            'quizzes',
            '✓',
            'Bài kiểm tra',
            'Xem số lượt còn lại và làm lại bài kiểm tra.'
          )}

          ${renderQuickLinkCard(
            'documents',
            '▣',
            'Tài liệu',
            'Tra cứu video, PDF và nội dung theo từng bài.'
          )}

          ${renderQuickLinkCard(
            'ai',
            '✦',
            'Trợ lý AI',
            'Chọn bài học và hỏi đáp theo tài liệu.'
          )}
        </section>
      </div>

      <aside
        class="dashboard-secondary-column"
      >
        <section
          class="dashboard-side-card"
        >
          <div
            class="dashboard-side-card-heading"
          >
            <div>
              <p
                class="dashboard-eyebrow"
              >
                TỔNG QUAN
              </p>

              <h3>
                Hoạt động học tập
              </h3>
            </div>

            <span
              class="side-card-badge"
            >
              ${progressPercent}%
            </span>
          </div>

          <div
            class="learning-summary-list"
          >
            <div>
              <span>
                Đã làm quiz
              </span>

              <strong>
                ${attemptedLessons}
              </strong>
            </div>

            <div>
              <span>
                Video đã xem
              </span>

              <strong>
                ${videoCompleted}
              </strong>
            </div>

            <div>
              <span>
                Điểm trung bình
              </span>

              <strong>
                ${
                  averageScore > 0
                    ? averageScore
                    : '--'
                }
              </strong>
            </div>
          </div>
        </section>

        <section
          class="
            dashboard-side-card
            ai-promotion-card
          "
        >
          <div class="ai-card-icon">
            ✦
          </div>

          <p class="dashboard-eyebrow">
            TRỢ LÝ AI
          </p>

          <h3>
            Hỏi đáp dựa trên tài liệu đào tạo
          </h3>

          <p>
            Chọn từng bài học và đặt câu hỏi
            trực tiếp cho Trợ lý AI.
          </p>

          <button
            class="dashboard-ai-button"
            type="button"
            data-dashboard-view="ai"
          >
            Mở Trợ lý AI
          </button>
        </section>

        ${renderStudentInformationCard(
          profile
        )}
      </aside>
    </div>
  `;

  bindCurrentViewEvents();
}

function renderStatisticCard(
  icon,
  value,
  label,
  theme
) {
  return `
    <article
      class="
        dashboard-stat-card
        ${theme}
      "
    >
      <div
        class="dashboard-stat-icon"
      >
        ${icon}
      </div>

      <div>
        <strong>
          ${escapeHtml(value)}
        </strong>

        <span>
          ${escapeHtml(label)}
        </span>
      </div>
    </article>
  `;
}

function renderNextLessonHomeCard(
  lesson
) {
  return `
    <section class="next-lesson-card">
      <div class="next-lesson-number">
        ${escapeHtml(
          lesson.order_number
        )}
      </div>

      <div class="next-lesson-content">
        <p class="dashboard-eyebrow">
          BÀI HỌC TIẾP THEO
        </p>

        <h2>
          ${escapeHtml(
            lesson.title
          )}
        </h2>

        <p>
          ${escapeHtml(
            lesson.description ||
            'Nội dung bài học đã sẵn sàng.'
          )}
        </p>

        <div class="next-lesson-meta">
          ${
            lesson.video_url
              ? '<span>Video</span>'
              : ''
          }

          ${
            lesson.pdf_url
              ? '<span>PDF</span>'
              : ''
          }

          <span>Quiz</span>

          ${
            Number(
              lesson.order_number
            ) <= 22
              ? '<span>AI</span>'
              : ''
          }
        </div>
      </div>

      <button
        class="
          dashboard-primary-action
          dashboard-open-lesson-button
        "
        type="button"
        data-lesson-id="${lesson.id}"
        data-status="${escapeAttribute(
          lesson.progress.status
        )}"
      >
        ${
          lesson.progress.status ===
          'studying'
            ? 'Tiếp tục học'
            : 'Bắt đầu học'
        }
      </button>
    </section>
  `;
}

function renderCompletedHomeCard() {
  return `
    <section class="course-completed-card">
      <div class="course-completed-icon">
        ✓
      </div>

      <div>
        <p class="dashboard-eyebrow">
          HOÀN THÀNH
        </p>

        <h2>
          Bạn đã hoàn thành chương trình
        </h2>

        <p>
          Hãy kiểm tra kết quả tổng kết
          và chờ đánh giá của cán bộ hướng dẫn.
        </p>
      </div>
    </section>
  `;
}

function renderQuickLinkCard(
  view,
  icon,
  title,
  description
) {
  return `
    <button
      class="dashboard-quick-link-card"
      type="button"
      data-dashboard-view="${view}"
    >
      <span
        class="dashboard-quick-link-icon"
      >
        ${icon}
      </span>

      <strong>
        ${escapeHtml(title)}
      </strong>

      <span>
        ${escapeHtml(description)}
      </span>
    </button>
  `;
}

/* =========================================================
   TRANG KHÓA HỌC
========================================================= */

function renderCoursesView(
  container
) {
  const {
    lessons,
  } = dashboardState;

  container.innerHTML = `
    ${renderDashboardViewHeader({
      eyebrow:
        'LỘ TRÌNH ĐÀO TẠO',
      title:
        'Danh sách khóa học',
      description:
        'Theo dõi trạng thái và mở từng bài học trong chương trình.',
    })}

    <section
      class="dashboard-toolbar"
    >
      <label
        class="dashboard-search-box"
      >
        <span>⌕</span>

        <input
          id="course-search-input"
          type="search"
          placeholder="Tìm kiếm bài học..."
        >
      </label>

      <div
        class="dashboard-filter-buttons"
      >
        <button
          class="dashboard-filter-button active"
          type="button"
          data-course-filter="all"
        >
          Tất cả
        </button>

        <button
          class="dashboard-filter-button"
          type="button"
          data-course-filter="available"
        >
          Đang học
        </button>

        <button
          class="dashboard-filter-button"
          type="button"
          data-course-filter="passed"
        >
          Đã hoàn thành
        </button>

        <button
          class="dashboard-filter-button"
          type="button"
          data-course-filter="locked"
        >
          Chưa mở khóa
        </button>
      </div>
    </section>

    <section
      id="course-module-list"
      class="module-list"
    >
      ${renderCourseModules(
        lessons,
        'all',
        ''
      )}
    </section>
  `;

  bindCurrentViewEvents();

  bindCourseFilterEvents();
}

function renderCourseModules(
  lessons,
  filter,
  keyword
) {
  const normalizedKeyword =
    String(keyword || '')
      .trim()
      .toLowerCase();

  const filteredLessons =
    lessons.filter(
      (lesson) => {
        const status =
          lesson.progress.status;

        const matchesFilter =
          filter === 'all' ||
          (
            filter ===
              'available' &&
            [
              'available',
              'studying',
            ].includes(status)
          ) ||
          status === filter;

        const searchableText =
          `
            ${lesson.order_number}
            ${lesson.title || ''}
            ${lesson.description || ''}
          `.toLowerCase();

        const matchesKeyword =
          !normalizedKeyword ||
          searchableText.includes(
            normalizedKeyword
          );

        return (
          matchesFilter &&
          matchesKeyword
        );
      }
    );

  if (
    filteredLessons.length === 0
  ) {
    return `
      <div class="dashboard-empty-state">
        Không tìm thấy bài học phù hợp.
      </div>
    `;
  }

  return TRAINING_MODULES.map(
    (module) => {
      const moduleLessons =
        filteredLessons.filter(
          (lesson) =>
            Number(
              lesson.order_number
            ) >= module.from &&
            Number(
              lesson.order_number
            ) <= module.to
        );

      if (
        moduleLessons.length === 0
      ) {
        return '';
      }

      return renderTrainingModule(
        module,
        moduleLessons
      );
    }
  ).join('');
}

function renderTrainingModule(
  module,
  moduleLessons
) {
  const completedCount =
    moduleLessons.filter(
      (lesson) =>
        lesson.progress.status ===
        'passed'
    ).length;

  const modulePercent =
    moduleLessons.length > 0
      ? Math.round(
          (
            completedCount /
            moduleLessons.length
          ) * 100
        )
      : 0;

  return `
    <article
      class="training-module-card"
    >
      <header class="module-header">
        <div class="module-index">
          ${String(
            module.id
          ).padStart(2, '0')}
        </div>

        <div class="module-title">
          <p>
            Chuyên đề
            ${module.id}
          </p>

          <h3>
            ${escapeHtml(
              module.title
            )}
          </h3>

          <span>
            ${escapeHtml(
              module.description
            )}
          </span>
        </div>

        <div
          class="module-progress-summary"
        >
          <strong>
            ${completedCount}/${
              moduleLessons.length
            }
          </strong>

          <span>
            Hoàn thành
          </span>
        </div>
      </header>

      <div
        class="module-progress-track"
      >
        <div
          class="module-progress-value"
          style="
            width:
            ${modulePercent}%;
          "
        ></div>
      </div>

      <div class="module-lessons">
        ${moduleLessons
          .map(
            renderDashboardLessonItem
          )
          .join('')}
      </div>
    </article>
  `;
}

function renderDashboardLessonItem(
  lesson
) {
  const status =
    lesson.progress.status;

  const isLocked =
    status === 'locked';

  const hasContent =
    Boolean(
      lesson.video_url ||
      lesson.pdf_url ||
      lesson.content ||
      lesson.image_url
    );

  const buttonDisabled =
    isLocked ||
    !hasContent;

  return `
    <div
      class="
        roadmap-lesson-item
        ${escapeAttribute(status)}
      "
    >
      <div
        class="roadmap-status-icon"
      >
        ${getLessonStatusIcon(
          status
        )}
      </div>

      <div
        class="roadmap-lesson-number"
      >
        Bài
        ${escapeHtml(
          lesson.order_number
        )}
      </div>

      <div
        class="roadmap-lesson-information"
      >
        <h4>
          ${escapeHtml(
            lesson.title
          )}
        </h4>

        <p>
          ${escapeHtml(
            lesson.description ||
            ''
          )}
        </p>

        <div
          class="lesson-resource-tags"
        >
          ${
            lesson.video_url
              ? `
                <span
                  class="resource-tag video"
                >
                  Video
                </span>
              `
              : ''
          }

          ${
            lesson.pdf_url
              ? `
                <span
                  class="resource-tag pdf"
                >
                  PDF
                </span>
              `
              : ''
          }

          ${
            Number(
              lesson.order_number
            ) <= 22
              ? `
                <span
                  class="resource-tag ai"
                >
                  AI
                </span>
              `
              : ''
          }

          ${
            lesson.progress
              .best_score !==
            null
              ? `
                <span
                  class="resource-tag score"
                >
                  Điểm:
                  ${escapeHtml(
                    lesson
                      .progress
                      .best_score
                  )}
                </span>
              `
              : ''
          }

          ${
            !hasContent
              ? `
                <span
                  class="resource-tag preparing"
                >
                  Đang cập nhật
                </span>
              `
              : ''
          }
        </div>
      </div>

      <div
        class="roadmap-lesson-action"
      >
        <span
          class="
            roadmap-status-text
            ${escapeAttribute(status)}
          "
        >
          ${formatLessonStatus(
            status
          )}
        </span>

        <button
          class="dashboard-open-lesson-button"
          type="button"
          data-lesson-id="${lesson.id}"
          data-status="${escapeAttribute(
            status
          )}"
          ${
            buttonDisabled
              ? 'disabled'
              : ''
          }
        >
          ${getLessonButtonText(
            status,
            hasContent
          )}
        </button>
      </div>
    </div>
  `;
}

function bindCourseFilterEvents() {
  const searchInput =
    document.querySelector(
      '#course-search-input'
    );

  const filterButtons =
    document.querySelectorAll(
      '[data-course-filter]'
    );

  let activeFilter =
    'all';

  const updateList = () => {
    const list =
      document.querySelector(
        '#course-module-list'
      );

    if (!list) {
      return;
    }

    list.innerHTML =
      renderCourseModules(
        dashboardState.lessons,
        activeFilter,
        searchInput?.value ||
          ''
      );

    bindCurrentViewEvents();
  };

  searchInput?.addEventListener(
    'input',
    updateList
  );

  filterButtons.forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          activeFilter =
            button.dataset
              .courseFilter;

          filterButtons.forEach(
            (item) => {
              item.classList.toggle(
                'active',
                item === button
              );
            }
          );

          updateList();
        }
      );
    }
  );
}

/* =========================================================
   TRANG BÀI KIỂM TRA
========================================================= */

function renderQuizzesView(
  container
) {
  const {
    lessons,
  } = dashboardState;

  container.innerHTML = `
    ${renderDashboardViewHeader({
      eyebrow:
        'BÀI KIỂM TRA',
      title:
        'Danh sách bài kiểm tra',
      description:
        'Xem điểm, số lượt đã sử dụng và số lượt còn lại của từng bài.',
    })}

    <section
      class="dashboard-toolbar"
    >
      <label
        class="dashboard-search-box"
      >
        <span>⌕</span>

        <input
          id="quiz-search-input"
          type="search"
          placeholder="Tìm bài kiểm tra..."
        >
      </label>

      <div
        class="dashboard-filter-buttons"
      >
        <button
          class="dashboard-filter-button active"
          type="button"
          data-quiz-filter="all"
        >
          Tất cả
        </button>

        <button
          class="dashboard-filter-button"
          type="button"
          data-quiz-filter="available"
        >
          Có thể làm
        </button>

        <button
          class="dashboard-filter-button"
          type="button"
          data-quiz-filter="passed"
        >
          Đã đạt
        </button>

        <button
          class="dashboard-filter-button"
          type="button"
          data-quiz-filter="exhausted"
        >
          Hết lượt
        </button>
      </div>
    </section>

    <section
      id="quiz-list"
      class="quiz-dashboard-list"
    >
      ${renderQuizCards(
        lessons,
        'all',
        ''
      )}
    </section>
  `;

  bindCurrentViewEvents();

  bindQuizFilterEvents();
}

function renderQuizCards(
  lessons,
  filter,
  keyword
) {
  const normalizedKeyword =
    String(keyword || '')
      .trim()
      .toLowerCase();

  const filtered =
    lessons.filter(
      (lesson) => {
        const attemptCount =
          Number(
            lesson.progress
              .attempt_count ||
              0
          );

        const remainingAttempts =
          Math.max(
            MAX_QUIZ_ATTEMPTS -
              attemptCount,
            0
          );

        const isLocked =
          lesson.progress.status ===
          'locked';

        const isPassed =
          lesson.progress.status ===
            'passed' ||
          Number(
            lesson.progress
              .best_score ||
              0
          ) >=
            Number(
              lesson.passing_score ||
              70
            );

        let matchesFilter =
          true;

        if (
          filter === 'available'
        ) {
          matchesFilter =
            !isLocked &&
            remainingAttempts > 0;
        }

        if (
          filter === 'passed'
        ) {
          matchesFilter =
            isPassed;
        }

        if (
          filter === 'exhausted'
        ) {
          matchesFilter =
            !isLocked &&
            remainingAttempts <= 0;
        }

        const searchableText =
          `
            ${lesson.order_number}
            ${lesson.title || ''}
          `.toLowerCase();

        const matchesKeyword =
          !normalizedKeyword ||
          searchableText.includes(
            normalizedKeyword
          );

        return (
          matchesFilter &&
          matchesKeyword
        );
      }
    );

  if (
    filtered.length === 0
  ) {
    return `
      <div class="dashboard-empty-state">
        Không tìm thấy bài kiểm tra phù hợp.
      </div>
    `;
  }

  return filtered
    .map(
      renderQuizDashboardCard
    )
    .join('');
}

function renderQuizDashboardCard(
  lesson
) {
  const status =
    lesson.progress.status;

  const isLocked =
    status === 'locked';

  const attemptCount =
    Number(
      lesson.progress
        .attempt_count ||
        0
    );

  const remainingAttempts =
    Math.max(
      MAX_QUIZ_ATTEMPTS -
        attemptCount,
      0
    );

  const bestScore =
    lesson.progress
      .best_score;

  const passingScore =
    Number(
      lesson.passing_score ||
      70
    );

  const isPassed =
    status === 'passed' ||
    Number(
      bestScore ||
      0
    ) >= passingScore;

  const exhausted =
    !isLocked &&
    remainingAttempts <= 0;

  let statusText =
    'Chưa làm bài';

  let statusClass =
    'not-started';

  if (isLocked) {
    statusText =
      'Chưa mở khóa';

    statusClass =
      'locked';
  } else if (isPassed) {
    statusText =
      'Đã đạt';

    statusClass =
      'passed';
  } else if (exhausted) {
    statusText =
      'Hết lượt';

    statusClass =
      'exhausted';
  } else if (
    attemptCount > 0
  ) {
    statusText =
      'Chưa đạt';

    statusClass =
      'failed';
  } else {
    statusText =
      'Có thể làm';

    statusClass =
      'available';
  }

  const buttonDisabled =
    isLocked ||
    exhausted;

  return `
    <article
      class="quiz-dashboard-card"
    >
      <div
        class="quiz-dashboard-number"
      >
        ${escapeHtml(
          lesson.order_number
        )}
      </div>

      <div
        class="quiz-dashboard-content"
      >
        <div
          class="quiz-dashboard-heading"
        >
          <div>
            <p>
              Bài
              ${escapeHtml(
                lesson.order_number
              )}
            </p>

            <h3>
              ${escapeHtml(
                lesson.title
              )}
            </h3>
          </div>

          <span
            class="
              quiz-status-badge
              ${statusClass}
            "
          >
            ${statusText}
          </span>
        </div>

        <div
          class="quiz-dashboard-metrics"
        >
          <div>
            <span>
              Điểm cao nhất
            </span>

            <strong>
              ${
                bestScore !==
                  null &&
                bestScore !==
                  undefined
                  ? `${escapeHtml(
                      bestScore
                    )}/100`
                  : '--'
              }
            </strong>
          </div>

          <div>
            <span>
              Điểm đạt
            </span>

            <strong>
              ${passingScore}/100
            </strong>
          </div>

          <div>
            <span>
              Đã sử dụng
            </span>

            <strong>
              ${attemptCount}/${
                MAX_QUIZ_ATTEMPTS
              }
            </strong>
          </div>

          <div>
            <span>
              Còn lại
            </span>

            <strong>
              ${remainingAttempts}
            </strong>
          </div>
        </div>
      </div>

      <button
        class="dashboard-open-quiz-button"
        type="button"
        data-lesson-id="${lesson.id}"
        data-status="${escapeAttribute(
          status
        )}"
        ${
          buttonDisabled
            ? 'disabled'
            : ''
        }
      >
        ${
          isLocked
            ? 'Chưa mở khóa'
            : exhausted
              ? 'Hết lượt'
              : attemptCount > 0
                ? 'Làm lại'
                : 'Bắt đầu'
        }
      </button>
    </article>
  `;
}

function bindQuizFilterEvents() {
  const searchInput =
    document.querySelector(
      '#quiz-search-input'
    );

  const filterButtons =
    document.querySelectorAll(
      '[data-quiz-filter]'
    );

  let activeFilter =
    'all';

  const updateList = () => {
    const list =
      document.querySelector(
        '#quiz-list'
      );

    if (!list) {
      return;
    }

    list.innerHTML =
      renderQuizCards(
        dashboardState.lessons,
        activeFilter,
        searchInput?.value ||
          ''
      );

    bindCurrentViewEvents();
  };

  searchInput?.addEventListener(
    'input',
    updateList
  );

  filterButtons.forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          activeFilter =
            button.dataset
              .quizFilter;

          filterButtons.forEach(
            (item) => {
              item.classList.toggle(
                'active',
                item === button
              );
            }
          );

          updateList();
        }
      );
    }
  );
}

/* =========================================================
   TRANG TÀI LIỆU
========================================================= */

function renderDocumentsView(
  container
) {
  const {
    lessons,
  } = dashboardState;

  container.innerHTML = `
    ${renderDashboardViewHeader({
      eyebrow:
        'KHO TÀI LIỆU',
      title:
        'Tài liệu đào tạo',
      description:
        'Tra cứu video, PDF và nội dung học tập theo từng bài.',
    })}

    <section
      class="dashboard-toolbar"
    >
      <label
        class="dashboard-search-box"
      >
        <span>⌕</span>

        <input
          id="document-search-input"
          type="search"
          placeholder="Tìm tài liệu..."
        >
      </label>

      <div
        class="dashboard-filter-buttons"
      >
        <button
          class="dashboard-filter-button active"
          type="button"
          data-document-filter="all"
        >
          Tất cả
        </button>

        <button
          class="dashboard-filter-button"
          type="button"
          data-document-filter="video"
        >
          Video
        </button>

        <button
          class="dashboard-filter-button"
          type="button"
          data-document-filter="pdf"
        >
          PDF
        </button>

        <button
          class="dashboard-filter-button"
          type="button"
          data-document-filter="content"
        >
          Nội dung
        </button>
      </div>
    </section>

    <section
      id="document-list"
      class="document-dashboard-grid"
    >
      ${renderDocumentCards(
        lessons,
        'all',
        ''
      )}
    </section>
  `;

  bindCurrentViewEvents();

  bindDocumentFilterEvents();
}

function renderDocumentCards(
  lessons,
  filter,
  keyword
) {
  const normalizedKeyword =
    String(keyword || '')
      .trim()
      .toLowerCase();

  const filtered =
    lessons.filter(
      (lesson) => {
        const hasVideo =
          Boolean(
            lesson.video_url
          );

        const hasPdf =
          Boolean(
            lesson.pdf_url
          );

        const hasContent =
          Boolean(
            lesson.content ||
            lesson.image_url
          );

        let matchesFilter =
          true;

        if (
          filter === 'video'
        ) {
          matchesFilter =
            hasVideo;
        }

        if (
          filter === 'pdf'
        ) {
          matchesFilter =
            hasPdf;
        }

        if (
          filter === 'content'
        ) {
          matchesFilter =
            hasContent;
        }

        const searchableText =
          `
            ${lesson.order_number}
            ${lesson.title || ''}
            ${lesson.description || ''}
          `.toLowerCase();

        const matchesKeyword =
          !normalizedKeyword ||
          searchableText.includes(
            normalizedKeyword
          );

        return (
          matchesFilter &&
          matchesKeyword
        );
      }
    );

  if (
    filtered.length === 0
  ) {
    return `
      <div class="dashboard-empty-state">
        Không tìm thấy tài liệu phù hợp.
      </div>
    `;
  }

  return filtered
    .map(
      renderDocumentDashboardCard
    )
    .join('');
}

function renderDocumentDashboardCard(
  lesson
) {
  const isLocked =
    lesson.progress.status ===
    'locked';

  const hasVideo =
    Boolean(
      lesson.video_url
    );

  const hasPdf =
    Boolean(
      lesson.pdf_url
    );

  const hasContent =
    Boolean(
      lesson.content ||
      lesson.image_url
    );

  return `
    <article
      class="
        document-dashboard-card
        ${
          isLocked
            ? 'locked'
            : ''
        }
      "
    >
      <div
        class="document-dashboard-top"
      >
        <span
          class="document-dashboard-number"
        >
          Bài
          ${escapeHtml(
            lesson.order_number
          )}
        </span>

        <span
          class="
            document-dashboard-status
            ${
              isLocked
                ? 'locked'
                : 'available'
            }
          "
        >
          ${
            isLocked
              ? 'Chưa mở khóa'
              : 'Có thể xem'
          }
        </span>
      </div>

      <h3>
        ${escapeHtml(
          lesson.title
        )}
      </h3>

      <p>
        ${escapeHtml(
          lesson.description ||
          ''
        )}
      </p>

      <div
        class="document-type-list"
      >
        ${
          hasVideo
            ? '<span class="video">Video</span>'
            : ''
        }

        ${
          hasPdf
            ? '<span class="pdf">PDF</span>'
            : ''
        }

        ${
          hasContent
            ? '<span class="content">Nội dung</span>'
            : ''
        }
      </div>

      <button
        class="dashboard-open-lesson-button"
        type="button"
        data-lesson-id="${lesson.id}"
        data-status="${escapeAttribute(
          lesson.progress.status
        )}"
        ${
          isLocked
            ? 'disabled'
            : ''
        }
      >
        ${
          isLocked
            ? 'Chưa mở khóa'
            : 'Xem tài liệu'
        }
      </button>
    </article>
  `;
}

function bindDocumentFilterEvents() {
  const searchInput =
    document.querySelector(
      '#document-search-input'
    );

  const filterButtons =
    document.querySelectorAll(
      '[data-document-filter]'
    );

  let activeFilter =
    'all';

  const updateList = () => {
    const list =
      document.querySelector(
        '#document-list'
      );

    if (!list) {
      return;
    }

    list.innerHTML =
      renderDocumentCards(
        dashboardState.lessons,
        activeFilter,
        searchInput?.value ||
          ''
      );

    bindCurrentViewEvents();
  };

  searchInput?.addEventListener(
    'input',
    updateList
  );

  filterButtons.forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          activeFilter =
            button.dataset
              .documentFilter;

          filterButtons.forEach(
            (item) => {
              item.classList.toggle(
                'active',
                item === button
              );
            }
          );

          updateList();
        }
      );
    }
  );
}

/* =========================================================
   TRANG TRỢ LÝ AI
========================================================= */

function renderAiView(
  container
) {
  const configuredLessons =
    dashboardState.lessons.filter(
      (lesson) =>
        Number(
          lesson.order_number
        ) >= 1 &&
        Number(
          lesson.order_number
        ) <= 22 &&
        lesson.progress.status !==
          'locked'
    );

  if (
    configuredLessons.length === 0
  ) {
    container.innerHTML = `
      ${renderDashboardViewHeader({
        eyebrow:
          'TRỢ LÝ AI',
        title:
          'Hỏi đáp theo bài học',
        description:
          'Chatbox AI chỉ trả lời theo tài liệu của bài được chọn.',
      })}

      <div class="dashboard-empty-state">
        Chưa có bài học nào được mở khóa
        để sử dụng Trợ lý AI.
      </div>
    `;

    bindCurrentViewEvents();

    return;
  }

  const selectedLesson =
    configuredLessons.find(
      (lesson) =>
        Number(
          lesson.order_number
        ) ===
        Number(
          dashboardState
            .selectedAiLessonNumber
        )
    ) ||
    configuredLessons[0];

  dashboardState
    .selectedAiLessonNumber =
    Number(
      selectedLesson.order_number
    );

  container.innerHTML = `
    ${renderDashboardViewHeader({
      eyebrow:
        'TRỢ LÝ AI',
      title:
        'Hỏi đáp theo bài học',
      description:
        'Chọn bài học ở cột bên trái và đặt câu hỏi cho Trợ lý AI.',
    })}

    <section class="standalone-ai-layout">
      <aside
        class="standalone-ai-lessons"
      >
        <div
          class="standalone-ai-sidebar-heading"
        >
          <h2>
            Chọn bài học
          </h2>

          <p>
            Bài 1 đến Bài 22
          </p>
        </div>

        <div
          class="standalone-ai-lesson-list"
        >
          ${configuredLessons
            .map(
              (lesson) => `
                <button
                  class="
                    standalone-ai-lesson-button
                    ${
                      Number(
                        lesson.order_number
                      ) ===
                      Number(
                        selectedLesson
                          .order_number
                      )
                        ? 'active'
                        : ''
                    }
                  "
                  type="button"
                  data-ai-lesson-number="${
                    lesson.order_number
                  }"
                >
                  <span>
                    ${escapeHtml(
                      lesson.order_number
                    )}
                  </span>

                  <strong>
                    ${escapeHtml(
                      lesson.title
                    )}
                  </strong>
                </button>
              `
            )
            .join('')}
        </div>
      </aside>

      <div
        class="standalone-ai-main"
      >
        <div
          class="standalone-ai-heading"
        >
          <div>
            <p>
              ĐANG HỎI VỀ
            </p>

            <h2>
              Bài
              ${escapeHtml(
                selectedLesson
                  .order_number
              )}
              -
              ${escapeHtml(
                selectedLesson.title
              )}
            </h2>
          </div>

          <span>
            AI theo tài liệu
          </span>
        </div>

        <div
          class="standalone-ai-suggestions"
        >
          <button
            type="button"
            data-ai-suggestion="Tóm tắt nội dung bài học này."
          >
            Tóm tắt bài học
          </button>

          <button
            type="button"
            data-ai-suggestion="Giải thích nguyên lý làm việc chính trong bài."
          >
            Giải thích nguyên lý
          </button>

          <button
            type="button"
            data-ai-suggestion="Liệt kê các thông số quan trọng cần nhớ."
          >
            Thông số cần nhớ
          </button>

          <button
            type="button"
            data-ai-suggestion="Hãy tạo 5 câu hỏi ôn tập cho bài này."
          >
            5 câu hỏi ôn tập
          </button>
        </div>

        <div
          id="standalone-ai-chat-container"
          class="standalone-ai-chat-container"
        ></div>
      </div>
    </section>
  `;

  bindCurrentViewEvents();

  bindAiViewEvents(
    configuredLessons
  );

  renderStandaloneLessonChat(
    selectedLesson.order_number,
    selectedLesson.title,
    document.querySelector(
      '#standalone-ai-chat-container'
    )
  );
}

function bindAiViewEvents(
  configuredLessons
) {
  document
    .querySelectorAll(
      '[data-ai-lesson-number]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const lessonNumber =
              Number(
                button.dataset
                  .aiLessonNumber
              );

            const selectedLesson =
              configuredLessons.find(
                (lesson) =>
                  Number(
                    lesson
                      .order_number
                  ) ===
                  lessonNumber
              );

            if (!selectedLesson) {
              return;
            }

            dashboardState
              .selectedAiLessonNumber =
              lessonNumber;

            const container =
              document.querySelector(
                '#dashboard-view'
              );

            renderAiView(
              container
            );
          }
        );
      }
    );

  document
    .querySelectorAll(
      '[data-ai-suggestion]'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const suggestion =
              button.dataset
                .aiSuggestion;

            copyTextToClipboard(
              suggestion
            );

            showTemporaryNotice(
              button,
              'Đã sao chép câu hỏi'
            );
          }
        );
      }
    );
}

/* =========================================================
   SỰ KIỆN CHUNG CỦA TỪNG VIEW
========================================================= */

function bindCurrentViewEvents() {
  document
    .querySelectorAll(
      '[data-dashboard-view]'
    )
    .forEach(
      (button) => {
        button.onclick = () => {
          showDashboardView(
            button.dataset
              .dashboardView
          );
        };
      }
    );

  document
    .querySelectorAll(
      '.dashboard-open-lesson-button'
    )
    .forEach(
      (button) => {
        button.onclick =
          async () => {
            if (
              button.disabled
            ) {
              return;
            }

            const lessonId =
              Number(
                button.dataset
                  .lessonId
              );

            const status =
              button.dataset
                .status;

            if (
              !lessonId ||
              status ===
                'locked'
            ) {
              return;
            }

            await renderLessonPage(
              lessonId,
              dashboardState
                .course.id,
              dashboardState.user
            );
          };
      }
    );

  document
    .querySelectorAll(
      '.dashboard-open-quiz-button'
    )
    .forEach(
      (button) => {
        button.onclick =
          async () => {
            if (
              button.disabled
            ) {
              return;
            }

            const lessonId =
              Number(
                button.dataset
                  .lessonId
              );

            const status =
              button.dataset
                .status;

            if (
              !lessonId ||
              status ===
                'locked'
            ) {
              return;
            }

            await renderQuizPage(
              lessonId,
              dashboardState
                .course.id,
              dashboardState.user
            );
          };
      }
    );
}

/* =========================================================
   HÀM PHỤ
========================================================= */

function getLessonStatusIcon(
  status
) {
  const icons = {
    passed: '✓',
    available: '▶',
    studying: '▶',
    locked: '⌁',
  };

  return (
    icons[status] ||
    '•'
  );
}

function getLessonButtonText(
  status,
  hasContent
) {
  if (!hasContent) {
    return 'Đang chuẩn bị';
  }

  if (
    status === 'locked'
  ) {
    return 'Chưa mở khóa';
  }

  if (
    status === 'passed'
  ) {
    return 'Xem lại';
  }

  if (
    status === 'studying'
  ) {
    return 'Tiếp tục';
  }

  return 'Học bài';
}

function renderStudentInformationCard(
  profile
) {
  return `
    <section
      class="dashboard-side-card"
    >
      <p class="dashboard-eyebrow">
        THÔNG TIN THỰC TẬP
      </p>

      <h3>
        Hồ sơ sinh viên
      </h3>

      <div
        class="internship-information-list"
      >
        <div>
          <span>
            Mã sinh viên
          </span>

          <strong>
            ${escapeHtml(
              profile.student_code ||
              'Chưa cập nhật'
            )}
          </strong>
        </div>

        <div>
          <span>
            Trường
          </span>

          <strong>
            ${escapeHtml(
              profile.university ||
              'Chưa cập nhật'
            )}
          </strong>
        </div>

        <div>
          <span>
            Chuyên ngành
          </span>

          <strong>
            ${escapeHtml(
              profile.major ||
              'Chưa cập nhật'
            )}
          </strong>
        </div>

        <div>
          <span>
            Thời gian
          </span>

          <strong>
            ${formatInternshipPeriod(
              profile
                .internship_start,
              profile
                .internship_end
            )}
          </strong>
        </div>
      </div>
    </section>
  `;
}

function getGreetingText() {
  const hour =
    new Date().getHours();

  if (hour < 11) {
    return 'Chào buổi sáng';
  }

  if (hour < 18) {
    return 'Chào buổi chiều';
  }

  return 'Chào buổi tối';
}

function getFirstName(
  fullName
) {
  const parts =
    String(
      fullName || ''
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  return (
    parts[
      parts.length - 1
    ] ||
    'Sinh viên'
  );
}

function getInitials(
  fullName
) {
  const parts =
    String(
      fullName || ''
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length === 0
  ) {
    return 'SV';
  }

  if (
    parts.length === 1
  ) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[
      parts.length - 1
    ][0]
  ).toUpperCase();
}

function formatInternshipPeriod(
  startDate,
  endDate
) {
  if (
    !startDate &&
    !endDate
  ) {
    return 'Chưa cập nhật';
  }

  const formatDate =
    (value) => {
      if (!value) {
        return '...';
      }

      const date =
        new Date(value);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return value;
      }

      return new Intl
        .DateTimeFormat(
          'vi-VN'
        )
        .format(date);
    };

  return `${formatDate(
    startDate
  )} - ${formatDate(
    endDate
  )}`;
}

function getDefaultAiLessonNumber(
  lessons
) {
  const current =
    lessons.find(
      (lesson) =>
        Number(
          lesson.order_number
        ) <= 22 &&
        lesson.progress.status ===
        'studying'
    ) ||
    lessons.find(
      (lesson) =>
        Number(
          lesson.order_number
        ) <= 22 &&
        lesson.progress.status ===
        'available'
    ) ||
    lessons.find(
      (lesson) =>
        Number(
          lesson.order_number
        ) <= 22 &&
        lesson.progress.status !==
        'locked'
    );

  return current
    ? Number(
        current.order_number
      )
    : 1;
}

async function copyTextToClipboard(
  text
) {
  try {
    await navigator.clipboard.writeText(
      text
    );
  } catch (error) {
    console.warn(
      'Không thể sao chép:',
      error
    );
  }
}

function showTemporaryNotice(
  button,
  message
) {
  const oldText =
    button.textContent;

  button.textContent =
    message;

  window.setTimeout(
    () => {
      button.textContent =
        oldText;
    },
    1200
  );
}
