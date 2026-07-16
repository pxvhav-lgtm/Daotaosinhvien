const SUPABASE_URL =
  'https://lzkdoyboahaucbdpdrlq.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_gfl2uPclIdwKz2R1I84LxA_tURJONRG';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const app = document.querySelector('#app');

async function init() {
  if (
    !SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY.includes('DAN_')
  ) {
    renderMessage('Chưa cấu hình Publishable key của Supabase.');
    return;
  }

  const {
    data: { session },
    error,
  } = await supabaseClient.auth.getSession();

  if (error) {
    console.error(error);
    renderMessage('Không thể kiểm tra phiên đăng nhập.');
    return;
  }

  if (session) {
    await renderDashboard(session.user);
  } else {
    renderLogin();
  }
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <p class="eyebrow">
          NHÀ MÁY THỦY ĐIỆN A VƯƠNG
        </p>

        <h1>Đào tạo sinh viên thực tập</h1>

        <p class="description">
          Đăng nhập để học bài và làm bài kiểm tra.
        </p>

        <form id="login-form" class="login-form">
          <label for="email">Email</label>

          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
          >

          <label for="password">Mật khẩu</label>

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

  const button = document.querySelector('#login-button');
  const message = document.querySelector('#login-message');
  const formData = new FormData(event.currentTarget);

  const email = String(formData.get('email') || '')
    .trim()
    .toLowerCase();

  const password = String(formData.get('password') || '');

  button.disabled = true;
  button.textContent = 'Đang đăng nhập...';
  message.textContent = '';

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    console.error(error);

    message.textContent =
      'Email hoặc mật khẩu không chính xác.';

    button.disabled = false;
    button.textContent = 'Đăng nhập';
    return;
  }

  await renderDashboard(data.user);
}

async function renderDashboard(user) {
  app.innerHTML = `
    <main class="loading-page">
      <p>Đang tải dữ liệu...</p>
    </main>
  `;

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
    console.error(profileResult.error);
    renderMessage('Không tải được hồ sơ sinh viên.');
    return;
  }

  if (enrollmentResult.error) {
    console.error(enrollmentResult.error);
    renderMessage('Không tải được danh sách khóa học.');
    return;
  }

  const profile = profileResult.data;
  const enrollments = enrollmentResult.data ?? [];

  app.innerHTML = `
    <header class="header">
      <div>
        <p class="eyebrow">
          NHÀ MÁY THỦY ĐIỆN A VƯƠNG
        </p>

        <h1>Hệ thống đào tạo sinh viên thực tập</h1>
      </div>

      <button
        id="logout-button"
        class="secondary-button"
        type="button"
      >
        Đăng xuất
      </button>
    </header>

    <main class="dashboard-page">
      <section class="profile-card">
        <p>Xin chào,</p>

        <h2>${escapeHtml(profile.full_name)}</h2>

        <div class="profile-grid">
          <div>
            <span>Mã sinh viên</span>
            <strong>
              ${escapeHtml(
                profile.student_code || 'Chưa cập nhật'
              )}
            </strong>
          </div>

          <div>
            <span>Trường</span>
            <strong>
              ${escapeHtml(
                profile.university || 'Chưa cập nhật'
              )}
            </strong>
          </div>

          <div>
            <span>Chuyên ngành</span>
            <strong>
              ${escapeHtml(
                profile.major || 'Chưa cập nhật'
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
    .addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      renderLogin();
    });

  document
    .querySelectorAll('.course-button')
    .forEach((button) => {
      button.addEventListener('click', async () => {
        const courseId = Number(button.dataset.courseId);

        if (!courseId) {
          alert('Không xác định được khóa học.');
          return;
        }

        await renderCoursePage(courseId, user);
      });
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
          ${formatStatus(enrollment.status)}
        </p>

        <h3>${escapeHtml(course.title)}</h3>

        <p>
          ${escapeHtml(course.description || '')}
        </p>

        <p>
          Điểm đạt:
          <strong>${escapeHtml(course.passing_score)}</strong>
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

async function renderCoursePage(courseId, user) {
  app.innerHTML = `
    <main class="loading-page">
      <p>Đang tải khóa học...</p>
    </main>
  `;

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
        content,
        order_number,
        passing_score,
        video_url,
        pdf_url,
        image_url
      `)
      .eq('course_id', courseId)
      .order('order_number', {
        ascending: true,
      }),

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
    console.error('Lỗi tải khóa học:', courseResult.error);
    renderMessage('Không tải được thông tin khóa học.');
    return;
  }

  if (lessonsResult.error) {
    console.error('Lỗi tải bài học:', lessonsResult.error);
    renderMessage('Không tải được danh sách bài học.');
    return;
  }

  if (progressResult.error) {
    console.error('Lỗi tải tiến độ:', progressResult.error);
    renderMessage('Không tải được tiến độ học tập.');
    return;
  }

  const course = courseResult.data;
  const lessons = lessonsResult.data ?? [];
  const progressList = progressResult.data ?? [];

  const lessonsWithProgress = lessons.map((lesson) => {
    const progress = progressList.find(
      (item) => Number(item.lesson_id) === Number(lesson.id)
    );

    return {
      ...lesson,
      progress: progress || {
        status: 'locked',
        best_score: null,
        attempt_count: 0,
      },
    };
  });

  app.innerHTML = `
    <header class="header">
      <div>
        <p class="eyebrow">
          NHÀ MÁY THỦY ĐIỆN A VƯƠNG
        </p>

        <h1>${escapeHtml(course.title)}</h1>
      </div>

      <div class="header-actions">
        <button
          id="back-dashboard-button"
          class="secondary-button"
          type="button"
        >
          Quay lại
        </button>

        <button
          id="logout-button"
          class="secondary-button"
          type="button"
        >
          Đăng xuất
        </button>
      </div>
    </header>

    <main class="dashboard-page">
      <section class="course-overview-card">
        <h2>Thông tin khóa học</h2>

        <p>
          ${escapeHtml(course.description || '')}
        </p>

        <p>
          Điểm đạt:
          <strong>
            ${escapeHtml(course.passing_score)}
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
    .querySelector('#back-dashboard-button')
    .addEventListener('click', async () => {
      await renderDashboard(user);
    });

  document
    .querySelector('#logout-button')
    .addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      renderLogin();
    });

  document
    .querySelectorAll('.lesson-button')
    .forEach((button) => {
      button.addEventListener('click', async () => {
        const lessonId = Number(button.dataset.lessonId);
        const status = button.dataset.status;

        if (status === 'locked') {
          return;
        }

        await renderLessonPage(
          lessonId,
          courseId,
          user
        );
      });
    });
}

function renderLessonCard(lesson) {
  const status = lesson.progress.status;
  const isLocked = status === 'locked';

  return `
    <article class="lesson-card ${isLocked ? 'locked' : ''}">
      <div class="lesson-number">
        ${lesson.order_number}
      </div>

      <div class="lesson-content">
        <p class="lesson-status ${status}">
          ${formatLessonStatus(status)}
        </p>

        <h3>${escapeHtml(lesson.title)}</h3>

        <p>
          ${escapeHtml(lesson.description || '')}
        </p>

        ${
          lesson.progress.best_score !== null
            ? `
              <p>
                Điểm cao nhất:
                <strong>
                  ${escapeHtml(lesson.progress.best_score)}
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
        data-status="${status}"
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

async function renderLessonPage(
  lessonId,
  courseId,
  user
) {
  app.innerHTML = `
    <main class="loading-page">
      <p>Đang tải bài học...</p>
    </main>
  `;

  const { data: lesson, error } =
    await supabaseClient
      .from('lessons')
      .select(`
        id,
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
      .single();

  if (error) {
    console.error('Lỗi tải bài học:', error);
    renderMessage('Không tải được nội dung bài học.');
    return;
  }

  app.innerHTML = `
    <header class="header">
      <div>
        <p class="eyebrow">
          NHÀ MÁY THỦY ĐIỆN A VƯƠNG
        </p>

        <h1>${escapeHtml(lesson.title)}</h1>
      </div>

      <div class="header-actions">
        <button
          id="back-course-button"
          class="secondary-button"
          type="button"
        >
          Quay lại khóa học
        </button>

        <button
          id="logout-button"
          class="secondary-button"
          type="button"
        >
          Đăng xuất
        </button>
      </div>
    </header>

    <main class="dashboard-page">
      <article class="lesson-detail-card">
        <p class="lesson-order">
          Bài ${escapeHtml(lesson.order_number)}
        </p>

        <h2>${escapeHtml(lesson.title)}</h2>

        <p class="lesson-description">
          ${escapeHtml(lesson.description || '')}
        </p>

        ${
          lesson.video_url
            ? renderVideo(lesson.video_url)
            : ''
        }

        ${
          lesson.pdf_url
            ? renderPdf(lesson.pdf_url)
            : ''
        }

        ${
          lesson.image_url
            ? `
              <section class="lesson-media-section">
                <h3>Hình ảnh minh họa</h3>

                <img
                  class="lesson-image"
                  src="${escapeAttribute(lesson.image_url)}"
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
                  ${escapeHtml(lesson.content)}
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
            Làm bài kiểm tra
          </button>
        </div>
      </article>
    </main>
  `;

  document
    .querySelector('#back-course-button')
    .addEventListener('click', async () => {
      await renderCoursePage(courseId, user);
    });

  document
    .querySelector('#logout-button')
    .addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      renderLogin();
    });

  document
    .querySelector('#quiz-button')
    .addEventListener('click', () => {
      alert(
        'Chức năng bài kiểm tra sẽ được xây dựng ở bước tiếp theo.'
      );
    });
}

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
  return `
    <section class="lesson-media-section">
      <h3>Tài liệu PDF</h3>

      <iframe
        class="pdf-viewer"
        src="${escapeAttribute(url)}"
        title="Tài liệu PDF"
      ></iframe>

      <a
        class="document-link"
        href="${escapeAttribute(url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Mở tài liệu trong cửa sổ mới
      </a>
    </section>
  `;
}

function formatStatus(status) {
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

function renderMessage(message) {
  app.innerHTML = `
    <main class="message-page">
      <section>
        <h1>Không tải được hệ thống</h1>

        <p>${escapeHtml(message)}</p>

        <button
          class="primary-button"
          type="button"
          onclick="window.location.reload()"
        >
          Thử lại
        </button>
      </section>
    </main>
  `;
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

init();
