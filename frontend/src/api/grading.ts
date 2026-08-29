import client from './client';

export interface IrtTaskStatus {
  task_id: string;
  status: string;
}

export async function runIrtCalibration(examId: number): Promise<{ message: string; task_id: string }> {
  const response = await client.post(`/api/v1/grading/exams/${examId}/run-irt`);
  return response.data;
}

export async function getIrtTaskStatus(taskId: string): Promise<IrtTaskStatus> {
  const response = await client.get<IrtTaskStatus>(`/api/v1/grading/tasks/${taskId}`);
  return response.data;
}
