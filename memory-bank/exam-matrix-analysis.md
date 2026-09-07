# Phân tích Ma trận Đề thi ĐGNL ĐHQG-HCM

> Tài liệu này lưu trữ phân tích chi tiết về cấu trúc "khung xương" của đề thi ĐGNL ĐHQG-HCM dựa trên đề mẫu chính thức và 2 đề phục dựng. Đây là bản thiết kế (blueprint) quan trọng dùng làm cơ sở cho engine sinh đề tự động.

**Ghi chú về nguồn và độ tin cậy:** *đề mẫu* là bản gốc chính thức do ĐHQG công bố (nguồn đáng tin nhất); còn hai "đề phục dựng" (đợt 1, đợt 2) là sản phẩm của một trung tâm luyện thi (BaiLearn) dựng lại dựa trên trí nhớ của thí sinh sau khi thi — nội dung câu hỏi có thể tương đối sát, nhưng thứ tự/cấu trúc chi tiết có thể lệch so với bản gốc thật do người phục dựng không nắm chính xác ma trận, chỉ nhớ đại khái dạng bài. Vì vậy, kết luận rút ra từ riêng các đề phục dựng (đặc biệt về thứ tự chi tiết trong phần Toán) có độ tin cậy thấp hơn kết luận rút ra từ đề mẫu chính thức. Ngược lại, những quy luật mà **cả ba nguồn (kể cả hai bản phục dựng độc lập với nhau) đều đồng nhất** thì độ tin cậy rất cao — vì người phục dựng dù không nhớ chính xác từng câu chữ vẫn tự nhiên tái hiện đúng cấu trúc, cho thấy đó là đặc trưng cấu trúc thực sự chứ không phải trùng hợp ngẫu nhiên.

## I. Tổng quan cấu trúc "khung xương" của đề thi

Nhìn tổng thể 120 câu, đề thi ĐGNL ĐHQG-HCM không phải là tập hợp câu hỏi ngẫu nhiên phủ chương trình, mà được xây trên một bộ khung cố định gồm các "khối câu" (block) có kích thước xác định trước — 1 câu đơn lẻ, 2 câu chung dữ kiện, 3 câu chung dữ kiện, 5 câu chung dữ kiện (đọc hiểu), 7-8 câu chung dữ kiện (đọc hiểu tiếng Anh). Việc ra đề, do đó, gần giống việc lắp ráp các module có sẵn theo một bản thiết kế (blueprint) chứ không phải soạn tự do. Đây là lý do vì sao khi so hai đề (đề mẫu 2026 và đề phục dựng đợt 2/2026) cách nhau về nội dung hoàn toàn nhưng số lượng câu, độ dài từng khối, và vị trí khối trong đề lại trùng khớp gần như tuyệt đối.

## II. Phân tích chi tiết Phần 1 — Sử dụng ngôn ngữ

### 1.1 Tiếng Việt (câu 1-30)

Khối này chia làm 3 tầng rõ rệt:

**Tầng 1 (câu 1-12): Đọc hiểu trích đoạn văn học có yêu cầu kiến thức thể loại.** Đây là điểm đặc trưng nhất khiến phần Tiếng Việt của ĐGNL khác hẳn đề thi THPT thông thường — không chỉ hỏi "nội dung đoạn văn nói gì" mà đòi hỏi thí sinh phải có nền tảng lý luận văn học: phân biệt loại nhân vật trong chèo/tuồng (đào lẳng, đào thương, kép, lão), nhận diện mô-típ văn học dân gian, phân tích thi pháp (luật bằng/trắc, cách gieo vần, phép đối trong thơ Đường luật), nhận diện phong cách tác giả qua so sánh dịch nghĩa - dịch thơ (như bài "Tình thiên" của Hồ Chí Minh trong đề mẫu), và phân biệt các thuật ngữ chuyên môn dễ gây nhầm (ngôi kể/điểm nhìn, tự truyện/tự thuật, hư cấu/phi hư cấu). Đây là khối có **hàm lượng kiến thức Ngữ văn chuyên sâu cao nhất** trong toàn bộ đề, không thể "đọc lướt suy luận" mà bắt buộc phải có vốn kiến thức nền.

**Tầng 2 (câu 13-20): Thực hành tiếng — chính tả, ngữ pháp, từ vựng, phong cách ngôn ngữ.** Đây là khối "gỡ điểm" xen vào giữa hai khối đọc hiểu nặng, có độ khó thấp hơn hẳn, chủ yếu kiểm tra kỹ năng ngôn ngữ thực hành: phát hiện lỗi chính tả (dùng "s/x", "tr/ch"), lỗi ngữ pháp (thiếu chủ ngữ/vị ngữ, sai trật tự thành phần trạng ngữ), nghĩa của thành ngữ/quán ngữ ("vô hình trung"), và phân biệt phong cách ngôn ngữ (sinh hoạt/hành chính/khoa học).

**Tầng 3 (câu 21-30): Hai cụm đọc hiểu văn bản thông tin/nghị luận, mỗi cụm 5 câu.** Đây là nơi độ khó tăng dần rõ rệt nhất trong toàn phần Tiếng Việt. Cấu trúc câu hỏi trong mỗi cụm 5 câu luôn đi theo trình tự cố định:
- Câu đầu cụm: hỏi về **cách tổ chức thông tin** (trình tự thời gian/không gian/nhân quả/liệt kê) — đây là câu "kỹ thuật văn bản", đòi hỏi thí sinh nhận diện cấu trúc đoạn chứ không cần hiểu sâu nội dung.
- 2 câu giữa: hỏi về **vai trò của một chi tiết cụ thể** đối với việc thể hiện nội dung/chủ đề, và **thái độ/quan điểm của tác giả** thể hiện qua một đoạn nhất định. Đây là dạng câu dễ bị nhiễu vì các phương án thường rất gần nghĩa nhau (ví dụ: "khách quan" và "tiếc nuối" đều có thể đúng một phần).
- Câu áp cuối: hỏi về **chủ đề chính/nhận định phù hợp nhất về toàn văn bản** — đây là câu tổng hợp, đòi hỏi loại trừ các phương án chỉ đúng một phần (quá hẹp) hoặc sai lệch trọng tâm.
- Câu cuối cụm: hỏi về **tác động/ý nghĩa mà văn bản mang lại cho người đọc**, hoặc **luận điểm/quan điểm bao quát của tác giả**. Đây thường là câu khó nhất trong cụm vì đòi hỏi suy luận vượt ra ngoài câu chữ trực tiếp, tổng hợp cả văn bản.

### 1.2 Tiếng Anh (câu 31-60)

Cấu trúc ở đây đơn giản và "cơ khí" hơn Tiếng Việt rất nhiều, thể hiện rõ việc đây là phần kiểm tra kỹ năng ngữ pháp - từ vựng - đọc hiểu theo khuôn mẫu chuẩn hóa quốc tế (dạng gần với cấu trúc đề TOEIC/đề thi năng lực Anh ngữ phổ thông):

- **31-35 (5 câu điền từ):** Luôn kiểm tra 5 điểm ngữ pháp/từ vựng khác nhau không trùng lặp — thường gồm: cụm động từ (phrasal verb), cấu trúc so sánh, thì động từ kết hợp dấu hiệu thời gian, cấu trúc lượng từ (much/many/all of), và từ loại (tính từ/danh từ/trạng từ) đặt đúng vị trí ngữ pháp.
- **36-40 (5 câu tìm lỗi sai):** Đây là khối kiểm tra "lỗi ẩn" — điểm đặc trưng là lỗi luôn nằm ở chi tiết rất nhỏ mà nếu đọc lướt sẽ bỏ qua: mạo từ (a/an/the) khi vật đã được nhắc đến trước đó, đại từ quan hệ dùng sai (who/which cho danh từ chỉ vật), sự hòa hợp chủ ngữ - động từ khi chủ ngữ là danh từ tập hợp, đại từ nhân xưng không khớp ngôi với chủ ngữ đã nêu, sở hữu cách dư thừa khi động từ đã mang nghĩa sở hữu.
- **41-45 (5 câu viết lại câu/paraphrase):** Đòi hỏi thuộc nằm lòng các mẫu chuyển đổi cấu trúc (câu điều kiện dùng "unless", câu tường thuật, so sánh nhất, câu bị động ngầm ẩn ý nhân quả). Đây là khối có bẫy tinh vi nhất vì các phương án sai thường chỉ lệch nhau ở mức độ chắc chắn (modal verbs) hoặc chiều hướng nhân quả bị đảo ngược.
- **46-52 (bài đọc ngắn, 7 câu)** và **53-60 (bài đọc dài hơn, 8 câu):** Cả hai bài đọc đều theo motif câu hỏi giống nhau: chủ đề chính bài đọc, đại từ thay thế (từ "it/those" quy chiếu về gì), từ đồng nghĩa trong ngữ cảnh, chi tiết KHÔNG được đề cập (dạng phủ định — thường là câu khó nhất vì cần đối chiếu toàn đoạn), suy luận ngầm (inference), và mục đích tác giả khi đưa một dẫn chứng cụ thể vào bài. Bài đọc dài hơn (53-60) luôn có thêm 1-2 câu tổng hợp toàn bài (chọn tiêu đề, hoặc tóm tắt trình tự các đoạn) mà bài ngắn không có.

## III. Phân tích sâu Phần 2 — Toán học

Đây là phần có cấu trúc "công thức hóa" rõ nhất, dễ bóc tách quy luật nhất trong toàn đề.

### Khối 12 câu đơn lẻ mở đầu (61-72) — 6 cặp, mỗi cặp 2 câu cùng nhóm kiến thức

Việc nhóm theo cặp 2 câu (chứ không phải 1 câu rời rạc mỗi chủ đề) cho phép đề thi vừa phủ rộng chương trình (12 câu = 6 mảng kiến thức khác nhau) vừa đủ sâu để phân hóa trong từng mảng (2 câu liên tiếp cùng chủ đề thường có độ khó tăng dần — câu đầu là dạng cơ bản/nhận biết công thức, câu sau đòi hỏi biến đổi thêm 1-2 bước hoặc đặt trong tình huống ứng dụng thực tế).

6 mảng kiến thức xuất hiện trong khối này (thứ tự có thể xê dịch nhẹ giữa các đề nhưng luôn đủ 6 mảng):
1. Đại số cơ bản (giải phương trình/bất phương trình, thường liên quan hình chữ nhật-hình vuông hoặc điều kiện có nghiệm/vô nghiệm chứa căn)
2. Mũ - Logarit ứng dụng thực tế (lãi suất kép, dân số tăng trưởng, phóng xạ)
3. Lý thuyết đồ thị (graph theory) — đây là mảng kiến thức "lạ" nhất so với chương trình phổ thông truyền thống, bao gồm bài toán đếm số cạnh trong đồ thị vô hướng và bài toán tìm cây khung nhỏ nhất (minimum spanning tree) hoặc đường đi ngắn nhất kiểu Dijkstra đơn giản hóa. Đây thực chất là kiến thức Toán rời rạc/Tin học ứng dụng được lồng vào đề, đòi hỏi tư duy thuật toán (luôn chọn cạnh có trọng số nhỏ nhất, tránh tạo chu trình) hơn là công thức có sẵn.
4. Lượng giác (giải phương trình lượng giác) ghép chung với Định lý sin - cos - Heron trong tam giác — đây là ví dụ điển hình của "gộp nhóm kiến thức liên quan" mà nhóm chat đã chỉ ra: về bản chất lượng giác và hệ thức lượng tam giác là hai chủ đề khác nhau trong chương trình, nhưng vì cùng dùng công cụ sin/cos nên bị xếp chung một khối.
5. Giới hạn - Đạo hàm - Tính liên tục của hàm số (đây là nhóm nền tảng của Giải tích, thường xuất hiện dạng: tính liên tục tại một điểm với tham số, rồi đến bất phương trình chứa đạo hàm cấp 2 hoặc đạo hàm ẩn dạng x·f'(x) - f(x))
6. Nguyên hàm - Tích phân (tính giá trị tích phân từ một đẳng thức cho trước, rồi ứng dụng tích phân tính diện tích hình phẳng)

Điều đáng chú ý: nhóm 3 (lý thuyết đồ thị) không tồn tại trong chương trình Toán phổ thông truyền thống của Việt Nam theo cách được dạy chính khóa, nhưng lại xuất hiện đều đặn ở cả hai đề khảo sát — điều này cho thấy ĐHQG chủ động đưa dạng bài "tư duy logic - toán rời rạc" vào để phân hóa thí sinh có tư duy thuật toán tốt, tách biệt với nhóm chỉ giỏi áp công thức có sẵn.

### Khối 18 câu còn lại (73-90) — 3 nhóm 2-câu + 4 nhóm 3-câu

Ở khối này, độ dài "2 câu" hay "3 câu" cho mỗi chủ đề gắn liền với độ phức tạp tự nhiên của chủ đề đó khi đặt trong 1 bối cảnh (ngữ cảnh) chung:

- Các chủ đề chỉ cần **2 câu** để khai thác trọn vẹn một tình huống: quy hoạch tuyến tính (thiết lập hệ bất phương trình ràng buộc → tìm giá trị tối ưu của hàm mục tiêu), dãy số (tìm công sai/công bội → tính giới hạn liên quan), hình học tọa độ Oxyz cơ bản (khoảng cách/góc → viết phương trình mặt phẳng). Đặc điểm chung: những chủ đề này có một quy trình giải "tuyến tính" 2 bước rõ ràng, không có nhiều nhánh khai thác thêm.

- Các chủ đề cần **3 câu** vì bản thân bối cảnh cho phép khai thác đa chiều hơn: khảo sát hàm số bậc 3 (tìm khoảng đơn điệu → tính khoảng cách 2 điểm cực trị → bài toán tương giao đồ thị với đường thẳng có điều kiện trung điểm — đây là 3 tầng khai thác độc lập từ cùng một hàm số gốc), xác suất có điều kiện (xác suất từ 1 hộp → xác suất tổng hợp nhiều hộp → xác suất ngược/Bayes — đúng chuẩn 3 cấp độ của lý thuyết xác suất phổ thông: xác suất đơn giản, xác suất toàn phần, công thức Bayes), hình học phẳng Oxy (tọa độ điểm đặc biệt như trọng tâm/trung điểm → phương trình đường thẳng/hình chiếu → tích vô hướng vectơ ứng dụng), và hình học không gian - hình chóp (luôn là nhóm chốt cuối cùng, đòi hỏi tổng hợp thể tích, góc giữa đường-mặt, và khoảng cách từ điểm đến mặt phẳng trong cùng một khối chóp).

Điểm bất biến quan trọng nhất mà quan sát thực tế xác nhận: **nhóm xác suất luôn nằm ở vị trí thứ 2 trong 4 nhóm 3-câu, và nhóm hình chóp luôn là nhóm cuối cùng đóng vai trò "câu chốt" của cả phần Toán.** Việc hình chóp luôn đứng cuối có logic sư phạm rõ ràng: đây là chủ đề đòi hỏi tưởng tượng không gian 3D, kỹ năng dựng hình phụ, và tổng hợp nhiều công cụ (vector, lượng giác, thể tích) — phù hợp để làm câu phân hóa cao nhất, dành cho thí sinh đã hoàn thành tốt toàn bộ phần trước và còn đủ thời gian.

## IV. Phân tích sâu Phần 3 — Tư duy khoa học

### 3.1 Logic - Phân tích số liệu (câu 91-102): 4 nhóm × 3 câu

Cấu trúc chia đúng 2 nửa với bản chất tư duy hoàn toàn khác nhau:

**Nửa đầu (2 nhóm suy luận logic thuần túy - dạng "logic games"):** Đây là dạng bài xếp lịch/xếp nhóm/xếp thứ tự dựa trên các ràng buộc điều kiện (nếu... thì..., không đồng thời, bắt buộc phải...). Trong mỗi nhóm 3 câu, luôn có motif: câu 1 hỏi trực tiếp "trường hợp nào sau đây thỏa mãn tất cả điều kiện" (chỉ cần thử từng phương án loại trừ, không cần suy luận sâu); câu 2 và 3 thêm một giả định mới ("nếu X xảy ra thì...") buộc thí sinh phải dựng lại toàn bộ sơ đồ ràng buộc từ đầu — đây là dạng câu tốn thời gian nhất trong cả đề vì không có công thức tắt, chỉ có thể giải bằng cách liệt kê/loại trừ có hệ thống.

**Nửa sau (2 nhóm đọc hiểu số liệu - biểu đồ/bảng):** Khác hẳn về bản chất tư duy, đây là dạng bài kiểm tra kỹ năng đọc và tính toán trên dữ liệu thực (biểu đồ tròn thể hiện thị phần, bảng tần số phân bố). Motif 3 câu trong mỗi nhóm: câu 1 đọc số liệu trực tiếp từ biểu đồ/bảng (không cần tính toán phức tạp); câu 2 đòi hỏi một phép tính trung gian (tính phần trăm tăng trưởng, tính giá trị tuyệt đối từ tỉ lệ phần trăm và tổng số biết trước); câu 3 thường là câu có "bẫy khái niệm" được cài đặt có chủ đích — ví dụ điển hình là nhầm lẫn giữa "chênh lệch phần trăm" (hiệu số tuyệt đối tính theo điểm phần trăm) với "tỉ lệ tăng/giảm tương đối" (chia cho giá trị gốc). Đây là loại bẫy lặp đi lặp lại có hệ thống ở cả hai đề khảo sát, cho thấy đây là một "trap kinh điển" được ĐHQG cố ý đưa vào để phân hóa thí sinh hiểu bản chất thống kê với thí sinh chỉ làm phép trừ đơn thuần.

### 3.2 Suy luận khoa học (câu 103-120): 6 nhóm × 3 câu

Đây là phần có tính "liên ngành" rõ nhất, và khác với phần Toán (nơi thứ tự các mảng kiến thức có thể hoán đổi), thứ tự 6 lĩnh vực ở đây gần như cố định: **Hóa học → Vật lý → Sinh học → Khoa học xã hội (thường là thống kê dân số/xã hội học) → Lịch sử → Kinh tế/Tình huống ứng dụng thực tế.**

Trình tự này phản ánh một logic phân loại kiểu "từ khoa học tự nhiên chính xác nhất đến khoa học xã hội có tính diễn giải cao hơn": Hóa và Vật lý là hai môn có công thức định lượng chặt chẽ nhất (tính toán từ dữ kiện cho sẵn theo công thức khoa học chuẩn — ví dụ áp suất hơi bão hòa, năng lượng photon), Sinh học vẫn định lượng nhưng thêm yếu tố thực nghiệm/quan sát (đọc bảng kết quả thí nghiệm, suy luận về biến số kiểm soát), rồi chuyển sang Khoa học xã hội với dữ liệu thống kê thực tế (đọc số liệu dân số, suy luận nguyên nhân xã hội), Lịch sử là môn thuần đọc hiểu - ghi nhớ - suy luận ngữ cảnh (không có tính toán), và cuối cùng là Kinh tế/Tình huống mô phỏng đời sống doanh nghiệp (vừa có khái niệm lý thuyết vừa có tình huống ứng dụng thực tế gần gũi).

Trong mỗi nhóm 3 câu, motif độ khó cũng lặp lại tương tự phần Toán: câu 1 kiểm tra khả năng đọc hiểu/nhận diện khái niệm ngay trong đoạn dẫn (không cần suy luận thêm nhiều, chỉ cần đọc kỹ), câu 2 yêu cầu áp dụng một công thức/quy luật đơn giản đã nêu trong đoạn dẫn vào một tình huống cụ thể, câu 3 là câu nặng nhất — hoặc đòi hỏi tính toán nhiều bước liên tiếp (như bài glucose/urea về áp suất hơi bão hòa, phải tính ngược từ áp suất mong muốn ra khối lượng chất tan cần thêm), hoặc đòi hỏi tổng hợp - đối chiếu nhiều nhận định đúng/sai cùng lúc (dạng câu liệt kê 3-4 phát biểu I, II, III, IV và hỏi "các phát biểu đúng là").

## V. Nhận xét tổng hợp về triết lý thiết kế đề

Nhìn xuyên suốt cả 3 phần, có thể rút ra một triết lý thiết kế nhất quán: **ĐHQG không thiết kế đề theo logic "phủ chương trình" (covering the syllabus) một cách dàn trải, mà theo logic "đóng gói theo cụm năng lực" (competency clustering).** Mỗi cụm câu hỏi (2, 3, 5, 7, hay 8 câu) được xây trên một bối cảnh/ngữ liệu duy nhất, và số lượng câu hỏi khai thác từ bối cảnh đó tỉ lệ thuận với độ "giàu thông tin" tự nhiên của bối cảnh — một hàm số bậc 3 có đủ chất liệu cho 3 câu hỏi độc lập (đơn điệu, cực trị, tương giao), trong khi một hệ bất phương trình quy hoạch tuyến tính chỉ tự nhiên sinh ra 2 câu (thiết lập ràng buộc, rồi tối ưu hóa).

Đây cũng chính là lý do giải thích hiện tượng "đề mẫu không có câu tiệm cận nhưng đề thi thật có" mà nhóm chat phát hiện: tiệm cận đồ thị hàm số, về mặt bản chất kiến thức, thuộc cùng một cụm với đạo hàm - giới hạn - tính liên tục (đều xoay quanh hành vi của hàm số khi biến số tiến đến một giá trị/vô cực). Khi người ra đề chọn khai thác cụm này theo hướng "liên tục + bất phương trình đạo hàm" thì tiệm cận không xuất hiện; khi chọn khai thác theo hướng khác trong cùng cụm kiến thức (như "giới hạn + tiệm cận đồ thị") thì câu tiệm cận sẽ xuất hiện thay cho câu khác. Nói cách khác, sự "có/không có" của một dạng câu cụ thể giữa các đề không phải ngẫu nhiên hoàn toàn, mà là do có nhiều "biến thể nội dung" khả dĩ trong cùng một ô (slot) của ma trận, và mỗi lần ra đề chỉ chọn 1 biến thể để lấp vào ô đó.

## VI. Đối chiếu khối 12 câu Toán đầu (61-72) 

Đề mẫu chính thức có cấu trúc rất "sạch" — đúng 6 cặp 2-câu liên tiếp, mỗi cặp một mảng kiến thức riêng biệt:

| Cặp | Đề mẫu chính thức |
|---|---|
| 61-62 | Đại số (hình chữ nhật-vuông; PT vô nghiệm tham số) |
| 63-64 | Mũ-log (lãi suất; tính biểu thức log) |
| 65-66 | Đồ thị (đếm cạnh; chi phí tối thiểu kiểu cây khung nhỏ nhất) |
| 67-68 | Lượng giác + hệ thức lượng tam giác |
| 69-70 | Liên tục + BPT đạo hàm |
| 71-72 | Tích phân (tính giá trị; diện tích hình phẳng) |

Tuy nhiên, khi soi vào **đề phục dựng đợt 1**, cấu trúc lại lỏng lẻo hơn hẳn:

| Câu | Đề phục dựng đợt 1 |
|---|---|
| 61 | BPT phân thức (đại số) |
| 62 | BPT trị tuyệt đối (đại số) |
| 63 | Log 2 biến (mũ-log) |
| 64 | BPT log tham số, đếm nghiệm nguyên (mũ-log) |
| 65 | Đếm số liên kết trong phân tử — thực chất là bài toán **tổng bậc đỉnh trong đồ thị** (mỗi liên kết hóa học tương đương một cạnh, số liên kết của nguyên tử tương đương bậc đỉnh) đội lốt ngữ cảnh Hóa học |
| 66 | Tam giác 3 cạnh — tính đường cao (dùng Heron) |
| 67 | Tam giác — hệ thức lượng giác tan/sin |
| 68 | Tiệm cận đồ thị hàm phân thức |
| 69 | Giới hạn ở vô cực (căn thức, ứng dụng "lợi nhuận công ty") |
| 70 | Tích phân tìm tham số m |
| 71 | Diện tích hình phẳng (tích phân ứng dụng) |
| 72 | Đếm số cách đi trên một hình vẽ (đồ thị/tổ hợp) |

Ở đây, cặp "đại số" (61-62) và "mũ-log" (63-64) vẫn giữ nguyên vị trí và độ dài y hệt đề mẫu — hai mảng này có vẻ rất ổn định. Nhưng nhóm "đồ thị/đếm rời rạc" lại **bị tách làm hai, không liền kề nhau**: câu 65 (đếm liên kết) và câu 72 (đếm đường đi) — về bản chất tư duy đều là bài toán đếm trên cấu trúc rời rạc, nhưng bị đặt cách nhau tận 7 câu. Tương tự, "tam giác — Heron và lượng giác" bị dồn thành 66-67 (thay vì 67-68 như đề mẫu), và tiệm cận (câu 68) đứng tách riêng một mình thay vì ghép cặp với một chủ đề Giải tích khác.

**Cách đọc hợp lý nhất cho sự khác biệt này:** hoặc (a) bản phục dựng của trung tâm luyện thi đã sắp lại thứ tự theo trí nhớ chủ quan chứ không phản ánh đúng thứ tự gốc, hoặc (b) quy luật "ghép cặp liền kề" chỉ là hiện tượng thường thấy chứ không phải luật cứng — ĐHQG hoàn toàn có thể rải một mảng kiến thức (như đồ thị/đếm) thành nhiều vị trí không liên tục trong cùng khối 12 câu, miễn tổng thể vẫn phủ đủ 6 mảng kiến thức lớn. Khuynh hướng nghiêng về khả năng (a), vì đề mẫu chính thức (nguồn đáng tin nhất) thể hiện tính "đóng gói liền mạch" rất rõ ràng và có chủ đích sư phạm (dễ chấm, dễ kiểm soát độ khó tăng dần trong từng cặp).

**Kết luận giữ lại:** hai mảng "đại số cơ bản" và "mũ-log ứng dụng" luôn đứng đầu tiên trong khối 12 câu Toán, theo đúng thứ tự này — không đổi qua cả ba đề. Các mảng lượng giác-tam giác, đồ thị/đếm rời rạc, giới hạn-đạo hàm-liên tục (bao gồm cả biến thể tiệm cận), tích phân đều xuất hiện đủ nhưng thứ tự và mức độ "ghép liền cặp" có thể lỏng lẻo hơn ở bản phục dựng so với đề gốc chính thức. Khi thiết kế ma trận trong hệ thống, nên mô hình hóa khối này là **6 ô 2-câu với tập 6 mảng kiến thức cố định**, trong đó thứ tự sau hai ô đầu tiên là soft-constraint (khuyến nghị, không bắt buộc).

## VII. Đối chiếu khối 18 câu Toán còn lại (73-90)

Bảng đối chiếu vị trí các mảng kiến thức qua 3 nguồn:

| Vị trí | Đề mẫu | Đợt 1 | Đợt 2 |
|---|---|---|---|
| 73-74 (2 câu) | Quy hoạch tuyến tính | Oxyz | Oxyz |
| 75-76 (2 câu) | Dãy số | Dãy số (bóng nảy) | Dãy số |
| 77-78 (2 câu) | Oxyz | Quy hoạch tuyến tính | Quy hoạch tuyến tính |
| 79-81 (3 câu) | Khảo sát hàm bậc 3 | **Xác suất/tổ hợp** | Hình Oxy |
| 82-84 (3 câu) | **Xác suất** | Khảo sát hàm (phân thức) | **Xác suất** |
| 85-87 (3 câu) | Hình Oxy | **Hình chóp** | Khảo sát hàm bậc 3 |
| 88-90 (3 câu) | **Hình chóp** | Hình Oxy | **Hình chóp** |

Nhìn bảng này: xác suất xuất hiện ở cả ba vị trí khác nhau tùy đề (đầu, giữa, giữa), và hình chóp cũng chỉ đứng cuối ở 2/3 đề (đề mẫu và đợt 2), còn đợt 1 lại đặt hình chóp ở giữa (85-87) và đẩy hình Oxy xuống làm câu chốt cuối cùng. Do đó hai kết luận cũ "xác suất luôn ở vị trí thứ 2 trong 4 nhóm 3-câu" và "hình chóp luôn là nhóm cuối cùng" **đều cần nới lỏng**, không còn là quy luật tuyệt đối.

**6 mảng kiến thức cố định (quy hoạch tuyến tính, dãy số, Oxyz, khảo sát hàm, xác suất, hình Oxy, hình chóp — thực ra là 7 mảng vì hình Oxy và hình chóp là hai mảng riêng biệt dùng chung "họ hình học") luôn xuất hiện đủ trong 18 câu này, độ dài mỗi mảng (2 hay 3 câu) gắn với độ giàu thông tin tự nhiên của bối cảnh đó — nhưng vị trí sắp xếp cụ thể của từng mảng trong 4 "ô 3-câu" có thể hoán đổi khá tự do giữa các lần ra đề, không theo một trật tự cố định.** Nói cách khác, cái bất biến là "tập hợp các mảng kiến thức và độ dài của chúng", còn "thứ tự xuất hiện của các mảng" là biến số.

Điểm đáng chú ý: hình chóp và xác suất **luôn nằm trong 4 nhóm 3-câu chứ không bao giờ rơi vào nhóm 2-câu** — tức bản thân hai chủ đề này luôn được xem là "đủ giàu" để khai thác 3 câu.

## VIII. Đối chiếu Phần Tư duy khoa học (91-120) — nơi quy luật vững chắc nhất

Ngược lại hoàn toàn với sự "lỏng lẻo" của phần Toán, khi đối chiếu ba đề cho phần Tư duy khoa học, đây là khu vực có **tính bất biến cao nhất trong toàn bộ đề thi**, không có ngoại lệ nào.

### 3.1 Logic — Phân tích số liệu (91-102)

Cả ba đề đều tuân thủ tuyệt đối cấu trúc "2 nhóm logic thuần túy đứng trước → 2 nhóm đọc số liệu/biểu đồ đứng sau", không hề đảo ngược ở bất kỳ đề nào. Cụ thể ở đợt 1: 91-93 và 94-96 đều là bài toán logic sắp xếp lịch (một cái sắp lịch huấn luyện nhân viên theo ngày, một cái sắp lịch biên tập bài viết theo vị trí) — về bản chất là hai biến thể của cùng một dạng "constraint satisfaction problem". Sau đó 97-99 và 100-102 đều là đọc bảng/biểu đồ số liệu thực tế (sản lượng nông trường, giá trị xuất-nhập khẩu).

### 3.2 Suy luận khoa học (103-120)

Đây là phát hiện đáng giá nhất từ việc đối chiếu — **trật tự 6 lĩnh vực không đổi qua cả ba đề**:

| Đề mẫu | Đợt 1 | Đợt 2 |
|---|---|---|
| Áp suất hơi bão hòa (Hóa) | Áp suất hơi bão hòa (Hóa) | Phản ứng trùng hợp PVC (Hóa) |
| Ánh sáng/quang phổ (Lý) | Máy biến áp (Lý) | Hệ thức Bode/thiên văn — thực chất vẫn thuộc nhóm Vật lý-thiên văn |
| Thường biến ở khoai tây (Sinh) | Sức chứa quần thể K (Sinh) | Thường biến ở khoai tây (Sinh) |
| Tuổi trung vị dân số Mỹ (XH/thống kê) | GRDP Quảng Ngãi (XH/kinh tế) | Tuổi trung vị dân số thế giới (XH/thống kê) |
| Văn hóa Phục hưng (Sử) | Lê Thánh Tông (Sử) | Vua Minh Mạng (Sử) |
| Khởi nghiệp/kinh doanh (Kinh tế-tình huống) | Vi phạm môi trường/pháp luật (Tình huống ứng dụng) | Chợ hoa ngày Tết/cung-cầu (Kinh tế-tình huống) |

Không một đề nào đảo thứ tự này. Ngay cả nội dung cụ thể trong từng ô cũng luôn thuộc đúng "họ lĩnh vực" đã định — nhóm thứ 4 lúc thì là thống kê dân số, lúc là số liệu GRDP kinh tế địa phương, nhưng bản chất vẫn là "đọc hiểu số liệu xã hội/kinh tế vĩ mô"; nhóm cuối cùng lúc là khởi nghiệp, lúc là vi phạm môi trường, lúc là quy luật cung-cầu chợ hoa, nhưng đều chung một tính chất "tình huống ứng dụng thực tế đời sống — kinh tế/xã hội/quản trị", đóng vai trò kết thúc đề bằng một bài không đòi hỏi kiến thức hàn lâm mà đòi hỏi khả năng đọc hiểu tình huống và suy luận logic đời thường.

**Lý giải cho sự khác biệt về độ ổn định giữa hai phần:** phần Toán có sẵn một "kho công thức" hữu hạn và tương đối gọn cho mỗi chuyên đề (khảo sát hàm, tích phân, xác suất...), nên việc hoán đổi vị trí giữa các đề không ảnh hưởng đến độ khó tổng thể — ban ra đề có thể tự do xáo trộn thứ tự miễn giữ đúng tỷ trọng. Ngược lại, phần Suy luận khoa học đòi hỏi thiết kế một "trình tự nhận thức" có chủ đích sư phạm: đi từ khoa học tự nhiên chính xác nhất (Hóa, Lý — có công thức định lượng rõ ràng) sang khoa học có yếu tố thực nghiệm-quan sát (Sinh) rồi đến khoa học xã hội mô tả bằng số liệu (thống kê dân số/kinh tế), sau đó là môn thuần đọc hiểu-ghi nhớ (Sử), và kết bằng một tình huống ứng dụng gần gũi đời sống nhất (kinh tế/pháp luật/xã hội) để hạ nhiệt độ khó trước khi thí sinh nộp bài. Trình tự này có tính logic giáo dục học chặt chẽ hơn nên khó bị xáo trộn giữa các lần ra đề, dù người ra đề khác nhau hay đề được phục dựng bởi bên thứ ba.

**Hàm ý cho engine sinh đề:** phần 91-120 nên được mô hình hóa bằng **hard-constraint về trình tự** (2 nhóm logic → 2 nhóm số liệu; Hóa → Lý → Sinh → XH/kinh tế → Sử → Tình huống ứng dụng), trong khi phần Toán 61-90 chỉ cần hard-constraint về tập mảng + độ dài ô, còn thứ tự là soft-constraint.

## IX. Tổng kết lại toàn bộ ma trận sau khi có ba nguồn đối chiếu

**Những gì bất biến tuyệt đối qua cả ba đề (độ tin cậy cao nhất):**
- Tổng số câu, tỷ lệ phần, số câu mỗi phần (60-30-30 hoặc 30-30 / 30 / 12-18) — không đổi.
- Độ dài từng khối "chung dữ kiện" trong Tiếng Việt và Tiếng Anh (12+8+5+5 và 5+5+5+7+8) — không đổi.
- Trình tự 6 lĩnh vực trong Suy luận khoa học (Hóa→Lý→Sinh→Xã hội/kinh tế→Sử→Tình huống ứng dụng) — không đổi.
- Trình tự "logic thuần trước, số liệu sau" trong phần 3.1 — không đổi.
- Hai mảng "đại số cơ bản" và "mũ-log ứng dụng" luôn đứng đầu tiên trong khối 12 câu Toán, theo đúng thứ tự này — không đổi qua cả ba đề.

**Những gì có xu hướng ổn định nhưng không tuyệt đối (độ tin cậy trung bình):**
- Xác suất và hình chóp luôn được xếp vào nhóm 3-câu (không bao giờ rút gọn còn 2 câu), nhưng vị trí cụ thể trong 4 ô 3-câu có thể hoán đổi.
- Trong khối 12 câu Toán đầu, các mảng lượng giác-tam giác, đồ thị/đếm rời rạc, giới hạn-đạo hàm-liên tục, tích phân đều xuất hiện đủ nhưng thứ tự và mức độ "ghép liền cặp" có thể lỏng lẻo hơn ở bản phục dựng so với đề gốc chính thức.

**Hạn chế cần lưu ý khi phân tích:** hai đề phục dựng là sản phẩm tái tạo trí nhớ của bên thứ ba (BaiLearn), nên những kết luận rút ra từ riêng chúng (đặc biệt về thứ tự chi tiết trong phần Toán) có độ tin cậy thấp hơn so với kết luận rút ra từ đề mẫu chính thức. Ngược lại, chính vì cả ba nguồn — kể cả hai bản phục dựng độc lập với nhau — đều đồng nhất tuyệt đối về trình tự lĩnh vực trong phần Suy luận khoa học, điều này càng củng cố rằng đây không phải sự trùng hợp ngẫu nhiên mà là một đặc trưng cấu trúc thực sự, ổn định đến mức người phục dựng dù không nhớ chính xác từng câu chữ vẫn tự nhiên tái hiện đúng thứ tự lĩnh vực — cho thấy trật tự "Hóa-Lý-Sinh-Xã hội-Sử-Ứng dụng" đã ăn sâu thành một khuôn mẫu nhận diện được ngay cả qua trí nhớ gián tiếp.
