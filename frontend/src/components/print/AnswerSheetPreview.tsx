interface AnswerSheetPreviewProps {
  schoolName?: string;
  examTitle?: string;
  examDate?: string;
}

function SbdNumberGrid({ cols = 6 }: { cols?: number }) {
  return (
    <div style={{ display: "flex", gap: 0, justifyContent: "center" }}>
      {Array.from({ length: cols }, (_, col) => (
        <div
          key={col}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderLeft: "1px solid #c00",
            borderRight: "1px solid #c00",
          }}
        >
          {Array.from({ length: 10 }, (_, row) => (
            <div
              key={row}
              style={{
                width: 16,
                height: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderBottom: "1px solid #c00",
              }}
            >
              <span
                style={{
                  width: 13,
                  height: 13,
                  border: "1.5px solid #c00",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  color: "#c00",
                  fontWeight: "bold",
                }}
              >
                {row}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function QuestionBubble({ num }: { num: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 1 }}>
      <span style={{ width: 18, textAlign: "right", fontSize: 9, fontWeight: "bold" }}>{num}</span>
      {["A", "B", "C", "D"].map((letter) => (
        <span
          key={letter}
          style={{
            width: 14,
            height: 14,
            border: "1.5px solid #c00",
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 7,
            fontWeight: "bold",
            color: "#c00",
            marginLeft: 3,
          }}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}

function QuestionBlock({ start, count = 5 }: { start: number; count?: number }) {
  return (
    <div
      style={{
        border: "1px solid #fcc",
        padding: "2px 4px",
        marginBottom: 4,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <QuestionBubble key={i} num={start + i} />
      ))}
    </div>
  );
}

export default function AnswerSheetPreview({
  schoolName,
  examTitle,
  examDate,
}: AnswerSheetPreviewProps) {
  return (
    <div style={{ fontFamily: "Times New Roman, serif", fontSize: 11, color: "#000", lineHeight: 1.4 }}>
      {/* ===== PAGE 1 ===== */}
      <div style={{ position: "relative", padding: "6mm 8mm 6mm 6mm" }}>
        {/* Timing marks - RIGHT side */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 10,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingTop: 40,
            paddingBottom: 20,
          }}
        >
          {Array.from({ length: 15 }, (_, i) => (
            <div key={i} style={{ width: 8, height: 5, background: "#000" }} />
          ))}
        </div>

        {/* Timing marks - BOTTOM */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 12,
            height: 8,
            display: "flex",
            justifyContent: "space-between",
            padding: "0 10px",
          }}
        >
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{ width: 5, height: 6, background: "#000" }} />
          ))}
        </div>

        {/* ===== TITLE ===== */}
        <div style={{ textAlign: "center", marginBottom: 2 }}>
          <div style={{ fontSize: 17, fontWeight: "bold", letterSpacing: 0.5 }}>
            PHIẾU TRẢ LỜI TRẮC NGHIỆM
          </div>
        </div>

        {/* ===== EXAM INFO LINE ===== */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 6 }}>
          <span>
            <strong>Kỳ thi:</strong> {schoolName || "..................................................................................................."}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 6 }}>
          <span style={{ flex: 1 }}>
            <strong>Bài thi:</strong> {examTitle || "..................................................................................................."}
          </span>
          <span style={{ marginLeft: 20 }}>
            <strong>Ngày thi:</strong> {examDate || "......../......../ 20........"}
          </span>
        </div>

        {/* ===== MAIN CONTENT ===== */}
        <div style={{ display: "flex", gap: 6 }}>
          {/* LEFT: Signature boxes + Info fields */}
          <div style={{ flex: 1 }}>
            {/* Signature boxes */}
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              <div
                style={{
                  flex: 1,
                  border: "1px solid #c00",
                  padding: "6px 4px",
                  fontSize: 9,
                  textAlign: "center",
                  minHeight: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1.3,
                }}
              >
                Họ tên, chữ ký<br />của cán bộ coi thi 1
              </div>
              <div
                style={{
                  flex: 1,
                  border: "1px solid #c00",
                  padding: "6px 4px",
                  fontSize: 9,
                  textAlign: "center",
                  minHeight: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1.3,
                }}
              >
                Họ tên, chữ ký<br />của cán bộ coi thi 2
              </div>
            </div>

            {/* Info fields 1-6 */}
            <div style={{ fontSize: 10, lineHeight: 2 }}>
              <div>1. Hội đồng thi:...................................................................................................</div>
              <div>2. Điểm thi:...................................................................................................</div>
              <div>3. Phòng thi số:...................................................................................................</div>
              <div>4. Họ và tên thí sinh:...................................................................................................</div>
              <div>
                5. Ngày sinh: ........../........../.................. (Nam/ Nữ).
              </div>
              <div>6. Chữ ký của thí sinh:...................................................................................................</div>
            </div>
          </div>

          {/* RIGHT: SBD + Code grids */}
          <div style={{ minWidth: 160 }}>
            <div style={{ display: "flex", gap: 10 }}>
              {/* SBD */}
              <div>
                <div style={{ fontSize: 9, fontWeight: "bold", marginBottom: 3, textAlign: "center" }}>
                  7. Số báo danh
                </div>
                {/* 6 empty boxes */}
                <div style={{ display: "flex", gap: 1, justifyContent: "center", marginBottom: 3 }}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} style={{ width: 16, height: 18, border: "1px solid #c00" }} />
                  ))}
                </div>
                <SbdNumberGrid cols={6} />
              </div>
              {/* Exam Code */}
              <div>
                <div style={{ fontSize: 9, fontWeight: "bold", marginBottom: 3, textAlign: "center" }}>
                  8. Mã đề thi
                </div>
                {/* 3 empty boxes */}
                <div style={{ display: "flex", gap: 1, justifyContent: "center", marginBottom: 3 }}>
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} style={{ width: 16, height: 18, border: "1px solid #c00" }} />
                  ))}
                </div>
                <SbdNumberGrid cols={3} />
              </div>
            </div>
          </div>
        </div>

        {/* ===== NOTE ===== */}
        <div
          style={{
            textAlign: "center",
            fontSize: 9,
            fontWeight: "bold",
            fontStyle: "italic",
            marginTop: 6,
            padding: "3px",
            border: "1px solid #c00",
          }}
        >
          Chú ý: Thí sinh cần đọc kỹ hướng dẫn ở mặt sau Phiếu này.
        </div>

        {/* ===== QUESTIONS GRID ===== */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 4,
            marginTop: 8,
          }}
        >
          {/* Column 1: 1-30 */}
          <div>
            {[1, 6, 11, 16, 21, 26].map((start) => (
              <QuestionBlock key={start} start={start} count={5} />
            ))}
          </div>
          {/* Column 2: 31-60 */}
          <div>
            {[31, 36, 41, 46, 51, 56].map((start) => (
              <QuestionBlock key={start} start={start} count={5} />
            ))}
          </div>
          {/* Column 3: 61-90 */}
          <div>
            {[61, 66, 71, 76, 81, 86].map((start) => (
              <QuestionBlock key={start} start={start} count={5} />
            ))}
          </div>
          {/* Column 4: 91-120 */}
          <div>
            {[91, 96, 101, 106, 111, 116].map((start) => (
              <QuestionBlock key={start} start={start} count={5} />
            ))}
          </div>
        </div>
      </div>

      {/* ===== PAGE 2: INSTRUCTIONS ===== */}
      <div style={{ padding: "10mm 15mm", pageBreakBefore: "always" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: "bold", letterSpacing: 0.5 }}>
            HƯỚNG DẪN SỬ DỤNG PHIẾU TRẢ LỜI TRẮC NGHIỆM
          </div>
        </div>

        <div style={{ fontSize: 12, lineHeight: 2.2 }}>
          <div style={{ marginBottom: 10 }}>
            1) Thí sinh cần giữ Phiếu cho phẳng, không bôi bẩn, không làm nhàu, rách nát;
          </div>
          <div style={{ marginBottom: 10 }}>
            2) Ghi đầy đủ, rõ ràng các mục từ mục 1 đến mục 8;
          </div>
          <div style={{ marginBottom: 10 }}>
            3) Số báo danh ghi tại mục 7 là 6 chữ số cuối;
          </div>
          <div style={{ marginBottom: 10 }}>
            4) Tại mục 7 và 8, ngoài việc ghi chữ số vào ô trống, thí sinh nhất thiết phải tô kín các ô
            tròn trong bảng số phía dưới tương ứng với chữ số đã ghi;
          </div>
          <div style={{ marginBottom: 10 }}>
            5) Phần trả lời: Số thứ tự các phương án trả lời (A, B, C, D) là tương ứng với thứ tự câu
            hỏi trắc nghiệm trong đề thi. Đối với mỗi câu trắc nghiệm, thí sinh chọn và tô kín
            một ô tròn tương ứng với một phương án trả lời mà thí sinh cho là đúng;
          </div>
          <div style={{ marginBottom: 10 }}>
            6) Thí sinh không được tô vào phương án có số thứ tự không tương ứng với câu hỏi
            trắc nghiệm trong đề thi.
          </div>
        </div>
      </div>
    </div>
  );
}
