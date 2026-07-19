/**
 * Chatbox hỏi đáp tài liệu cho từng bài học.
 *
 * Chatbox chỉ xuất hiện trong trang chi tiết bài học,
 * không xuất hiện tại:
 * - Trang đăng nhập
 * - Dashboard
 * - Danh sách bài học
 * - Trang quản trị
 * - Trang kiểm tra
 * - Trang kết quả
 */

const LESSON_CHAT_APP_URL =
  'https://script.google.com/macros/s/AKfycbwJrBuDX7ChFZllSH3-1RRR1BKchGDcoQ3rVSPgP1aWbr9rUg5ByyVXpibehHzba4T0/exec';


/**
 * Những bài hiện đã có STORE trong Apps Script.
 *
 * Bài 23 là bài kiểm tra tổng kết nên
 * không được thêm vào danh sách này.
 */
const CONFIGURED_CHAT_LESSONS = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22
];


/* =========================================================
   KHỞI TẠO CHATBOX
========================================================= */

(function initializeLessonChat() {
  const originalRenderLessonPage =
    window.renderLessonPage;

  /*
   * Bọc hàm renderLessonPage để chèn chatbox
   * sau khi nội dung bài học đã được hiển thị.
   */
  if (
    typeof originalRenderLessonPage ===
    'function'
  ) {
    window.renderLessonPage =
      async function (...args) {
        const result =
          await originalRenderLessonPage
            .apply(
              this,
              args
            );

        window.setTimeout(
          function () {
            injectLessonChat(args);
          },
          150
        );

        return result;
      };

    /*
     * Cập nhật lại biến toàn cục để các file khác
     * gọi đúng phiên bản renderLessonPage mới.
     */
    try {
      renderLessonPage =
        window.renderLessonPage;
    } catch (error) {
      console.warn(
        'Không thể cập nhật renderLessonPage:',
        error
      );
    }
  }

  /*
   * MutationObserver dùng làm phương án dự phòng
   * khi giao diện được render bởi file khác.
   */
  const appElement =
    document.querySelector(
      '#app'
    );

  if (!appElement) {
    return;
  }

  let observerTimer = null;

  const observer =
    new MutationObserver(
      function () {
        if (observerTimer) {
          window.clearTimeout(
            observerTimer
          );
        }

        observerTimer =
          window.setTimeout(
            function () {
              injectLessonChat([]);
            },
            180
          );
      }
    );

  observer.observe(
    appElement,
    {
      childList: true,
      subtree: true
    }
  );
})();


/* =========================================================
   CHÈN CHATBOX VÀO TRANG BÀI HỌC
========================================================= */

/**
 * Chèn khung chat vào đúng trang chi tiết bài học.
 */
function injectLessonChat(
  renderArguments
) {
  const appElement =
    document.querySelector(
      '#app'
    );

  if (!appElement) {
    return;
  }

  /*
   * Điều kiện quan trọng:
   *
   * Trang chi tiết bài học trong app.js có:
   * <article class="lesson-detail-card">
   *
   * Trang danh sách bài học không có class này.
   * Vì vậy chatbox không được chèn ở dashboard.
   */
  const lessonDetailCard =
    appElement.querySelector(
      '.lesson-detail-card'
    );

  if (!lessonDetailCard) {
    removeLessonChat();
    return;
  }

  /*
   * Kiểm tra thêm để tránh chèn vào:
   * - Trang quản trị
   * - Trang kiểm tra
   * - Trang kết quả
   */
  if (
    !isLessonPageVisible(
      appElement
    )
  ) {
    removeLessonChat();
    return;
  }

  const lessonNumber =
    detectLessonNumber(
      renderArguments,
      lessonDetailCard
    );

  if (!lessonNumber) {
    removeLessonChat();
    return;
  }

  /*
   * Bài chưa có STORE thì không hiển thị
   * bất kỳ khung chat nào.
   *
   * Điều này cũng đảm bảo Bài 23 không xuất hiện chatbox.
   */
  const isConfigured =
    CONFIGURED_CHAT_LESSONS.includes(
      Number(
        lessonNumber
      )
    );

  if (!isConfigured) {
    removeLessonChat();
    return;
  }

  const existingChat =
    document.querySelector(
      '#lessonAiChatSection'
    );

  /*
   * Chatbox đúng bài đã tồn tại thì không tạo lại.
   */
  if (
    existingChat &&
    existingChat.dataset.lesson ===
      String(
        lessonNumber
      )
  ) {
    return;
  }

  removeLessonChat();

  const section =
    document.createElement(
      'section'
    );

  section.id =
    'lessonAiChatSection';

  section.className =
    'lesson-ai-chat';

  section.dataset.lesson =
    String(
      lessonNumber
    );

  section.innerHTML =
    renderAvailableChat(
      lessonNumber
    );

  const target =
    findLessonChatTarget(
      appElement
    );

  target.appendChild(
    section
  );

  bindLessonChatEvents(
    section
  );
}


/* =========================================================
   KIỂM TRA TRANG HIỆN TẠI
========================================================= */

/**
 * Chỉ xác nhận trang chi tiết nội dung bài học.
 */
function isLessonPageVisible(
  appElement
) {
  const lessonDetailCard =
    appElement.querySelector(
      '.lesson-detail-card'
    );

  if (!lessonDetailCard) {
    return false;
  }

  const text =
    String(
      appElement.innerText || ''
    ).toLowerCase();

  const isQuizPage =
    Boolean(
      appElement.querySelector(
        '.quiz-page'
      )
    ) ||
    Boolean(
      appElement.querySelector(
        '#quiz-form'
      )
    ) ||
    Boolean(
      appElement.querySelector(
        '#final-quiz-form'
      )
    );

  const isResultPage =
    Boolean(
      appElement.querySelector(
        '.result-page'
      )
    );

  const isAdminPage =
    Boolean(
      appElement.querySelector(
        '.admin-page'
      )
    ) ||
    text.includes(
      'cấu hình kiểm tra'
    ) ||
    text.includes(
      'thêm câu hỏi mới'
    ) ||
    text.includes(
      'nhập json từ notebooklm'
    );

  const isLoginPage =
    Boolean(
      appElement.querySelector(
        '.login-page'
      )
    );

  const isDashboardPageOnly =
    Boolean(
      appElement.querySelector(
        '.lesson-list'
      )
    ) &&
    !lessonDetailCard;

  return (
    !isQuizPage &&
    !isResultPage &&
    !isAdminPage &&
    !isLoginPage &&
    !isDashboardPageOnly
  );
}


/* =========================================================
   XÁC ĐỊNH SỐ BÀI
========================================================= */

/**
 * Xác định số bài hiện tại.
 *
 * Ưu tiên:
 * 1. Dữ liệu truyền vào renderLessonPage.
 * 2. Biến toàn cục.
 * 3. Nội dung trong lesson-detail-card.
 */
function detectLessonNumber(
  renderArguments,
  lessonDetailCard
) {
  const fromArguments =
    findLessonNumberInValue(
      renderArguments
    );

  if (fromArguments) {
    return fromArguments;
  }

  const possibleGlobals = [
    window.currentLesson,
    window.selectedLesson,
    window.activeLesson,
    window.currentLessonData
  ];

  for (
    const value of possibleGlobals
  ) {
    const detected =
      findLessonNumberInValue(
        value
      );

    if (detected) {
      return detected;
    }
  }

  /*
   * Chỉ đọc nội dung trong lesson-detail-card.
   *
   * Không đọc toàn bộ #app để tránh lấy nhầm
   * chữ Bài 23 trong danh sách bài học.
   */
  const pageText =
    String(
      lessonDetailCard.innerText || ''
    );

  const lessonOrderElement =
    lessonDetailCard.querySelector(
      '.lesson-order'
    );

  if (lessonOrderElement) {
    const orderText =
      String(
        lessonOrderElement.textContent ||
        ''
      );

    const orderMatch =
      orderText.match(
        /\bBài\s*(\d+)\b/i
      );

    if (orderMatch) {
      return normalizeLessonNumber(
        orderMatch[1]
      );
    }
  }

  const match =
    pageText.match(
      /\bBài\s*(\d+)\b/i
    );

  if (!match) {
    return null;
  }

  return normalizeLessonNumber(
    match[1]
  );
}


/**
 * Tìm order_number trong một đối tượng
 * hoặc mảng dữ liệu.
 */
function findLessonNumberInValue(
  value,
  depth = 0
) {
  if (
    value === null ||
    value === undefined ||
    depth > 4
  ) {
    return null;
  }

  /*
   * Không coi lessonId là số thứ tự bài.
   * Trong app.js, renderLessonPage nhận lessonId,
   * không phải order_number.
   */
  if (
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return null;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    for (
      const item of value
    ) {
      const result =
        findLessonNumberInValue(
          item,
          depth + 1
        );

      if (result) {
        return result;
      }
    }

    return null;
  }

  if (
    typeof value !== 'object'
  ) {
    return null;
  }

  const directKeys = [
    'order_number',
    'orderNumber',
    'lesson_number',
    'lessonNumber'
  ];

  for (
    const key of directKeys
  ) {
    if (
      Object.prototype
        .hasOwnProperty
        .call(
          value,
          key
        )
    ) {
      const normalized =
        normalizeLessonNumber(
          value[key]
        );

      if (normalized) {
        return normalized;
      }
    }
  }

  const nestedKeys = [
    'lesson',
    'data',
    'selectedLesson',
    'currentLesson'
  ];

  for (
    const key of nestedKeys
  ) {
    if (
      Object.prototype
        .hasOwnProperty
        .call(
          value,
          key
        )
    ) {
      const nestedResult =
        findLessonNumberInValue(
          value[key],
          depth + 1
        );

      if (nestedResult) {
        return nestedResult;
      }
    }
  }

  return null;
}


/**
 * Chuẩn hóa số bài.
 */
function normalizeLessonNumber(
  value
) {
  const digits =
    String(
      value || ''
    ).replace(
      /[^0-9]/g,
      ''
    );

  if (!digits) {
    return null;
  }

  const parsed =
    Number.parseInt(
      digits,
      10
    );

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < 1
  ) {
    return null;
  }

  return parsed;
}


/* =========================================================
   VỊ TRÍ CHÈN CHATBOX
========================================================= */

/**
 * Chọn vị trí đặt khung chat.
 *
 * Ưu tiên đặt ngay sau lesson-detail-card.
 */
function findLessonChatTarget(
  appElement
) {
  const lessonDetailCard =
    appElement.querySelector(
      '.lesson-detail-card'
    );

  if (
    lessonDetailCard &&
    lessonDetailCard.parentElement
  ) {
    return lessonDetailCard.parentElement;
  }

  const possibleTargets = [
    '.lesson-page',
    '.lesson-detail',
    '.lesson-content-page',
    '.course-content',
    '.student-lesson-page',
    'main'
  ];

  for (
    const selector of possibleTargets
  ) {
    const element =
      appElement.querySelector(
        selector
      );

    if (element) {
      return element;
    }
  }

  return appElement;
}


/* =========================================================
   GIAO DIỆN CHATBOX
========================================================= */

/**
 * Giao diện bài đã có STORE.
 */
function renderAvailableChat(
  lessonNumber
) {
  const chatUrl =
    buildLessonChatUrl(
      lessonNumber
    );

  return `
    <div class="lesson-ai-chat__header">
      <div>
        <p class="lesson-ai-chat__eyebrow">
          TRỢ LÝ HỌC TẬP AI
        </p>

        <h2>
          Hỏi đáp tài liệu Bài ${escapeLessonChatHtml(
            lessonNumber
          )}
        </h2>

        <p>
          Trợ lý chỉ trả lời dựa trên tài liệu
          của bài học hiện tại.
        </p>
      </div>

      <div class="lesson-ai-chat__actions">
        <button
          type="button"
          class="lesson-ai-chat__toggle"
          aria-expanded="true"
        >
          Thu gọn
        </button>

        <a
          class="lesson-ai-chat__open"
          href="${escapeLessonChatHtml(
            chatUrl
          )}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Mở cửa sổ riêng
        </a>
      </div>
    </div>

    <div class="lesson-ai-chat__body">
      <div class="lesson-ai-chat__loading">
        Đang tải trợ lý hỏi đáp...
      </div>

      <iframe
        class="lesson-ai-chat__iframe"
        title="Hỏi đáp tài liệu Bài ${escapeLessonChatHtml(
          lessonNumber
        )}"
        src="${escapeLessonChatHtml(
          chatUrl
        )}"
        loading="lazy"
        allow="clipboard-write"
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    </div>
  `;
}


/* =========================================================
   URL CHAT
========================================================= */

/**
 * Tạo URL chat theo số bài.
 */
function buildLessonChatUrl(
  lessonNumber
) {
  const separator =
    LESSON_CHAT_APP_URL.includes(
      '?'
    )
      ? '&'
      : '?';

  return (
    LESSON_CHAT_APP_URL +
    separator +
    'lesson=' +
    encodeURIComponent(
      lessonNumber
    ) +
    '&embed=1'
  );
}


/* =========================================================
   SỰ KIỆN CHATBOX
========================================================= */

/**
 * Gắn sự kiện cho iframe và nút thu gọn.
 */
function bindLessonChatEvents(
  section
) {
  const iframe =
    section.querySelector(
      '.lesson-ai-chat__iframe'
    );

  const loading =
    section.querySelector(
      '.lesson-ai-chat__loading'
    );

  const body =
    section.querySelector(
      '.lesson-ai-chat__body'
    );

  const toggleButton =
    section.querySelector(
      '.lesson-ai-chat__toggle'
    );

  if (
    iframe &&
    loading
  ) {
    iframe.addEventListener(
      'load',
      function () {
        loading.hidden = true;

        iframe.classList.add(
          'is-loaded'
        );
      }
    );
  }

  if (
    toggleButton &&
    body
  ) {
    toggleButton.addEventListener(
      'click',
      function () {
        const collapsed =
          section.classList.toggle(
            'is-collapsed'
          );

        body.hidden =
          collapsed;

        toggleButton.textContent =
          collapsed
            ? 'Mở chat'
            : 'Thu gọn';

        toggleButton.setAttribute(
          'aria-expanded',
          collapsed
            ? 'false'
            : 'true'
        );
      }
    );
  }
}


/* =========================================================
   XÓA CHATBOX
========================================================= */

/**
 * Xóa mọi chatbox cũ còn tồn tại.
 */
function removeLessonChat() {
  document
    .querySelectorAll(
      '#lessonAiChatSection'
    )
    .forEach(
      function (element) {
        element.remove();
      }
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

/**
 * Đặt tên riêng để không ghi đè hàm escapeHtml
 * đã có trong app.js.
 */
function escapeLessonChatHtml(
  value
) {
  return String(
    value ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}
