/**
 * Chatbox hỏi đáp tài liệu.
 *
 * Hỗ trợ:
 * 1. Chatbox trong trang chi tiết bài học.
 * 2. Chatbox độc lập tại tab Trợ lý AI.
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

/* =========================================================
   KHỞI TẠO CHATBOX TRONG TRANG BÀI HỌC
========================================================= */

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
            .apply(
              this,
              args
            );

        window.setTimeout(
          () => {
            injectLessonChat(
              args
            );
          },
          150
        );

        return result;
      };

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

  const appElement =
    document.querySelector(
      '#app'
    );

  if (!appElement) {
    return;
  }

  let observerTimer =
    null;

  const observer =
    new MutationObserver(
      () => {
        if (
          observerTimer
        ) {
          window.clearTimeout(
            observerTimer
          );
        }

        observerTimer =
          window.setTimeout(
            () => {
              injectLessonChat(
                []
              );
            },
            180
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
})();

/* =========================================================
   CHATBOX TRONG TRANG BÀI HỌC
========================================================= */

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

  const lessonDetailCard =
    appElement.querySelector(
      '.lesson-detail-card'
    );

  if (
    !lessonDetailCard
  ) {
    removeLessonChat();
    return;
  }

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

  if (
    !CONFIGURED_CHAT_LESSONS.includes(
      Number(
        lessonNumber
      )
    )
  ) {
    removeLessonChat();
    return;
  }

  const existingChat =
    document.querySelector(
      '#lessonAiChatSection'
    );

  if (
    existingChat &&
    existingChat.dataset
      .lesson ===
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

function isLessonPageVisible(
  appElement
) {
  const lessonDetailCard =
    appElement.querySelector(
      '.lesson-detail-card'
    );

  if (
    !lessonDetailCard
  ) {
    return false;
  }

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
    );

  const isLoginPage =
    Boolean(
      appElement.querySelector(
        '.login-page'
      )
    );

  return (
    !isQuizPage &&
    !isResultPage &&
    !isAdminPage &&
    !isLoginPage
  );
}

/* =========================================================
   XÁC ĐỊNH SỐ BÀI
========================================================= */

function detectLessonNumber(
  renderArguments,
  lessonDetailCard
) {
  const fromArguments =
    findLessonNumberInValue(
      renderArguments
    );

  if (
    fromArguments
  ) {
    return fromArguments;
  }

  const globals = [
    window.currentLesson,
    window.selectedLesson,
    window.activeLesson,
    window.currentLessonData,
  ];

  for (
    const value of globals
  ) {
    const detected =
      findLessonNumberInValue(
        value
      );

    if (
      detected
    ) {
      return detected;
    }
  }

  const lessonOrderElement =
    lessonDetailCard.querySelector(
      '.lesson-order'
    );

  if (
    lessonOrderElement
  ) {
    const match =
      String(
        lessonOrderElement
          .textContent ||
        ''
      ).match(
        /\bBài\s*(\d+)\b/i
      );

    if (
      match
    ) {
      return normalizeLessonNumber(
        match[1]
      );
    }
  }

  const pageText =
    String(
      lessonDetailCard
        .innerText ||
      ''
    );

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
    typeof value ===
      'number' ||
    typeof value ===
      'string'
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

      if (
        result
      ) {
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

      if (
        normalized
      ) {
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
      Object.prototype
        .hasOwnProperty
        .call(
          value,
          key
        )
    ) {
      const result =
        findLessonNumberInValue(
          value[key],
          depth + 1
        );

      if (
        result
      ) {
        return result;
      }
    }
  }

  return null;
}

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
   GIAO DIỆN CHAT TRONG BÀI
========================================================= */

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

function findLessonChatTarget(
  appElement
) {
  const lessonDetailCard =
    appElement.querySelector(
      '.lesson-detail-card'
    );

  if (
    lessonDetailCard &&
    lessonDetailCard
      .parentElement
  ) {
    return lessonDetailCard
      .parentElement;
  }

  return (
    appElement.querySelector(
      'main'
    ) ||
    appElement
  );
}

/* =========================================================
   CHATBOX ĐỘC LẬP TRONG TAB AI
========================================================= */

window.renderStandaloneLessonChat =
  function (
    lessonNumber,
    lessonTitle,
    container
  ) {
    if (
      !container
    ) {
      return;
    }

    const normalizedLesson =
      normalizeLessonNumber(
        lessonNumber
      );

    if (
      !normalizedLesson ||
      !CONFIGURED_CHAT_LESSONS
        .includes(
          normalizedLesson
        )
    ) {
      container.innerHTML = `
        <div class="standalone-chat-unavailable">
          Trợ lý AI chưa được cấu hình
          cho bài học này.
        </div>
      `;

      return;
    }

    const chatUrl =
      buildLessonChatUrl(
        normalizedLesson
      );

    container.innerHTML = `
      <section
        id="standaloneLessonChat"
        class="standalone-lesson-chat"
        data-lesson="${normalizedLesson}"
      >
        <div
          class="standalone-lesson-chat__status"
        >
          <div>
            <span>
              Bài ${escapeLessonChatHtml(
                normalizedLesson
              )}
            </span>

            <strong>
              ${escapeLessonChatHtml(
                lessonTitle ||
                ''
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
        </div>

        <div
          class="standalone-lesson-chat__body"
        >
          <div
            class="standalone-lesson-chat__loading"
          >
            Đang tải Trợ lý AI...
          </div>

          <iframe
            class="standalone-lesson-chat__iframe"
            title="Trợ lý AI Bài ${escapeLessonChatHtml(
              normalizedLesson
            )}"
            src="${escapeLessonChatHtml(
              chatUrl
            )}"
            loading="lazy"
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

    const loading =
      container.querySelector(
        '.standalone-lesson-chat__loading'
      );

    iframe?.addEventListener(
      'load',
      () => {
        if (
          loading
        ) {
          loading.hidden =
            true;
        }

        iframe.classList.add(
          'is-loaded'
        );
      }
    );
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
   SỰ KIỆN
========================================================= */

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

  iframe?.addEventListener(
    'load',
    () => {
      if (
        loading
      ) {
        loading.hidden =
          true;
      }

      iframe.classList.add(
        'is-loaded'
      );
    }
  );

  toggleButton?.addEventListener(
    'click',
    () => {
      const collapsed =
        section.classList.toggle(
          'is-collapsed'
        );

      if (
        body
      ) {
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
   URL VÀ XÓA CHAT
========================================================= */

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

function removeLessonChat() {
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

function removeStandaloneLessonChat() {
  if (
    typeof window
      .removeStandaloneLessonChat ===
    'function'
  ) {
    window
      .removeStandaloneLessonChat();
  }
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
