import io
import os
import zipfile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.exam import Exam, ExamForm, ExamFormQuestion, ExamFormAnswer
from app.models.question import Question, KnowledgeNode

class LatexService:
    @staticmethod
    def _map_subject_to_folder(node_name: str) -> str:
        import unicodedata
        def remove_accents(input_str):
            nfkd_form = unicodedata.normalize('NFKD', input_str)
            return u"".join([c for c in nfkd_form if not unicodedata.combining(c)])
            
        name = remove_accents(node_name.lower())
        
        # Tiếng Anh
        if any(k in name for k in ["tieng anh", "english", "grammar", "vocab", "reading", "cloze", "sentence", "phrasal", "word formation", "error ident", "idiom", "para completion", "inference"]):
            return "ta"
            
        # Tiếng Việt
        if any(k in name for k in ["tieng viet", "ngon ngu", "thanh ngu", "chinh ta", "chon tu", "hieu dan giai", "phan tich doan", "sap xep", "bat thong tin", "tom tat"]):
            return "tv"
            
        # Toán
        if any(k in name for k in ["toan", "dai so", "hinh hoc", "ham so", "xac suat", "phuong trinh", "oxy", "so phuc", "luy thua", "logarithm", "to hop", "vector"]):
            return "toan"
            
        # Logic
        if any(k in name for k in ["logic", "suy luan sang tao", "nhan dien mau"]):
            return "logic"
            
        # Phân tích số liệu
        if any(k in name for k in ["so lieu", "bieu do", "du lieu"]):
            return "ptsl"
            
        # Khoa học
        if any(k in name for k in ["khoa hoc", "ly", "hoa", "sinh", "thi nghiem", "vat ly", "gia thuyet", "nguyen nhan"]):
            return "slkh"
            
        return "other"
        
    @staticmethod
    def _determine_choice_macro(answers: list) -> str:
        # Heuristic to choose \choiceFour, \choiceTwo, \choiceOne
        # based on the max length of the answers
        if not answers:
            return ""
        max_len = max([len(a.content) for a in answers])
        if max_len > 35:
            return "choiceOne"
        if max_len > 15:
            return "choiceTwo"
        return "choiceFour"

    @staticmethod
    async def generate_latex_zip(db: AsyncSession, exam_id: int, form_code: str = None) -> bytes:
        # 1. Get Exam
        exam_result = await db.execute(select(Exam).where(Exam.id == exam_id))
        exam = exam_result.scalars().first()
        if not exam:
            raise ValueError("Không tìm thấy kỳ thi")

        # 2. Get Form
        stmt = select(ExamForm).where(ExamForm.exam_id == exam_id)
        if form_code:
            stmt = stmt.where(ExamForm.code == form_code)
        else:
            stmt = stmt.where(ExamForm.is_original == True)
            
        form_result = await db.execute(stmt)
        form = form_result.scalars().first()
        if not form:
            raise ValueError("Không tìm thấy mã đề")

        # 3. Get Questions and Answers mapped to Form
        q_stmt = select(ExamFormQuestion).options(
            selectinload(ExamFormQuestion.question_ref).selectinload(Question.passage),
            selectinload(ExamFormQuestion.question_ref).selectinload(Question.knowledge_node)
        ).where(ExamFormQuestion.exam_form_id == form.id).order_by(ExamFormQuestion.position)
        q_result = await db.execute(q_stmt)
        form_questions = q_result.scalars().all()
        
        a_stmt = select(ExamFormAnswer).options(selectinload(ExamFormAnswer.answer_ref)).join(ExamFormQuestion).where(ExamFormQuestion.exam_form_id == form.id)
        a_result = await db.execute(a_stmt)
        form_answers = a_result.scalars().all()
        
        answers_by_fq = {}
        for ans in form_answers:
            if ans.exam_form_question_id not in answers_by_fq:
                answers_by_fq[ans.exam_form_question_id] = []
            answers_by_fq[ans.exam_form_question_id].append(ans)
            
        for fq_id in answers_by_fq:
            answers_by_fq[fq_id].sort(key=lambda x: x.new_position)

        # 4. Group by Subject
        subject_data = {
            "tv": {"single": [], "passages": {}},
            "ta": {"single": [], "passages": {}},
            "toan": {"single": [], "passages": {}},
            "logic": {"single": [], "passages": {}},
            "ptsl": {"single": [], "passages": {}},
            "slkh": {"single": [], "passages": {}},
            "other": {"single": [], "passages": {}}
        }

        for fq in form_questions:
            orig_q = fq.question_ref
            subject = LatexService._map_subject_to_folder(orig_q.knowledge_node.name) if orig_q.knowledge_node else "other"

            render_style = getattr(orig_q, 'render_style', 'standard')
            
            if render_style == "error_detection":
                import re
                pattern = r'\[(.*?)\]\{\.answer-error\}'
                parts = re.split(pattern, orig_q.content)
                if len(parts) == 9:
                    # parts are: [text0, span1, text1, span2, text2, span3, text3, span4, text4]
                    escaped_parts = [p.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#') for p in parts]
                    q_block = r"\errorq{" + "}{".join(escaped_parts) + "}"
                else:
                    # Fallback if invalid
                    q_content = orig_q.content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                    q_block = rf"\q{{{q_content}}}"
            else:
                q_content = orig_q.content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                
                # Format answers
                answers = answers_by_fq.get(fq.id, [])
                ans_latex = ""
                if len(answers) == 4:
                    macro_name = LatexService._determine_choice_macro([a.answer_ref for a in answers])
                    a1 = answers[0].answer_ref.content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                    a2 = answers[1].answer_ref.content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                    a3 = answers[2].answer_ref.content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                    a4 = answers[3].answer_ref.content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                    ans_latex = rf"\{macro_name}{{{a1}}}{{{a2}}}{{{a3}}}{{{a4}}}"
                
                q_block = rf"\q{{{q_content}}}"
                if ans_latex:
                    q_block += "\n" + ans_latex

            if orig_q.passage_id:
                if orig_q.passage_id not in subject_data[subject]["passages"]:
                    p_content = orig_q.passage.content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                    subject_data[subject]["passages"][orig_q.passage_id] = {
                        "content": p_content,
                        "questions": []
                    }
                subject_data[subject]["passages"][orig_q.passage_id]["questions"].append(q_block)
            else:
                subject_data[subject]["single"].append(q_block)


        # 5. Create ZIP in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
            
            # Read preamble and macros from templates
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            template_dir = os.path.join(base_dir, "templates", "latex")
            
            try:
                with open(os.path.join(template_dir, "preamble.tex"), "r", encoding="utf-8") as f:
                    zipf.writestr("preamble.tex", f.read())
            except Exception:
                zipf.writestr("preamble.tex", "% Missing preamble")
                
            try:
                with open(os.path.join(template_dir, "macros.tex"), "r", encoding="utf-8") as f:
                    zipf.writestr("macros.tex", f.read())
            except Exception:
                zipf.writestr("macros.tex", "% Missing macros")

            main_lines = [
                r"\documentclass[12pt,a4paper]{article}",
                r"",
                r"\input{preamble}",
                r"\input{macros}",
                r"",
                r"\begin{document}",
                r"\pagestyle{fancy}",
                rf"\renewcommand{{\examcode}}{{{form.code}}}",
                r"\makeexamheader"
            ]

            reading_counters = {k: 1 for k in subject_data.keys()}
            
            def render_subject(subject_key: str):
                lines = []
                data = subject_data[subject_key]
                if not data["single"] and not data["passages"]:
                    return lines
                
                if data["single"]:
                    zipf.writestr(f"content/{subject_key}/single.tex", "\n\n".join(data["single"]))
                    lines.append(rf"\inputspace{{content/{subject_key}/single}}")
                    
                for p_id, p_data in data["passages"].items():
                    idx = reading_counters[subject_key]
                    reading_counters[subject_key] += 1
                    p_str = rf"\reading{{{len(p_data['questions'])}}}{{{p_data['content']}}}" + "\n\n" + "\n\n".join(p_data["questions"])
                    zipf.writestr(f"content/{subject_key}/reading{idx}.tex", p_str)
                    lines.append(rf"\inputspace{{content/{subject_key}/reading{idx}}}")
                return lines

            # Build exact structure based on data/main.tex
            
            # PHẦN 1
            part1_lines = []
            tv_lines = render_subject("tv")
            if tv_lines:
                part1_lines.extend([r"\subsection*{1.1. TIẾNG VIỆT}"] + tv_lines)
                
            ta_lines = render_subject("ta")
            if ta_lines:
                part1_lines.extend([r"\subsection*{1.2. TIẾNG ANH}"] + ta_lines)
                
            if part1_lines:
                main_lines.append(r"%======================")
                main_lines.append(r"\section*{PHẦN 1: SỬ DỤNG NGÔN NGỮ}")
                main_lines.extend(part1_lines)

            # PHẦN 2
            part2_lines = render_subject("toan")
            if part2_lines:
                main_lines.append(r"%======================")
                main_lines.append(r"\section*{PHẦN 2: TOÁN HỌC}")
                main_lines.extend(part2_lines)
                
            # PHẦN 3
            part3_lines = []
            logic_ptsl_lines = []
            logic_lines = render_subject("logic")
            if logic_lines:
                logic_ptsl_lines.extend(logic_lines)
            ptsl_lines = render_subject("ptsl")
            if ptsl_lines:
                logic_ptsl_lines.extend(ptsl_lines)
                
            if logic_ptsl_lines:
                part3_lines.extend([r"\subsection*{3.1. LOGIC, PHÂN TÍCH SỐ LIỆU}"] + logic_ptsl_lines)
                
            slkh_lines = render_subject("slkh")
            if slkh_lines:
                part3_lines.extend([r"\subsection*{3.2. SUY LUẬN KHOA HỌC}"] + slkh_lines)
                
            if part3_lines:
                main_lines.append(r"%======================")
                main_lines.append(r"\section*{PHẦN 3: TƯ DUY KHOA HỌC}")
                main_lines.extend(part3_lines)
                
            # (PHẦN KHÁC has been intentionally removed)
            main_lines.extend([
                r"%======================",
                r"",
                r"\end{document}"
            ])
            
            zipf.writestr("main.tex", "\n".join(main_lines))

        zip_buffer.seek(0)
        return zip_buffer.read()
