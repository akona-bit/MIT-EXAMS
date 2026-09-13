"""
Seed script: Import 120 questions from đề 161, create exam, 1000 students, simulate + grade.
Works with existing users in the database.
"""
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import AsyncSessionLocal
from app.models.user import User, Role
from app.models.question import (
    Question, Answer, KnowledgeNode, KnowledgeNodeType, QuestionType, QuestionStatus
)
from app.models.exam import (
    Exam, ExamForm, ExamFormQuestion, ExamFormAnswer,
    ExamParticipant, ExamSubmission, ExamSubmissionAnswer,
    ExamStatus, ParticipantStatus, ExamMode,
    Matrix, MatrixRule
)
from app.models.grading import ExamResult
# Use pre-computed bcrypt hash for all new students
STUDENT_PASSWORD_HASH = "$2b$12$zCTCB81pAwyn0eDZFCZdFO0cWYgjRB4jVC6Cl64nk/AnYTFPq0U5W"

# ============================================================
# QUESTION DATA from 161.pdf
# ============================================================

QUESTIONS = [
    # PART 1: TIẾNG VIỆT (1-30)
    {
        "pos": 1, "part": 1, "content": "\"Chồng người đi ngược về xuôi\nChồng em ngồi bếp sờ đuôi con mèo\"\n(Ca dao)\nSự đối lập giữa hai hình ảnh \"đi ngược về xuôi\" và \"ngồi bếp sờ đuôi con mèo\" trong bài ca dao trên là gì?",
        "answers": [
            {"content": "Đối lập giữa cái xấu và cái đẹp.", "correct": False},
            {"content": "Đối lập giữa cái hư và cái thực.", "correct": False},
            {"content": "Đối lập giữa cái lớn lao và cái nhỏ nhặt, tầm thường.", "correct": True},
            {"content": "Đối lập giữa động và tĩnh.", "correct": False},
        ]
    },
    {
        "pos": 2, "part": 1, "content": "\"Cái bóng là một sáng tạo nghệ thuật độc đáo...\" (Hoàng Tiến Tựu, Bình giảng truyện dân gian)\nDòng nào dưới đây đề cập đúng về hình ảnh cái bóng trong đoạn văn trên?",
        "answers": [
            {"content": "Cái bóng không phải là người nhưng là một cá thể độc lập.", "correct": False},
            {"content": "Cái bóng được sử dụng trong truyện cổ tích mang tính bi kịch.", "correct": False},
            {"content": "Cái bóng là biểu tượng cho sự hoàn hảo trong nghệ thuật.", "correct": False},
            {"content": "Cái bóng thể hiện vai trò đa chiều của nó trong câu chuyện.", "correct": True},
        ]
    },
    {
        "pos": 3, "part": 1, "content": "\"Chiếc bách buồn vì phận nổi nênh...\" (Hồ Xuân Hương, Tự tình bài III)\nHình tượng chiếc bách trong bài thơ trên có ý nghĩa là",
        "answers": [
            {"content": "người phụ nữ cô lẻ, bất hạnh.", "correct": True},
            {"content": "người chinh phụ đơn côi chờ chồng.", "correct": False},
            {"content": "người chinh phụ với thân phận vô định.", "correct": False},
            {"content": "bậc nam nhi sa cơ lỡ vận.", "correct": False},
        ]
    },
    {
        "pos": 4, "part": 1, "content": "\"Tạo hóa gây chi cuộc hí trường...\" (Bà Huyện Thanh Quan, Thăng Long thành hoài cổ)\nBiện pháp tu từ được sử dụng trong bài thơ trên là",
        "answers": [
            {"content": "so sánh, phép đối.", "correct": False},
            {"content": "phép đối, ẩn dụ.", "correct": False},
            {"content": "ẩn dụ, nhân hoá, phép đối.", "correct": False},
            {"content": "phép đối, nhân hoá.", "correct": True},
        ]
    },
    {
        "pos": 5, "part": 1, "content": "\"Cỏ xanh cửa dưỡng để lòng nhân...\" (Nguyễn Trãi, Ngôn chí bài 11)\nDòng nào dưới đây đề cập chính xác nhất về con người của tác giả ở bài thơ trên?",
        "answers": [
            {"content": "Tình yêu mãnh liệt với thơ ca.", "correct": False},
            {"content": "Căm hận với giặc ngoại xâm.", "correct": False},
            {"content": "Mong muốn hoà mình với thiên nhiên.", "correct": False},
            {"content": "Lối sống bình dị, cốt cách, thanh cao.", "correct": True},
        ]
    },
    {
        "pos": 6, "part": 1, "content": "\"Từ khi biết nghĩ, biết nhớ, Tâm nhớ là chưa lần nào được cha gần gũi...\" (Bảo Ninh, Vô cùng xưa cũ)\nNgười kể chuyện trong văn bản trên đã sử dụng điểm nhìn thời gian như thế nào?",
        "answers": [
            {"content": "Bắt đầu nhìn một sự việc từ hiện tại.", "correct": False},
            {"content": "Nhìn lại quá khứ để nghĩ đến tương lai.", "correct": False},
            {"content": "Nhìn lại quá khứ bằng lăng kính hồi ức.", "correct": True},
            {"content": "Theo dõi một sự việc đang diễn ra.", "correct": False},
        ]
    },
    {
        "pos": 7, "part": 1, "content": "\"Gạo nếp ngày xuân gói bánh chưng...\" (Đoàn Văn Cừ, Tết quê bà)\nBiện pháp tu từ nào được sử dụng trong đoạn thơ trên?",
        "answers": [
            {"content": "Phép điệp.", "correct": False},
            {"content": "Liệt kê.", "correct": True},
            {"content": "So sánh.", "correct": False},
            {"content": "Nói quá.", "correct": False},
        ]
    },
    {
        "pos": 8, "part": 1, "content": "\"Em hiểu rằng mỗi lúc đi xa...\" (Xuân Quỳnh, Nói cùng anh)\nNhân vật trữ tình trong đoạn thơ trên là",
        "answers": [
            {"content": "em.", "correct": True},
            {"content": "con người.", "correct": False},
            {"content": "tình yêu.", "correct": False},
            {"content": "anh.", "correct": False},
        ]
    },
    {
        "pos": 9, "part": 1, "content": "\"Mà bà chủ quán vốn là một người đãi bôi xởi lởi...\" (Đoàn Giỏi, Đất rừng phương Nam)\nTrong văn bản trên, cụm từ \"đãi bôi xởi lởi\" chỉ tính cách gì ở nhân vật bà chủ quán?",
        "answers": [
            {"content": "Niềm nở bề ngoài, nhưng thực chất tính toán thiệt hơn.", "correct": True},
            {"content": "Nhiệt tình và hào phóng đối với người khác.", "correct": False},
            {"content": "Lạnh nhạt bề ngoài, nhưng thực chất tốt bụng.", "correct": False},
            {"content": "Cởi mở và chân thành đối với người khác.", "correct": False},
        ]
    },
    {
        "pos": 10, "part": 1, "content": "\"Một ông lão băng qua cây cầu...\" (Masaru Emoto, Bí mật của nước)\nDòng nào dưới đây nói chính xác nhất về hình ảnh dòng sông trong văn bản trên?",
        "answers": [
            {"content": "Dòng sông chuyển động liên tục như dòng chảy của cuộc sống.", "correct": False},
            {"content": "Dòng sông như là người bạn gắn bó qua suốt nhiều thế hệ.", "correct": True},
            {"content": "Dòng sông đại diện cho sự nhẹ nhàng và bình yên trong cuộc đời.", "correct": False},
            {"content": "Dòng sông buồn bã trước sự kết thúc của một hành trình dài.", "correct": False},
        ]
    },
    {
        "pos": 11, "part": 1, "content": "\"Lương tâm – đó là sự thật sống giữa mọi người...\" (Simon Soloveychik, Tuyên ngôn con người tự do)\nTừ nó ở vị trí nào được đặt trong ngữ cảnh trong văn bản trên có nghĩa là \"sự thật\"?",
        "answers": [
            {"content": "(1) và (2).", "correct": False},
            {"content": "(3) và (4).", "correct": True},
            {"content": "(2), (3) và (4).", "correct": False},
            {"content": "Không ở vị trí nào.", "correct": False},
        ]
    },
    {
        "pos": 12, "part": 1, "content": "Trong trường phái văn học hiện thực, nhà văn nào dưới đây có xu hướng theo chủ nghĩa hiện thực trào phúng?",
        "answers": [
            {"content": "Vũ Trọng Phụng.", "correct": True},
            {"content": "Nam Cao.", "correct": False},
            {"content": "Ngô Tất Tố.", "correct": False},
            {"content": "Tô Hoài.", "correct": False},
        ]
    },
    {
        "pos": 13, "part": 1, "content": "Dòng nào dưới đây chứa hoàn toàn những từ viết sai chính tả?",
        "answers": [
            {"content": "Xào xạc, sắc sảo, sực nức, xúc tích.", "correct": False},
            {"content": "Xào xạt, sắc xảo, xực nức, xúc tích.", "correct": True},
            {"content": "Xào xạt, sắc sảo, sực nức, súc tích.", "correct": False},
            {"content": "Xào xạc, sắc xảo, xực nức, súc tích.", "correct": False},
        ]
    },
    {
        "pos": 14, "part": 1, "content": "Chọn cặp từ viết đúng chính tả để điền vào chỗ trống:\n\"Đột nhiên, trận mưa dông _____ đổ, gõ lên mái tôn _____\".",
        "answers": [
            {"content": "sầm sập, loảng xoảng.", "correct": True},
            {"content": "xầm xập, loảng xoảng.", "correct": False},
            {"content": "sầm sập, loãng xoãng.", "correct": False},
            {"content": "xầm xập, loãng xoãng.", "correct": False},
        ]
    },
    {
        "pos": 15, "part": 1, "content": "Trong những nhóm từ dưới đây, nhóm nào chứa toàn bộ là các từ ghép?",
        "answers": [
            {"content": "Tần tảo, nhiễu nhương, rào rạt.", "correct": False},
            {"content": "Đày đoạ, chênh vênh, gian nan.", "correct": True},
            {"content": "Chênh vênh, rào rạt, chật vật.", "correct": False},
            {"content": "Gian nan, tần tảo, nhiễu nhương.", "correct": False},
        ]
    },
    {
        "pos": 16, "part": 1, "content": "\"Nhằm phục vụ quý khách hàng tốt hơn và cải thiện chất lượng phục vụ của nhân viên\".\nCâu trên là câu",
        "answers": [
            {"content": "thiếu thành phần vị ngữ.", "correct": True},
            {"content": "thiếu thành phần chủ ngữ.", "correct": False},
            {"content": "thiếu thành phần nòng cốt câu.", "correct": False},
            {"content": "tĩnh lược chủ ngữ.", "correct": False},
        ]
    },
    {
        "pos": 17, "part": 1, "content": "\"Sản phẩm này rất hữu ích, có chất lượng cao và giá cả hợp lí. Vì vậy, nhà sản xuất khuyến cáo khách hàng nên mua về sử dụng.\"\nTừ nào bị dùng sai trong câu trên?",
        "answers": [
            {"content": "hữu ích.", "correct": False},
            {"content": "khuyến cáo.", "correct": True},
            {"content": "hợp lí.", "correct": False},
            {"content": "sử dụng.", "correct": False},
        ]
    },
    {
        "pos": 18, "part": 1, "content": "Dòng nào sau đây viết đúng?",
        "answers": [
            {"content": "Đâu phải là tôi không quan tâm tới nó? Tôi đã nói hết cách rồi nhưng nó có chịu nghe đâu? Anh thử khuyên nó xem sao?", "correct": True},
            {"content": "Thằng bé kiên quyết đòi chơi game.", "correct": False},
            {"content": "Quảng Trị, nơi dừng chân đầu tiên của triều đình nhà Nguyễn trên hành trình về phương Nam, nơi xảy ra mùa hè 72 rực lửa.", "correct": False},
            {"content": "Anh ta đã đánh những đòn khá hiểm nhưng đánh sao nổi một tay anh chị nổi tiếng đao búa.", "correct": False},
        ]
    },
    {
        "pos": 19, "part": 1, "content": "Trong dòng dưới đây, dòng nào có sự sắp xếp trật tự hợp lí nhất?",
        "answers": [
            {"content": "Tài tử Jung Hae In trả lời phỏng vấn của báo Star nhân chuyến sang Việt Nam.", "correct": False},
            {"content": "Trả lời phỏng vấn của tài tử Jung Hae In nhân chuyến sang Việt Nam.", "correct": True},
            {"content": "Trả lời phỏng vấn của báo Star nhân chuyến sang Việt Nam của tài tử Jung Hae In.", "correct": False},
            {"content": "Tài tử Jung Hae In nhân chuyến sang Việt Nam của báo Star trả lời phỏng vấn.", "correct": False},
        ]
    },
    {
        "pos": 20, "part": 1, "content": "Từ \"những\" trong câu nào dưới đây là trợ từ?",
        "answers": [
            {"content": "Bạn tôi không những xinh đẹp, mà còn thông minh.", "correct": False},
            {"content": "Hôm qua anh đi những đâu, làm những gì?", "correct": False},
            {"content": "Cái giỏ này giá những một triệu đồng.", "correct": True},
            {"content": "Họ là những cô gái năng động, giàu sức sống.", "correct": False},
        ]
    },
    {
        "pos": 21, "part": 1, "content": "\"Nếu đọc được 10 quyển sách không quan trọng, không bằng đem thời gian, sức lực đọc 10 quyển ấy mà đọc một quyển thực sự có giá trị\" có ý nghĩa gì?",
        "answers": [
            {"content": "Không nên đọc nhiều sách.", "correct": False},
            {"content": "Nên lựa chọn sách để đọc.", "correct": True},
            {"content": "Đọc sách cần đọc kỹ.", "correct": False},
            {"content": "Đọc sách ít tốt hơn là đọc sách nhiều.", "correct": False},
        ]
    },
    {
        "pos": 22, "part": 1, "content": "Từ \"trọc phú\" trong đoạn 2 có thể hiểu là gì?",
        "answers": [
            {"content": "Người giàu có thích khoe khoang coi trọng số lượng hơn chất lượng.", "correct": True},
            {"content": "Người giàu có và có ngoại hình bệ vệ, oai nghi.", "correct": False},
            {"content": "Người ít tiền mà khoe mình giàu có.", "correct": False},
            {"content": "Người giàu có nhưng keo kiệt xu nịnh.", "correct": False},
        ]
    },
    {
        "pos": 23, "part": 1, "content": "Tại sao cần chia sách theo nhiều loại?",
        "answers": [
            {"content": "Để thể hiện sự am hiểu chuyên sâu về các loại sách.", "correct": False},
            {"content": "Để trau dồi kiến thức phổ thông và học vấn chuyên môn.", "correct": True},
            {"content": "Để xác định số lượng sách cần đọc trong suốt cuộc đời.", "correct": False},
            {"content": "Để biết cách tìm các loại sách quan trọng để đọc.", "correct": False},
        ]
    },
    {
        "pos": 24, "part": 1, "content": "Tại sao người ta không thu được lợi ích gì khi đọc sách?",
        "answers": [
            {"content": "Do chỉ đọc sách giáo trình.", "correct": False},
            {"content": "Do đọc quá nhiều sách dẫn đến quên kiến thức.", "correct": False},
            {"content": "Do không có nhiều loại sách để lựa chọn.", "correct": False},
            {"content": "Do đọc sách qua loa, không kỹ lưỡng.", "correct": True},
        ]
    },
    {
        "pos": 25, "part": 1, "content": "Nội dung nào dưới đây không được đề cập trong văn bản?",
        "answers": [
            {"content": "Người đọc sách cần chọn sách cho tinh.", "correct": False},
            {"content": "Đọc sách cần có phương pháp.", "correct": False},
            {"content": "Sách hay không có nhiều.", "correct": True},
            {"content": "Phải đọc nhiều loại sách khác nhau để tăng thêm kiến thức.", "correct": False},
        ]
    },
    {
        "pos": 26, "part": 1, "content": "Từ \"trảng sen\" ở đoạn (1) dùng để chỉ",
        "answers": [
            {"content": "một bộ phận của cây hoa sen.", "correct": False},
            {"content": "một họ của cây hoa sen.", "correct": False},
            {"content": "một vùng đất rộng trồng hoa sen.", "correct": True},
            {"content": "một địa danh nổi tiếng về hoa sen.", "correct": False},
        ]
    },
    {
        "pos": 27, "part": 1, "content": "Ở đoạn (2), tác giả đã thực hiện liên kết các câu bằng biện pháp tu từ nào?",
        "answers": [
            {"content": "Ẩn dụ.", "correct": False},
            {"content": "Liệt kê.", "correct": False},
            {"content": "So sánh.", "correct": True},
            {"content": "Nhân hoá.", "correct": False},
        ]
    },
    {
        "pos": 28, "part": 1, "content": "Đoạn (2) và đoạn (3) đã sử dụng bao nhiêu từ láy?",
        "answers": [
            {"content": "2 từ láy.", "correct": False},
            {"content": "3 từ láy.", "correct": False},
            {"content": "4 từ láy.", "correct": True},
            {"content": "5 từ láy.", "correct": False},
        ]
    },
    {
        "pos": 29, "part": 1, "content": "Tác giả sử dụng hình ảnh \"hoa quỳnh nở rồi tàn nhanh\" trong đoạn (4) để làm gì?",
        "answers": [
            {"content": "Thể hiện sự tiếc nuối khi những giá trị truyền thống dần bị mai một.", "correct": True},
            {"content": "Bộc lộ cảm xúc buồn bã khi tình người đang đánh mất theo thời gian.", "correct": False},
            {"content": "Miêu tả và so sánh vẻ đẹp của hoa quỳnh với hoa sen.", "correct": False},
            {"content": "Tạo nên mối liên hệ giữa các giá trị truyền thống và con người ở hiện tại.", "correct": False},
        ]
    },
    {
        "pos": 30, "part": 1, "content": "Qua văn bản trên, tác giả muốn gửi gắm điều gì?",
        "answers": [
            {"content": "Đừng để đánh mất những giá trị truyền thống tốt đẹp của thiên nhiên và con người.", "correct": True},
            {"content": "Tình cảm giữa con người trong đời sống quan trọng hơn mọi giá trị về vật chất.", "correct": False},
            {"content": "Những giá trị truyền thống dù biến mất vẫn sẽ còn lưu mãi trong kí ức của mỗi người.", "correct": False},
            {"content": "Sự biến đổi về con người và thiên nhiên là một quy luật tất yếu theo thời gian.", "correct": False},
        ]
    },
    # PART 2: TIẾNG ANH (31-60)
    {
        "pos": 31, "part": 2, "content": "We usually do voluntary work to help _____ people have more food and places to sleep.",
        "answers": [
            {"content": "without home", "correct": False},
            {"content": "no-home", "correct": False},
            {"content": "homeless", "correct": True},
            {"content": "homelessness", "correct": False},
        ]
    },
    {
        "pos": 32, "part": 2, "content": "Linda works as a social worker, so she often calls _____ charity donations.",
        "answers": [
            {"content": "out", "correct": False},
            {"content": "around", "correct": False},
            {"content": "up", "correct": False},
            {"content": "for", "correct": True},
        ]
    },
    {
        "pos": 33, "part": 2, "content": "Daisy felt sad when she received her essay back with _____ corrections.",
        "answers": [
            {"content": "too much", "correct": True},
            {"content": "a lot of", "correct": False},
            {"content": "too few of", "correct": False},
            {"content": "a great deal of", "correct": False},
        ]
    },
    {
        "pos": 34, "part": 2, "content": "On March 8, women around the world _____ flowers and wishes.",
        "answers": [
            {"content": "will receive", "correct": False},
            {"content": "has received", "correct": False},
            {"content": "received", "correct": False},
            {"content": "receive", "correct": True},
        ]
    },
    {
        "pos": 35, "part": 2, "content": "The _____ I waited, the more anxious I became.",
        "answers": [
            {"content": "longer", "correct": True},
            {"content": "longest", "correct": False},
            {"content": "as long as", "correct": False},
            {"content": "more longer", "correct": False},
        ]
    },
    {
        "pos": 36, "part": 2, "content": "My father seems not to like the new pictures the colors of whom are rather dark.\nFind the error.",
        "answers": [
            {"content": "A", "correct": False},
            {"content": "B", "correct": False},
            {"content": "C", "correct": True},
            {"content": "D", "correct": False},
        ]
    },
    {
        "pos": 37, "part": 2, "content": "My little son is crazy about animated movies, so I have to stop her from watching them too often.\nFind the error.",
        "answers": [
            {"content": "A", "correct": False},
            {"content": "B", "correct": False},
            {"content": "C", "correct": True},
            {"content": "D", "correct": False},
        ]
    },
    {
        "pos": 38, "part": 2, "content": "The juice that you made from the oranges picked this morning have lessened my cold.\nFind the error.",
        "answers": [
            {"content": "A", "correct": False},
            {"content": "B", "correct": False},
            {"content": "C", "correct": False},
            {"content": "D", "correct": True},
        ]
    },
    {
        "pos": 39, "part": 2, "content": "Go ahead and take the first turning on the left; the butcher's shop is next to the grocery store.\nFind the error.",
        "answers": [
            {"content": "A", "correct": False},
            {"content": "B", "correct": False},
            {"content": "C", "correct": True},
            {"content": "D", "correct": False},
        ]
    },
    {
        "pos": 40, "part": 2, "content": "Whenever I come back to my hometown, I ask my best friend out for a coffee by river.\nFind the error.",
        "answers": [
            {"content": "A", "correct": False},
            {"content": "B", "correct": False},
            {"content": "C", "correct": False},
            {"content": "D", "correct": True},
        ]
    },
    {
        "pos": 41, "part": 2, "content": "The only white flower can be easily sorted out from the yellow flowers.\nWhich best restates this sentence?",
        "answers": [
            {"content": "From the yellow flowers, the only white flower can be easily separated.", "correct": True},
            {"content": "Unlike the yellow flowers, the only white flower is another sort.", "correct": False},
            {"content": "The only white flower can be differed from most yellow flowers.", "correct": False},
            {"content": "Of all the flowers, the only white flower cannot be recognized.", "correct": False},
        ]
    },
    {
        "pos": 42, "part": 2, "content": "My plants may have died because I have been away too long.\nWhich best restates this sentence?",
        "answers": [
            {"content": "As I have been away too long, my plants must have died by now.", "correct": False},
            {"content": "It is certain that my plants have died by now since I have been away too long.", "correct": False},
            {"content": "I have been away from my plants too long, so it is likely that they have died.", "correct": True},
            {"content": "It seems that I have been away too long, so my plants may have died by now.", "correct": False},
        ]
    },
    {
        "pos": 43, "part": 2, "content": "Ginger cake is the best snack for me so far.\nWhich best restates this sentence?",
        "answers": [
            {"content": "Of all the snacks, I love ginger cake the most.", "correct": True},
            {"content": "Ginger cake is one of my favorite snacks.", "correct": False},
            {"content": "For a snack, I would choose ginger cake.", "correct": False},
            {"content": "For snack lover, nothing is better than ginger cake.", "correct": False},
        ]
    },
    {
        "pos": 44, "part": 2, "content": "I told Tom, \"Think twice before you post a tweet\".\nWhich best restates this sentence?",
        "answers": [
            {"content": "I warned Tom against thinking hard if he wanted to post a tweet.", "correct": False},
            {"content": "I said Tom should think twice before he posts a tweet.", "correct": False},
            {"content": "I advised Tom to think carefully before posting a tweet.", "correct": True},
            {"content": "I told Tom to think twice before I posted a tweet.", "correct": False},
        ]
    },
    {
        "pos": 45, "part": 2, "content": "Due to my bad cold, I cannot hang around with my friends now.\nWhich best restates this sentence?",
        "answers": [
            {"content": "Without a bad cold, I could hang around with my friends now.", "correct": True},
            {"content": "If I had a bad cold, I could not hang around with my friends now.", "correct": False},
            {"content": "If my bad cold had gone, I could have hung around with my friends now.", "correct": False},
            {"content": "Unless I had a bad cold, I will hang around with my friends soon.", "correct": False},
        ]
    },
    {
        "pos": 46, "part": 2, "content": "What is the best title of the Merriwether Mall passage?",
        "answers": [
            {"content": "A new shopping mall in Gatesbridge", "correct": True},
            {"content": "The origin of the name Merriwether", "correct": False},
            {"content": "The history of the Merriwether Mall", "correct": False},
            {"content": "Shopping opportunities in Gatesbridge", "correct": False},
        ]
    },
    {
        "pos": 47, "part": 2, "content": "In paragraph 1, what does the word \"it\" refer to?",
        "answers": [
            {"content": "the Merriweather Mall", "correct": True},
            {"content": "the biggest mall", "correct": False},
            {"content": "the motorway", "correct": False},
            {"content": "the bus station", "correct": False},
        ]
    },
    {
        "pos": 48, "part": 2, "content": "Where is the best place in the mall to buy an expensive necklace?",
        "answers": [
            {"content": "The Palisade", "correct": True},
            {"content": "Thai and Italian food", "correct": False},
            {"content": "Bohemia", "correct": False},
            {"content": "Independent shops", "correct": False},
        ]
    },
    {
        "pos": 49, "part": 2, "content": "In paragraph 2, what is the word \"major\" closest in meaning to?",
        "answers": [
            {"content": "main", "correct": True},
            {"content": "well-organized", "correct": False},
            {"content": "professional", "correct": False},
            {"content": "expensive", "correct": False},
        ]
    },
    {
        "pos": 50, "part": 2, "content": "According to paragraph 5, what can be inferred about the Palisade?",
        "answers": [
            {"content": "Its customers have a lot of money.", "correct": True},
            {"content": "It offers traditional postal service.", "correct": False},
            {"content": "It lends money to customers.", "correct": False},
            {"content": "It is for display only.", "correct": False},
        ]
    },
    {
        "pos": 51, "part": 2, "content": "According to paragraph 7, how long is the voucher valid for?",
        "answers": [
            {"content": "5 days", "correct": False},
            {"content": "6 days", "correct": False},
            {"content": "7 days", "correct": True},
            {"content": "8 days", "correct": False},
        ]
    },
    {
        "pos": 52, "part": 2, "content": "According to the passage, where can we do food shopping?",
        "answers": [
            {"content": "Bohemia", "correct": False},
            {"content": "The Market square", "correct": True},
            {"content": "The Showground", "correct": False},
            {"content": "The Palisade", "correct": False},
        ]
    },
    {
        "pos": 53, "part": 2, "content": "What is the bitcoin passage mainly about?",
        "answers": [
            {"content": "The future of bitcoins in the real world", "correct": False},
            {"content": "A new kind of currency in the virtual world", "correct": True},
            {"content": "A way of doing business in the virtual world", "correct": False},
            {"content": "An alternative to bitcoins created by Nakamoto", "correct": False},
        ]
    },
    {
        "pos": 54, "part": 2, "content": "Which of the following is NOT mentioned in paragraphs 1 and 2?",
        "answers": [
            {"content": "The identity of the creator of bitcoins remains a mystery.", "correct": False},
            {"content": "Bitcoins can be accepted as national currencies.", "correct": True},
            {"content": "The bitcoin is a type of cryptocurrency.", "correct": False},
            {"content": "All bitcoin transactions are archived and publicly visible.", "correct": False},
        ]
    },
    {
        "pos": 55, "part": 2, "content": "What is the word \"them\" in paragraph 3 referring to?",
        "answers": [
            {"content": "governments", "correct": True},
            {"content": "bitcoins", "correct": False},
            {"content": "hackers", "correct": False},
            {"content": "goods", "correct": False},
        ]
    },
    {
        "pos": 56, "part": 2, "content": "In paragraph 3, what is the word \"minuscule\" closest in meaning to?",
        "answers": [
            {"content": "significant", "correct": False},
            {"content": "considerable", "correct": False},
            {"content": "increasing", "correct": False},
            {"content": "minimal", "correct": True},
        ]
    },
    {
        "pos": 57, "part": 2, "content": "In paragraph 4, it can be inferred that bitcoin investors are ______.",
        "answers": [
            {"content": "confident in its long-term stability", "correct": False},
            {"content": "taking risks due to its volatile nature", "correct": True},
            {"content": "avoiding any type of online transactions", "correct": False},
            {"content": "reluctant to invest further", "correct": False},
        ]
    },
    {
        "pos": 58, "part": 2, "content": "The author uses the word \"high-tech\" in paragraph 4 in order to ______.",
        "answers": [
            {"content": "emphasize why bitcoin attracts more and more companies", "correct": False},
            {"content": "suggest that bitcoin are superior to other online payment methods", "correct": False},
            {"content": "highlight the innovation of bitcoins compared to traditional currencies", "correct": True},
            {"content": "criticize the instability of bitcoin as a form of investment", "correct": False},
        ]
    },
    {
        "pos": 59, "part": 2, "content": "In which paragraph does the author primarily discuss both the potential risks and limited current usage of bitcoins?",
        "answers": [
            {"content": "Paragraph 1", "correct": False},
            {"content": "Paragraph 2", "correct": False},
            {"content": "Paragraph 3", "correct": True},
            {"content": "Paragraph 4", "correct": False},
        ]
    },
    {
        "pos": 60, "part": 2, "content": "It can be inferred from the passage that the future of bitcoin ______.",
        "answers": [
            {"content": "its value will soon stabilize as bitcoins become more widely accepted", "correct": False},
            {"content": "governments will regulate its value to reduce risks for investors", "correct": False},
            {"content": "its value is difficult to predict due to the current volatility", "correct": True},
            {"content": "it will eventually become more valuable than national currencies", "correct": False},
        ]
    },
    # PART 3: TOÁN HỌC (61-90)
    {
        "pos": 61, "part": 3, "content": "Cho tập hợp A. Biết rằng số tập hợp con của A gồm 4 phần tử bằng với số tập hợp con của A gồm 2 phần tử. Số phần tử của tập hợp A là",
        "answers": [
            {"content": "12.", "correct": False},
            {"content": "10.", "correct": False},
            {"content": "6.", "correct": False},
            {"content": "8.", "correct": True},
        ]
    },
    {
        "pos": 62, "part": 3, "content": "Số đường tiệm cận đứng của hàm số f(x) = (x²-4)/(x+2) là",
        "answers": [
            {"content": "1.", "correct": False},
            {"content": "2.", "correct": False},
            {"content": "0.", "correct": True},
            {"content": "3.", "correct": False},
        ]
    },
    {
        "pos": 63, "part": 3, "content": "Biết rằng lim(x→-∞) (x²+mx+3)/(x²-1) = 2. Giá trị của m nằm trong khoảng:",
        "answers": [
            {"content": "(-2; 1).", "correct": True},
            {"content": "(0; 1).", "correct": False},
            {"content": "(1; 2).", "correct": False},
            {"content": "(3; 5).", "correct": False},
        ]
    },
    {
        "pos": 64, "part": 3, "content": "Cho hàm số f(x) = (x²+1)/(ln x) có đạo hàm tại x=1 là f'(1) = a + b·ln2. Giá trị của P = a – b là",
        "answers": [
            {"content": "P = 2.", "correct": False},
            {"content": "P = –1.", "correct": True},
            {"content": "P = –2.", "correct": False},
            {"content": "P = 1.", "correct": False},
        ]
    },
    {
        "pos": 65, "part": 3, "content": "Hàm số f(x) = x³-2x²-4x có nguyên hàm F(x) = ∫f(x)dx + C. Để nguyên hàm có giá trị bằng 0 tại x=1 thì giá trị của hằng số C là",
        "answers": [
            {"content": "C = 2/3.", "correct": False},
            {"content": "C = –2/3.", "correct": True},
            {"content": "C = –3/2.", "correct": False},
            {"content": "C = 3/2.", "correct": False},
        ]
    },
    {
        "pos": 66, "part": 3, "content": "Cho hàm số f(x) = x³-(m+1)x²+(m-1)x+1. Hàm số y=f(x) đạt cực trị tại x=2 khi và chỉ khi m bằng",
        "answers": [
            {"content": "1.", "correct": False},
            {"content": "2.", "correct": False},
            {"content": "3.", "correct": True},
            {"content": "4.", "correct": False},
        ]
    },
    {
        "pos": 67, "part": 3, "content": "Với m=–2, đồ thị hàm số y=f(x) đạt giá trị lớn nhất trên đoạn [–2;1] tại điểm có hoành độ bằng",
        "answers": [
            {"content": "–1.", "correct": False},
            {"content": "0.", "correct": False},
            {"content": "–2.", "correct": True},
            {"content": "1.", "correct": False},
        ]
    },
    {
        "pos": 68, "part": 3, "content": "Để đường thẳng y=2x+5 cắt đồ thị hàm số y=f(x) tại hai điểm phân biệt có tổng các hoành độ bằng 4 thì các giá trị của m sẽ nằm trong khoảng",
        "answers": [
            {"content": "(2; 4).", "correct": True},
            {"content": "(4; 6).", "correct": False},
            {"content": "(3; 5).", "correct": False},
            {"content": "(1; 3).", "correct": False},
        ]
    },
    {
        "pos": 69, "part": 3, "content": "Nếu cơ sở cung cấp x (tấn) nguyên liệu loại II và y (tấn) nguyên liệu loại I thì tổng số tiền để mua nguyên liệu là",
        "answers": [
            {"content": "4x + 3y.", "correct": False},
            {"content": "10x + 9y.", "correct": False},
            {"content": "3x + 4y.", "correct": True},
            {"content": "9x + 10y.", "correct": False},
        ]
    },
    {
        "pos": 70, "part": 3, "content": "Để giảm chi phí mua nguyên liệu đến mức thấp nhất, giá trị của y là",
        "answers": [
            {"content": "9.", "correct": False},
            {"content": "10.", "correct": True},
            {"content": "4.", "correct": False},
            {"content": "5.", "correct": False},
        ]
    },
    {
        "pos": 71, "part": 3, "content": "Mức chi phí ít nhất để mua nguyên liệu là",
        "answers": [
            {"content": "32 triệu đồng.", "correct": False},
            {"content": "28 triệu đồng.", "correct": False},
            {"content": "37 triệu đồng.", "correct": True},
            {"content": "40 triệu đồng.", "correct": False},
        ]
    },
    {
        "pos": 72, "part": 3, "content": "Cho cấp số nhân (un) xác định bởi u₃+u₄=5 và u₅–u₆=36. Công bội của cấp số nhân là",
        "answers": [
            {"content": "q = 2.", "correct": False},
            {"content": "q = –2.", "correct": False},
            {"content": "q = 3.", "correct": True},
            {"content": "q = –3.", "correct": False},
        ]
    },
    {
        "pos": 73, "part": 3, "content": "Gọi S là tổng 8 số hạng đầu tiên. Biết rằng S=17, giá trị của số hạng đầu u₁ là",
        "answers": [
            {"content": "u₁ = 1/5.", "correct": False},
            {"content": "u₁ = –3/2.", "correct": False},
            {"content": "u₁ = 3/2.", "correct": True},
            {"content": "u₁ = –1/5.", "correct": False},
        ]
    },
    {
        "pos": 74, "part": 3, "content": "Cho bất phương trình (x+1)/(4x-2) + m ≥ 0 có nghiệm đúng với mọi x ≥ 0. Tập hợp tất cả các giá trị của m là",
        "answers": [
            {"content": "(-∞; 0].", "correct": True},
            {"content": "[0; +∞).", "correct": False},
            {"content": "[-1; +∞).", "correct": False},
            {"content": "(-∞; -1].", "correct": False},
        ]
    },
    {
        "pos": 75, "part": 3, "content": "S là tập tất cả các giá trị nguyên của m sao cho BP có nghiệm nằm trong khoảng (0;4). Số phần tử của S là",
        "answers": [
            {"content": "1.", "correct": False},
            {"content": "3.", "correct": True},
            {"content": "2.", "correct": False},
            {"content": "4.", "correct": False},
        ]
    },
    {
        "pos": 76, "part": 3, "content": "Cho phương trình log₂(x-2) = 5 - 2log₂x. Điều kiện xác định của phương trình là",
        "answers": [
            {"content": "x > 2, x ≠ 5/2.", "correct": False},
            {"content": "0 < x < 5/2.", "correct": False},
            {"content": "x < 5/2.", "correct": False},
            {"content": "x > 0, x ≠ 5/2.", "correct": True},
        ]
    },
    {
        "pos": 77, "part": 3, "content": "Tổng tất cả các nghiệm của phương trình là",
        "answers": [
            {"content": "16/3.", "correct": False},
            {"content": "3.", "correct": True},
            {"content": "–3.", "correct": False},
            {"content": "7/3.", "correct": False},
        ]
    },
    {
        "pos": 78, "part": 3, "content": "Tỷ lệ sinh viên không biết sử dụng cả Latex và Powerpoint là",
        "answers": [
            {"content": "60%.", "correct": False},
            {"content": "40%.", "correct": True},
            {"content": "80%.", "correct": False},
            {"content": "20%.", "correct": False},
        ]
    },
    {
        "pos": 79, "part": 3, "content": "Trong những sinh viên biết sử dụng Latex hoặc PowerPoint, tỷ lệ sinh viên biết sử dụng Word chiếm khoảng bao nhiêu phần trăm?",
        "answers": [
            {"content": "39%.", "correct": False},
            {"content": "65%.", "correct": True},
            {"content": "35%.", "correct": False},
            {"content": "61%.", "correct": False},
        ]
    },
    {
        "pos": 80, "part": 3, "content": "Chọn ngẫu nhiên một sinh viên biết sử dụng Powerpoint, xác suất để sinh viên này cũng biết sử dụng Latex là",
        "answers": [
            {"content": "35%.", "correct": False},
            {"content": "20%.", "correct": True},
            {"content": "15%.", "correct": False},
            {"content": "40%.", "correct": False},
        ]
    },
    {
        "pos": 81, "part": 3, "content": "Cho tam giác ABC vuông tại B, BA=5, AC=13. Giá trị của CA→.BC→ là",
        "answers": [
            {"content": "144.", "correct": False},
            {"content": "–144.", "correct": True},
            {"content": "–65.", "correct": False},
            {"content": "65.", "correct": False},
        ]
    },
    {
        "pos": 82, "part": 3, "content": "Gọi H là chân đường cao kẻ từ B. Giá trị của BH→.BA→ là",
        "answers": [
            {"content": "18.", "correct": False},
            {"content": "16.", "correct": True},
            {"content": "25.", "correct": False},
            {"content": "9.", "correct": False},
        ]
    },
    {
        "pos": 83, "part": 3, "content": "Cho tam giác ABC, A(2;1), pth AB: 2x+y-4=0, pth BC: 3x-y+11=0. Toạ độ điểm C là",
        "answers": [
            {"content": "C(1;4).", "correct": False},
            {"content": "C(2; –4).", "correct": False},
            {"content": "C(–2;3).", "correct": True},
            {"content": "C(4; –2).", "correct": False},
        ]
    },
    {
        "pos": 84, "part": 3, "content": "Đường tròn ngoại tiếp tam giác ABC có đường kính là",
        "answers": [
            {"content": "2√3.", "correct": False},
            {"content": "5.", "correct": False},
            {"content": "2√5.", "correct": True},
            {"content": "2√3.", "correct": False},
        ]
    },
    {
        "pos": 85, "part": 3, "content": "Cho hình chóp S.ABC có đáy ABC vuông tại B, BC=a, ∠ACB=60°, SA⊥(ABC) và M nằm trên AC sao cho MA=2MC. Mặt phẳng (SBC) tạo với đáy góc 30°. Thể tích khối chóp S.ABC là",
        "answers": [
            {"content": "a³√3/2.", "correct": False},
            {"content": "a³√3/12.", "correct": False},
            {"content": "a³√3/6.", "correct": True},
            {"content": "a³√3/4.", "correct": False},
        ]
    },
    {
        "pos": 86, "part": 3, "content": "Tỉ số thể tích giữa khối chóp S.ABC và khối chóp S.MHC là",
        "answers": [
            {"content": "3.", "correct": False},
            {"content": "1/3.", "correct": False},
            {"content": "2/3.", "correct": True},
            {"content": "3/2.", "correct": False},
        ]
    },
    {
        "pos": 87, "part": 3, "content": "Khoảng cách từ điểm M đến mặt phẳng (SBC) là",
        "answers": [
            {"content": "a√3/3.", "correct": False},
            {"content": "a√3/6.", "correct": True},
            {"content": "a√3/2.", "correct": False},
            {"content": "4a/3.", "correct": False},
        ]
    },
    {
        "pos": 88, "part": 3, "content": "Cho A(0;1;2), B(2;–2;1), C(–2;0;1) và (P): 2x+2y+3z=0. M thuộc (P) thoả MA=MB=MC. Toạ độ M là",
        "answers": [
            {"content": "M(1;1; –1).", "correct": False},
            {"content": "M(2;1; –3).", "correct": False},
            {"content": "M(2;3; –7).", "correct": False},
            {"content": "M(0;1;1).", "correct": True},
        ]
    },
    {
        "pos": 89, "part": 3, "content": "Mặt cầu tâm M ngoại tiếp mặt phẳng (ABC) có phương trình là",
        "answers": [
            {"content": "x²+y²+z²-4x+6y-14z+27=0.", "correct": False},
            {"content": "x²+y²+z²-4x-2y+6z+21=0.", "correct": False},
            {"content": "x²+y²+z²-4x+6y-14z+27=0.", "correct": False},
            {"content": "x²+y²+z²-4x-2y+6z+21=0.", "correct": True},
        ]
    },
    {
        "pos": 90, "part": 3, "content": "Đường thẳng đi qua trung điểm BC và vuông góc với (P) có phương trình chính tắc là",
        "answers": [
            {"content": "(x-1)/2 = (y+1)/2 = (z-1)/1.", "correct": False},
            {"content": "(x-1)/2 = (y+1)/2 = (z-1)/1.", "correct": True},
            {"content": "(x-1)/2 = (y+1)/2 = (z+1)/1.", "correct": False},
            {"content": "(x-1)/2 = (y+1)/2 = (z+1)/1.", "correct": False},
        ]
    },
    # PART 4: TƯ DUY KHOA HỌC (91-120)
    {
        "pos": 91, "part": 4, "content": "Một liên hoan sân khấu có 6 đoàn J,K,N,Q,R,S. J phải trình diễn buổi sáng, cùng ngày với K hoặc Q; R phải trình diễn buổi chiều, cùng ngày với N hoặc S; Q phải trình diễn vào ngày trước ngày trình diễn của K và N. Lịch trình diễn nào chấp nhận được?",
        "answers": [
            {"content": "J, Q, K, N, S, R.", "correct": True},
            {"content": "J, K, Q, S, N, R.", "correct": False},
            {"content": "Q, N, S, R, J, K.", "correct": False},
            {"content": "Q, S, J, K, R, N.", "correct": False},
        ]
    },
    {
        "pos": 92, "part": 4, "content": "Lịch trình diễn của đoàn nào không thể diễn ra vào sáng thứ Năm?",
        "answers": [
            {"content": "N.", "correct": True},
            {"content": "Q.", "correct": False},
            {"content": "K.", "correct": False},
            {"content": "J.", "correct": False},
        ]
    },
    {
        "pos": 93, "part": 4, "content": "Nếu K trình diễn vào sáng thứ Sáu thì nào sau đây có thể đúng?",
        "answers": [
            {"content": "R trình diễn vào chiều thứ Sáu.", "correct": False},
            {"content": "N trình diễn vào chiều thứ Năm.", "correct": True},
            {"content": "Q trình diễn vào sáng thứ Tư.", "correct": False},
            {"content": "J trình diễn vào sáng thứ Năm.", "correct": False},
        ]
    },
    {
        "pos": 94, "part": 4, "content": "Nếu Q trình diễn vào buổi sáng thì đoàn nào không thể trình diễn vào thứ Năm?",
        "answers": [
            {"content": "R.", "correct": False},
            {"content": "S.", "correct": False},
            {"content": "K.", "correct": True},
            {"content": "J.", "correct": False},
        ]
    },
    {
        "pos": 95, "part": 4, "content": "6 người H,I,J,K,L,M ở phòng 1-6. H bên trái L, J kề M, K không kề M, L ở phòng 4. Danh sách nào thoả mãn?",
        "answers": [
            {"content": "K, M, H, L, I, J.", "correct": True},
            {"content": "H, K, I, L, J, M.", "correct": False},
            {"content": "J, M, K, L, H, I.", "correct": False},
            {"content": "M, H, L, K, I, J.", "correct": False},
        ]
    },
    {
        "pos": 96, "part": 4, "content": "Nếu H và J ở hai phòng kề nhau thì khẳng định nào không đúng?",
        "answers": [
            {"content": "M không ở phòng bên cạnh phòng của H.", "correct": False},
            {"content": "I ở phòng bên cạnh phòng của K.", "correct": True},
            {"content": "L ở phòng bên cạnh phòng của J.", "correct": False},
            {"content": "K không ở phòng bên cạnh phòng của L.", "correct": False},
        ]
    },
    {
        "pos": 97, "part": 4, "content": "Nếu M ở phòng số 2 thì điều nào không thể đúng?",
        "answers": [
            {"content": "M ở phòng bên cạnh phòng của H và J.", "correct": False},
            {"content": "L ở phòng bên cạnh phòng của J và K.", "correct": True},
            {"content": "I ở phòng bên cạnh phòng của L và K.", "correct": False},
            {"content": "H ở phòng bên cạnh phòng của M và K.", "correct": False},
        ]
    },
    {
        "pos": 98, "part": 4, "content": "Hai người nào không thể ở hai phòng ngay bên cạnh nhau?",
        "answers": [
            {"content": "K và L.", "correct": False},
            {"content": "H và M.", "correct": False},
            {"content": "I và J.", "correct": False},
            {"content": "H và J.", "correct": True},
        ]
    },
    {
        "pos": 99, "part": 4, "content": "Số lượng cam bán được trong ngày thứ hai là (theo bảng dữ liệu bán hàng trái cây)",
        "answers": [
            {"content": "30 kg.", "correct": False},
            {"content": "25 kg.", "correct": True},
            {"content": "15 kg.", "correct": False},
            {"content": "20 kg.", "correct": False},
        ]
    },
    {
        "pos": 100, "part": 4, "content": "Trong ba ngày, giá bán trung bình của chuối là",
        "answers": [
            {"content": "15.000 đồng/kg.", "correct": False},
            {"content": "14.000 đồng/kg.", "correct": False},
            {"content": "12.000 đồng/kg.", "correct": True},
            {"content": "10.000 đồng/kg.", "correct": False},
        ]
    },
    {
        "pos": 101, "part": 4, "content": "Trong ba ngày, giá bán trung bình của mít là",
        "answers": [
            {"content": "34.700 đồng/kg.", "correct": False},
            {"content": "31.200 đồng/kg.", "correct": False},
            {"content": "32.100 đồng/kg.", "correct": False},
            {"content": "33.600 đồng/kg.", "correct": True},
        ]
    },
    {
        "pos": 102, "part": 4, "content": "Giá bán mít ở ngày thứ hai là",
        "answers": [
            {"content": "40.000 đồng/kg.", "correct": False},
            {"content": "30.000 đồng/kg.", "correct": True},
            {"content": "45.000 đồng/kg.", "correct": False},
            {"content": "35.000 đồng/kg.", "correct": False},
        ]
    },
    {
        "pos": 103, "part": 4, "content": "Xét 4 cân bằng hoá học, khi thay đổi áp suất, có bao nhiêu phản ứng không bị thay đổi chuyển dịch?",
        "answers": [
            {"content": "2.", "correct": False},
            {"content": "3.", "correct": True},
            {"content": "1.", "correct": False},
            {"content": "4.", "correct": False},
        ]
    },
    {
        "pos": 104, "part": 4, "content": "Tổng hợp methanol: CO(k) + H₂(k) ↔ CH₃OH(k), phản ứng tỏa nhiệt. Để chuyển dịch cân bằng theo chiều tạo metanol, quá trình nên thực hiện ở",
        "answers": [
            {"content": "nhiệt độ thấp và áp suất cao.", "correct": True},
            {"content": "nhiệt độ cao và áp suất cao.", "correct": False},
            {"content": "nhiệt độ thấp và áp suất thấp.", "correct": False},
            {"content": "nhiệt độ cao và áp suất thấp.", "correct": False},
        ]
    },
    {
        "pos": 105, "part": 4, "content": "Nhị hợp khí NO₂ tạo thành N₂O₄. Cho 18,4g N₂O₄ vào bình chân không. Nhận định nào đúng về độ phân li?",
        "answers": [
            {"content": "Độ phân li tăng dần khi nhiệt độ tăng dần, phản ứng toả nhiệt.", "correct": False},
            {"content": "Độ phân li tăng dần khi nhiệt độ tăng dần, phản ứng thu nhiệt.", "correct": True},
            {"content": "Độ phân li giảm dần khi nhiệt độ tăng dần, phản ứng thu nhiệt.", "correct": False},
            {"content": "Độ phân li giảm dần khi nhiệt độ tăng dần, phản ứng toả nhiệt.", "correct": False},
        ]
    },
    {
        "pos": 106, "part": 4, "content": "F₁ là lực hấp dẫn của Trái Đất tác dụng lên Mặt Trời và F₂ là lực hấp dẫn của Mặt Trời tác dụng lên Trái Đất. So sánh F₁ và F₂?",
        "answers": [
            {"content": "F₁ lớn hơn một chút so với F₂.", "correct": False},
            {"content": "F₁ bằng với F₂.", "correct": True},
            {"content": "F₁ nhỏ hơn một chút so với F₂.", "correct": False},
            {"content": "F₁ nhỏ hơn rất nhiều so với F₂.", "correct": False},
        ]
    },
    {
        "pos": 107, "part": 4, "content": "Gia tốc rơi tự do trên bề mặt Trái Đất là 9,8 m/s², bán kính 6400 km. Để đạt gia tốc 9,6 m/s² phải ở độ cao bao nhiêu?",
        "answers": [
            {"content": "65 km.", "correct": False},
            {"content": "57 km.", "correct": True},
            {"content": "62 km.", "correct": False},
            {"content": "67 km.", "correct": False},
        ]
    },
    {
        "pos": 108, "part": 4, "content": "Sao Thủy có khối lượng bằng 0,055 lần Trái Đất, đường kính bằng 0,381 lần. Gia tốc rơi tự do ở bề mặt Sao Thủy là bao nhiêu?",
        "answers": [
            {"content": "0,21 m/s².", "correct": False},
            {"content": "1,41 m/s².", "correct": False},
            {"content": "3,71 m/s².", "correct": True},
            {"content": "5,5 m/s².", "correct": False},
        ]
    },
    {
        "pos": 109, "part": 4, "content": "Nếu trong môi trường có cả lactose và glucose với nồng độ cao thì hoạt động điều hòa biểu hiện gen trong E.coli sẽ",
        "answers": [
            {"content": "chỉ sử dụng glucose và không tổng hợp lactose.", "correct": False},
            {"content": "không tổng hợp nếu không xuất hiện protein điều hòa.", "correct": False},
            {"content": "chỉ sử dụng lactose khi có số lượng lactose đủ lớn.", "correct": False},
            {"content": "chỉ sử dụng lactose khi lượng glucose khan hiếm.", "correct": True},
        ]
    },
    {
        "pos": 110, "part": 4, "content": "Trong operon lactose, vùng khởi động (promoter) là nơi",
        "answers": [
            {"content": "ARN polimerase bám vào và khởi đầu phiên mã.", "correct": True},
            {"content": "mang thông tin quy định cấu trúc các enzim phân giải đường lactose.", "correct": False},
            {"content": "protein ức chế có thể liên kết vào để ngăn cản phiên mã.", "correct": False},
            {"content": "mang thông tin quy định cấu trúc protein ức chế.", "correct": False},
        ]
    },
    {
        "pos": 111, "part": 4, "content": "Sự điều hòa của operon lactose sẽ không xảy ra nếu",
        "answers": [
            {"content": "nồng độ glucose quá cao hoặc không có lactose trong môi trường.", "correct": False},
            {"content": "nồng độ cAMP giảm đi và CAP giảm ái lực với vùng khởi động.", "correct": False},
            {"content": "cAMP không thể liên kết và tương tác với protein điều hòa.", "correct": True},
            {"content": "nồng độ ARN polymerase bị suy giảm nghiêm trọng.", "correct": False},
        ]
    },
    {
        "pos": 112, "part": 4, "content": "Theo bài viết, mỗi năm dân số thành phố gia tăng do chuyển cư là",
        "answers": [
            {"content": "1 triệu người.", "correct": False},
            {"content": "200.000 người.", "correct": False},
            {"content": "250.000 người.", "correct": True},
            {"content": "500.000 người.", "correct": False},
        ]
    },
    {
        "pos": 113, "part": 4, "content": "Giải pháp lâu dài cho vấn đề phát triển đô thị của TPHCM là gì?",
        "answers": [
            {"content": "Quy hoạch lại vành đai nông nghiệp các huyện ngoại thành.", "correct": False},
            {"content": "Phát triển các trung tâm dịch vụ vệ tinh ở bên ngoài thành phố.", "correct": False},
            {"content": "Thêm cực phát triển để giảm sức ép cho trung tâm hiện tại.", "correct": True},
            {"content": "Chuyển nhanh sang thành trung tâm quốc tế, dịch vụ, y tế.", "correct": False},
        ]
    },
    {
        "pos": 114, "part": 4, "content": "Theo bài viết, TPHCM đang thiếu những gì về cơ sở hạ tầng?",
        "answers": [
            {"content": "Cơ sở y tế.", "correct": False},
            {"content": "Xe bus, tàu điện ngầm.", "correct": False},
            {"content": "Trung tâm thương mại, siêu thị.", "correct": False},
            {"content": "Cơ sở giáo dục.", "correct": True},
        ]
    },
    {
        "pos": 115, "part": 4, "content": "Hiệp định Pari năm 1973 thừa nhận thực tế miền Nam Việt Nam có",
        "answers": [
            {"content": "2 chính quyền, 3 quân đội, 3 lực lượng chính trị, 2 vùng kiểm soát.", "correct": False},
            {"content": "2 chính quyền, 2 quân đội, 3 lực lượng chính trị, 3 vùng kiểm soát.", "correct": False},
            {"content": "2 chính quyền, 2 quân đội, 3 lực lượng chính trị, 2 vùng kiểm soát.", "correct": True},
            {"content": "2 chính quyền, 2 quân đội, 2 lực lượng chính trị, 3 vùng kiểm soát.", "correct": False},
        ]
    },
    {
        "pos": 116, "part": 4, "content": "Bốn nước trong Uỷ ban Giám sát và Kiểm soát quốc tế tham gia Hiệp định Pari gồm có:",
        "answers": [
            {"content": "Liên Xô, Trung Quốc, Anh, Pháp.", "correct": False},
            {"content": "In-đô-nê-xi-a, Ca-na-đa, Ba Lan, Hung-ga-ri.", "correct": True},
            {"content": "Ba Lan, Trung Quốc, Ca-na-đa, Pháp.", "correct": False},
            {"content": "Ba Lan, Hung-ga-ri, In-đô-nê-xi-a, Trung Quốc.", "correct": False},
        ]
    },
    {
        "pos": 117, "part": 4, "content": "Điều khoản nào trong Hiệp định Pari có ý nghĩa quyết định đối với cuộc kháng chiến chống Mĩ cứu nước?",
        "answers": [
            {"content": "Hai bên ngừng bắn và giữ nguyên vị trí ở miền Nam.", "correct": False},
            {"content": "Nhân dân miền Nam tự quyết định tương lai chính trị.", "correct": False},
            {"content": "Các bên thừa nhận thực tế ở miền Nam có hai chính quyền.", "correct": False},
            {"content": "Hoa Kì rút hết quân viễn chinh và quân các nước đồng minh.", "correct": True},
        ]
    },
    {
        "pos": 118, "part": 4, "content": "Theo Navigos Search, nguyên nhân chính dẫn đến làn sóng sa thải lớn trong ngành CNTT toàn cầu cuối 2023 là do",
        "answers": [
            {"content": "các công ty lớn bị suy giảm vốn hoá thị trường sau đại dịch.", "correct": False},
            {"content": "các công ty không còn nhu cầu tuyển dụng các vị trí chuyên viên.", "correct": False},
            {"content": "các công ty liên tục tuyển dụng sau đại dịch COVID-19 nhưng không đảm bảo hoạt động hiệu quả.", "correct": True},
            {"content": "các công ty lập chính sách cắt giảm chi phí, tập trung vào đầu tư nước ngoài.", "correct": False},
        ]
    },
    {
        "pos": 119, "part": 4, "content": "Nhận định nào KHÔNG chính xác về thị trường việc làm ngành CNTT tại Việt Nam?",
        "answers": [
            {"content": "Các công ty có nhu cầu lựa chọn nhân sự phù hợp với việc cạnh tranh và phát triển bền vững.", "correct": False},
            {"content": "Các vị trí việc làm liên quan đến học máy và trí tuệ nhân tạo đang trở thành xu hướng tuyển dụng.", "correct": False},
            {"content": "Ngành CNTT tại Việt Nam vẫn có cơ hội phát triển thuận lợi dù bị tác động bởi làn sóng sa thải.", "correct": False},
            {"content": "Nhu cầu tuyển dụng nhân sự có kinh nghiệm trong ngành có xu hướng tăng ở nửa cuối năm 2023.", "correct": True},
        ]
    },
    {
        "pos": 120, "part": 4, "content": "Trong bối cảnh thị trường việc làm ngành CNTT, theo góc nhìn lập trình viên, bạn sẽ làm gì để tăng cơ hội được tuyển dụng?",
        "answers": [
            {"content": "Xây dựng mối quan hệ tốt với các nhà tuyển dụng.", "correct": False},
            {"content": "Tập trung phát triển thế mạnh ở một lĩnh vực duy nhất.", "correct": False},
            {"content": "Theo dõi và cập nhật các xu hướng công nghệ hiện tại.", "correct": True},
            {"content": "Tích luỹ kinh nghiệm về vấn đề quản lý và vận hành.", "correct": False},
        ]
    },
]

PART_NAMES = {1: "Tiếng Việt", 2: "Tiếng Anh", 3: "Toán học", 4: "Tư duy khoa học"}

KNOWLEDGE_TREE = {
    1: {"Tiếng Việt": {"Ngữ pháp": ["Chính tả", "Từ vựng", "Cú pháp"], "Đọc hiểu": ["Phân tích tác phẩm", "Hiểu văn bản", "Biện pháp tu từ"], "Văn học": ["Truyện", "Thơ", "Phê bình"]}},
    2: {"Tiếng Anh": {"Grammar": ["Tense", "Articles", "Prepositions"], "Reading": ["Comprehension", "Vocabulary", "Error identification"], "Writing": ["Sentence restructuring", "Paraphrase"]}},
    3: {"Toán học": {"Đại số": ["Tập hợp", "Bất phương trình", "Phương trình"], "Hàm số": ["Đạo hàm", "Cực trị", "Nguyên hàm"], "Xác suất": ["Xác suất", "Thống kê"], "Hình học": ["Tọa độ", "Hình chóp", "Mặt cầu"], "Số học": ["Cấp số", "Tổ hợp"]}},
    4: {"Tư duy khoa học": {"Logic": ["Sắp xếp", "Phân tích số liệu"], "Khoa học tự nhiên": ["Hoá học", "Vật lý", "Sinh học"], "Khoa học xã hội": ["Địa lý", "Lịch sử", "Kinh tế"]}},
}


async def seed():
    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Get admin user as creator
            admin_result = await session.execute(text("SELECT id FROM \"user\" WHERE username = 'admin'"))
            admin_id = admin_result.scalar()
            if not admin_id:
                raise Exception("Admin user not found!")

            # Get student role
            role_result = await session.execute(text("SELECT id FROM role WHERE name = 'STUDENT'"))
            student_role_id = role_result.scalar()
            if not student_role_id:
                raise Exception("Student role not found!")

            # 1. Create knowledge nodes
            print("=== Creating knowledge nodes ===")
            node_map = {}
            node_id_counter = 1

            for part_num, topics in KNOWLEDGE_TREE.items():
                for topic_name, concepts in topics.items():
                    topic_node = KnowledgeNode(id=node_id_counter, name=topic_name, node_type=KnowledgeNodeType.TOPIC, subject=PART_NAMES[part_num], is_leaf=False)
                    session.add(topic_node)
                    node_map[("topic", part_num, topic_name)] = node_id_counter
                    node_id_counter += 1

                    for concept_name, skills in concepts.items():
                        concept_node = KnowledgeNode(id=node_id_counter, name=concept_name, node_type=KnowledgeNodeType.CONCEPT, subject=PART_NAMES[part_num], is_leaf=False)
                        session.add(concept_node)
                        node_map[("concept", part_num, topic_name, concept_name)] = node_id_counter
                        node_id_counter += 1

                        for skill_name in skills:
                            skill_node = KnowledgeNode(id=node_id_counter, name=skill_name, node_type=KnowledgeNodeType.SKILL, subject=PART_NAMES[part_num], is_leaf=True)
                            session.add(skill_node)
                            node_map[("skill", part_num, topic_name, concept_name, skill_name)] = node_id_counter
                            node_id_counter += 1

            await session.flush()
            print(f"Created {node_id_counter - 1} knowledge nodes")

            # 2. Create questions
            print("=== Creating questions ===")
            question_map = {}
            q_id_counter = 1
            skill_keys = [k for k in node_map.keys() if k[0] == "skill"]

            for q_data in QUESTIONS:
                pos = q_data["pos"]
                part = q_data["part"]
                part_skills = [k for k in skill_keys if k[1] == part]
                kn_id = node_map[random.choice(part_skills)] if part_skills else 1

                question = Question(id=q_id_counter, content=q_data["content"], level=2, type=QuestionType.SINGLE_CHOICE, status=QuestionStatus.APPROVED, knowledge_node_id=kn_id, creator_id=admin_id)
                session.add(question)
                question_map[pos] = q_id_counter
                q_id_counter += 1

                for ans_idx, ans_data in enumerate(q_data["answers"]):
                    answer = Answer(question_id=question.id, content=ans_data["content"], is_correct=ans_data["correct"], position=ans_idx + 1)
                    session.add(answer)

            await session.flush()
            print(f"Created {q_id_counter - 1} questions")

            # 3. Create matrix
            print("=== Creating matrix ===")
            matrix = Matrix(id=1, name="Ma trận ĐGNL - Kỳ thi thử lần 1", subject="ĐGNL", description="120 câu: 30 TV + 30 TA + 30 Toán + 30 TDKH")
            session.add(matrix)

            for part_num in [1, 2, 3, 4]:
                part_skills = [k for k in skill_keys if k[1] == part_num]
                count_per = 30 // max(len(part_skills), 1)
                remainder = 30 % max(len(part_skills), 1)
                for idx, sk_key in enumerate(part_skills):
                    cnt = count_per + (1 if idx < remainder else 0)
                    rule = MatrixRule(matrix_id=1, knowledge_node_id=node_map[sk_key], count=cnt, part=part_num, level=2)
                    session.add(rule)

            await session.flush()
            print("Created matrix")

            # 4. Create exam + form
            print("=== Creating exam ===")
            exam = Exam(id=1, name="Kỳ thi thử ĐGNL lần thứ nhất", description="120 câu, 150 phút", matrix_id=1, allow_omr=True, status=ExamStatus.PUBLISHED, start_time=datetime(2026, 9, 15, 7, 0), end_time=datetime(2026, 9, 15, 9, 30), duration_minutes=150, max_attempts=1)
            session.add(exam)

            form = ExamForm(id=1, exam_id=1, code="161", is_original=True)
            session.add(form)

            for q_data in QUESTIONS:
                pos = q_data["pos"]
                part = q_data["part"]
                q_id = question_map[pos]

                efq = ExamFormQuestion(exam_form_id=1, question_id=q_id, position=pos, part=part)
                session.add(efq)
                await session.flush()

                ans_result = await session.execute(text("SELECT id, position FROM answer WHERE question_id = :qid ORDER BY position"), {"qid": q_id})
                for orig_pos, (ans_id, _) in enumerate(ans_result.fetchall()):
                    efa = ExamFormAnswer(exam_form_question_id=efq.id, answer_id=ans_id, new_position=orig_pos + 1)
                    session.add(efa)

            await session.flush()
            print("Created exam form")

            # 5. Create 1000 students
            print("=== Creating 1000 students ===")
            default_pwd = STUDENT_PASSWORD_HASH
            students = []

            for i in range(1, 1001):
                sbd = f"{900000 + i:06d}"
                uid = 10000 + i
                student = User(id=uid, full_name=f"Thí sinh {i:04d}", username=f"sv{i:04d}", email=f"sv{i:04d}@mitexams.com", registration_number=sbd, hashed_password=default_pwd, role_id=student_role_id, is_active=True)
                session.add(student)
                students.append((uid, sbd))

            await session.flush()
            print(f"Created 1000 students (ID 10001-11000)")

            # 6. Assign to exam
            print("=== Assigning students ===")
            for idx, (uid, sbd) in enumerate(students):
                mode = ExamMode.ONLINE if idx < 500 else ExamMode.PAPER
                ep = ExamParticipant(exam_id=1, user_id=uid, sbd=sbd, attempt_number=1, exam_mode=mode, status=ParticipantStatus.NOT_STARTED)
                session.add(ep)

            await session.flush()
            print("Assigned 500 online + 500 offline")

            # 7. Get correct answers
            correct_result = await session.execute(text("SELECT question_id, id FROM answer WHERE is_correct = true"))
            correct_map = dict(correct_result.fetchall())

            # 8. Simulate submissions
            print("=== Simulating submissions ===")
            random.seed(42)
            sub_id = 1
            res_id = 1

            for idx, (uid, sbd) in enumerate(students):
                ep_result = await session.execute(text("SELECT id FROM exam_participant WHERE user_id = :uid AND exam_id = 1"), {"uid": uid})
                ep_id = ep_result.scalar()

                submission = ExamSubmission(id=sub_id, exam_participant_id=ep_id, submit_time=datetime(2026, 9, 15, 9, 0) + timedelta(minutes=random.randint(0, 30)))
                session.add(submission)
                await session.execute(text("UPDATE exam_participant SET status = 'SUBMITTED', submit_time = :st WHERE id = :epid"), {"st": submission.submit_time, "epid": ep_id})

                part_scores = {1: 0, 2: 0, 3: 0, 4: 0}
                item_scores = {}

                for q_data in QUESTIONS:
                    pos = q_data["pos"]
                    part = q_data["part"]
                    q_id = question_map[pos]

                    efq_r = await session.execute(text("SELECT id FROM exam_form_question WHERE exam_form_id = 1 AND position = :pos"), {"pos": pos})
                    efq_id = efq_r.scalar()

                    is_correct = random.random() < 0.70
                    if is_correct and q_id in correct_map:
                        sel_aid = correct_map[q_id]
                        score = 1.0
                    else:
                        wrong_r = await session.execute(text("SELECT id FROM answer WHERE question_id = :qid AND is_correct = false"), {"qid": q_id})
                        wrongs = wrong_r.fetchall()
                        sel_aid = random.choice(wrongs)[0] if wrongs else None
                        score = 0.0

                    part_scores[part] += score
                    item_scores[str(pos)] = score

                    esa = ExamSubmissionAnswer(exam_submission_id=sub_id, exam_form_question_id=efq_id, selected_answer_id=sel_aid, score=score)
                    session.add(esa)

                er = ExamResult(id=res_id, exam_submission_id=sub_id, ctt_score_part1=part_scores[1], ctt_score_part2=part_scores[2], ctt_score_part3=part_scores[3], ctt_score_part4=part_scores[4], raw_total_score=sum(part_scores.values()), item_scores=item_scores, score_method="CTT")
                session.add(er)

                sub_id += 1
                res_id += 1
                if (idx + 1) % 200 == 0:
                    print(f"  {idx + 1}/1000...")

            await session.flush()
            print(f"Created {sub_id - 1} submissions + results")

            print("\n=== DONE ===")
            print(f"Knowledge nodes: {node_id_counter - 1}")
            print(f"Questions: 120")
            print(f"Exam: code 161, PUBLISHED")
            print(f"Students: 1000 (500 online, 500 offline)")
            print(f"\nTest accounts:")
            print(f"  Admin: admin / Admin@123")
            print(f"  Student: sv0001 / Student@123")


if __name__ == "__main__":
    asyncio.run(seed())
