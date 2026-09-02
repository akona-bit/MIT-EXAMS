import client from "./client";

export interface MaintenanceStatus {
  maintenance_mode_all: boolean;
  maintenance_mode_exam: boolean;
  maintenance_mode_result: boolean;
}

export const getMaintenanceStatus = async (): Promise<MaintenanceStatus> => {
  const response = await client.get<MaintenanceStatus>("/api/v1/system/maintenance");
  return response.data;
};
