-- ==============================================================================
-- 1. TẠO HELPER FUNCTIONS
-- ==============================================================================

-- Lấy user_id nội bộ (int4) từ JWT của Supabase Auth
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS int4 LANGUAGE sql SECURITY DEFINER STABLE
AS $$ 
  SELECT id FROM public.user WHERE supabase_id = auth.uid()::text; 
$$;

-- Lấy tên Role hiện tại của User
CREATE OR REPLACE FUNCTION public.current_user_role_name()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE
AS $$ 
  SELECT r.name 
  FROM public.user u 
  JOIN public.role r ON r.id = u.role_id 
  WHERE u.supabase_id = auth.uid()::text; 
$$;

-- Kiểm tra có phải Admin không (dựa theo seed data, role 'ADMIN' có id=1)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
AS $$ 
  SELECT public.current_user_role_name() = 'ADMIN'; 
$$;

-- Kiểm tra có phải Người soạn đề (TEACHER) / Người duyệt (MODERATOR) / ADMIN
CREATE OR REPLACE FUNCTION public.is_teacher_or_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
AS $$ 
  SELECT public.current_user_role_name() IN ('ADMIN', 'TEACHER', 'MODERATOR'); 
$$;

-- ==============================================================================
-- 2. BẬT RLS & VIẾT POLICY CHO TỪNG NHÓM
-- ==============================================================================

-- ==========================================
-- NHÓM A - Dữ liệu cá nhân User
-- ==========================================
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile or Admin views all"
ON public.user FOR SELECT TO authenticated
USING (id = public.current_user_id() OR public.is_admin());

CREATE POLICY "Users can update their own profile"
ON public.user FOR UPDATE TO authenticated
USING (id = public.current_user_id() OR public.is_admin());

-- [TRIGGER CHẶN] Chỉ Admin mới được sửa các cột nhạy cảm của user
CREATE OR REPLACE FUNCTION public.check_user_sensitive_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        IF NEW.is_active IS DISTINCT FROM OLD.is_active OR 
           NEW.role_id IS DISTINCT FROM OLD.role_id OR 
           NEW.can_view_answers IS DISTINCT FROM OLD.can_view_answers THEN
            RAISE EXCEPTION 'Only administrators can update is_active, role_id, or can_view_answers';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_user_columns ON public.user;
CREATE TRIGGER trigger_check_user_columns
BEFORE UPDATE ON public.user
FOR EACH ROW
EXECUTE FUNCTION public.check_user_sensitive_columns();


-- ==========================================
-- NHÓM B - Ngân hàng câu hỏi & Ma trận
-- ==========================================
ALTER TABLE public.question ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_sub_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passage ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.knowledge_node ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matrix_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matrix_rule_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_node_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_node_parent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_skill_tag ENABLE ROW LEVEL SECURITY;

-- Nhóm Metadata (Knowledge Node, Matrix, Tags): Chỉ Admin & Teacher CRUD, Học sinh KHÔNG thấy
CREATE POLICY "Staff can manage metadata" ON public.knowledge_node FOR ALL TO authenticated USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can manage matrix" ON public.matrix FOR ALL TO authenticated USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can manage matrix rules" ON public.matrix_rule FOR ALL TO authenticated USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can manage matrix groups" ON public.matrix_rule_group FOR ALL TO authenticated USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can manage kn links" ON public.knowledge_node_link FOR ALL TO authenticated USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can manage kn parents" ON public.knowledge_node_parent FOR ALL TO authenticated USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can manage skill tags" ON public.question_skill_tag FOR ALL TO authenticated USING (public.is_teacher_or_admin());

-- Nhóm Nội dung thi (Question, Answer, Sub Item, Passage): Admin/Teacher CRUD
-- Dùng INSERT, UPDATE, DELETE (không dùng FOR ALL) để status-based SELECT policy hoạt động đúng
CREATE POLICY "Staff can manage questions" ON public.question FOR INSERT TO authenticated WITH CHECK (public.is_teacher_or_admin());
CREATE POLICY "Staff can update questions" ON public.question FOR UPDATE TO authenticated USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can delete questions" ON public.question FOR DELETE TO authenticated USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can manage answers" ON public.answer FOR INSERT TO authenticated WITH CHECK (public.is_teacher_or_admin());
CREATE POLICY "Staff can update answers" ON public.answer FOR UPDATE TO authenticated USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can delete answers" ON public.answer FOR DELETE TO authenticated USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can manage sub items" ON public.question_sub_item FOR ALL TO authenticated USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can manage passages" ON public.passage FOR ALL TO authenticated USING (public.is_teacher_or_admin());

-- POLICY: Trạng thái câu hỏi cho Teacher (không thấy PENDING nếu không phải Admin/Mod)
CREATE POLICY "Staff can read questions based on status"
ON public.question FOR SELECT TO authenticated
USING (
  public.is_admin() OR 
  public.current_user_role_name() = 'MODERATOR' OR 
  (public.current_user_role_name() = 'TEACHER' AND status != 'PENDING')
);

-- POLICY: Học sinh chỉ được xem Question, Answer, SubItem, Passage khi đang làm bài thi Active
CREATE POLICY "Students can view questions in active exams"
ON public.question FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exam_form_question efq
    JOIN public.exam_form ef ON ef.id = efq.exam_form_id
    JOIN public.exam e ON e.id = ef.exam_id
    JOIN public.exam_participant ep ON ep.exam_id = e.id
    WHERE efq.question_id = public.question.id
      AND ep.user_id = public.current_user_id()
      AND ep.status = 'IN_PROGRESS'
      AND (e.start_time IS NULL OR e.start_time <= now())
      AND (e.end_time IS NULL OR e.end_time >= now())
  )
);

CREATE POLICY "Students can view answers in active exams"
ON public.answer FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exam_form_question efq
    JOIN public.exam_form ef ON ef.id = efq.exam_form_id
    JOIN public.exam e ON e.id = ef.exam_id
    JOIN public.exam_participant ep ON ep.exam_id = e.id
    WHERE efq.question_id = public.answer.question_id
      AND ep.user_id = public.current_user_id()
      AND ep.status = 'IN_PROGRESS'
      AND (e.start_time IS NULL OR e.start_time <= now())
      AND (e.end_time IS NULL OR e.end_time >= now())
  )
);

CREATE POLICY "Students can view sub items in active exams"
ON public.question_sub_item FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exam_form_question efq
    JOIN public.exam_form ef ON ef.id = efq.exam_form_id
    JOIN public.exam e ON e.id = ef.exam_id
    JOIN public.exam_participant ep ON ep.exam_id = e.id
    WHERE efq.question_id = public.question_sub_item.question_id
      AND ep.user_id = public.current_user_id()
      AND ep.status = 'IN_PROGRESS'
      AND (e.start_time IS NULL OR e.start_time <= now())
      AND (e.end_time IS NULL OR e.end_time >= now())
  )
);

CREATE POLICY "Students can view passages in active exams"
ON public.passage FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.question q
    JOIN public.exam_form_question efq ON q.id = efq.question_id
    JOIN public.exam_form ef ON ef.id = efq.exam_form_id
    JOIN public.exam e ON e.id = ef.exam_id
    JOIN public.exam_participant ep ON ep.exam_id = e.id
    WHERE q.passage_id = public.passage.id
      AND ep.user_id = public.current_user_id()
      AND ep.status = 'IN_PROGRESS'
      AND (e.start_time IS NULL OR e.start_time <= now())
      AND (e.end_time IS NULL OR e.end_time >= now())
  )
);


-- ==========================================
-- NHÓM C - Kỳ thi & Bài làm
-- ==========================================
ALTER TABLE public.exam ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_form ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_form_question ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_participant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_submission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_submission_answer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_result ENABLE ROW LEVEL SECURITY;

-- 1. EXAM & EXAM_FORM
CREATE POLICY "Admin has full access to exams" ON public.exam FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin has full access to exam forms" ON public.exam_form FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin has full access to exam form questions" ON public.exam_form_question FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Students can view exams they are participating in"
ON public.exam FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exam_participant 
    WHERE exam_id = public.exam.id AND user_id = public.current_user_id()
  )
);

CREATE POLICY "Students can view exam forms they are assigned to"
ON public.exam_form FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exam_participant 
    WHERE exam_id = public.exam_form.exam_id AND user_id = public.current_user_id()
  )
);

CREATE POLICY "Students can view exam form questions in active exams"
ON public.exam_form_question FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exam_participant ep
    JOIN public.exam e ON e.id = ep.exam_id
    WHERE ep.exam_id = (SELECT exam_id FROM public.exam_form WHERE id = public.exam_form_question.exam_form_id)
      AND ep.user_id = public.current_user_id()
      AND ep.status = 'IN_PROGRESS'
      AND (e.start_time IS NULL OR e.start_time <= now())
      AND (e.end_time IS NULL OR e.end_time >= now())
  )
);

-- 2. EXAM_PARTICIPANT
CREATE POLICY "Admin has full access to participants" ON public.exam_participant FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Students can view their own participation"
ON public.exam_participant FOR SELECT TO authenticated
USING (user_id = public.current_user_id());

-- [TRIGGER CHẶN] Thí sinh không tự sửa trạng thái cấm thi
CREATE OR REPLACE FUNCTION public.check_participant_sensitive_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        IF NEW.status = 'SUSPENDED' AND OLD.status != 'SUSPENDED' THEN
            RAISE EXCEPTION 'Only administrators can suspend a participant';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_participant_columns ON public.exam_participant;
CREATE TRIGGER trigger_check_participant_columns
BEFORE UPDATE ON public.exam_participant
FOR EACH ROW
EXECUTE FUNCTION public.check_participant_sensitive_columns();


-- 3. EXAM_SUBMISSION & ANSWERS
CREATE POLICY "Students insert/update submission while active"
ON public.exam_submission FOR ALL TO authenticated
USING (
  user_id = public.current_user_id() OR public.is_admin()
)
WITH CHECK (
  public.is_admin() OR (
    user_id = public.current_user_id() 
    AND EXISTS (
      SELECT 1 FROM public.exam_participant ep
      JOIN public.exam e ON e.id = ep.exam_id
      WHERE ep.exam_id = public.exam_submission.exam_id
        AND ep.user_id = public.current_user_id()
        AND ep.status = 'IN_PROGRESS'
        AND (e.end_time IS NULL OR e.end_time >= now())
    )
    -- Nếu đã submit_time thì khóa không cho INSERT/UPDATE tiếp
    AND submit_time IS NULL
  )
);

CREATE POLICY "Students can manage their own submission answers"
ON public.exam_submission_answer FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exam_submission s
    WHERE s.id = public.exam_submission_answer.submission_id 
      AND s.user_id = public.current_user_id()
  ) OR public.is_admin()
)
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.exam_submission s
    JOIN public.exam_participant ep ON ep.exam_id = s.exam_id AND ep.user_id = s.user_id
    JOIN public.exam e ON e.id = s.exam_id
    WHERE s.id = public.exam_submission_answer.submission_id 
      AND s.user_id = public.current_user_id()
      AND ep.status = 'IN_PROGRESS'
      AND s.submit_time IS NULL
      AND (e.end_time IS NULL OR e.end_time >= now())
  )
);

-- 4. EXAM_RESULT (Chỉ Read-only với thí sinh)
CREATE POLICY "Students can only read their results"
ON public.exam_result FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exam_participant ep
    WHERE ep.id = public.exam_result.participant_id 
      AND ep.user_id = public.current_user_id()
  ) OR public.is_admin()
);


-- ==========================================
-- NHÓM D - Vận hành nội bộ (Admin)
-- ==========================================
ALTER TABLE public.irt_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages internal settings and jobs"
ON public.irt_task FOR ALL TO authenticated
USING (public.is_admin());

CREATE POLICY "Admin manages system settings"
ON public.system_setting FOR ALL TO authenticated
USING (public.is_admin());

CREATE POLICY "Staff can manage resources they uploaded"
ON public.resource FOR ALL TO authenticated
USING (public.is_admin() OR uploader_id = public.current_user_id());

-- ==========================================
-- NHÓM E - AI Analysis & Logging
-- ==========================================
ALTER TABLE public.ai_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

-- Chỉ Admin và Teacher mới được đọc/ghi Cache phân tích AI
CREATE POLICY "Staff can manage AI analysis cache"
ON public.ai_analysis_cache FOR ALL TO authenticated
USING (public.is_teacher_or_admin())
WITH CHECK (public.is_teacher_or_admin());

-- Request log chỉ Admin xem/quản lý
CREATE POLICY "Admin manages AI request logs"
ON public.ai_request_log FOR ALL TO authenticated
USING (public.is_admin());

-- ==========================================
-- NHÓM F - Các bảng thiếu RLS
-- ==========================================

-- OTP Token: chỉ service role truy cập (Admin không cần xem OTP code)
ALTER TABLE public.otp_token ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only for OTP tokens"
ON public.otp_token FOR ALL TO authenticated
USING (false);

-- Audit Log: chỉ Admin xem
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages audit logs"
ON public.audit_log FOR ALL TO authenticated
USING (public.is_admin());

-- OMR Session & Sheet: Admin/Teacher quản lý
ALTER TABLE public.omr_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omr_sheet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage OMR jobs"
ON public.omr_job FOR ALL TO authenticated
USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can manage OMR sheets"
ON public.omr_sheet FOR ALL TO authenticated
USING (public.is_teacher_or_admin());

-- Exam Form Answer: Admin xem (chứa đáp án đúng - nhạy cảm)
ALTER TABLE public.exam_form_answer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages exam form answers"
ON public.exam_form_answer FOR ALL TO authenticated
USING (public.is_admin());

-- Exam Tracking Log: Admin xem, thí sinh KHÔNG thấy
ALTER TABLE public.exam_tracking_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages exam tracking logs"
ON public.exam_tracking_log FOR ALL TO authenticated
USING (public.is_admin());

-- Exam Generation Run: Admin/Teacher xem
ALTER TABLE public.exam_generation_run ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view exam generation runs"
ON public.exam_generation_run FOR SELECT TO authenticated
USING (public.is_teacher_or_admin());
CREATE POLICY "Staff can create exam generation runs"
ON public.exam_generation_run FOR INSERT TO authenticated
WITH CHECK (public.is_teacher_or_admin());

-- Item Analysis Result: Admin/Teacher xem
ALTER TABLE public.item_analysis_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view item analysis results"
ON public.item_analysis_result FOR SELECT TO authenticated
USING (public.is_teacher_or_admin());
CREATE POLICY "Admin manages item analysis results"
ON public.item_analysis_result FOR INSERT, UPDATE, DELETE TO authenticated
USING (public.is_admin());

-- Notification: thí sinh thấy thông báo của mình, Admin gửi
ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications"
ON public.notification FOR SELECT TO authenticated
USING (user_id = public.current_user_id() OR public.is_admin());
CREATE POLICY "Admin can create notifications"
ON public.notification FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

-- Feedback: thí sinh gửi, Admin xem
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own feedback"
ON public.feedback FOR INSERT TO authenticated
WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "Users can view their own feedback or Admin views all"
ON public.feedback FOR SELECT TO authenticated
USING (user_id = public.current_user_id() OR public.is_admin());
CREATE POLICY "Admin manages feedback"
ON public.feedback FOR UPDATE, DELETE TO authenticated
USING (public.is_admin());

