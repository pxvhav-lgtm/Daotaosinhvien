/*
 * Chức năng học video Google Drive.
 *
 * File này được tải sau app.js và thay thế riêng hàm
 * renderLessonPage(), không làm ảnh hưởng các chức năng khác.
 */

let lessonVideoCountdownId = null;

/* =========================================================
   THAY THẾ TRANG NỘI DUNG BÀI HỌC
========================================================= */

window.renderLessonPage = async function (
  lessonId,
  courseId,
  user
) {
  clearLessonVideoCountdown();
  clearQuizTimer();

  renderLoading('Đang tải bài học...');

  const [lessonResult, progressResult] =
    await Promise.all([
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
          minimum_watch_seconds
        `)
        .eq('id', lessonId)
        .single(),

      supabaseClient
        .from('lesson_progress')
        .select(`
          status,
          best_score,
          attempt_count,
          video_started_at,
          video_completed,
          video_completed_at
        `)
        .eq('student_id', user.id)
        .eq('lesson_id', lessonId)
        .single(),
    ]);

  if (lessonResult.error) {
    console.error(
      'Lỗi tải bài học:',
      lessonResult.error
    );

    renderMessage(
      'Không tải được nội dung bài học.'
    );

    return;
  }

  if (progressResult.error) {
    console.error(
      'Lỗi tải tiến độ bài học:',
      progressResult.error
    );

    renderMessage(
      'Không tải được trạng thái bài học.'
    );

    return;
  }

  const lesson = lessonResult.data;
  const progress = progressResult.data;

  if (progress.status === 'locked') {
    renderMessage(
      'Bài học này chưa được mở khóa.'
    );

    return;
  }

  const hasVideo =
    Boolean(
      lesson.video_url &&
      String(lesson.video_url).trim()
    );

  const videoCompleted =
    Boolean(progress.video_completed);

  app.innerHTML = `
    ${renderMainHeader(
      lesson.title,
      true
    )}

    <main class="dashboard-page">
      <article class="lesson-detail-card">
        <p class="lesson-order">
          Bài ${escapeHtml(
            lesson.order_number
          )}
        </p>

        <h2>
          ${escapeHtml(lesson.title)}
        </h2>

        <p class="lesson-description">
          ${escapeHtml(
            lesson.description || ''
          )}
        </p>

        ${
          progress.best_score !== null
            ? `
              <div class="lesson-result-summary">
                <span>Điểm cao nhất</span>

                <strong>
                  ${escapeHtml(
                    progress.best_score
                  )}/100
                </strong>
              </div>
            `
            : ''
        }

        ${
          hasVideo
            ? renderGoogleDriveLearningVideo(
                lesson,
                progress
              )
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
                  src="${escapeAttribute(
                    lesson.image_url
                  )}"
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
                  ${escapeHtml(
                    lesson.content
                  )}
                </p>
              </section>
            `
            : ''
        }

        <section class="quiz-access-card">
          <div>
            <h3>Bài kiểm tra</h3>

            <p id="quiz-access-message">
              ${
                !hasVideo || videoCompleted
                  ? 'Bạn đã đủ điều kiện làm bài kiểm tra.'
                  : 'Bạn cần hoàn thành video trước khi làm bài kiểm tra.'
              }
            </p>
          </div>

          <button
            id="quiz-button"
            class="primary-button"
            type="button"
            ${
              hasVideo && !videoCompleted
                ? 'disabled'
                : ''
            }
          >
            ${
              progress.status === 'passed'
                ? 'Làm lại bài kiểm tra'
                : 'Làm bài kiểm tra'
            }
          </button>
        </section>
      </article>
    </main>
  `;

  document
    .querySelector('#back-button')
    .addEventListener(
      'click',
      async () => {
        clearLessonVideoCountdown();

        await renderCoursePage(
          courseId,
          user
        );
      }
    );

  document
    .querySelector('#logout-button')
    .addEventListener(
      'click',
      async () => {
        clearLessonVideoCountdown();
        await handleLogout();
      }
    );

  const quizButton =
    document.querySelector('#quiz-button');

  quizButton.addEventListener(
    'click',
    async () => {
      if (quizButton.disabled) {
        return;
      }

      clearLessonVideoCountdown();

      await renderQuizPage(
        lessonId,
        courseId,
        user
      );
    }
  );

  if (hasVideo) {
    setupVideoLearningControls({
      lesson,
      progress,
      courseId,
      user,
    });
  }
};

/* =========================================================
   KHUNG VIDEO GOOGLE DRIVE
========================================================= */

function renderGoogleDriveLearningVideo(
  lesson,
  progress
) {
  const minimumSeconds =
    Number(
      lesson.minimum_watch_seconds || 0
    );

  const videoCompleted =
    Boolean(progress.video_completed);

  return `
    <section class="video-learning-section">
      <div class="video-learning-heading">
        <div>
          <p class="video-label">
            VIDEO BÀI HỌC
          </p>

          <h3>
            Xem video trước khi làm bài kiểm tra
          </h3>
        </div>

        <span
          id="video-status-badge"
          class="
            video-status-badge
            ${
              videoCompleted
                ? 'completed'
                : 'pending'
            }
          "
        >
          ${
            videoCompleted
              ? 'Đã hoàn thành'
              : 'Chưa hoàn thành'
          }
        </span>
      </div>

      <div
        id="video-frame-wrapper"
        class="
          video-frame-wrapper
          ${
            progress.video_started_at ||
            videoCompleted
              ? ''
              : 'video-not-started'
          }
        "
      >
        <iframe
          id="lesson-video-frame"
          src="${escapeAttribute(
            lesson.video_url
          )}"
          title="Video bài học"
          allow="autoplay; fullscreen"
          allowfullscreen
        ></iframe>

        ${
          !progress.video_started_at &&
          !videoCompleted
            ? `
              <div
                id="video-start-overlay"
                class="video-start-overlay"
              >
                <div class="video-start-content">
                  <div class="video-play-icon">
                    ▶
                  </div>

                  <h3>Bắt đầu học video</h3>

                  <p>
                    Thời gian học tối thiểu:
                    <strong>
                      ${formatLearningDuration(
                        minimumSeconds
                      )}
                    </strong>
                  </p>

                  <button
                    id="start-video-button"
                    class="primary-button"
                    type="button"
                  >
                    Bắt đầu xem video
                  </button>
                </div>
              </div>
            `
            : ''
        }
      </div>

      <div class="video-progress-panel">
        <div class="video-progress-information">
          <span>Thời gian học tối thiểu</span>

          <strong>
            ${formatLearningDuration(
              minimumSeconds
            )}
          </strong>
        </div>

        <div class="video-progress-information">
          <span>Thời gian còn lại</span>

          <strong id="video-remaining-time">
            ${
              videoCompleted
                ? 'Đã hoàn thành'
                : progress.video_started_at
                  ? 'Đang tính...'
                  : formatLearningDuration(
                      minimumSeconds
                    )
            }
          </strong>
        </div>

        <div class="video-progress-information">
          <span>Trạng thái</span>

          <strong id="video-progress-status">
            ${
              videoCompleted
                ? 'Đã xác nhận'
                : progress.video_started_at
                  ? 'Đang học'
                  : 'Chưa bắt đầu'
            }
          </strong>
        </div>
      </div>

      <div
        id="video-learning-message"
        class="video-learning-message"
        role="status"
      >
        ${
          videoCompleted
            ? 'Bạn đã hoàn thành yêu cầu xem video.'
            : progress.video_started_at
              ? 'Hãy tiếp tục xem video cho đến khi đủ thời gian.'
              : 'Nhấn “Bắt đầu xem video” để bắt đầu tính thời gian học.'
        }
      </div>

      <div class="video-confirm-actions">
        <button
          id="complete-video-button"
          class="primary-button"
          type="button"
          ${
            videoCompleted ||
            !progress.video_started_at
              ? 'disabled'
              : ''
          }
        >
          ${
            videoCompleted
              ? 'Đã hoàn thành video'
              : 'Xác nhận đã xem xong'
          }
        </button>
      </div>
    </section>
  `;
}

/* =========================================================
   ĐIỀU KHIỂN VIDEO
========================================================= */

function setupVideoLearningControls({
  lesson,
  progress,
  courseId,
  user,
}) {
  const startButton =
    document.querySelector(
      '#start-video-button'
    );

  const completeButton =
    document.querySelector(
      '#complete-video-button'
    );

  if (progress.video_completed) {
    unlockQuizAfterVideo();
    return;
  }

  if (progress.video_started_at) {
    startVideoCountdown({
      lessonId: lesson.id,
      startedAt:
        progress.video_started_at,
      minimumSeconds:
        Number(
          lesson.minimum_watch_seconds || 0
        ),
    });
  }

  if (startButton) {
    startButton.addEventListener(
      'click',
      async () => {
        startButton.disabled = true;
        startButton.textContent =
          'Đang bắt đầu...';

        const { data, error } =
          await supabaseClient.rpc(
            'start_lesson_video',
            {
              p_lesson_id:
                Number(lesson.id),
            }
          );

        if (error) {
          console.error(
            'Lỗi bắt đầu video:',
            error
          );

          startButton.disabled = false;
          startButton.textContent =
            'Bắt đầu xem video';

          setVideoLearningMessage(
            getVideoFriendlyError(
              error,
              'Không thể bắt đầu tính thời gian học.'
            ),
            true
          );

          return;
        }

        document
          .querySelector(
            '#video-start-overlay'
          )
          ?.remove();

        document
          .querySelector(
            '#video-frame-wrapper'
          )
          ?.classList.remove(
            'video-not-started'
          );

        updateVideoStatusBadge(
          'Đang học',
          'studying'
        );

        setVideoProgressStatus(
          'Đang học'
        );

        setVideoLearningMessage(
          'Thời gian học đã bắt đầu. Hãy xem đầy đủ nội dung video.'
        );

        if (completeButton) {
          completeButton.disabled = false;
        }

        startVideoCountdown({
          lessonId: lesson.id,
          startedAt:
            data.video_started_at,
          minimumSeconds:
            Number(
              data.minimum_watch_seconds ||
              lesson.minimum_watch_seconds ||
              0
            ),
        });
      }
    );
  }

  if (completeButton) {
    completeButton.addEventListener(
      'click',
      async () => {
        completeButton.disabled = true;
        completeButton.textContent =
          'Đang xác nhận...';

        const { data, error } =
          await supabaseClient.rpc(
            'complete_lesson_video',
            {
              p_lesson_id:
                Number(lesson.id),
            }
          );

        if (error) {
          console.error(
            'Lỗi xác nhận video:',
            error
          );

          completeButton.disabled = false;
          completeButton.textContent =
            'Xác nhận đã xem xong';

          setVideoLearningMessage(
            getVideoFriendlyError(
              error,
              'Chưa thể xác nhận hoàn thành video.'
            ),
            true
          );

          return;
        }

        if (!data?.video_completed) {
          completeButton.disabled = false;
          completeButton.textContent =
            'Xác nhận đã xem xong';

          return;
        }

        clearLessonVideoCountdown();

        completeButton.disabled = true;
        completeButton.textContent =
          'Đã hoàn thành video';

        updateVideoRemainingTime(
          'Đã hoàn thành'
        );

        setVideoProgressStatus(
          'Đã xác nhận'
        );

        updateVideoStatusBadge(
          'Đã hoàn thành',
          'completed'
        );

        setVideoLearningMessage(
          'Bạn đã hoàn thành yêu cầu xem video. Bài kiểm tra đã được mở.',
          false,
          true
        );

        unlockQuizAfterVideo();
      }
    );
  }
}

/* =========================================================
   ĐỒNG HỒ HỌC VIDEO
========================================================= */

function startVideoCountdown({
  lessonId,
  startedAt,
  minimumSeconds,
}) {
  clearLessonVideoCountdown();

  const startedTimestamp =
    new Date(startedAt).getTime();

  if (
    !Number.isFinite(startedTimestamp)
  ) {
    updateVideoRemainingTime(
      formatLearningDuration(
        minimumSeconds
      )
    );

    return;
  }

  const updateCountdown = () => {
    const elapsedSeconds =
      Math.max(
        Math.floor(
          (
            Date.now() -
            startedTimestamp
          ) / 1000
        ),
        0
      );

    const remainingSeconds =
      Math.max(
        Number(minimumSeconds) -
        elapsedSeconds,
        0
      );

    updateVideoRemainingTime(
      remainingSeconds <= 0
        ? 'Có thể xác nhận'
        : formatLearningDuration(
            remainingSeconds
          )
    );

    if (remainingSeconds <= 0) {
      clearLessonVideoCountdown();

      setVideoProgressStatus(
        'Đủ thời gian'
      );

      setVideoLearningMessage(
        'Bạn đã đủ thời gian học tối thiểu. Hãy xem xong video rồi nhấn xác nhận.'
      );

      const completeButton =
        document.querySelector(
          '#complete-video-button'
        );

      if (completeButton) {
        completeButton.disabled = false;
      }
    }
  };

  updateCountdown();

  lessonVideoCountdownId =
    window.setInterval(
      updateCountdown,
      1000
    );
}

function clearLessonVideoCountdown() {
  if (
    lessonVideoCountdownId !== null
  ) {
    window.clearInterval(
      lessonVideoCountdownId
    );

    lessonVideoCountdownId = null;
  }
}

/* =========================================================
   MỞ BÀI KIỂM TRA
========================================================= */

function unlockQuizAfterVideo() {
  const quizButton =
    document.querySelector(
      '#quiz-button'
    );

  const accessMessage =
    document.querySelector(
      '#quiz-access-message'
    );

  if (quizButton) {
    quizButton.disabled = false;
  }

  if (accessMessage) {
    accessMessage.textContent =
      'Bạn đã đủ điều kiện làm bài kiểm tra.';
  }

  document
    .querySelector(
      '.quiz-access-card'
    )
    ?.classList.add('unlocked');
}

/* =========================================================
   CẬP NHẬT GIAO DIỆN
========================================================= */

function updateVideoRemainingTime(
  value
) {
  const element =
    document.querySelector(
      '#video-remaining-time'
    );

  if (element) {
    element.textContent = value;
  }
}

function setVideoProgressStatus(
  value
) {
  const element =
    document.querySelector(
      '#video-progress-status'
    );

  if (element) {
    element.textContent = value;
  }
}

function updateVideoStatusBadge(
  text,
  statusClass
) {
  const badge =
    document.querySelector(
      '#video-status-badge'
    );

  if (!badge) {
    return;
  }

  badge.textContent = text;
  badge.className =
    `video-status-badge ${statusClass}`;
}

function setVideoLearningMessage(
  message,
  isError = false,
  isSuccess = false
) {
  const element =
    document.querySelector(
      '#video-learning-message'
    );

  if (!element) {
    return;
  }

  element.textContent = message;

  element.classList.toggle(
    'error',
    isError
  );

  element.classList.toggle(
    'success',
    isSuccess
  );
}

/* =========================================================
   HÀM HỖ TRỢ
========================================================= */

function formatLearningDuration(
  totalSeconds
) {
  const seconds =
    Math.max(
      Number(totalSeconds) || 0,
      0
    );

  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    seconds % 60;

  if (minutes <= 0) {
    return `${remainingSeconds} giây`;
  }

  if (remainingSeconds === 0) {
    return `${minutes} phút`;
  }

  return (
    `${minutes} phút ` +
    `${remainingSeconds} giây`
  );
}

function getVideoFriendlyError(
  error,
  fallback
) {
  const message =
    String(error?.message || '');

  const remainingMatch =
    message.match(
      /thêm\s+(\d+)\s+giây/i
    );

  if (remainingMatch) {
    return (
      'Bạn cần xem video thêm ' +
      formatLearningDuration(
        Number(remainingMatch[1])
      ) +
      '.'
    );
  }

  if (
    message.includes(
      'Bạn chưa bắt đầu xem video'
    )
  ) {
    return 'Bạn chưa bắt đầu xem video.';
  }

  if (
    message.includes(
      'Bài học này chưa được mở khóa'
    )
  ) {
    return 'Bài học này chưa được mở khóa.';
  }

  if (
    message.includes(
      'Bạn chưa đăng nhập'
    )
  ) {
    return 'Phiên đăng nhập đã hết hạn.';
  }

  return fallback;
}
