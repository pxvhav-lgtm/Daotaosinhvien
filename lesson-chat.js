/**
 * Chatbox AI dùng cho:
 * 1. Trang chi tiết bài học.
 * 2. Tab Trợ lý AI độc lập.
 *
 * Không chứa API key hoặc bí mật.
 */

const LESSON_CHAT_APP_URL =
  'https://script.google.com/macros/s/AKfycbwJrBuDX7ChFZllSH3-1RRR1BKchGDcoQ3rVSPgP1aWbr9rUg5ByyVXpibehHzba4T0/exec';

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
];

const LESSON_CHAT_LOAD_TIMEOUT_MS =
  15000;

let lessonChatMutationTimer =
  null;

/* =========================================================
   KHỞI TẠO
========================================================= */

(function initializeLessonChat() {
  wrapRenderLessonPage();

  observeApplicationChanges();
})();

/* =========================================================
   BỌC HÀM MỞ BÀI HỌC
========================================================= */

function wrapRenderLessonPage() {
  const originalRenderLessonPage =
    window.renderLessonPage;

  if (
    typeof originalRenderLessonPage !==
    'function'
  ) {
    return;
  }

  if (
    originalRenderLessonPage
      .__lessonChatWrapped
  ) {
    return;
  }

  const wrappedRenderLessonPage =
    async function (...args) {
      const result =
        await originalRenderLessonPage.apply(
          this,
          args
        );

      window.setTimeout(
        () => {
          injectLessonChatIntoLessonPage(
            args
          );
        },
        180
      );

      return result;
    };

  wrappedRenderLessonPage
    .__lessonChatWrapped =
    true;

  window.renderLessonPage =
    wrappedRenderLessonPage;

  try {
    renderLessonPage =
      wrappedRenderLessonPage;
  } catch (error) {
    console.warn(
      'Không thể đồng bộ biến renderLessonPage:',
      error
    );
  }
}

/* =========================================================
   THEO DÕI THAY ĐỔI TRANG
========================================================= */

function observeApplicationChanges() {
  const appElement =
    document.querySelector(
      '#app'
    );

  if (!appElement) {
    return;
  }

  const observer =
    new MutationObserver(
      () => {
        if (
          lessonChatMutationTimer
        ) {
          window.clearTimeout(
            lessonChatMutationTimer
          );
        }

        lessonChatMutationTimer =
          window.setTimeout(
            () => {
              injectLessonChatIntoLessonPage(
                []
              );
            },
            220
          );
      }
    );

  observer.observe(
    appElement,
    {
      childList: true,
      subtree: true,
    }
  );
}

/* =========================================================
   CHAT TRONG TRANG BÀI HỌC
========================================================= */

function injectLessonChatIntoLessonPage(
  renderArguments
) {
  const appElement =
    document.querySelector(
      '#app'
    );

  if (!appElement) {
    return;
  }

  const lessonDetailCard =
    appElement.querySelector(
      '.lesson-detail-card'
    );

  if (!lessonDetailCard) {
    removeEmbeddedLessonChat();

    return;
  }

  if (
    isQuizOrResultPage(
      appElement
    )
  ) {
    removeEmbeddedLessonChat();

    return;
  }

  const lessonNumber =
    detectLessonNumber(
      renderArguments,
      lessonDetailCard
    );

  if (
    !isConfiguredChatLesson(
      lessonNumber
    )
  ) {
    removeEmbeddedLessonChat();

    return;
  }

  const currentSection =
    document.querySelector(
      '#lessonAiChatSection'
    );

  if (
    currentSection &&
    Number(
      currentSection.dataset.lesson
    ) ===
      Number(
        lessonNumber
      )
  ) {
    return;
  }

  removeEmbeddedLessonChat();

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
    createEmbeddedLessonChatMarkup(
      lessonNumber
    );

  const parent =
    lessonDetailCard.parentElement ||
    appElement;

  parent.appendChild(
    section
  );

  initializeEmbeddedLessonChat(
    section
  );
}

function createEmbeddedLessonChatMarkup(
  lessonNumber
) {
  const chatUrl =
    buildLessonChatUrl(
      lessonNumber
    );

  return `
    <header class="lesson-ai-chat__header">
      <div>
        <p class="lesson-ai-chat__eyebrow">
          TRỢ LÝ HỌC TẬP AI
        </p>

        <h2>
          Hỏi đáp tài liệu Bài
          ${escapeLessonChatHtml(
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
          class="lesson-ai-chat__toggle"
          type="button"
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
    </header>

    <div class="lesson-ai-chat__body">
      ${createChatLoadingMarkup()}

      <iframe
        class="lesson-ai-chat__iframe"
        title="Trợ lý AI Bài ${escapeLessonChatHtml(
          lessonNumber
        )}"
        src="${escapeLessonChatHtml(
          chatUrl
        )}"
        loading="eager"
        allow="clipboard-write"
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    </div>
  `;
}

function initializeEmbeddedLessonChat(
  section
) {
  const iframe =
    section.querySelector(
      '.lesson-ai-chat__iframe'
    );

  const loadingElement =
    section.querySelector(
      '.lesson-chat-loading'
    );

  const body =
    section.querySelector(
      '.lesson-ai-chat__body'
    );

  const toggleButton =
    section.querySelector(
      '.lesson-ai-chat__toggle'
    );

  initializeIframeLoading({
    iframe,
    loadingElement,
    chatUrl:
      iframe?.src || '',
  });

  toggleButton?.addEventListener(
    'click',
    () => {
      const collapsed =
        section.classList.toggle(
          'is-collapsed'
        );

      if (body) {
        body.hidden =
          collapsed;
      }

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

/* =========================================================
   CHAT ĐỘC LẬP TRONG TAB AI
========================================================= */

window.renderStandaloneLessonChat =
  function (
    lessonNumber,
    lessonTitle,
    container
  ) {
    if (!container) {
      return;
    }

    const normalizedLessonNumber =
      normalizeLessonNumber(
        lessonNumber
      );

    if (
      !isConfiguredChatLesson(
        normalizedLessonNumber
      )
    ) {
      container.innerHTML = `
        <div class="standalone-chat-unavailable">
          <strong>
            Trợ lý AI chưa được cấu hình
          </strong>

          <p>
            Bài học này chưa có kho tài liệu AI.
          </p>
        </div>
      `;

      return;
    }

    const chatUrl =
      buildLessonChatUrl(
        normalizedLessonNumber
      );

    container.innerHTML = `
      <section
        id="standaloneLessonChat"
        class="standalone-lesson-chat"
        data-lesson="${normalizedLessonNumber}"
      >
        <header
          class="standalone-lesson-chat__status"
        >
          <div>
            <span>
              Bài
              ${escapeLessonChatHtml(
                normalizedLessonNumber
              )}
            </span>

            <strong>
              ${escapeLessonChatHtml(
                lessonTitle || ''
              )}
            </strong>
          </div>

          <a
            href="${escapeLessonChatHtml(
              chatUrl
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Mở cửa sổ riêng
          </a>
        </header>

        <div
          class="standalone-lesson-chat__body"
        >
          ${createChatLoadingMarkup()}

          <iframe
            class="standalone-lesson-chat__iframe"
            title="Trợ lý AI Bài ${escapeLessonChatHtml(
              normalizedLessonNumber
            )}"
            src="${escapeLessonChatHtml(
              chatUrl
            )}"
            loading="eager"
            allow="clipboard-write"
            referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>
        </div>
      </section>
    `;

    const iframe =
      container.querySelector(
        '.standalone-lesson-chat__iframe'
      );

    const loadingElement =
      container.querySelector(
        '.lesson-chat-loading'
      );

    initializeIframeLoading({
      iframe,
      loadingElement,
      chatUrl,
    });
  };

window.removeStandaloneLessonChat =
  function () {
    document
      .querySelectorAll(
        '#standaloneLessonChat'
      )
      .forEach(
        (element) => {
          element.remove();
        }
      );
  };

/* =========================================================
   QUẢN LÝ LOADING IFRAME
========================================================= */

function initializeIframeLoading({
  iframe,
  loadingElement,
  chatUrl,
}) {
  if (
    !iframe ||
    !loadingElement
  ) {
    return;
  }

  let completed =
    false;

  let timeoutId =
    null;

  const completeLoading =
    () => {
      if (completed) {
        return;
      }

      completed =
        true;

      if (timeoutId) {
        window.clearTimeout(
          timeoutId
        );
      }

      loadingElement.hidden =
        true;

      iframe.classList.add(
        'is-loaded'
      );
    };

  iframe.addEventListener(
    'load',
    () => {
      /*
       * Sự kiện load chỉ xác nhận iframe đã tải
       * một tài liệu. Khi Apps Script cho phép nhúng,
       * iframe sẽ hiển thị bình thường.
       */
      completeLoading();
    },
    {
      once: true,
    }
  );

  iframe.addEventListener(
    'error',
    () => {
      showChatLoadError(
        loadingElement,
        chatUrl
      );
    },
    {
      once: true,
    }
  );

  timeoutId =
    window.setTimeout(
      () => {
        if (completed) {
          return;
        }

        showChatLoadError(
          loadingElement,
          chatUrl
        );
      },
      LESSON_CHAT_LOAD_TIMEOUT_MS
    );
}

function createChatLoadingMarkup() {
  return `
    <div class="lesson-chat-loading">
      <div class="lesson-chat-loading__spinner"></div>

      <strong>
        Đang tải Trợ lý AI...
      </strong>

      <span>
        Vui lòng chờ trong giây lát.
      </span>
    </div>
  `;
}

function showChatLoadError(
  loadingElement,
  chatUrl
) {
  if (!loadingElement) {
    return;
  }

  loadingElement.hidden =
    false;

  loadingElement.innerHTML = `
    <div class="lesson-chat-load-error">
      <div class="lesson-chat-load-error__icon">
        !
      </div>

      <strong>
        Không thể hiển thị Trợ lý AI trong trang
      </strong>

      <p>
        Web App chưa cho phép nhúng iframe,
        chưa được triển khai phiên bản mới
        hoặc quyền truy cập chưa phù hợp.
      </p>

      <a
        href="${escapeLessonChatHtml(
          chatUrl
        )}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Mở cửa sổ riêng
      </a>
    </div>
  `;
}

/* =========================================================
   XÁC ĐỊNH BÀI HỌC
========================================================= */

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

  const candidates = [
    window.currentLesson,
    window.selectedLesson,
    window.activeLesson,
    window.currentLessonData,
  ];

  for (
    const candidate of candidates
  ) {
    const result =
      findLessonNumberInValue(
        candidate
      );

    if (result) {
      return result;
    }
  }

  const orderElement =
    lessonDetailCard.querySelector(
      '.lesson-order'
    );

  const orderMatch =
    String(
      orderElement?.textContent ||
      ''
    ).match(
      /\bBài\s*(\d+)\b/i
    );

  if (orderMatch) {
    return normalizeLessonNumber(
      orderMatch[1]
    );
  }

  const cardText =
    String(
      lessonDetailCard.innerText ||
      ''
    );

  const cardMatch =
    cardText.match(
      /\bBài\s*(\d+)\b/i
    );

  return cardMatch
    ? normalizeLessonNumber(
        cardMatch[1]
      )
    : null;
}

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

  if (Array.isArray(value)) {
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
    typeof value !==
    'object'
  ) {
    return null;
  }

  const directKeys = [
    'order_number',
    'orderNumber',
    'lesson_number',
    'lessonNumber',
  ];

  for (
    const key of directKeys
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
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
    'currentLesson',
  ];

  for (
    const key of nestedKeys
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        value,
        key
      )
    ) {
      const result =
        findLessonNumberInValue(
          value[key],
          depth + 1
        );

      if (result) {
        return result;
      }
    }
  }

  return null;
}

/* =========================================================
   HÀM HỖ TRỢ
========================================================= */

function isQuizOrResultPage(
  appElement
) {
  return Boolean(
    appElement.querySelector(
      '.quiz-page'
    ) ||
    appElement.querySelector(
      '#quiz-form'
    ) ||
    appElement.querySelector(
      '#final-quiz-form'
    ) ||
    appElement.querySelector(
      '.result-page'
    ) ||
    appElement.querySelector(
      '.admin-page'
    ) ||
    appElement.querySelector(
      '.login-page'
    )
  );
}

function isConfiguredChatLesson(
  lessonNumber
) {
  const normalized =
    normalizeLessonNumber(
      lessonNumber
    );

  return (
    normalized !== null &&
    CONFIGURED_CHAT_LESSONS.includes(
      normalized
    )
  );
}

function normalizeLessonNumber(
  value
) {
  const digits =
    String(
      value ?? ''
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

function removeEmbeddedLessonChat() {
  document
    .querySelectorAll(
      '#lessonAiChatSection'
    )
    .forEach(
      (element) => {
        element.remove();
      }
    );
}

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
