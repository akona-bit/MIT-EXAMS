import client from "./client";

export interface OmrSheet {
    id: number;
    status: string;
    student_id_raw: string | null;
    form_code_raw: string | null;
    confidence_score: number | null;
    error_message?: string | null;
    image_path?: string | null;
    exam_submission_id?: number | null;
}

export interface OmrSheetDetail extends OmrSheet {
    job_id: number;
    answers: Record<string, string>;
}

export interface OmrJob {
    id: number;
    exam_id: number;
    status: string;
    total_files: number;
    processed_files: number;
    created_at: string | null;
    completed_at: string | null;
}

export interface OmrJobDetail {
    job: OmrJob;
    sheets: OmrSheet[];
}

export async function uploadOmrSheets(examId: number, files: File[]): Promise<{ job_id: number; sheet_ids: number[]; total_files: number }> {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const response = await client.post(`/api/v1/omr/upload?exam_id=${examId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data;
}

export async function getOmrJob(jobId: number): Promise<OmrJobDetail> {
    const response = await client.get(`/api/v1/omr/jobs/${jobId}`);
    return response.data.data;
}

export async function getOmrSheet(sheetId: number): Promise<OmrSheetDetail> {
    const response = await client.get(`/api/v1/omr/sheets/${sheetId}`);
    return response.data.data;
}

export async function confirmOmrSheet(sheetId: number, answersOverride?: Record<number, string | null>): Promise<{ task_id: string; message: string }> {
    const response = await client.post(`/api/v1/omr/sheets/${sheetId}/review`, answersOverride || {});
    return response.data.data;
}

export interface StudentOmrSubmission {
    id: number;
    student_id: string;
    student_name: string;
    submit_time: string | null;
    image_url: string;
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
    score?: number | null;
}

export async function getStudentOmrSubmissions(examId: number): Promise<StudentOmrSubmission[]> {
    const response = await client.get(`/api/v1/omr/exams/${examId}/student-submissions`);
    return response.data.data;
}

export async function gradeStudentSubmissionSync(submissionId: number, enableGemini = true): Promise<{ success: boolean; message: string }> {
    const response = await client.post(`/api/v1/omr/grade-student-submission-sync/${submissionId}?enable_gemini=${enableGemini}`);
    return response.data.data;
}