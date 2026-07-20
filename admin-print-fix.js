/*
 * =========================================================
 * XUẤT PHIẾU KẾT QUẢ THÀNH PDF
 * =========================================================
 *
 * Chức năng:
 * - Tạo PDF trực tiếp, không mở Microsoft Print to PDF.
 * - Tự động đặt tên file.
 * - Giữ nút Ctrl + P hoặc in trình duyệt khi cần.
 *
 * File này phải tải sau:
 * - admin-results.js
 */

(function initializeAdminPrintFix() {
  document.addEventListener(
    'click',
    async (event) => {
      const printButton =
        event.target.closest(
          '#admin-print-button'
        );

      if (!printButton) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      await exportAdminResultPdf(
        printButton
      );
    },
    true
  );
})();


/* =========================================================
   XUẤT PDF
========================================================= */

async function exportAdminResultPdf(
  button
) {
  const documentElement =
    document.querySelector(
      '.admin-print-document'
    );

  if (!documentElement) {
    window.alert(
      'Không tìm thấy nội dung phiếu kết quả.'
    );

    return;
  }

  const oldText =
    button.textContent;

  button.disabled =
    true;

  button.textContent =
    'Đang tạo PDF...';

  try {
    await ensureHtml2PdfLoaded();

    await waitForAdminPrintImages(
      documentElement
    );

    const fileName =
      createAdminPrintPdfFileName();

    const clonedDocument =
      documentElement.cloneNode(
        true
      );

    prepareAdminPrintClone(
      clonedDocument
    );

    const temporaryContainer =
      document.createElement(
        'div'
      );

    temporaryContainer.className =
      'admin-pdf-export-container';

    temporaryContainer.appendChild(
      clonedDocument
    );

    document.body.appendChild(
      temporaryContainer
    );

    const options = {
      margin: 0,

      filename:
        `${fileName}.pdf`,

      image: {
        type: 'jpeg',
        quality: 0.98,
      },

      html2canvas: {
        scale: 2,

        useCORS: true,

        allowTaint: false,

        backgroundColor:
          '#ffffff',

        logging: false,

        scrollX: 0,

        scrollY: 0,

        windowWidth:
          794,
      },

      jsPDF: {
        unit: 'mm',

        format: 'a4',

        orientation:
          'portrait',

        compress: true,
      },

      pagebreak: {
        mode: [
          'avoid-all',
          'css',
          'legacy',
        ],
      },
    };

    await window
      .html2pdf()
      .set(options)
      .from(clonedDocument)
      .save();

    temporaryContainer.remove();
  } catch (error) {
    console.error(
      'Lỗi tạo PDF:',
      error
    );

    window.alert(
      'Không thể tạo file PDF. Vui lòng kiểm tra kết nối mạng và thử lại.'
    );
  } finally {
    button.disabled =
      false;

    button.textContent =
      oldText;
  }
}


/* =========================================================
   TẢI THƯ VIỆN HTML2PDF
========================================================= */

function ensureHtml2PdfLoaded() {
  if (
    typeof window.html2pdf ===
    'function'
  ) {
    return Promise.resolve();
  }

  return new Promise(
    (
      resolve,
      reject
    ) => {
      const existingScript =
        document.querySelector(
          '#html2pdf-library'
        );

      if (existingScript) {
        existingScript.addEventListener(
          'load',
          resolve,
          {
            once: true,
          }
        );

        existingScript.addEventListener(
          'error',
          reject,
          {
            once: true,
          }
        );

        return;
      }

      const script =
        document.createElement(
          'script'
        );

      script.id =
        'html2pdf-library';

      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

      script.async =
        true;

      script.onload =
        () => {
          resolve();
        };

      script.onerror =
        () => {
          reject(
            new Error(
              'Không tải được thư viện html2pdf.'
            )
          );
        };

      document.head.appendChild(
        script
      );
    }
  );
}


/* =========================================================
   CHỜ LOGO TẢI XONG
========================================================= */

async function waitForAdminPrintImages(
  rootElement
) {
  const images =
    Array.from(
      rootElement.querySelectorAll(
        'img'
      )
    );

  await Promise.all(
    images.map(
      (image) => {
        if (
          image.complete &&
          image.naturalWidth > 0
        ) {
          return Promise.resolve();
        }

        return new Promise(
          (resolve) => {
            image.addEventListener(
              'load',
              resolve,
              {
                once: true,
              }
            );

            image.addEventListener(
              'error',
              resolve,
              {
                once: true,
              }
            );

            window.setTimeout(
              resolve,
              5000
            );
          }
        );
      }
    )
  );
}


/* =========================================================
   CHUẨN BỊ BẢN SAO DÙNG XUẤT PDF
========================================================= */

function prepareAdminPrintClone(
  clonedDocument
) {
  clonedDocument.classList.add(
    'admin-print-document-export'
  );

  clonedDocument.style.margin =
    '0';

  clonedDocument.style.boxShadow =
    'none';

  clonedDocument.style.transform =
    'none';

  clonedDocument.style.width =
    '210mm';

  clonedDocument.style.minHeight =
    '297mm';

  clonedDocument.style.background =
    '#ffffff';

  clonedDocument
    .querySelectorAll(
      'button, .no-print'
    )
    .forEach(
      (element) => {
        element.remove();
      }
    );
}


/* =========================================================
   TẠO TÊN FILE
========================================================= */

function createAdminPrintPdfFileName() {
  const studentName =
    getAdminPrintStudentName();

  const testName =
    getAdminPrintTestName();

  return sanitizeAdminPrintFileName(
    `Kết quả kiểm tra ${testName} - ${studentName}`
  );
}


function getAdminPrintStudentName() {
  const tables =
    document.querySelectorAll(
      '.admin-print-information-table'
    );

  for (
    const table of tables
  ) {
    const cells =
      Array.from(
        table.querySelectorAll(
          'th, td'
        )
      );

    for (
      let index = 0;
      index < cells.length;
      index += 1
    ) {
      const label =
        normalizeAdminPrintText(
          cells[index]
            .textContent
        )
          .toLowerCase();

      if (
        label ===
        'họ và tên'
      ) {
        const value =
          normalizeAdminPrintText(
            cells[index + 1]
              ?.textContent
          );

        if (value) {
          return value;
        }
      }
    }
  }

  return 'Sinh viên';
}


function getAdminPrintTestName() {
  const subtitle =
    normalizeAdminPrintText(
      document.querySelector(
        '.admin-print-title p'
      )?.textContent
    );

  if (!subtitle) {
    return 'bài kiểm tra';
  }

  const title =
    normalizeAdminPrintText(
      document.querySelector(
        '.admin-print-title h1'
      )?.textContent
    ).toLowerCase();

  if (
    title.includes(
      'cuối khóa'
    )
  ) {
    return 'cuối khóa';
  }

  return subtitle;
}


function normalizeAdminPrintText(
  value
) {
  return String(
    value || ''
  )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


function sanitizeAdminPrintFileName(
  value
) {
  return String(
    value || ''
  )
    .replace(
      /[\\/:*?"<>|]/g,
      '-'
    )
    .replace(
      /\s+/g,
      ' '
    )
    .replace(
      /\s*-\s*/g,
      ' - '
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
