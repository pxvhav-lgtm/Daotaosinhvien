/**
 * Chatbox hỏi đáp tài liệu cho từng bài học.
 *
 * Bài 1:
 * .../exec?lesson=1
 *
 * Bài 15:
 * .../exec?lesson=15
 */

const LESSON_CHAT_APP_URL =
  'https://script.google.com/macros/s/AKfycbzR3MLfocfCrRhix3MAXAWG50AJKEmIkjjmbjHMh4F83OGFRLSxwIUkgQlUkzrmHSAb/exec';


/**
 * Những bài hiện đã có STORE trong Apps Script.
 *
 * Khi tạo thêm STORE_2, STORE_3...
 * chỉ cần thêm số bài vào đây.
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
  22,
  23  
];


(function initializeLessonChat() {
  const originalRenderLessonPage =
    window.renderLessonPage;

  if (
    typeof originalRenderLessonPage ===
    'function'
  ) {
    window.renderLessonPage =
      async function (...args) {
        const result =
          await originalRenderLessonPage
            .apply(this, args);

        window.setTimeout(
          function () {
            injectLessonChat(args);
          },
          100
        );

        return result;
      };
  }

  /*
   * Dự phòng khi trang bài học được render
   * bởi một file JavaScript khác.
   */
  const appElement =
    document.querySelector('#app');

  if (appElement) {
    const observer =
      new MutationObserver(
        function () {
          window.setTimeout(
            function () {
              injectLessonChat([]);
            },
            100
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
  }
})();


/**
 * Chèn khung chat vào trang bài học.
 */
function injectLessonChat(
  renderArguments
) {
  const appElement =
    document.querySelector('#app');

  if (!appElement) {
    return;
  }

  /*
   * Không chèn chat vào trang đăng nhập,
   * dashboard hoặc trang quản trị.
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
      appElement
    );

  if (!lessonNumber) {
    return;
  }

  const existingChat =
    document.querySelector(
      '#lessonAiChatSection'
    );

  if (
    existingChat &&
    existingChat.dataset.lesson ===
      String(lessonNumber)
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
    String(lessonNumber);

  const isConfigured =
    CONFIGURED_CHAT_LESSONS.includes(
      Number(lessonNumber)
    );

  if (!isConfigured) {
    section.innerHTML =
      renderUnavailableChat(
        lessonNumber
      );
  } else {
    section.innerHTML =
      renderAvailableChat(
        lessonNumber
      );
  }

  const target =
    findLessonChatTarget(
      appElement
    );

  target.appendChild(section);

  bindLessonChatEvents(
    section,
    lessonNumber,
    isConfigured
  );
}


/**
 * Kiểm tra giao diện hiện tại có phải
 * trang nội dung bài học hay không.
 */
function isLessonPageVisible(
  appElement
) {
  const text =
    String(
      appElement.innerText || ''
    ).toLowerCase();

  const hasLessonHeading =
    /\bbài\s*\d+\b/i.test(
      appElement.innerText || ''
    );

  const hasLessonContent =
    text.includes(
      'nội dung bài học'
    ) ||
    text.includes(
      'tài liệu bài học'
    ) ||
    text.includes(
      'bài kiểm tra'
    ) ||
    text.includes(
      'xem video'
    );

  const isAdminPage =
    text.includes(
      'cấu hình kiểm tra'
    ) ||
    text.includes(
      'thêm câu hỏi mới'
    ) ||
    text.includes(
      'nhập json từ notebooklm'
    );

  return (
    hasLessonHeading &&
    hasLessonContent &&
    !isAdminPage
  );
}


/**
 * Xác định số bài.
 *
 * Ưu tiên:
 * 1. Dữ liệu truyền vào renderLessonPage.
 * 2. Biến toàn cục hiện tại.
 * 3. Đọc chữ "Bài X" trên giao diện.
 */
function detectLessonNumber(
  renderArguments,
  appElement
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

  const pageText =
    String(
      appElement.innerText || ''
    );

  const match =
    pageText.match(
      /\bBÀI\s*(\d+)\b/i
    ) ||
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

  if (
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return null;
  }

  if (
    Array.isArray(value)
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
        .call(value, key)
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
        .call(value, key)
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
    String(value || '')
      .replace(
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
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return null;
  }

  return parsed;
}


/**
 * Chọn vị trí đặt khung chat.
 */
function findLessonChatTarget(
  appElement
) {
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


/**
 * Giao diện khi bài đã có STORE.
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
          Hỏi đáp tài liệu Bài ${escapeHtml(
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
          href="${escapeHtml(chatUrl)}"
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
        title="Hỏi đáp tài liệu Bài ${escapeHtml(
          lessonNumber
        )}"
        src="${escapeHtml(chatUrl)}"
        loading="lazy"
        allow="clipboard-write"
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    </div>
  `;
}


/**
 * Giao diện bài chưa tạo STORE.
 */
function renderUnavailableChat(
  lessonNumber
) {
  return `
    <div class="lesson-ai-chat__header">
      <div>
        <p class="lesson-ai-chat__eyebrow">
          TRỢ LÝ HỌC TẬP AI
        </p>

        <h2>
          Hỏi đáp tài liệu Bài ${escapeHtml(
            lessonNumber
          )}
        </h2>

        <p>
          Chatbox của bài học này chưa được
          cấu hình tài liệu.
        </p>
      </div>
    </div>

    <div class="lesson-ai-chat__unavailable">
      <strong>
        Chưa có STORE_${escapeHtml(
          lessonNumber
        )}
      </strong>

      <p>
        Sau khi tạo kho tài liệu trong Apps Script,
        hãy thêm số ${escapeHtml(
          lessonNumber
        )} vào mảng
        <code>CONFIGURED_CHAT_LESSONS</code>
        trong file <code>lesson-chat.js</code>.
      </p>
    </div>
  `;
}


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


/**
 * Gắn sự kiện cho khung chat.
 */
function bindLessonChatEvents(
  section,
  lessonNumber,
  isConfigured
) {
  if (!isConfigured) {
    return;
  }

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


/**
 * Xóa khung chat cũ.
 */
function removeLessonChat() {
  const existing =
    document.querySelector(
      '#lessonAiChatSection'
    );

  if (existing) {
    existing.remove();
  }
}


/**
 * Escape dữ liệu HTML.
 */
function escapeHtml(
  value
) {
  return String(value ?? '')
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
