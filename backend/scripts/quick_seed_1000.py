"""Quick seed: 1000 students x 2 exams. Bulk-only, no per-row flush."""
import asyncio, random, sys, os
from datetime import datetime, timedelta, timezone
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import Role, User
from app.models.question import KnowledgeNode, KnowledgeNodeType, Question, QuestionStatus, Answer
from app.models.exam import (
    Matrix, MatrixRule, Exam, ExamStatus, ExamForm, ExamFormQuestion, ExamFormAnswer,
    ExamParticipant, ParticipantStatus, ExamSubmission, ExamSubmissionAnswer,
)
from app.models.grading import ExamResult
from app.db.bulk import bulk_insert

engine = create_async_engine(settings.DATABASE_URL, echo=False)
S = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

NUM_STUDENTS = 1000
NUM_FORMS = 20
QPFORM = 120

async def main():
    t0 = asyncio.get_event_loop().time()
    async with S() as db:
        # Roles
        for n in ["ADMIN","TEACHER","STUDENT","MODERATOR"]:
            if not (await db.execute(select(Role).where(Role.name==n))).scalar_one_or_none():
                db.add(Role(name=n, description=n))
        await db.flush()
        ar = (await db.execute(select(Role).where(Role.name=="ADMIN"))).scalar_one()
        tr = (await db.execute(select(Role).where(Role.name=="TEACHER"))).scalar_one()
        sr = (await db.execute(select(Role).where(Role.name=="STUDENT"))).scalar_one()

        # Users
        admin = (await db.execute(select(User).where(User.username=="admin"))).scalar_one_or_none()
        if not admin:
            admin = User(username="admin",email="admin@test.com",full_name="Admin",hashed_password=get_password_hash("admin123"),role_id=ar.id)
            db.add(admin)
        teacher = (await db.execute(select(User).where(User.username=="teacher"))).scalar_one_or_none()
        if not teacher:
            teacher = User(username="teacher",email="teacher@test.com",full_name="Teacher",hashed_password=get_password_hash("teacher123"),role_id=tr.id)
            db.add(teacher)
        await db.flush()
        print(f"Admin={admin.id} Teacher={teacher.id}")

        # Students (bulk)
        ex = (await db.execute(select(User.id).where(User.role_id==sr.id))).scalars().all()
        if len(ex) < NUM_STUDENTS:
            batch = []
            for i in range(1, NUM_STUDENTS+1):
                un = f"student{i:04d}"
                if not (await db.execute(select(User.id).where(User.username==un))).scalar_one_or_none():
                    batch.append({"username":un,"email":f"{un}@test.com","full_name":f"S{i:04d}",
                                  "student_id":f"{i:04d}","registration_number":f"{i:04d}",
                                  "hashed_password":get_password_hash("student123"),"role_id":sr.id,"is_active":True})
            if batch:
                await bulk_insert(db, User, batch, batch_size=500)
                await db.commit()
        students = (await db.execute(select(User).where(User.role_id==sr.id).order_by(User.id).limit(NUM_STUDENTS))).scalars().all()
        print(f"Students: {len(students)}")

        # Questions (bulk)
        qcount = (await db.execute(select(Question.id))).scalars().all()
        if len(qcount) < 200:
            nodes = (await db.execute(select(KnowledgeNode).where(KnowledgeNode.node_type==KnowledgeNodeType.TOPIC).limit(4))).scalars().all()
            q_batch, a_batch = [], []
            for nd in nodes:
                for lv in range(1,5):
                    for i in range(30):
                        q_batch.append({"content":f"Q {nd.name} L{lv} #{i+1}","level":lv,
                                        "status":QuestionStatus.APPROVED,"knowledge_node_id":nd.id,"creator_id":teacher.id})
            await bulk_insert(db, Question, q_batch, batch_size=1000)
            await db.commit()
            # Answers
            all_q = (await db.execute(select(Question))).scalars().all()
            for q in all_q:
                ci = random.randint(0,3)
                for j,lbl in enumerate(["A","B","C","D"]):
                    a_batch.append({"question_id":q.id,"content":lbl,"is_correct":(j==ci),"position":j})
            await bulk_insert(db, Answer, a_batch, batch_size=2000)
            await db.commit()
            print("Questions+Answers created")

        questions = (await db.execute(select(Question).where(Question.status==QuestionStatus.APPROVED))).scalars().all()
        answers_all = (await db.execute(select(Answer))).scalars().all()
        ans_by_q = {}
        for a in answers_all:
            ans_by_q.setdefault(a.question_id,[]).append(a)
        print(f"Q={len(questions)} A={len(answers_all)}")

        # Matrix
        matrix = (await db.execute(select(Matrix).limit(1))).scalar_one_or_none()
        if not matrix:
            matrix = Matrix(name="MatrixTest",description="Auto",created_by=teacher.id)
            db.add(matrix); await db.flush()
            nodes = (await db.execute(select(KnowledgeNode).where(KnowledgeNode.node_type==KnowledgeNodeType.TOPIC).limit(4))).scalars().all()
            for nd in nodes:
                db.add(MatrixRule(matrix_id=matrix.id,knowledge_node_id=nd.id,question_count=30,difficulty_min=1,difficulty_max=4))
            await db.commit()

        # 2 Exams
        for exam_num in range(1,3):
            print(f"\n=== EXAM {exam_num} ===")

            exam = Exam(name=f"Exam {exam_num}",matrix_id=matrix.id,status=ExamStatus.PUBLISHED,max_attempts=2,duration_minutes=120)
            db.add(exam); await db.flush()

            forms = []
            for i in range(NUM_FORMS):
                f = ExamForm(exam_id=exam.id,code=f"M{exam_num}{chr(65+i%26)}{i//26+1:02d}")
                db.add(f); forms.append(f)
            await db.flush()

            # EFQ + EFA (bulk)
            efq_batch, efa_batch = [], []
            correct_map = {}  # efq_idx -> answer_id
            efq_meta = []  # (efq_idx, part, qid)
            efa_by_efq_idx = {}  # efq_idx -> [(efa_id, answer_id)]

            form_q_map = {}  # form_id -> [question_ids]
            for form in forms:
                form_q_map[form.id] = [q.id for q in random.sample(questions, min(QPFORM, len(questions)))]

            efq_idx = 0
            for form in forms:
                qids = form_q_map[form.id]
                for pos, qid in enumerate(qids):
                    efq_batch.append({"exam_form_id":form.id,"question_id":qid,"position":pos+1,"part":(pos//30)+1})
                    efq_meta.append(((pos//30)+1, qid))

            await bulk_insert(db, ExamFormQuestion, efq_batch, batch_size=2000)
            await db.commit()

            all_efq = (await db.execute(select(ExamFormQuestion).where(ExamFormQuestion.exam_form_id.in_([f.id for f in forms])))).scalars().all()
            efq_by_form = {}
            for e in all_efq:
                efq_by_form.setdefault(e.exam_form_id,[]).append(e)

            for form in forms:
                efqs = efq_by_form.get(form.id,[])
                for efq in efqs:
                    q_ans = ans_by_q.get(efq.question_id,[])
                    for pos2,ans in enumerate(q_ans):
                        efa_batch.append({"exam_form_question_id":efq.id,"answer_id":ans.id,"new_position":pos2})
                        if ans.is_correct:
                            correct_map[efq.id] = ans.id

            await bulk_insert(db, ExamFormAnswer, efa_batch, batch_size=5000)
            await db.commit()
            print(f"  Forms={len(forms)} EFQ={len(all_efq)} EFA={len(efa_batch)}")

            # Simulate (bulk)
            BATCH = 200
            for bi in range((len(students)+BATCH-1)//BATCH):
                batch = students[bi*BATCH:(bi+1)*BATCH]
                now = datetime.now(timezone.utc)

                # Participants
                p_batch = []
                for s in batch:
                    form = random.choice(forms)
                    st = now - timedelta(minutes=random.randint(30,110))
                    p_batch.append({"exam_id":exam.id,"user_id":s.id,"exam_form_id":form.id,
                                    "status":"SUBMITTED","start_time":now-timedelta(hours=2),"submit_time":st})
                await bulk_insert(db, ExamParticipant, p_batch, batch_size=500)
                await db.commit()

                parts = (await db.execute(select(ExamParticipant).where(ExamParticipant.exam_id==exam.id).order_by(ExamParticipant.id.desc()).limit(len(batch)))).scalars().all()

                # Submissions
                sub_batch = [{"exam_participant_id":p.id,"submit_time":p.submit_time} for p in parts]
                await bulk_insert(db, ExamSubmission, sub_batch, batch_size=500)
                await db.commit()

                subs = (await db.execute(select(ExamSubmission).where(ExamSubmission.exam_participant_id.in_([p.id for p in parts])))).scalars().all()
                sub_by_pid = {s.exam_participant_id:s for s in subs}

                # Answers + Results
                esa_batch, res_batch = [], []
                for p in parts:
                    sub = sub_by_pid[p.id]
                    efqs = efq_by_form.get(p.exam_form_id,[])
                    ps = {1:0.0,2:0.0,3:0.0,4:0.0}
                    tc = 0
                    is_items, ca_dict, sa_dict, ip_dict = {}, {}, {}, {}

                    for efq in efqs:
                        part = efq.part
                        ca_id = correct_map.get(efq.id)
                        opts = [a.id for a in ans_by_q.get(efq.question_id,[])]

                        if random.random()<0.65 and ca_id:
                            sel_id = ca_id; corr = True
                        else:
                            wrong = [x for x in opts if x!=ca_id]
                            sel_id = random.choice(wrong) if wrong else (opts[0] if opts else None)
                            corr = False

                        sc = 1.0 if corr else 0.0
                        qk = str(efq.question_id)
                        esa_batch.append({"exam_submission_id":sub.id,"exam_form_question_id":efq.id,"selected_answer_id":sel_id,"score":sc})
                        if corr: tc+=1; ps[part]+=1.0
                        is_items[qk]=sc; ca_dict[qk]=ca_id; sa_dict[qk]=sel_id; ip_dict[qk]=1.0

                    irt = {pp:round((ps[pp]/30.0)*300,1) for pp in range(1,5)}
                    res_batch.append({"exam_submission_id":sub.id,
                        "ctt_score_part1":ps[1],"ctt_score_part2":ps[2],"ctt_score_part3":ps[3],"ctt_score_part4":ps[4],
                        "irt_score_part1":irt[1],"irt_score_part2":irt[2],"irt_score_part3":irt[3],"irt_score_part4":irt[4],
                        "total_score":sum(irt.values()),"raw_total_score":float(tc),
                        "item_scores":is_items,"correct_answers":ca_dict,"selected_answers":sa_dict,
                        "item_points":ip_dict,"total_points":float(len(efqs)),"score_method":"CTT"})

                await bulk_insert(db, ExamSubmissionAnswer, esa_batch, batch_size=5000)
                await bulk_insert(db, ExamResult, res_batch, batch_size=1000)
                await db.commit()
                print(f"  Batch {bi+1}/{(len(students)+BATCH-1)//BATCH} OK ({len(batch)} HS)")

        elapsed = asyncio.get_event_loop().time() - t0
        print(f"\n{'='*50}")
        print(f"  DONE in {elapsed:.1f}s | 2 exams x {NUM_STUDENTS} HS = {2*NUM_STUDENTS} submissions")
        print(f"  Admin: admin/admin123 | Teacher: teacher/teacher123")
        print(f"  Students: student0001..student1000 / Pass: student123")
        print(f"{'='*50}")

if __name__ == "__main__":
    asyncio.run(main())
