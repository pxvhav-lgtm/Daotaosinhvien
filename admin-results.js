/*
 * =========================================================
 * QUẢN LÝ VÀ IN KẾT QUẢ KIỂM TRA
 * =========================================================
 *
 * File này phải tải sau:
 * - app.js
 * - dashboard-v2.js
 * - admin.js
 *
 * Chức năng:
 * - Chỉ hiển thị trong tài khoản admin.
 * - Xem danh sách các lần làm bài.
 * - Lọc theo sinh viên, bài học và kết quả.
 * - Xem trước phiếu kết quả A4.
 * - In hoặc lưu thành PDF bằng trình duyệt.
 *
 * Phiếu Bài 1 đến Bài 22:
 * - Công ty CP Thủy điện A Vương
 * - Phân xưởng Vận hành
 *
 * Phiếu Bài 23:
 * - Tổng Công ty Phát điện 2
 * - Công ty CP Thủy điện A Vương
 */

const ADMIN_RESULTS_COURSE_ID = 1;

let adminResultRecords = [];

let adminResultContext = {
  user: null,
  profile: null,
};

let adminResultObserver = null;

let adminResultInjectTimer = null;


/* =========================================================
   KHỞI TẠO
========================================================= */

(function initializeAdminResults() {
  observeAdminDashboard();
})();


function observeAdminDashboard() {
  const appElement =
    document.querySelector(
      '#app'
    );

  if (!appElement) {
    return;
  }

  adminResultObserver =
    new MutationObserver(
      () => {
        if (adminResultInjectTimer) {
          window.clearTimeout(
            adminResultInjectTimer
          );
        }

        adminResultInjectTimer =
          window.setTimeout(
            async () => {
              await injectAdminResultsButton();
            },
            120
          );
      }
    );

  adminResultObserver.observe(
    appElement,
    {
      childList: true,
      subtree: true,
    }
  );

  injectAdminResultsButton();
}


/* =========================================================
   CHÈN NÚT VÀO HEADER ADMIN
========================================================= */

async function injectAdminResultsButton() {
  const adminHeader =
    document.querySelector(
      '.admin-header'
    );

  const adminAccount =
    document.querySelector(
      '.admin-account'
    );

  if (
    !adminHeader ||
    !adminAccount
  ) {
    return;
  }

  if (
    document.querySelector(
      '#admin-results-button'
    )
  ) {
    return;
  }

  const {
    data: {
      session
    },
    error: sessionError,
  } =
    await supabaseClient.auth
      .getSession();

  if (
    sessionError ||
    !session?.user
  ) {
    return;
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabaseClient
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        role
      `)
      .eq(
        'id',
        session.user.id
      )
      .single();

  if (
    profileError ||
    profile?.role !==
      'admin'
  ) {
    return;
  }

  adminResultContext = {
    user:
      session.user,

    profile,
  };

  const button =
    document.createElement(
      'button'
    );

  button.id =
    'admin-results-button';

  button.className =
    'secondary-button admin-results-header-button';

  button.type =
    'button';

  button.innerHTML = `
    <span aria-hidden="true">
      ▤
    </span>

    <span>
      Kết quả kiểm tra
    </span>
  `;

  const logoutButton =
    adminAccount.querySelector(
      '#logout-button'
    );

  if (logoutButton) {
    adminAccount.insertBefore(
      button,
      logoutButton
    );
  } else {
    adminAccount.appendChild(
      button
    );
  }

  button.addEventListener(
    'click',
    async () => {
      await renderAdminResultsPage();
    }
  );
}


/* =========================================================
   TRANG DANH SÁCH KẾT QUẢ
========================================================= */

async function renderAdminResultsPage() {
  clearQuizTimer();

  renderLoading(
    'Đang tải kết quả kiểm tra...'
  );

  const adminAccess =
    await getCurrentAdminContext();

  if (!adminAccess) {
    renderMessage(
      'Bạn không có quyền truy cập kết quả kiểm tra.'
    );

    return;
  }

  adminResultContext =
    adminAccess;

  const loadResult =
    await loadAdminResultData();

  if (!loadResult.success) {
    renderMessage(
      loadResult.message
    );

    return;
  }

  adminResultRecords =
    loadResult.records;

  app.innerHTML = `
    ${renderAdminResultsHeader()}

    <main class="admin-results-page">
      <section class="admin-results-summary">
        ${renderAdminResultsSummary()}
      </section>

      <section class="admin-results-panel">
        <header class="admin-results-panel-header">
          <div>
            <p class="admin-results-eyebrow">
              HỒ SƠ KIỂM TRA
            </p>

            <h2>
              Danh sách kết quả kiểm tra
            </h2>

            <p>
              Chọn một lần làm bài để xem trước,
              in hoặc lưu thành PDF.
            </p>
          </div>

          <button
            id="admin-results-refresh-button"
            class="secondary-button"
            type="button"
          >
            ↻ Tải lại dữ liệu
          </button>
        </header>

        <section class="admin-results-toolbar">
          <label class="admin-results-search">
            <span aria-hidden="true">
              ⌕
            </span>

            <input
              id="admin-results-search-input"
              type="search"
              placeholder="Tìm theo họ tên, mã sinh viên hoặc tên bài..."
            >
          </label>

          <select
            id="admin-results-lesson-filter"
            class="admin-results-select"
            aria-label="Lọc theo bài học"
          >
            ${renderLessonFilterOptions()}
          </select>

          <select
            id="admin-results-status-filter"
            class="admin-results-select"
            aria-label="Lọc theo kết quả"
          >
            <option value="all">
              Tất cả kết quả
            </option>

            <option value="passed">
              Đạt
            </option>

            <option value="failed">
              Chưa đạt
            </option>
          </select>
        </section>

        <div
          id="admin-results-table-container"
          class="admin-results-table-container"
        >
          ${renderAdminResultsTable(
            adminResultRecords
          )}
        </div>
      </section>
    </main>
  `;

  bindAdminResultsPageEvents();
}


function renderAdminResultsHeader() {
  const profile =
    adminResultContext.profile ||
    {};

  return `
    <header class="admin-header admin-results-main-header">
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

          <h1>
            Quản lý kết quả kiểm tra
          </h1>
        </div>
      </div>

      <div class="admin-account">
        <div>
          <span>
            Đăng nhập với quyền
          </span>

          <strong>
            ${escapeHtml(
              profile.full_name ||
              'Quản trị viên'
            )}
          </strong>
        </div>

        <button
          id="admin-results-back-button"
          class="secondary-button"
          type="button"
        >
          ← Quay lại quản trị
        </button>

        <button
          id="admin-results-logout-button"
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
   TẢI DỮ LIỆU
========================================================= */

async function loadAdminResultData() {
  try {
    const [
      attemptsResult,
      profilesResult,
      quizzesResult,
      lessonsResult,
    ] =
      await Promise.all([
        supabaseClient
          .from('quiz_attempts')
          .select(`
            id,
            quiz_id,
            student_id,
            attempt_number,
            score,
            is_passed,
            started_at,
            submitted_at
          `)
          .order(
            'submitted_at',
            {
              ascending: false,
            }
          ),

        supabaseClient
          .from('profiles')
          .select(`
            id,
            full_name,
            email,
            student_code,
            university,
            major,
            internship_start,
            internship_end,
            role
          `),

        supabaseClient
          .from('quizzes')
          .select(`
            id,
            lesson_id,
            title,
            passing_score,
            max_attempts
          `),

        supabaseClient
          .from('lessons')
          .select(`
            id,
            course_id,
            title,
            order_number
          `)
          .eq(
            'course_id',
            ADMIN_RESULTS_COURSE_ID
          )
          .order(
            'order_number',
            {
              ascending: true,
            }
          ),
      ]);

    if (attemptsResult.error) {
      console.error(
        'Lỗi tải quiz_attempts:',
        attemptsResult.error
      );

      return {
        success: false,

        message:
          'Không tải được danh sách kết quả kiểm tra. Hãy kiểm tra RLS của bảng quiz_attempts.',
      };
    }

    if (profilesResult.error) {
      console.error(
        'Lỗi tải profiles:',
        profilesResult.error
      );

      return {
        success: false,

        message:
          'Không tải được hồ sơ sinh viên. Hãy kiểm tra RLS của bảng profiles.',
      };
    }

    if (quizzesResult.error) {
      console.error(
        'Lỗi tải quizzes:',
        quizzesResult.error
      );

      return {
        success: false,

        message:
          'Không tải được thông tin bài kiểm tra.',
      };
    }

    if (lessonsResult.error) {
      console.error(
        'Lỗi tải lessons:',
        lessonsResult.error
      );

      return {
        success: false,

        message:
          'Không tải được thông tin bài học.',
      };
    }

    const profilesById =
      new Map(
        (profilesResult.data || [])
          .map(
            (profile) => [
              String(profile.id),
              profile,
            ]
          )
      );

    const quizzesById =
      new Map(
        (quizzesResult.data || [])
          .map(
            (quiz) => [
              Number(quiz.id),
              quiz,
            ]
          )
      );

    const lessonsById =
      new Map(
        (lessonsResult.data || [])
          .map(
            (lesson) => [
              Number(lesson.id),
              lesson,
            ]
          )
      );

    const records =
      (attemptsResult.data || [])
        .map(
          (attempt) => {
            const profile =
              profilesById.get(
                String(
                  attempt.student_id
                )
              ) || {};

            const quiz =
              quizzesById.get(
                Number(
                  attempt.quiz_id
                )
              ) || {};

            const lesson =
              lessonsById.get(
                Number(
                  quiz.lesson_id
                )
              ) || {};

            return {
              ...attempt,

              profile,

              quiz,

              lesson,

              lessonNumber:
                Number(
                  lesson.order_number ||
                  0
                ),

              isFinalQuiz:
                Number(
                  lesson.order_number
                ) === 23,
            };
          }
        )
        .filter(
          (record) =>
            Number(
              record.lesson.course_id ||
              ADMIN_RESULTS_COURSE_ID
            ) ===
              ADMIN_RESULTS_COURSE_ID ||
            record.lessonNumber > 0
        );

    return {
      success: true,
      records,
    };
  } catch (error) {
    console.error(
      'Lỗi tải dữ liệu kết quả:',
      error
    );

    return {
      success: false,

      message:
        'Đã xảy ra lỗi khi tải dữ liệu kết quả kiểm tra.',
    };
  }
}


/* =========================================================
   THỐNG KÊ
========================================================= */

function renderAdminResultsSummary() {
  const totalAttempts =
    adminResultRecords.length;

  const passedAttempts =
    adminResultRecords.filter(
      (record) =>
        record.is_passed === true
    ).length;

  const failedAttempts =
    totalAttempts -
    passedAttempts;

  const uniqueStudents =
    new Set(
      adminResultRecords.map(
        (record) =>
          String(
            record.student_id
          )
      )
    ).size;

  return `
    <article class="admin-results-summary-card">
      <span>
        Tổng lượt làm bài
      </span>

      <strong>
        ${totalAttempts}
      </strong>

      <p>
        Tất cả các bài kiểm tra
      </p>
    </article>

    <article class="admin-results-summary-card">
      <span>
        Số sinh viên
      </span>

      <strong>
        ${uniqueStudents}
      </strong>

      <p>
        Có dữ liệu kiểm tra
      </p>
    </article>

    <article class="admin-results-summary-card success">
      <span>
        Kết quả đạt
      </span>

      <strong>
        ${passedAttempts}
      </strong>

      <p>
        Lượt làm đạt yêu cầu
      </p>
    </article>

    <article class="admin-results-summary-card danger">
      <span>
        Chưa đạt
      </span>

      <strong>
        ${failedAttempts}
      </strong>

      <p>
        Lượt làm chưa đạt
      </p>
    </article>
  `;
}


/* =========================================================
   BỘ LỌC
========================================================= */

function renderLessonFilterOptions() {
  const lessons =
    Array.from(
      new Map(
        adminResultRecords
          .filter(
            (record) =>
              record.lessonNumber > 0
          )
          .map(
            (record) => [
              record.lessonNumber,
              record.lesson,
            ]
          )
      ).values()
    )
      .sort(
        (a, b) =>
          Number(
            a.order_number
          ) -
          Number(
            b.order_number
          )
      );

  return `
    <option value="all">
      Tất cả bài kiểm tra
    </option>

    ${lessons
      .map(
        (lesson) => `
          <option
            value="${escapeAttribute(
              lesson.order_number
            )}"
          >
            Bài
            ${escapeHtml(
              lesson.order_number
            )}
            -
            ${escapeHtml(
              stripAdminResultLessonPrefix(
                lesson.title
              )
            )}
          </option>
        `
      )
      .join('')}
  `;
}


function filterAdminResultRecords() {
  const searchValue =
    String(
      document.querySelector(
        '#admin-results-search-input'
      )?.value || ''
    )
      .trim()
      .toLowerCase();

  const lessonFilter =
    String(
      document.querySelector(
        '#admin-results-lesson-filter'
      )?.value || 'all'
    );

  const statusFilter =
    String(
      document.querySelector(
        '#admin-results-status-filter'
      )?.value || 'all'
    );

  return adminResultRecords.filter(
    (record) => {
      const searchableText =
        `
          ${record.profile.full_name || ''}
          ${record.profile.student_code || ''}
          ${record.profile.email || ''}
          ${record.lesson.title || ''}
          ${record.quiz.title || ''}
          ${record.lessonNumber || ''}
        `.toLowerCase();

      const matchesSearch =
        !searchValue ||
        searchableText.includes(
          searchValue
        );

      const matchesLesson =
        lessonFilter ===
          'all' ||
        Number(
          record.lessonNumber
        ) ===
          Number(
            lessonFilter
          );

      const matchesStatus =
        statusFilter ===
          'all' ||
        (
          statusFilter ===
            'passed' &&
          record.is_passed ===
            true
        ) ||
        (
          statusFilter ===
            'failed' &&
          record.is_passed !==
            true
        );

      return (
        matchesSearch &&
        matchesLesson &&
        matchesStatus
      );
    }
  );
}


function updateAdminResultsTable() {
  const container =
    document.querySelector(
      '#admin-results-table-container'
    );

  if (!container) {
    return;
  }

  container.innerHTML =
    renderAdminResultsTable(
      filterAdminResultRecords()
    );

  bindAdminResultRowEvents();
}


/* =========================================================
   BẢNG KẾT QUẢ
========================================================= */

function renderAdminResultsTable(
  records
) {
  if (
    !Array.isArray(records) ||
    records.length === 0
  ) {
    return `
      <div class="admin-results-empty-state">
        <div>
          ▤
        </div>

        <h3>
          Không có kết quả phù hợp
        </h3>

        <p>
          Thử thay đổi từ khóa hoặc bộ lọc.
        </p>
      </div>
    `;
  }

  return `
    <div class="admin-results-table-scroll">
      <table class="admin-results-table">
        <thead>
          <tr>
            <th>
              Sinh viên
            </th>

            <th>
              Bài kiểm tra
            </th>

            <th>
              Lần làm
            </th>

            <th>
              Điểm
            </th>

            <th>
              Kết quả
            </th>

            <th>
              Ngày nộp
            </th>

            <th>
              Thao tác
            </th>
          </tr>
        </thead>

        <tbody>
          ${records
            .map(
              renderAdminResultRow
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}


function renderAdminResultRow(
  record
) {
  const profile =
    record.profile || {};

  const lesson =
    record.lesson || {};

  return `
    <tr>
      <td>
        <div class="admin-result-student">
          <div class="admin-result-avatar">
            ${escapeHtml(
              getAdminResultInitials(
                profile.full_name ||
                'Sinh viên'
              )
            )}
          </div>

          <div>
            <strong>
              ${escapeHtml(
                profile.full_name ||
                'Chưa xác định'
              )}
            </strong>

            <span>
              ${escapeHtml(
                profile.student_code ||
                profile.email ||
                'Chưa có mã sinh viên'
              )}
            </span>
          </div>
        </div>
      </td>

      <td>
        <div class="admin-result-lesson">
          <span>
            ${
              record.isFinalQuiz
                ? 'Kiểm tra cuối khóa'
                : `Bài ${escapeHtml(
                    record.lessonNumber ||
                    ''
                  )}`
            }
          </span>

          <strong>
            ${escapeHtml(
              stripAdminResultLessonPrefix(
                lesson.title ||
                record.quiz.title ||
                'Bài kiểm tra'
              )
            )}
          </strong>
        </div>
      </td>

      <td>
        <strong>
          ${escapeHtml(
            record.attempt_number ||
            1
          )}
        </strong>

        <span class="admin-result-subtext">
          /${escapeHtml(
            record.quiz.max_attempts ||
            3
          )}
        </span>
      </td>

      <td>
        <strong class="admin-result-score">
          ${formatAdminResultScore(
            record.score
          )}
        </strong>

        <span class="admin-result-subtext">
          /100
        </span>
      </td>

      <td>
        <span
          class="
            admin-result-status
            ${
              record.is_passed
                ? 'passed'
                : 'failed'
            }
          "
        >
          ${
            record.is_passed
              ? 'Đạt'
              : 'Chưa đạt'
          }
        </span>
      </td>

      <td>
        <span class="admin-result-date">
          ${formatAdminResultDateTime(
            record.submitted_at ||
            record.started_at
          )}
        </span>
      </td>

      <td>
        <button
          class="admin-result-preview-button"
          type="button"
          data-attempt-id="${escapeAttribute(
            record.id
          )}"
        >
          Xem bản in
        </button>
      </td>
    </tr>
  `;
}


/* =========================================================
   SỰ KIỆN TRANG KẾT QUẢ
========================================================= */

function bindAdminResultsPageEvents() {
  document
    .querySelector(
      '#admin-results-back-button'
    )
    ?.addEventListener(
      'click',
      async () => {
        await returnToAdminDashboard();
      }
    );

  document
    .querySelector(
      '#admin-results-logout-button'
    )
    ?.addEventListener(
      'click',
      handleLogout
    );

  document
    .querySelector(
      '#admin-results-refresh-button'
    )
    ?.addEventListener(
      'click',
      async () => {
        await renderAdminResultsPage();
      }
    );

  document
    .querySelector(
      '#admin-results-search-input'
    )
    ?.addEventListener(
      'input',
      updateAdminResultsTable
    );

  document
    .querySelector(
      '#admin-results-lesson-filter'
    )
    ?.addEventListener(
      'change',
      updateAdminResultsTable
    );

  document
    .querySelector(
      '#admin-results-status-filter'
    )
    ?.addEventListener(
      'change',
      updateAdminResultsTable
    );

  bindAdminResultRowEvents();
}


function bindAdminResultRowEvents() {
  document
    .querySelectorAll(
      '.admin-result-preview-button'
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const attemptId =
              Number(
                button.dataset
                  .attemptId
              );

            const record =
              adminResultRecords.find(
                (item) =>
                  Number(
                    item.id
                  ) ===
                  attemptId
              );

            if (!record) {
              return;
            }

            renderAdminResultPrintPreview(
              record
            );
          }
        );
      }
    );
}


/* =========================================================
   TRỞ VỀ ADMIN
========================================================= */

async function returnToAdminDashboard() {
  if (
    typeof renderAdminDashboard !==
    'function'
  ) {
    window.location.reload();

    return;
  }

  const context =
    await getCurrentAdminContext();

  if (!context) {
    renderLogin();

    return;
  }

  await renderAdminDashboard(
    context.user,
    context.profile
  );
}


/* =========================================================
   XEM TRƯỚC BẢN IN
========================================================= */

function renderAdminResultPrintPreview(
  record
) {
  clearQuizTimer();

  document.body.classList.add(
    'admin-print-preview-active'
  );

  app.innerHTML = `
    <main class="admin-print-preview-page">
      <div class="admin-print-toolbar no-print">
        <div>
          <strong>
            Xem trước phiếu kết quả
          </strong>

          <span>
            Kiểm tra nội dung trước khi in hoặc lưu PDF.
          </span>
        </div>

        <div class="admin-print-toolbar-actions">
          <button
            id="admin-print-back-button"
            class="secondary-button"
            type="button"
          >
            ← Quay lại danh sách
          </button>

          <button
            id="admin-print-button"
            class="primary-button"
            type="button"
          >
            In / Lưu PDF
          </button>
        </div>
      </div>

      ${renderAdminResultPrintDocument(
        record
      )}
    </main>
  `;

  document
    .querySelector(
      '#admin-print-back-button'
    )
    ?.addEventListener(
      'click',
      async () => {
        document.body.classList.remove(
          'admin-print-preview-active'
        );

        await renderAdminResultsPage();
      }
    );

  document
    .querySelector(
      '#admin-print-button'
    )
    ?.addEventListener(
      'click',
      () => {
        window.print();
      }
    );
}


/* =========================================================
   NỘI DUNG PHIẾU A4
========================================================= */

function renderAdminResultPrintDocument(
  record
) {
  const profile =
    record.profile || {};

  const lesson =
    record.lesson || {};

  const quiz =
    record.quiz || {};

  const isFinalQuiz =
    record.isFinalQuiz;

  const organizationHeader =
    isFinalQuiz
      ? `
        <div class="print-organization-lines">
          <div>
            TỔNG CÔNG TY PHÁT ĐIỆN 2
          </div>

          <strong>
            CÔNG TY CP THỦY ĐIỆN A VƯƠNG
          </strong>
        </div>
      `
      : `
        <div class="print-organization-lines">
          <strong>
            CÔNG TY CP THỦY ĐIỆN A VƯƠNG
          </strong>

          <div>
            PHÂN XƯỞNG VẬN HÀNH
          </div>
        </div>
      `;

  const documentTitle =
    isFinalQuiz
      ? 'PHIẾU KẾT QUẢ KIỂM TRA CUỐI KHÓA'
      : 'PHIẾU KẾT QUẢ KIỂM TRA ĐÀO TẠO';

  const documentSubtitle =
    isFinalQuiz
      ? 'Đào tạo sinh viên thực tập'
      : `Bài ${record.lessonNumber}: ${stripAdminResultLessonPrefix(
          lesson.title ||
          quiz.title ||
          ''
        )}`;

  const confirmationTitle =
    isFinalQuiz
      ? 'XÁC NHẬN CÔNG TY CP THỦY ĐIỆN A VƯƠNG'
      : 'XÁC NHẬN PHÂN XƯỞNG VẬN HÀNH';

  const confirmationNote =
    isFinalQuiz
      ? '(Ký, ghi rõ họ tên, đóng dấu)'
      : '(Ký, ghi rõ họ tên)';

  const recordCode =
    createAdminResultRecordCode(
      record
    );

  return `
    <article class="admin-print-document">
      <header class="admin-print-document-header">
        <section class="print-header-organization">
          <img
            class="print-company-logo"
            src="./Logo.png"
            alt="Logo Công ty Cổ phần Thủy điện A Vương"
          >

          ${organizationHeader}
        </section>

        <section class="print-header-national">
          <strong>
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </strong>

          <div>
            Độc lập - Tự do - Hạnh phúc
          </div>
        </section>
      </header>

      <section class="admin-print-title">
        <h1>
          ${documentTitle}
        </h1>

        <p>
          ${escapeHtml(
            documentSubtitle
          )}
        </p>
      </section>

      <section class="admin-print-section">
        <h2>
          I. THÔNG TIN HỌC VIÊN
        </h2>

        <table class="admin-print-information-table">
          <tbody>
            <tr>
              <th>
                Họ và tên
              </th>

              <td>
                ${escapeHtml(
                  profile.full_name ||
                  'Chưa cập nhật'
                )}
              </td>

              <th>
                Mã sinh viên
              </th>

              <td>
                ${escapeHtml(
                  profile.student_code ||
                  'Chưa cập nhật'
                )}
              </td>
            </tr>

            <tr>
              <th>
                Trường
              </th>

              <td>
                ${escapeHtml(
                  profile.university ||
                  'Chưa cập nhật'
                )}
              </td>

              <th>
                Chuyên ngành
              </th>

              <td>
                ${escapeHtml(
                  profile.major ||
                  'Chưa cập nhật'
                )}
              </td>
            </tr>

            <tr>
              <th>
                Thời gian thực tập
              </th>

              <td colspan="3">
                ${escapeHtml(
                  formatAdminResultInternshipPeriod(
                    profile.internship_start,
                    profile.internship_end
                  )
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="admin-print-section">
        <h2>
          II. THÔNG TIN BÀI KIỂM TRA
        </h2>

        <table class="admin-print-information-table">
          <tbody>
            <tr>
              <th>
                Tên bài kiểm tra
              </th>

              <td colspan="3">
                ${
                  isFinalQuiz
                    ? 'Bài kiểm tra cuối khóa'
                    : `Bài ${escapeHtml(
                        record.lessonNumber
                      )}: ${escapeHtml(
                        stripAdminResultLessonPrefix(
                          lesson.title ||
                          quiz.title ||
                          ''
                        )
                      )}`
                }
              </td>
            </tr>

            <tr>
              <th>
                Lần làm bài
              </th>

              <td>
                ${escapeHtml(
                  record.attempt_number ||
                  1
                )}
                /
                ${escapeHtml(
                  quiz.max_attempts ||
                  3
                )}
              </td>

              <th>
                Điểm đạt
              </th>

              <td>
                ${formatAdminResultScore(
                  quiz.passing_score ||
                  70
                )}
                /100
              </td>
            </tr>

            <tr>
              <th>
                Bắt đầu
              </th>

              <td>
                ${escapeHtml(
                  formatAdminResultDateTime(
                    record.started_at
                  )
                )}
              </td>

              <th>
                Nộp bài
              </th>

              <td>
                ${escapeHtml(
                  formatAdminResultDateTime(
                    record.submitted_at
                  )
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="admin-print-section">
        <h2>
          III. KẾT QUẢ
        </h2>

        <div class="admin-print-result-box">
          <div>
            <span>
              Điểm bài kiểm tra
            </span>

            <strong>
              ${formatAdminResultScore(
                record.score
              )}
              /100
            </strong>
          </div>

          <div>
            <span>
              Kết quả
            </span>

            <strong
              class="${
                record.is_passed
                  ? 'print-result-passed'
                  : 'print-result-failed'
              }"
            >
              ${
                record.is_passed
                  ? 'ĐẠT'
                  : 'CHƯA ĐẠT'
              }
            </strong>
          </div>
        </div>

        <div class="admin-print-note">
          <strong>
            Nhận xét của cán bộ hướng dẫn:
          </strong>

          <div class="admin-print-note-line"></div>
          <div class="admin-print-note-line"></div>
          <div class="admin-print-note-line"></div>
        </div>
      </section>

      <section class="admin-print-signatures">
        <div>
          <strong>
            HỌC VIÊN
          </strong>

          <span>
            (Ký, ghi rõ họ tên)
          </span>

          <div class="admin-print-signature-space"></div>

          <p>
            ${escapeHtml(
              profile.full_name ||
              ''
            )}
          </p>
        </div>

        <div>
          <strong>
            ${confirmationTitle}
          </strong>

          <span>
            ${confirmationNote}
          </span>

          <div class="admin-print-signature-space"></div>

          <p>
            ................................................
          </p>
        </div>
      </section>

      <footer class="admin-print-footer">
        <span>
          Mã hồ sơ:
          <strong>
            ${escapeHtml(
              recordCode
            )}
          </strong>
        </span>

        <span>
          Ngày xuất:
          <strong>
            ${escapeHtml(
              formatAdminResultDateTime(
                new Date().toISOString()
              )
            )}
          </strong>
        </span>
      </footer>
    </article>
  `;
}


/* =========================================================
   KIỂM TRA QUYỀN ADMIN
========================================================= */

async function getCurrentAdminContext() {
  const {
    data: {
      session
    },
    error: sessionError,
  } =
    await supabaseClient.auth
      .getSession();

  if (
    sessionError ||
    !session?.user
  ) {
    return null;
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabaseClient
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        role
      `)
      .eq(
        'id',
        session.user.id
      )
      .single();

  if (
    profileError ||
    profile?.role !==
      'admin'
  ) {
    return null;
  }

  return {
    user:
      session.user,

    profile,
  };
}


/* =========================================================
   HÀM HỖ TRỢ
========================================================= */

function formatAdminResultScore(
  value
) {
  const score =
    Number(value);

  if (
    !Number.isFinite(score)
  ) {
    return '0';
  }

  if (
    Number.isInteger(score)
  ) {
    return String(score);
  }

  return score
    .toFixed(2)
    .replace(
      /\.?0+$/,
      ''
    );
}


function formatAdminResultDateTime(
  value
) {
  if (!value) {
    return 'Chưa cập nhật';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return new Intl
    .DateTimeFormat(
      'vi-VN',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    )
    .format(date);
}


function formatAdminResultInternshipPeriod(
  startDate,
  endDate
) {
  if (
    !startDate &&
    !endDate
  ) {
    return 'Chưa cập nhật';
  }

  return `${formatAdminResultDateOnly(
    startDate
  )} đến ${formatAdminResultDateOnly(
    endDate
  )}`;
}


function formatAdminResultDateOnly(
  value
) {
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
    return String(value);
  }

  return new Intl
    .DateTimeFormat(
      'vi-VN',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }
    )
    .format(date);
}


function createAdminResultRecordCode(
  record
) {
  const year =
    new Date(
      record.submitted_at ||
      record.started_at ||
      Date.now()
    ).getFullYear();

  const studentCode =
    String(
      record.profile
        ?.student_code ||
      record.student_id ||
      'SV'
    )
      .replace(
        /[^a-zA-Z0-9]/g,
        ''
      )
      .slice(
        -16
      )
      .toUpperCase();

  const attemptId =
    String(
      record.id || 0
    ).padStart(
      6,
      '0'
    );

  return `AVH-DTSV-${year}-${studentCode}-${attemptId}`;
}


function stripAdminResultLessonPrefix(
  title
) {
  return String(
    title || ''
  )
    .replace(
      /^Bài\s*\d+\s*[-:]\s*/i,
      ''
    )
    .replace(
      /^Bài kiểm tra\s*:\s*/i,
      ''
    )
    .trim();
}


function getAdminResultInitials(
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
      .slice(
        0,
        2
      )
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[
      parts.length - 1
    ][0]
  ).toUpperCase();
}
