const SUPABASE_URL =
  'https://lzkdoyboahaucbdpdrlq.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_gfl2uPclIdwKz2R1I84LxA_tURJONRG';

if (
  !SUPABASE_URL ||
  !SUPABASE_PUBLISHABLE_KEY ||
  SUPABASE_PUBLISHABLE_KEY.includes('DAN_')
) {
  throw new Error(
    'Chưa cấu hình Supabase URL hoặc Publishable key.'
  );
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const app = document.querySelector('#app');

async function init() {
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

  const password = String(
    formData.get('password') || ''
  );

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
          <strong>
            ${escapeHtml(course.passing_score)}
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

function formatStatus(status) {
  const labels = {
    assigned: 'Đã phân công',
    in_progress: 'Đang học',
    completed: 'Đã hoàn thành',
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

init();
