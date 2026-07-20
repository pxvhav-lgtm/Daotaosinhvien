/*
 * Dashboard sinh viên phiên bản hiện đại.
 * Giữ nguyên luồng dữ liệu Supabase và chức năng mở bài hiện có.
 */

const TRAINING_MODULES = [
  {
    id: 1,
    title: 'Tổng quan và sơ đồ điện',
    description:
      'Kiến thức nền tảng về nhà máy và sơ đồ điện chính.',
    from: 1,
    to: 2,
  },
  {
    id: 2,
    title: 'Các hệ thống phụ trợ',
    description:
      'Các hệ thống phục vụ vận hành an toàn và liên tục.',
    from: 3,
    to: 8,
  },
  {
    id: 3,
    title: 'Thiết bị điện và cơ khí chính',
    description:
      'Máy biến áp, thiết bị đầu cực, van và tổ máy.',
    from: 9,
    to: 13,
  },
  {
    id: 4,
    title: 'Điều khiển và bảo vệ',
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

/* =========================================================
   DASHBOARD
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
      'Đang tải lộ trình đào tạo...'
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
        .order('order_number', {
          ascending: true,
        }),

      supabaseClient
        .from('lesson_progress')
        .select(`
          lesson_id,
          status,
          best_score,
          attempt_count,
          video_completed
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
        'Không tải được lộ trình đào tạo.'
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
      lessonsResult.data ?? [];

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
              video_completed: false,
            },
        };
      });

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
          lesson.progress.status ===
            'available' ||
          lesson.progress.status ===
            'studying'
      ).length;

    const progressPercent =
      totalLessons > 0
        ? Math.round(
            (passedLessons /
              totalLessons) *
              100
          )
        : 0;

    const scoredLessons =
      lessonsWithProgress.filter(
        (lesson) =>
          lesson.progress.best_score !==
          null &&
          lesson.progress.best_score !==
          undefined
      );

    const averageScore =
      scoredLessons.length > 0
        ? Math.round(
            scoredLessons.reduce(
              (sum, lesson) =>
                sum +
                Number(
                  lesson.progress
                    .best_score || 0
                ),
              0
            ) / scoredLessons.length
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

    const currentModule =
      nextLesson
        ? TRAINING_MODULES.find(
            (module) =>
              nextLesson.order_number >=
                module.from &&
              nextLesson.order_number <=
                module.to
          )
        : null;

    app.innerHTML = `
      ${renderMainHeader(
        'Hệ thống đào tạo sinh viên thực tập',
        false
      )}

      <main class="digital-dashboard">
        <button
          class="dashboard-menu-toggle"
          id="dashboard-menu-toggle"
          type="button"
          aria-label="Mở menu Dashboard"
          aria-expanded="false"
        >
          ☰
        </button>

        <div
          class="dashboard-sidebar-overlay"
          id="dashboard-sidebar-overlay"
        ></div>

        ${renderDashboardSidebar({
          profile,
          totalLessons,
          passedLessons,
          progressPercent,
        })}

        <section class="dashboard-main-content">
          ${renderDashboardHero({
            profile,
            course,
            nextLesson,
            currentModule,
          })}

          ${renderDashboardStatistics({
            totalLessons,
            passedLessons,
            availableLessons,
            averageScore,
          })}

          <div class="dashboard-content-grid">
            <div class="dashboard-primary-column">
              ${renderProgressOverview({
                totalLessons,
                passedLessons,
                progressPercent,
                enrollmentStatus:
                  enrollment?.status ||
                  'assigned',
                nextLesson,
              })}

              ${
                nextLesson
                  ? renderNextLessonCard(
                      nextLesson
                    )
                  : renderCourseCompletedCard()
              }

              ${renderTrainingRoadmap(
                lessonsWithProgress
              )}
            </div>

            <aside class="dashboard-secondary-column">
              ${renderLearningSummary({
                lessonsWithProgress,
                averageScore,
                progressPercent,
              })}

              ${renderAiPromotionCard(
                nextLesson
              )}

              ${renderInternshipInformation(
                profile
              )}
            </aside>
          </div>
        </section>
      </main>
    `;

    const logoutButton =
      document.querySelector(
        '#logout-button'
      );

    if (logoutButton) {
      logoutButton.addEventListener(
        'click',
        handleLogout
      );
    }

    attachDashboardLessonEvents(
      course.id,
      user
    );

    attachDashboardNavigation();
  };

/* =========================================================
   SIDEBAR
========================================================= */

function renderDashboardSidebar({
  profile,
  totalLessons,
  passedLessons,
  progressPercent,
}) {
  return `
    <aside
      class="dashboard-sidebar"
      id="dashboard-sidebar"
    >
      <div class="sidebar-brand">
        <img
          src="./Logo.png"
          alt="Logo Công ty Cổ phần Thủy điện A Vương"
        >

        <div>
          <strong>A VƯƠNG</strong>
          <span>Training Platform</span>
        </div>
      </div>

      <nav
        class="dashboard-navigation"
        aria-label="Điều hướng Dashboard"
      >
        <button
          class="dashboard-nav-item active"
          type="button"
          data-scroll-target="dashboard-overview"
        >
          <span class="dashboard-nav-icon">
            ◫
          </span>

          <span>Tổng quan</span>
        </button>

        <button
          class="dashboard-nav-item"
          type="button"
          data-scroll-target="training-roadmap"
        >
          <span class="dashboard-nav-icon">
            ▤
          </span>

          <span>Khóa học</span>
        </button>

        <button
          class="dashboard-nav-item"
          type="button"
          data-scroll-target="learning-progress"
        >
          <span class="dashboard-nav-icon">
            ◔
          </span>

          <span>Tiến độ của tôi</span>
        </button>

        <button
          class="dashboard-nav-item"
          type="button"
          data-scroll-target="training-roadmap"
        >
          <span class="dashboard-nav-icon">
            ✓
          </span>

          <span>Bài kiểm tra</span>
        </button>

        <button
          class="dashboard-nav-item"
          type="button"
          data-scroll-target="training-roadmap"
        >
          <span class="dashboard-nav-icon">
            ▣
          </span>

          <span>Tài liệu</span>
        </button>

        <button
          class="dashboard-nav-item"
          type="button"
          data-scroll-target="ai-assistant-card"
        >
          <span class="dashboard-nav-icon">
            ✦
          </span>

          <span>Trợ lý AI</span>
        </button>
      </nav>

      <div class="sidebar-course-progress">
        <span>Tiến độ khóa học</span>

        <strong>
          ${passedLessons}/${totalLessons}
          bài
        </strong>

        <div class="sidebar-progress-track">
          <div
            class="sidebar-progress-value"
            style="width: ${progressPercent}%"
          ></div>
        </div>

        <small>
          ${progressPercent}% hoàn thành
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
  `;
}

/* =========================================================
   HERO
========================================================= */

function renderDashboardHero({
  profile,
  course,
  nextLesson,
  currentModule,
}) {
  const greeting =
    getGreetingText();

  return `
    <section
      class="dashboard-hero"
      id="dashboard-overview"
    >
      <div class="dashboard-hero-copy">
        <p class="dashboard-eyebrow">
          CHƯƠNG TRÌNH THỰC TẬP
        </p>

        <h1>
          ${greeting},
          ${escapeHtml(
            getFirstName(
              profile.full_name ||
              'Sinh viên'
            )
          )}
        </h1>

        <p>
          ${escapeHtml(course.title)}
        </p>

        ${
          currentModule
            ? `
              <div class="dashboard-current-module">
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

      <div class="dashboard-hero-actions">
        <button
          class="dashboard-outline-button"
          type="button"
          data-scroll-target="training-roadmap"
        >
          Xem lộ trình
        </button>

        ${
          nextLesson
            ? `
              <button
                class="dashboard-primary-action dashboard-lesson-button"
                type="button"
                data-lesson-id="${nextLesson.id}"
                data-status="${escapeAttribute(
                  nextLesson.progress.status
                )}"
              >
                ${
                  nextLesson.progress
                    .status ===
                  'studying'
                    ? 'Tiếp tục học'
                    : 'Bắt đầu học'
                }
              </button>
            `
            : ''
        }
      </div>
    </section>
  `;
}

/* =========================================================
   THỐNG KÊ
========================================================= */

function renderDashboardStatistics({
  totalLessons,
  passedLessons,
  availableLessons,
  averageScore,
}) {
  return `
    <section class="dashboard-statistics">
      ${renderStatisticCard({
        icon: '▦',
        value: totalLessons,
        label: 'Tổng bài học',
        theme: 'blue',
      })}

      ${renderStatisticCard({
        icon: '✓',
        value: passedLessons,
        label: 'Đã hoàn thành',
        theme: 'green',
      })}

      ${renderStatisticCard({
        icon: '▶',
        value: availableLessons,
        label: 'Đang mở',
        theme: 'cyan',
      })}

      ${renderStatisticCard({
        icon: '★',
        value:
          averageScore > 0
            ? averageScore
            : '--',
        label: 'Điểm trung bình',
        theme: 'orange',
      })}
    </section>
  `;
}

function renderStatisticCard({
  icon,
  value,
  label,
  theme,
}) {
  return `
    <article
      class="
        dashboard-stat-card
        ${escapeAttribute(theme)}
      "
    >
      <div class="dashboard-stat-icon">
        ${icon}
      </div>

      <div>
        <strong>${value}</strong>
        <span>${escapeHtml(label)}</span>
      </div>
    </article>
  `;
}

/* =========================================================
   TIẾN ĐỘ
========================================================= */

function renderProgressOverview({
  totalLessons,
  passedLessons,
  progressPercent,
  enrollmentStatus,
  nextLesson,
}) {
  return `
    <section
      class="dashboard-panel progress-overview-card"
      id="learning-progress"
    >
      <div class="dashboard-panel-heading">
        <div>
          <p class="dashboard-eyebrow">
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
                    Bài ${escapeHtml(
                      nextLesson.order_number
                    )} -
                    ${escapeHtml(
                      nextLesson.title
                    )}
                  </strong>
                `
                : `
                  Bạn đã hoàn thành toàn bộ lộ trình.
                `
            }
          </p>
        </div>

        <div
          class="modern-progress-ring"
          style="--progress: ${progressPercent}"
          aria-label="${progressPercent}% hoàn thành"
        >
          <div>
            <strong>
              ${progressPercent}%
            </strong>

            <span>Hoàn thành</span>
          </div>
        </div>
      </div>

      <div class="main-progress-track">
        <div
          class="main-progress-value"
          style="width: ${progressPercent}%"
        ></div>
      </div>

      <div class="progress-footer">
        <span>
          Trạng thái:
          <strong>
            ${formatCourseStatus(
              enrollmentStatus
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
  `;
}

/* =========================================================
   BÀI HỌC TIẾP THEO
========================================================= */

function renderNextLessonCard(
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
          ${escapeHtml(lesson.title)}
        </h2>

        <p>
          ${escapeHtml(
            lesson.description ||
            'Nội dung đào tạo đang sẵn sàng.'
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
        class="dashboard-primary-action dashboard-lesson-button"
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

function renderCourseCompletedCard() {
  return `
    <section class="course-completed-card">
      <div class="course-completed-icon">
        ✓
      </div>

      <div>
        <p class="dashboard-eyebrow">
          HOÀN THÀNH LỘ TRÌNH
        </p>

        <h2>
          Bạn đã hoàn thành chương trình
        </h2>

        <p>
          Hãy kiểm tra kết quả tổng kết và
          chờ đánh giá từ người phụ trách.
        </p>
      </div>
    </section>
  `;
}

/* =========================================================
   LỘ TRÌNH
========================================================= */

function renderTrainingRoadmap(
  lessonsWithProgress
) {
  return `
    <section
      class="dashboard-panel training-roadmap-section"
      id="training-roadmap"
    >
      <div class="section-heading">
        <div>
          <p class="dashboard-eyebrow">
            LỘ TRÌNH ĐÀO TẠO
          </p>

          <h2>
            Danh sách 23 bài học
          </h2>

          <p>
            Hoàn thành bài kiểm tra đạt yêu
            cầu để mở khóa bài học tiếp theo.
          </p>
        </div>

        <div class="roadmap-legend">
          <span class="legend-item passed">
            Đã hoàn thành
          </span>

          <span class="legend-item available">
            Có thể học
          </span>

          <span class="legend-item locked">
            Chưa mở khóa
          </span>
        </div>
      </div>

      <div class="module-list">
        ${TRAINING_MODULES.map(
          (module) =>
            renderTrainingModule(
              module,
              lessonsWithProgress
            )
        ).join('')}
      </div>
    </section>
  `;
}

/* =========================================================
   CHUYÊN ĐỀ
========================================================= */

function renderTrainingModule(
  module,
  lessons
) {
  const moduleLessons =
    lessons.filter(
      (lesson) =>
        lesson.order_number >=
          module.from &&
        lesson.order_number <=
          module.to
    );

  const completedCount =
    moduleLessons.filter(
      (lesson) =>
        lesson.progress.status ===
        'passed'
    ).length;

  const modulePercent =
    moduleLessons.length > 0
      ? Math.round(
          (completedCount /
            moduleLessons.length) *
            100
        )
      : 0;

  return `
    <article class="training-module-card">
      <header class="module-header">
        <div class="module-index">
          ${String(module.id).padStart(
            2,
            '0'
          )}
        </div>

        <div class="module-title">
          <p>
            Chuyên đề ${module.id}
          </p>

          <h3>
            ${escapeHtml(module.title)}
          </h3>

          <span>
            ${escapeHtml(
              module.description
            )}
          </span>
        </div>

        <div class="module-progress-summary">
          <strong>
            ${completedCount}/${
              moduleLessons.length
            }
          </strong>

          <span>Hoàn thành</span>
        </div>
      </header>

      <div class="module-progress-track">
        <div
          class="module-progress-value"
          style="width: ${modulePercent}%"
        ></div>
      </div>

      <div class="module-lessons">
        ${moduleLessons
          .map(renderDashboardLessonItem)
          .join('')}
      </div>
    </article>
  `;
}

/* =========================================================
   BÀI HỌC
========================================================= */

function renderDashboardLessonItem(
  lesson
) {
  const status =
    lesson.progress.status;

  const isLocked =
    status === 'locked';

  const hasLearningContent =
    Boolean(
      lesson.video_url ||
      lesson.pdf_url ||
      lesson.content ||
      lesson.image_url
    );

  const buttonDisabled =
    isLocked || !hasLearningContent;

  const resourceTags = [
    lesson.video_url
      ? `
        <span class="resource-tag video">
          Video
        </span>
      `
      : '',

    lesson.pdf_url
      ? `
        <span class="resource-tag pdf">
          PDF
        </span>
      `
      : '',

    Number(lesson.order_number) <= 22
      ? `
        <span class="resource-tag ai">
          AI
        </span>
      `
      : '',

    lesson.progress.best_score !==
    null
      ? `
        <span class="resource-tag score">
          Điểm:
          ${escapeHtml(
            lesson.progress.best_score
          )}
        </span>
      `
      : '',

    !hasLearningContent
      ? `
        <span class="resource-tag preparing">
          Đang cập nhật nội dung
        </span>
      `
      : '',
  ].join('');

  return `
    <div
      class="
        roadmap-lesson-item
        ${escapeAttribute(status)}
      "
    >
      <div class="roadmap-status-icon">
        ${getLessonStatusIcon(status)}
      </div>

      <div class="roadmap-lesson-number">
        Bài ${escapeHtml(
          lesson.order_number
        )}
      </div>

      <div class="roadmap-lesson-information">
        <h4>
          ${escapeHtml(lesson.title)}
        </h4>

        <p>
          ${escapeHtml(
            lesson.description || ''
          )}
        </p>

        <div class="lesson-resource-tags">
          ${resourceTags}
        </div>
      </div>

      <div class="roadmap-lesson-action">
        <span
          class="
            roadmap-status-text
            ${escapeAttribute(status)}
          "
        >
          ${formatLessonStatus(status)}
        </span>

        <button
          class="dashboard-lesson-button"
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
            hasLearningContent
          )}
        </button>
      </div>
    </div>
  `;
}

function getLessonStatusIcon(
  status
) {
  const icons = {
    passed: '✓',
    available: '▶',
    studying: '▶',
    locked: '⌁',
  };

  return icons[status] || '•';
}

function getLessonButtonText(
  status,
  hasContent
) {
  if (!hasContent) {
    return 'Đang chuẩn bị';
  }

  if (status === 'locked') {
    return 'Chưa mở khóa';
  }

  if (status === 'passed') {
    return 'Xem lại';
  }

  if (status === 'studying') {
    return 'Tiếp tục';
  }

  return 'Học bài';
}

/* =========================================================
   CỘT THÔNG TIN PHỤ
========================================================= */

function renderLearningSummary({
  lessonsWithProgress,
  averageScore,
  progressPercent,
}) {
  const attemptedLessons =
    lessonsWithProgress.filter(
      (lesson) =>
        Number(
          lesson.progress
            .attempt_count || 0
        ) > 0
    ).length;

  const videoCompleted =
    lessonsWithProgress.filter(
      (lesson) =>
        lesson.progress
          .video_completed === true
    ).length;

  return `
    <section class="dashboard-side-card">
      <div class="dashboard-side-card-heading">
        <div>
          <p class="dashboard-eyebrow">
            TỔNG QUAN
          </p>

          <h3>
            Hoạt động học tập
          </h3>
        </div>

        <span class="side-card-badge">
          ${progressPercent}%
        </span>
      </div>

      <div class="learning-summary-list">
        <div>
          <span>Đã làm quiz</span>
          <strong>${attemptedLessons}</strong>
        </div>

        <div>
          <span>Video đã xem</span>
          <strong>${videoCompleted}</strong>
        </div>

        <div>
          <span>Điểm trung bình</span>
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
  `;
}

function renderAiPromotionCard(
  nextLesson
) {
  return `
    <section
      class="dashboard-side-card ai-promotion-card"
      id="ai-assistant-card"
    >
      <div class="ai-card-icon">
        ✦
      </div>

      <p class="dashboard-eyebrow">
        TRỢ LÝ AI THEO BÀI HỌC
      </p>

      <h3>
        Hỏi đáp dựa trên tài liệu đào tạo
      </h3>

      <p>
        Chatbox AI chỉ sử dụng kho tài liệu
        của bài đang học để giải thích nội
        dung, thông số và câu hỏi ôn tập.
      </p>

      ${
        nextLesson
          ? `
            <button
              class="dashboard-ai-button dashboard-lesson-button"
              type="button"
              data-lesson-id="${nextLesson.id}"
              data-status="${escapeAttribute(
                nextLesson.progress.status
              )}"
            >
              Mở bài có Trợ lý AI
            </button>
          `
          : ''
      }
    </section>
  `;
}

function renderInternshipInformation(
  profile
) {
  return `
    <section class="dashboard-side-card">
      <p class="dashboard-eyebrow">
        THÔNG TIN THỰC TẬP
      </p>

      <h3>
        Hồ sơ sinh viên
      </h3>

      <div class="internship-information-list">
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

        <div>
          <span>Thời gian</span>

          <strong>
            ${formatInternshipPeriod(
              profile.internship_start,
              profile.internship_end
            )}
          </strong>
        </div>
      </div>
    </section>
  `;
}

/* =========================================================
   SỰ KIỆN
========================================================= */

function attachDashboardLessonEvents(
  courseId,
  user
) {
  document
    .querySelectorAll(
      '.dashboard-lesson-button'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        async () => {
          if (button.disabled) {
            return;
          }

          const lessonId =
            Number(
              button.dataset.lessonId
            );

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

function attachDashboardNavigation() {
  const sidebar =
    document.querySelector(
      '#dashboard-sidebar'
    );

  const overlay =
    document.querySelector(
      '#dashboard-sidebar-overlay'
    );

  const toggleButton =
    document.querySelector(
      '#dashboard-menu-toggle'
    );

  const closeSidebar = () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('visible');

    toggleButton?.setAttribute(
      'aria-expanded',
      'false'
    );
  };

  toggleButton?.addEventListener(
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

      toggleButton.setAttribute(
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
      '[data-scroll-target]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const targetId =
            button.dataset
              .scrollTarget;

          const target =
            document.getElementById(
              targetId
            );

          if (!target) {
            return;
          }

          document
            .querySelectorAll(
              '.dashboard-nav-item'
            )
            .forEach((item) => {
              item.classList.remove(
                'active'
              );
            });

          if (
            button.classList.contains(
              'dashboard-nav-item'
            )
          ) {
            button.classList.add(
              'active'
            );
          }

          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });

          closeSidebar();
        }
      );
    });
}

/* =========================================================
   HÀM HỖ TRỢ
========================================================= */

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
    String(fullName)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  return (
    parts[parts.length - 1] ||
    'Sinh viên'
  );
}

function getInitials(
  fullName
) {
  const parts =
    String(fullName)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (parts.length === 0) {
    return 'SV';
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

function formatInternshipPeriod(
  startDate,
  endDate
) {
  if (!startDate && !endDate) {
    return 'Chưa cập nhật';
  }

  const formatDate = (value) => {
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

    return new Intl.DateTimeFormat(
      'vi-VN'
    ).format(date);
  };

  return `${formatDate(
    startDate
  )} - ${formatDate(endDate)}`;
}
