/*
 * final-quiz.js
 * Bài 23: Kiểm tra tổng kết 50 câu từ kho Bài 1-22.
 * Tải file này sau app.js.
 */

(() => {
  'use strict';

  const FINAL_LESSON_NUMBER = 23;
  const FINAL_QUIZ_ID = 23;

  const originalRenderQuizPage =
    window.renderQuizPage;

  let finalQuizSubmitting = false;

  if (
    typeof originalRenderQuizPage !==
    'function'
  ) {
    console.error(
      'Không tìm thấy renderQuizPage trong app.js.'
    );

    return;
  }

  window.renderQuizPage =
    async function (
      lessonId,
      courseId,
      user
    ) {
      const {
        data: lesson,
        error,
      } = await supabaseClient
        .from('lessons')
        .select(`
          id,
          order_number
        `)
        .eq('id', lessonId)
        .single();

      if (error) {
        console.error(
          'Lỗi kiểm tra bài học:',
          error
        );

        renderMessage(
          'Không xác định được bài kiểm tra.'
        );

        return;
      }

      if (
        Number(lesson.order_number) ===
        FINAL_LESSON_NUMBER
      ) {
        await renderFinalQuizPage(
          lessonId,
          courseId,
          user
        );

        return;
      }

      await originalRenderQuizPage(
        lessonId,
        courseId,
        user
      );
    };

  try {
    renderQuizPage =
      window.renderQuizPage;
  } catch (error) {
    console.warn(
      'Không thể gán lại renderQuizPage:',
      error
    );
  }

  async function renderFinalQuizPage(
    lessonId,
    courseId,
    user
  ) {
    clearQuizTimer();

    renderLoading(
      'Đang tạo bài kiểm tra tổng kết...'
    );

    const { data, error } =
      await supabaseClient.rpc(
        'start_final_quiz',
        {
          p_quiz_id: FINAL_QUIZ_ID,
        }
      );

    if (error) {
      console.error(
        'Lỗi bắt đầu bài tổng kết:',
        error
      );

      if (
        String(
          error.message || ''
        ).includes(
          'hết số lần làm bài'
        )
      ) {
        renderFinalNoAttemptsPage(
          lessonId,
          courseId,
          user
        );

        return;
      }

      renderMessage(
        getFriendlyRpcError(
          error,
          'Không thể bắt đầu bài kiểm tra tổng kết.'
        )
      );

      return;
    }

    const attempt = data || {};

    const questions =
      Array.isArray(
        attempt.questions
      )
        ? attempt.questions
        : [];

    if (questions.length !== 50) {
      console.error(
        'Số câu nhận được:',
        questions.length
      );

      renderMessage(
        'Bộ đề tổng kết chưa đủ 50 câu hỏi.'
      );

      return;
    }

    const startedAt =
      new Date(
        attempt.started_at
      );

    const expiresAt =
      attempt.expires_at
        ? new Date(
            attempt.expires_at
          )
        : new Date(
            startedAt.getTime() +
              Number(
                attempt.time_limit_minutes ||
                  60
              ) *
                60 *
                1000
          );

    const remainingSeconds =
      Math.max(
        Math.floor(
          (
            expiresAt.getTime() -
            Date.now()
          ) / 1000
        ),
        0
      );

    const answeredInitially =
      questions.filter(
        (question) =>
          question.selected_option_id !==
            null &&
          question.selected_option_id !==
            undefined
      ).length;

    app.innerHTML = `
      ${renderMainHeader(
        'Kiểm tra tổng kết cuối đợt',
        true
      )}

      <main
        class="quiz-page final-quiz-page"
      >
        <section
          class="quiz-information-card"
        >
          <div>
            <p class="eyebrow">
              BÀI KIỂM TRA TỔNG KẾT
            </p>

            <h2>
              Kiểm tra, đánh giá sinh viên
              cuối đợt thực tập
            </h2>

            <p class="final-quiz-note">
              Bộ đề gồm 50 câu được lấy ngẫu nhiên
              từ kho câu hỏi Bài 1 đến Bài 22.
            </p>
          </div>

          <div class="quiz-meta-grid">
            <div>
              <span>Điểm đạt</span>

              <strong>
                ${escapeHtml(
                  attempt.passing_score
                )}/100
              </strong>
            </div>

            <div>
              <span>Số câu hỏi</span>

              <strong>
                50
              </strong>
            </div>

            <div>
              <span>Lần làm bài</span>

              <strong>
                ${escapeHtml(
                  attempt.attempt_number
                )}
              </strong>
            </div>

            <div>
              <span>
                Thời gian còn lại
              </span>

              <strong id="quiz-timer">
                ${formatSeconds(
                  remainingSeconds
                )}
              </strong>
            </div>
          </div>
        </section>

        <section
          class="final-progress-card"
        >
          <div>
            Đã trả lời:

            <strong
              id="answered-count"
            >
              ${answeredInitially}/50
            </strong>
          </div>

          <div
            class="final-progress-track"
          >
            <div
              id="final-progress-bar"
              class="final-progress-bar"
              style="
                width:
                ${answeredInitially * 2}%;
              "
            ></div>
          </div>
        </section>

        <form
          id="final-quiz-form"
          class="quiz-form"
        >
          ${
            questions
              .map(
                (
                  question,
                  index
                ) =>
                  renderFinalQuestion(
                    question,
                    index
                  )
              )
              .join('')
          }

          <section
            class="quiz-submit-card"
          >
            <p
              id="final-quiz-message"
              class="form-message"
              role="alert"
            ></p>

            <button
              id="submit-final-quiz-button"
              class="primary-button"
              type="submit"
            >
              Nộp bài tổng kết
            </button>
          </section>
        </form>
      </main>
    `;

    bindFinalQuizEvents({
      attempt,
      questions,
      lessonId,
      courseId,
      user,
      remainingSeconds,
    });

    if (
      remainingSeconds <= 0
    ) {
      await submitFinalQuiz({
        attempt,
        questions,
        lessonId,
        courseId,
        user,
        forceSubmit: true,
      });
    }
  }

  function renderFinalQuestion(
    question,
    index
  ) {
    const options =
      Array.isArray(
        question.options
      )
        ? question.options
        : [];

    return `
      <section
        class="
          question-card
          final-question-card
        "
        data-question-id="${
          question.id
        }"
      >
        <div
          class="question-heading"
        >
          <span
            class="question-number"
          >
            ${index + 1}
          </span>

          <h3>
            ${escapeHtml(
              question.question_text
            )}
          </h3>
        </div>

        <div class="answer-list">
          ${
            options
              .map(
                (
                  option,
                  optionIndex
                ) => `
                  <label
                    class="answer-option"
                  >
                    <input
                      type="radio"
                      name="question-${
                        question.id
                      }"
                      value="${
                        option.id
                      }"
                      ${
                        Number(
                          question
                            .selected_option_id
                        ) ===
                        Number(
                          option.id
                        )
                          ? 'checked'
                          : ''
                      }
                    >

                    <span
                      class="answer-letter"
                    >
                      ${getAnswerLetter(
                        optionIndex
                      )}
                    </span>

                    <span
                      class="answer-text"
                    >
                      ${escapeHtml(
                        option.option_text
                      )}
                    </span>
                  </label>
                `
              )
              .join('')
          }
        </div>

        <p
          class="final-save-status"
          id="save-status-${
            question.id
          }"
        ></p>
      </section>
    `;
  }

  function bindFinalQuizEvents({
    attempt,
    questions,
    lessonId,
    courseId,
    user,
    remainingSeconds,
  }) {
    document
      .querySelector(
        '#back-button'
      )
      ?.addEventListener(
        'click',
        async () => {
          const confirmed =
            window.confirm(
              'Các đáp án đã chọn đã được lưu. Bạn có chắc muốn rời bài kiểm tra?'
            );

          if (!confirmed) {
            return;
          }

          clearQuizTimer();

          await renderLessonPage(
            lessonId,
            courseId,
            user
          );
        }
      );

    document
      .querySelector(
        '#logout-button'
      )
      ?.addEventListener(
        'click',
        async () => {
          const confirmed =
            window.confirm(
              'Các đáp án đã chọn đã được lưu. Bạn có chắc muốn đăng xuất?'
            );

          if (!confirmed) {
            return;
          }

          await handleLogout();
        }
      );

    document
      .querySelectorAll(
        `
          #final-quiz-form
          input[type="radio"]
        `
      )
      .forEach((input) => {
        input.addEventListener(
          'change',
          async () => {
            const card =
              input.closest(
                '[data-question-id]'
              );

            const questionId =
              Number(
                card?.dataset
                  .questionId
              );

            const optionId =
              Number(
                input.value
              );

            await saveFinalAnswer(
              Number(
                attempt.attempt_id
              ),
              questionId,
              optionId
            );

            updateFinalProgress();
          }
        );
      });

    document
      .querySelector(
        '#final-quiz-form'
      )
      ?.addEventListener(
        'submit',
        async (event) => {
          event.preventDefault();

          await submitFinalQuiz({
            attempt,
            questions,
            lessonId,
            courseId,
            user,
            forceSubmit: false,
          });
        }
      );

    startQuizTimer(
      remainingSeconds,
      async () => {
        alert(
          'Đã hết thời gian. Hệ thống sẽ tự động nộp bài.'
        );

        await submitFinalQuiz({
          attempt,
          questions,
          lessonId,
          courseId,
          user,
          forceSubmit: true,
        });
      }
    );
  }

  async function saveFinalAnswer(
    attemptId,
    questionId,
    optionId
  ) {
    const statusElement =
      document.querySelector(
        `#save-status-${questionId}`
      );

    if (statusElement) {
      statusElement.textContent =
        'Đang lưu...';
    }

    const { error } =
      await supabaseClient.rpc(
        'save_final_quiz_answer',
        {
          p_attempt_id:
            attemptId,

          p_question_id:
            questionId,

          p_option_id:
            optionId,
        }
      );

    if (error) {
      console.error(
        'Lỗi lưu đáp án:',
        error
      );

      if (statusElement) {
        statusElement.textContent =
          'Chưa lưu được đáp án. Hãy chọn lại.';

        statusElement.classList.add(
          'save-error'
        );
      }

      return;
    }

    if (statusElement) {
      statusElement.textContent =
        'Đã lưu';

      statusElement.classList.remove(
        'save-error'
      );

      window.setTimeout(
        () => {
          statusElement.textContent =
            '';
        },
        1200
      );
    }
  }

  async function submitFinalQuiz({
    attempt,
    questions,
    lessonId,
    courseId,
    user,
    forceSubmit,
  }) {
    if (finalQuizSubmitting) {
      return;
    }

    const message =
      document.querySelector(
        '#final-quiz-message'
      );

    const submitButton =
      document.querySelector(
        '#submit-final-quiz-button'
      );

    const answeredCount =
      document.querySelectorAll(
        `
          #final-quiz-form
          input[type="radio"]:checked
        `
      ).length;

    if (
      !forceSubmit &&
      answeredCount !==
        questions.length
    ) {
      if (message) {
        message.textContent =
          `Bạn còn ${
            questions.length -
            answeredCount
          } câu chưa trả lời.`;
      }

      const firstUnanswered =
        questions.find(
          (question) =>
            !document.querySelector(
              `
                input[
                  name="question-${
                    question.id
                  }"
                ]:checked
              `
            )
        );

      document
        .querySelector(
          `[data-question-id="${
            firstUnanswered?.id
          }"]`
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

      return;
    }

    if (
      !forceSubmit &&
      !window.confirm(
        'Bạn có chắc muốn nộp bài tổng kết? Sau khi nộp sẽ không thể sửa đáp án.'
      )
    ) {
      return;
    }

    finalQuizSubmitting = true;

    clearQuizTimer();

    if (submitButton) {
      submitButton.disabled = true;

      submitButton.textContent =
        'Đang chấm bài...';
    }

    if (message) {
      message.textContent = '';
    }

    const { data, error } =
      await supabaseClient.rpc(
        'submit_final_quiz',
        {
          p_attempt_id:
            Number(
              attempt.attempt_id
            ),
        }
      );

    if (error) {
      console.error(
        'Lỗi nộp bài tổng kết:',
        error
      );

      finalQuizSubmitting = false;

      if (message) {
        message.textContent =
          getFriendlyRpcError(
            error,
            'Không thể nộp bài tổng kết.'
          );
      }

      if (submitButton) {
        submitButton.disabled =
          false;

        submitButton.textContent =
          'Nộp bài tổng kết';
      }

      return;
    }

    renderFinalQuizResultPage({
      result: data,
      attempt,
      lessonId,
      courseId,
      user,
    });

    finalQuizSubmitting = false;
  }

  function renderFinalQuizResultPage({
    result,
    attempt,
    lessonId,
    courseId,
    user,
  }) {
    clearQuizTimer();

    const isPassed =
      Boolean(
        result.is_passed
      );

    const score =
      Number(
        result.score || 0
      );

    app.innerHTML = `
      ${renderMainHeader(
        'Kết quả kiểm tra tổng kết',
        false
      )}

      <main class="result-page">
        <section
          class="
            result-card
            ${
              isPassed
                ? 'passed'
                : 'failed'
            }
          "
        >
          <div class="result-icon">
            ${
              isPassed
                ? '✓'
                : '!'
            }
          </div>

          <p class="result-label">
            ${
              isPassed
                ? 'HOÀN THÀNH'
                : 'CHƯA ĐẠT'
            }
          </p>

          <h2>
            ${
              isPassed
                ? 'Bạn đã đạt bài kiểm tra cuối đợt'
                : 'Bạn cần tiếp tục ôn tập'
            }
          </h2>

          <div class="result-score">
            <strong>
              ${escapeHtml(
                score
              )}
            </strong>

            <span>/100</span>
          </div>

          <div
            class="final-result-grid"
          >
            <div>
              <span>
                Số câu đúng
              </span>

              <strong>
                ${escapeHtml(
                  result.correct_questions
                )}/50
              </strong>
            </div>

            <div>
              <span>
                Đã trả lời
              </span>

              <strong>
                ${escapeHtml(
                  result.answered_questions
                )}/50
              </strong>
            </div>

            <div>
              <span>
                Điểm đạt
              </span>

              <strong>
                ${escapeHtml(
                  result.passing_score
                )}/100
              </strong>
            </div>

            <div>
              <span>
                Lần làm bài
              </span>

              <strong>
                ${escapeHtml(
                  attempt.attempt_number
                )}
              </strong>
            </div>
          </div>

          <div class="result-actions">
            <button
              id="back-course-result-button"
              class="secondary-button"
              type="button"
            >
              Xem danh sách bài học
            </button>

            ${
              !isPassed
                ? `
                  <button
                    id="retry-final-quiz-button"
                    class="primary-button"
                    type="button"
                  >
                    Làm lại bài tổng kết
                  </button>
                `
                : ''
            }
          </div>
        </section>
      </main>
    `;

    document
      .querySelector(
        '#logout-button'
      )
      ?.addEventListener(
        'click',
        handleLogout
      );

    document
      .querySelector(
        '#back-course-result-button'
      )
      ?.addEventListener(
        'click',
        async () => {
          await renderCoursePage(
            courseId,
            user
          );
        }
      );

    document
      .querySelector(
        '#retry-final-quiz-button'
      )
      ?.addEventListener(
        'click',
        async () => {
          await renderFinalQuizPage(
            lessonId,
            courseId,
            user
          );
        }
      );
  }

  function renderFinalNoAttemptsPage(
    lessonId,
    courseId,
    user
  ) {
    clearQuizTimer();

    app.innerHTML = `
      ${renderMainHeader(
        'Kiểm tra tổng kết cuối đợt',
        true
      )}

      <main class="result-page">
        <section
          class="result-card failed"
        >
          <div class="result-icon">
            !
          </div>

          <p class="result-label">
            HẾT LƯỢT LÀM BÀI
          </p>

          <h2>
            Bạn đã sử dụng hết số lần
            làm bài tổng kết
          </h2>

          <p>
            Vui lòng liên hệ cán bộ hướng dẫn
            để được hỗ trợ.
          </p>

          <div class="result-actions">
            <button
              id="back-final-lesson-button"
              class="secondary-button"
              type="button"
            >
              Quay lại Bài 23
            </button>
          </div>
        </section>
      </main>
    `;

    const goBack =
      async () => {
        await renderLessonPage(
          lessonId,
          courseId,
          user
        );
      };

    document
      .querySelector(
        '#back-button'
      )
      ?.addEventListener(
        'click',
        goBack
      );

    document
      .querySelector(
        '#back-final-lesson-button'
      )
      ?.addEventListener(
        'click',
        goBack
      );

    document
      .querySelector(
        '#logout-button'
      )
      ?.addEventListener(
        'click',
        handleLogout
      );
  }

  function updateFinalProgress() {
    const count =
      document.querySelectorAll(
        `
          #final-quiz-form
          input[type="radio"]:checked
        `
      ).length;

    const countElement =
      document.querySelector(
        '#answered-count'
      );

    const progressBar =
      document.querySelector(
        '#final-progress-bar'
      );

    if (countElement) {
      countElement.textContent =
        `${count}/50`;
    }

    if (progressBar) {
      progressBar.style.width =
        `${count * 2}%`;
    }
  }
})();
