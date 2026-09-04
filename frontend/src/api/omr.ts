import client from "./client";

export interface OmrSheet {
    id: number;
    status: string;
    student_id_raw: string | null;
    form_code_raw: string | null;
    confidence_score: number | null;
    error_message?: string | null;
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

export async function confirmOmrSheet(sheetId: number): Promise<{ task_id: string; message: string }> {
    const response = await client.post(`/api/v1/omr/sheets/${sheetId}/review`);
    return response.data.data;
}