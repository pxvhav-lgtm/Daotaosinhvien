/*
 * =========================================================
 * XUẤT PHIẾU KẾT QUẢ THÀNH PDF
 * =========================================================
 *
 * Chức năng:
 * - Xuất PDF trực tiếp, không qua Microsoft Print to PDF.
 * - Tự động đặt tên file.
 * - Không bị cắt phần bên trái.
 * - Luôn căn toàn bộ phiếu vào giữa một trang A4.
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

      /*
       * Ngăn listener window.print()
       * cũ trong admin-results.js chạy.
       */
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
  const sourceDocument =
    document.querySelector(
      '.admin-print-document'
    );

  if (!sourceDocument) {
    window.alert(
      'Không tìm thấy nội dung phiếu kết quả.'
    );

    return;
  }

  const originalButtonText =
    button.textContent;

  button.disabled = true;

  button.textContent =
    'Đang tạo PDF...';

  let exportHost = null;

  try {
    await ensureAdminPdfLibraries();

    await waitForAdminPrintImages(
      sourceDocument
    );

    const fileName =
      createAdminPrintPdfFileName();

    /*
     * Tạo bản sao để xuất PDF.
     * Không làm thay đổi giao diện đang hiển thị.
     */
    const clonedDocument =
      sourceDocument.cloneNode(
        true
      );

    prepareAdminPrintClone(
      clonedDocument
    );

    /*
     * Không đặt left: -100000px.
     *
     * Bản sao được đặt tại tọa độ 0,0,
     * nằm phía sau giao diện bằng z-index âm.
     * Nhờ đó html2canvas không tính sai tọa độ.
     */
    exportHost =
      document.createElement(
        'div'
      );

    exportHost.className =
      'admin-pdf-export-host';

    exportHost.appendChild(
      clonedDocument
    );

    document.body.appendChild(
      exportHost
    );

    /*
     * Chờ trình duyệt hoàn thành bố cục
     * trước khi tạo canvas.
     */
    await waitForAdminPdfLayout();

    const canvas =
      await window.html2canvas(
        clonedDocument,
        {
          scale: 2,

          useCORS: true,

          allowTaint: false,

          backgroundColor:
            '#ffffff',

          logging: false,

          scrollX: 0,

          scrollY: 0,

          width:
            clonedDocument.scrollWidth,

          height:
            clonedDocument.scrollHeight,

          windowWidth:
            clonedDocument.scrollWidth,

          windowHeight:
            clonedDocument.scrollHeight,

          onclone:
            (
              clonedPageDocument
            ) => {
              const exportedElement =
                clonedPageDocument
                  .querySelector(
                    '.admin-print-document-export'
                  );

              if (
                exportedElement
              ) {
                exportedElement
                  .style
                  .transform =
                  'none';

                exportedElement
                  .style
                  .margin =
                  '0';

                exportedElement
                  .style
                  .boxShadow =
                  'none';
              }
            },
        }
      );

    if (
      !canvas.width ||
      !canvas.height
    ) {
      throw new Error(
        'Canvas PDF không có kích thước hợp lệ.'
      );
    }

    saveAdminCanvasAsPdf(
      canvas,
      fileName
    );
  } catch (error) {
    console.error(
      'Lỗi tạo PDF:',
      error
    );

    window.alert(
      'Không thể tạo file PDF. Vui lòng tải lại trang và thử lại.'
    );
  } finally {
    exportHost?.remove();

    button.disabled = false;

    button.textContent =
      originalButtonText;
  }
}


/* =========================================================
   CHUYỂN CANVAS THÀNH PDF A4
========================================================= */

function saveAdminCanvasAsPdf(
  canvas,
  fileName
) {
  const {
    jsPDF
  } =
    window.jspdf;

  const pdf =
    new jsPDF({
      orientation:
        'portrait',

      unit:
        'mm',

      format:
        'a4',

      compress:
        true,
    });

  const pageWidth =
    pdf.internal.pageSize
      .getWidth();

  const pageHeight =
    pdf.internal.pageSize
      .getHeight();

  /*
   * Chừa lề nhỏ an toàn.
   */
  const marginX = 0;

  const marginY = 0;

  const availableWidth =
    pageWidth -
    marginX * 2;

  const availableHeight =
    pageHeight -
    marginY * 2;

  /*
   * Tính tỷ lệ để toàn bộ phiếu vừa một trang.
   *
   * Không cắt ngang hoặc cắt dọc.
   */
  const widthScale =
    availableWidth /
    canvas.width;

  const heightScale =
    availableHeight /
    canvas.height;

  const scale =
    Math.min(
      widthScale,
      heightScale
    );

  const imageWidth =
    canvas.width *
    scale;

  const imageHeight =
    canvas.height *
    scale;

  /*
   * Căn giữa trang A4.
   */
  const imageX =
    (
      pageWidth -
      imageWidth
    ) / 2;

  const imageY =
    (
      pageHeight -
      imageHeight
    ) / 2;

  const imageData =
    canvas.toDataURL(
      'image/jpeg',
      0.98
    );

  pdf.addImage(
    imageData,
    'JPEG',
    imageX,
    imageY,
    imageWidth,
    imageHeight,
    undefined,
    'FAST'
  );

  pdf.save(
    `${fileName}.pdf`
  );
}


/* =========================================================
   TẢI THƯ VIỆN
========================================================= */

async function ensureAdminPdfLibraries() {
  await loadAdminExternalScript({
    id:
      'admin-html2canvas-library',

    src:
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',

    isReady:
      () =>
        typeof window
          .html2canvas ===
        'function',
  });

  await loadAdminExternalScript({
    id:
      'admin-jspdf-library',

    src:
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',

    isReady:
      () =>
        Boolean(
          window.jspdf
            ?.jsPDF
        ),
  });
}


function loadAdminExternalScript({
  id,
  src,
  isReady,
}) {
  if (isReady()) {
    return Promise.resolve();
  }

  return new Promise(
    (
      resolve,
      reject
    ) => {
      const existingScript =
        document.querySelector(
          `#${id}`
        );

      if (existingScript) {
        const checkReady =
          () => {
            if (isReady()) {
              resolve();
            } else {
              reject(
                new Error(
                  `Thư viện ${id} tải chưa hoàn tất.`
                )
              );
            }
          };

        existingScript
          .addEventListener(
            'load',
            checkReady,
            {
              once: true,
            }
          );

        existingScript
          .addEventListener(
            'error',
            () => {
              reject(
                new Error(
                  `Không tải được thư viện ${id}.`
                )
              );
            },
            {
              once: true,
            }
          );

        /*
         * Script có thể đã tải trước khi
         * listener được gắn.
         */
        window.setTimeout(
          () => {
            if (isReady()) {
              resolve();
            }
          },
          100
        );

        return;
      }

      const script =
        document.createElement(
          'script'
        );

      script.id = id;

      script.src = src;

      script.async = true;

      script.crossOrigin =
        'anonymous';

      script.addEventListener(
        'load',
        () => {
          if (isReady()) {
            resolve();

            return;
          }

          reject(
            new Error(
              `Thư viện ${id} không khởi tạo đúng.`
            )
          );
        },
        {
          once: true,
        }
      );

      script.addEventListener(
        'error',
        () => {
          reject(
            new Error(
              `Không tải được thư viện ${id}.`
            )
          );
        },
        {
          once: true,
        }
      );

      document.head.appendChild(
        script
      );
    }
  );
}


/* =========================================================
   CHUẨN BỊ BẢN SAO
========================================================= */

function prepareAdminPrintClone(
  clonedDocument
) {
  clonedDocument.classList.add(
    'admin-print-document-export'
  );

  clonedDocument
    .querySelectorAll(
      '.no-print, button'
    )
    .forEach(
      (element) => {
        element.remove();
      }
    );

  /*
   * Dùng kích thước pixel cố định tương ứng A4
   * ở mật độ 96 DPI:
   *
   * 210 mm ≈ 794 px
   * 297 mm ≈ 1123 px
   */
  clonedDocument.style.width =
    '794px';

  clonedDocument.style.minHeight =
    '1123px';

  clonedDocument.style.height =
    'auto';

  clonedDocument.style.margin =
    '0';

  clonedDocument.style.padding =
    '34px 42px';

  clonedDocument.style.boxShadow =
    'none';

  clonedDocument.style.transform =
    'none';

  clonedDocument.style.position =
    'relative';

  clonedDocument.style.left =
    '0';

  clonedDocument.style.top =
    '0';

  clonedDocument.style.overflow =
    'visible';

  clonedDocument.style.background =
    '#ffffff';
}


/* =========================================================
   CHỜ HÌNH ẢNH
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
            let completed =
              false;

            const finish =
              () => {
                if (completed) {
                  return;
                }

                completed =
                  true;

                resolve();
              };

            image.addEventListener(
              'load',
              finish,
              {
                once: true,
              }
            );

            image.addEventListener(
              'error',
              finish,
              {
                once: true,
              }
            );

            window.setTimeout(
              finish,
              5000
            );
          }
        );
      }
    )
  );
}


/* =========================================================
   CHỜ TRÌNH DUYỆT DÀN TRANG
========================================================= */

function waitForAdminPdfLayout() {
  return new Promise(
    (resolve) => {
      window.requestAnimationFrame(
        () => {
          window.requestAnimationFrame(
            () => {
              window.setTimeout(
                resolve,
                100
              );
            }
          );
        }
      );
    }
  );
}


/* =========================================================
   TẠO TÊN FILE PDF
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
            ?.textContent
        ).toLowerCase();

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
  const documentTitle =
    normalizeAdminPrintText(
      document.querySelector(
        '.admin-print-title h1'
      )?.textContent
    ).toLowerCase();

  if (
    documentTitle.includes(
      'cuối khóa'
    )
  ) {
    return 'cuối khóa';
  }

  const subtitle =
    normalizeAdminPrintText(
      document.querySelector(
        '.admin-print-title p'
      )?.textContent
    );

  if (subtitle) {
    return subtitle;
  }

  return 'bài kiểm tra';
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
    /*
     * Loại bỏ ký tự cấm trong tên file Windows.
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
      /\s*-\s*/g,
      ' - '
    )
    .trim()
    .slice(
      0,
      180
    );
}
