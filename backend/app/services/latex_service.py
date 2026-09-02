import io
import os
import zipfile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.exam import Exam, ExamForm, ExamFormQuestion, ExamFormAnswer
from app.models.question import Question, QuestionSkillTag
from app.models.knowledge import KnowledgeNode

class LatexService:
    @staticmethod
    def _map_subject_to_folder(node_name: str) -> str:
        name = node_name.lower()
        if "tiếng việt" in name: return "tv"
        if "tiếng anh" in name: return "ta"
        if "toán" in name: return "toan"
        if "logic" in name: return "logic"
        if "phân tích số liệu" in name: return "ptsl"
        if "khoa học" in name or "lý" in name or "hóa" in name or "sinh" in name: return "slkh"
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
            selectinload(ExamFormQuestion.original_question).selectinload(Question.passage),
            selectinload(ExamFormQuestion.original_question).selectinload(Question.skill_tags).selectinload(QuestionSkillTag.knowledge_node)
        ).where(ExamFormQuestion.exam_form_id == form.id).order_by(ExamFormQuestion.position)
        q_result = await db.execute(q_stmt)
        form_questions = q_result.scalars().all()
        
        a_stmt = select(ExamFormAnswer).where(ExamFormAnswer.exam_form_id == form.id)
        a_result = await db.execute(a_stmt)
        form_answers = a_result.scalars().all()
        
        answers_by_question = {}
        for ans in form_answers:
            if ans.question_id not in answers_by_question:
                answers_by_question[ans.question_id] = []
            answers_by_question[ans.question_id].append(ans)
            
        for q_id in answers_by_question:
            answers_by_question[q_id].sort(key=lambda x: x.position)

        # 4. Group by Subject and Passage
        folders = {}
        for folder_name in ["tv", "ta", "toan", "logic", "ptsl", "slkh", "other"]:
            folders[folder_name] = {"single": [], "passages": {}}

        for fq in form_questions:
            orig_q = fq.original_question
            
            folder = "other"
            if orig_q.skill_tags:
                primary_tag = next((t for t in orig_q.skill_tags if t.is_primary), orig_q.skill_tags[0])
                folder = LatexService._map_subject_to_folder(primary_tag.knowledge_node.name)

            q_content = orig_q.content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
            
            # Format answers
            answers = answers_by_question.get(orig_q.id, [])
            ans_latex = ""
            if len(answers) == 4:
                macro_name = LatexService._determine_choice_macro(answers)
                a1 = answers[0].content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                a2 = answers[1].content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                a3 = answers[2].content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                a4 = answers[3].content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                ans_latex = rf"\{macro_name}{{{a1}}}{{{a2}}}{{{a3}}}{{{a4}}}"
            
            q_block = rf"\q{{{q_content}}}"
            if ans_latex:
                q_block += "\n" + ans_latex

            if orig_q.passage_id:
                if orig_q.passage_id not in folders[folder]["passages"]:
                    p_content = orig_q.passage.content.replace('_', r'\_').replace('%', r'\%').replace('$', r'\$').replace('#', r'\#')
                    folders[folder]["passages"][orig_q.passage_id] = {
                        "content": p_content,
                        "questions": []
                    }
                folders[folder]["passages"][orig_q.passage_id]["questions"].append(q_block)
            else:
                folders[folder]["single"].append(q_block)


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

            # Build main.tex
            main_lines = [
                r"\documentclass[12pt,a4paper]{article}",
                r"",
                r"\input{preamble}",
                r"\input{macros}",
                r"",
                r"\begin{document}",
                r"\pagestyle{fancy}",
                rf"\renewcommand{{\examcode}}{{{form.code}}}",
                r"\makeexamheader",
                r"%======================"
            ]

            reading_counters = {k: 1 for k in folders.keys()}
            
            # Tiếng Việt
            if len(folders["tv"]["single"]) > 0 or len(folders["tv"]["passages"]) > 0:
                main_lines.append(r"\section*{PHẦN 1: SỬ DỤNG NGÔN NGỮ}")
                main_lines.append(r"\subsection*{1.1. TIẾNG VIỆT}")
                if folders["tv"]["single"]:
                    zipf.writestr("content/tv/single.tex", "\n\n".join(folders["tv"]["single"]))
                    main_lines.append(r"\inputspace{content/tv/single}")
                for p_id, p_data in folders["tv"]["passages"].items():
                    idx = reading_counters["tv"]
                    reading_counters["tv"] += 1
                    p_str = rf"\reading{{{len(p_data['questions'])}}}{{{p_data['content']}}}" + "\n\n" + "\n\n".join(p_data["questions"])
                    zipf.writestr(f"content/tv/reading{idx}.tex", p_str)
                    main_lines.append(rf"\inputspace{{content/tv/reading{idx}}}")
                    
            # Tiếng Anh
            if len(folders["ta"]["single"]) > 0 or len(folders["ta"]["passages"]) > 0:
                # If section 1 not added yet
                if "PHẦN 1:" not in "".join(main_lines):
                    main_lines.append(r"\section*{PHẦN 1: SỬ DỤNG NGÔN NGỮ}")
                main_lines.append(r"\subsection*{1.2. TIẾNG ANH}")
                if folders["ta"]["single"]:
                    zipf.writestr("content/ta/single.tex", "\n\n".join(folders["ta"]["single"]))
                    main_lines.append(r"\inputspace{content/ta/single}")
                for p_id, p_data in folders["ta"]["passages"].items():
                    idx = reading_counters["ta"]
                    reading_counters["ta"] += 1
                    p_str = rf"\engread{{{len(p_data['questions'])}}}{{{p_data['content']}}}" + "\n\n" + "\n\n".join(p_data["questions"])
                    zipf.writestr(f"content/ta/eng_read{idx}.tex", p_str)
                    main_lines.append(rf"\inputspace{{content/ta/eng_read{idx}}}")

            # Toán
            if len(folders["toan"]["single"]) > 0 or len(folders["toan"]["passages"]) > 0:
                main_lines.append(r"%======================")
                main_lines.append(r"\section*{PHẦN 2: TOÁN HỌC}")
                if folders["toan"]["single"]:
                    zipf.writestr("content/toan/single.tex", "\n\n".join(folders["toan"]["single"]))
                    main_lines.append(r"\inputspace{content/toan/single}")
                for p_id, p_data in folders["toan"]["passages"].items():
                    idx = reading_counters["toan"]
                    reading_counters["toan"] += 1
                    p_str = rf"\reading{{{len(p_data['questions'])}}}{{{p_data['content']}}}" + "\n\n" + "\n\n".join(p_data["questions"])
                    zipf.writestr(f"content/toan/reading{idx}.tex", p_str)
                    main_lines.append(rf"\inputspace{{content/toan/reading{idx}}}")

            # Tư duy Khoa học (Logic, PTSL, Khoa học)
            has_tdkh = False
            for k in ["logic", "ptsl", "slkh"]:
                if len(folders[k]["single"]) > 0 or len(folders[k]["passages"]) > 0:
                    has_tdkh = True
                    break
                    
            if has_tdkh:
                main_lines.append(r"%======================")
                main_lines.append(r"\section*{PHẦN 3: TƯ DUY KHOA HỌC}")
                
                # Logic và Phân tích số liệu
                if len(folders["logic"]["single"]) > 0 or len(folders["logic"]["passages"]) > 0 or len(folders["ptsl"]["single"]) > 0 or len(folders["ptsl"]["passages"]) > 0:
                    main_lines.append(r"\subsection*{3.1. LOGIC, PHÂN TÍCH SỐ LIỆU}")
                    for sec in ["logic", "ptsl"]:
                        if folders[sec]["single"]:
                            zipf.writestr(f"content/{sec}/single.tex", "\n\n".join(folders[sec]["single"]))
                            main_lines.append(rf"\inputspace{{content/{sec}/single}}")
                        for p_id, p_data in folders[sec]["passages"].items():
                            idx = reading_counters[sec]
                            reading_counters[sec] += 1
                            p_str = rf"\reading{{{len(p_data['questions'])}}}{{{p_data['content']}}}" + "\n\n" + "\n\n".join(p_data["questions"])
                            zipf.writestr(f"content/{sec}/reading{idx}.tex", p_str)
                            main_lines.append(rf"\inputspace{{content/{sec}/reading{idx}}}")

                # Khoa học
                if len(folders["slkh"]["single"]) > 0 or len(folders["slkh"]["passages"]) > 0:
                    main_lines.append(r"\subsection*{3.2. SUY LUẬN KHOA HỌC}")
                    if folders["slkh"]["single"]:
                        zipf.writestr("content/slkh/single.tex", "\n\n".join(folders["slkh"]["single"]))
                        main_lines.append(r"\inputspace{content/slkh/single}")
                    for p_id, p_data in folders["slkh"]["passages"].items():
                        idx = reading_counters["slkh"]
                        reading_counters["slkh"] += 1
                        p_str = rf"\reading{{{len(p_data['questions'])}}}{{{p_data['content']}}}" + "\n\n" + "\n\n".join(p_data["questions"])
                        zipf.writestr(f"content/slkh/reading{idx}.tex", p_str)
                        main_lines.append(rf"\inputspace{{content/slkh/reading{idx}}}")

            # Other
            if len(folders["other"]["single"]) > 0 or len(folders["other"]["passages"]) > 0:
                main_lines.append(r"%======================")
                main_lines.append(r"\section*{KHÁC}")
                if folders["other"]["single"]:
                    zipf.writestr("content/other/single.tex", "\n\n".join(folders["other"]["single"]))
                    main_lines.append(r"\inputspace{content/other/single}")
                for p_id, p_data in folders["other"]["passages"].items():
                    idx = reading_counters["other"]
                    reading_counters["other"] += 1
                    p_str = rf"\reading{{{len(p_data['questions'])}}}{{{p_data['content']}}}" + "\n\n" + "\n\n".join(p_data["questions"])
                    zipf.writestr(f"content/other/reading{idx}.tex", p_str)
                    main_lines.append(rf"\inputspace{{content/other/reading{idx}}}")

            main_lines.extend([
                r"%======================",
                r"\end{document}"
            ])
            
            zipf.writestr("main.tex", "\n".join(main_lines))

        zip_buffer.seek(0)
        return zip_buffer.read()
