/*
 * Dashboard phiên bản 2
 * Hiển thị lộ trình đào tạo gồm 23 bài học.
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
    title: 'Thị trường điện và thiết bị trạm 220 kV',
    description:
      'Thị trường điện và thiết bị nhất thứ ngoài trời.',
    from: 18,
    to: 21,
  },
  {
    id: 6,
    title: 'Đập tràn và đánh giá cuối khóa',
    description:
      'Thiết bị tại Đập tràn và bài đánh giá tổng hợp.',
    from: 22,
    to: 23,
  },
];

/* =========================================================
   DASHBOARD MỚI
========================================================= */

window.renderDashboard = async function (user) {
  clearQuizTimer();

  if (
    typeof clearLessonVideoCountdown ===
    'function'
  ) {
    clearLessonVideoCountdown();
  }

  renderLoading('Đang tải lộ trình đào tạo...');

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

  const profile = profileResult.data;

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
          (passedLessons / totalLessons) *
            100
        )
      : 0;

  const nextLesson =
    lessonsWithProgress.find(
      (lesson) =>
        lesson.progress.status ===
          'available' ||
        lesson.progress.status ===
          'studying'
    );

  app.innerHTML = `
    ${renderMainHeader(
      'Hệ thống đào tạo sinh viên thực tập',
      false
    )}

    <main class="training-dashboard">
      ${renderStudentWelcome(
        profile,
        course
      )}

      ${renderProgressOverview({
        totalLessons,
        passedLessons,
        availableLessons,
        progressPercent,
        enrollmentStatus:
          enrollment?.status ||
          'assigned',
      })}

      ${
        nextLesson
          ? renderNextLessonCard(
              nextLesson
            )
          : ''
      }

      <section class="training-roadmap-section">
        <div class="section-heading">
          <div>
            <p class="section-label">
              LỘ TRÌNH ĐÀO TẠO
            </p>

            <h2>
              Danh sách 23 bài học
            </h2>

            <p>
              Hoàn thành bài kiểm tra đạt yêu cầu
              để mở khóa bài học tiếp theo.
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
    </main>
  `;

  document
    .querySelector('#logout-button')
    .addEventListener(
      'click',
      handleLogout
    );

  attachDashboardLessonEvents(
    course.id,
    user
  );
};

/* =========================================================
   KHỐI CHÀO MỪNG
========================================================= */

function renderStudentWelcome(
  profile,
  course
) {
  return `
    <section class="student-welcome-card">
      <div class="welcome-main">
        <p class="section-label">
          CHƯƠNG TRÌNH THỰC TẬP
        </p>

        <h2>
          Xin chào,
          ${escapeHtml(
            profile.full_name ||
            'Sinh viên'
          )}
        </h2>

        <p>
          ${escapeHtml(course.title)}
        </p>
      </div>

      <div class="student-information-grid">
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
  `;
}

/* =========================================================
   TỔNG QUAN TIẾN ĐỘ
========================================================= */

function renderProgressOverview({
  totalLessons,
  passedLessons,
  availableLessons,
  progressPercent,
  enrollmentStatus,
}) {
  return `
    <section class="progress-overview-card">
      <div class="progress-overview-heading">
        <div>
          <p class="section-label">
            TIẾN ĐỘ HỌC TẬP
          </p>

          <h2>
            ${passedLessons}/${totalLessons}
            bài đã hoàn thành
          </h2>
        </div>

        <div class="progress-circle">
          <strong>
            ${progressPercent}%
          </strong>
        </div>
      </div>

      <div class="main-progress-track">
        <div
          class="main-progress-value"
          style="width: ${progressPercent}%"
        ></div>
      </div>

      <div class="progress-statistics">
        <div>
          <span>Tổng số bài</span>
          <strong>${totalLessons}</strong>
        </div>

        <div>
          <span>Đã hoàn thành</span>
          <strong>${passedLessons}</strong>
        </div>

        <div>
          <span>Đang mở</span>
          <strong>${availableLessons}</strong>
        </div>

        <div>
          <span>Trạng thái khóa học</span>

          <strong>
            ${formatCourseStatus(
              enrollmentStatus
            )}
          </strong>
        </div>
      </div>
    </section>
  `;
}

/* =========================================================
   BÀI HỌC TIẾP THEO
========================================================= */

function renderNextLessonCard(lesson) {
  return `
    <section class="next-lesson-card">
      <div class="next-lesson-number">
        ${escapeHtml(
          lesson.order_number
        )}
      </div>

      <div class="next-lesson-content">
        <p class="section-label">
          BÀI HỌC TIẾP THEO
        </p>

        <h2>
          ${escapeHtml(lesson.title)}
        </h2>

        <p>
          ${escapeHtml(
            lesson.description || ''
          )}
        </p>
      </div>

      <button
        class="dashboard-lesson-button primary-button"
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
        lesson.order_number <= module.to
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
   TỪNG BÀI HỌC
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
          ${
            lesson.video_url
              ? `
                <span class="resource-tag video">
                  Video
                </span>
              `
              : ''
          }

          ${
            lesson.pdf_url
              ? `
                <span class="resource-tag pdf">
                  PDF
                </span>
              `
              : ''
          }

          ${
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
              : ''
          }

          ${
            !hasLearningContent
              ? `
                <span class="resource-tag preparing">
                  Đang cập nhật nội dung
                </span>
              `
              : ''
          }
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

function getLessonStatusIcon(status) {
  const icons = {
    passed: '✓',
    available: '▶',
    studying: '▶',
    locked: '🔒',
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
