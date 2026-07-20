/*
 * =========================================================
 * HIỆU CHỈNH IN PHIẾU KẾT QUẢ
 * =========================================================
 *
 * Chức năng:
 * - Tạo tên file PDF gợi ý theo bài và sinh viên.
 * - Không thay đổi dữ liệu hoặc chức năng Admin hiện tại.
 *
 * File này phải tải sau admin-results.js.
 */

(function initializeAdminPrintFix() {
  let originalDocumentTitle =
    document.title;

  /*
   * Xử lý trước listener window.print()
   * trong admin-results.js.
   */
  document.addEventListener(
    'click',
    (event) => {
      const printButton =
        event.target.closest(
          '#admin-print-button'
        );

      if (!printButton) {
        return;
      }

      originalDocumentTitle =
        document.title;

      const suggestedFileName =
        createAdminPrintSuggestedFileName();

      document.title =
        suggestedFileName;

      /*
       * Trường hợp trình duyệt không phát
       * sự kiện afterprint ổn định.
       */
      window.setTimeout(
        () => {
          if (
            document.title ===
            suggestedFileName
          ) {
            document.title =
              originalDocumentTitle;
          }
        },
        30000
      );
    },
    true
  );

  /*
   * Khôi phục tiêu đề website sau khi
   * đóng cửa sổ in.
   */
  window.addEventListener(
    'afterprint',
    () => {
      window.setTimeout(
        () => {
          document.title =
            originalDocumentTitle;
        },
        300
      );
    }
  );
})();


function createAdminPrintSuggestedFileName() {
  const studentName =
    getAdminPrintStudentName();

  const testTitle =
    getAdminPrintTestTitle();

  return sanitizeAdminPrintFileName(
    `Kết quả kiểm tra ${testTitle} - ${studentName}`
  );
}


function getAdminPrintStudentName() {
  const rows =
    Array.from(
      document.querySelectorAll(
        '.admin-print-information-table tbody tr'
      )
    );

  for (const row of rows) {
    const cells =
      Array.from(
        row.querySelectorAll(
          'th, td'
        )
      );

    for (
      let index = 0;
      index < cells.length;
      index += 1
    ) {
      const label =
        String(
          cells[index]
            ?.textContent ||
          ''
        )
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

      if (
        label === 'họ và tên'
      ) {
        const value =
          String(
            cells[index + 1]
              ?.textContent ||
            ''
          )
            .replace(/\s+/g, ' ')
            .trim();

        if (value) {
          return value;
        }
      }
    }
  }

  return 'Sinh viên';
}


function getAdminPrintTestTitle() {
  const subtitleElement =
    document.querySelector(
      '.admin-print-title p'
    );

  const subtitle =
    String(
      subtitleElement
        ?.textContent ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();

  if (!subtitle) {
    return 'bài kiểm tra';
  }

  /*
   * Bài cuối khóa.
   */
  if (
    subtitle
      .toLowerCase()
      .includes(
        'đào tạo sinh viên thực tập'
      )
  ) {
    return 'cuối khóa';
  }

  /*
   * Ví dụ:
   * Bài 6: Hệ thống chữa cháy bằng nước và CO2
   */
  return subtitle;
}


function sanitizeAdminPrintFileName(
  value
) {
  return String(
    value || ''
  )
    /*
     * Các ký tự không được phép trong
     * tên file Windows.
     */
    .replace(
      /[\\/:*?"<>|]/g,
      '-'
    )
    .replace(
      /\s+/g,
      ' '
    )
    .replace(
      /-+/g,
      '-'
    )
    .trim()
    .slice(
      0,
      180
    );
}
