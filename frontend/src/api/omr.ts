import client from "./client";

export interface OmrSheet {
    id: number;
    job_id: number;
    image_path: string | null;
    status: string; // PENDING | PROCESSING | NEEDS_REVIEW | COMPLETED | FAILED
    student_id_raw: string | null;
    form_code_raw: string | null;
    answers_raw: string | null;
    exam_submission_id: number | null;
    error_message?: string | null;
}

export interface OmrJob {
    id: number;
    exam_id: number;
    uploader_id: number;
    total_files: number;
    status: string; // PROCESSING | COMPLETED | FAILED
}

export interface OmrJobDetail {
    job: OmrJob;
    sheets: OmrSheet[];
}

export async function uploadOmrSheets(examId: number, files: File[]): Promise<{ message: string; job_id: number }> {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const response = await client.post(`/api/v1/omr/upload?exam_id=${examId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
}

export async function getOmrJob(jobId: number): Promise<OmrJobDetail> {
    const response = await client.get<OmrJobDetail>(`/api/v1/omr/jobs/${jobId}`);
    return response.data;
}

export async function confirmOmrSheet(sheetId: number): Promise<{ message: string; submission_id: number }> {
    const response = await client.post(`/api/v1/omr/sheets/${sheetId}/review`);
    return response.data;
}