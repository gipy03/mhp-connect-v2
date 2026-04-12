import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface TrainerProfile {
  id: string;
  digiformaId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  photoUrl: string | null;
  specialties: string[];
  role: string | null;
  active: boolean;
  lastSyncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TrainerSession {
  id: string;
  digiformaId: string;
  name: string | null;
  code: string | null;
  programCode: string | null;
  programName: string | null;
  startDate: string | null;
  endDate: string | null;
  place: string | null;
  placeName: string | null;
  remote: boolean;
  inter: boolean;
  dates: { date: string; startTime: string | null; endTime: string | null }[];
  participantCount: number;
}

export interface TrainerParticipant {
  assignmentId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  enrollmentStatus: string | null;
  assignmentStatus: string;
  participationMode: string | null;
}

export function useTrainerProfile() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<TrainerProfile>({
    queryKey: ["trainer", "profile"],
    queryFn: () => api.get<TrainerProfile>("/trainer/profile"),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Pick<TrainerProfile, "bio" | "photoUrl" | "specialties" | "phone">>) =>
      api.patch<TrainerProfile>("/trainer/profile", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer", "profile"] });
    },
  });

  return { profile: data ?? null, isLoading, isError, update: updateMutation };
}

export function useTrainerSessions() {
  const { data, isLoading, isError } = useQuery<TrainerSession[]>({
    queryKey: ["trainer", "sessions"],
    queryFn: () => api.get<TrainerSession[]>("/trainer/sessions"),
  });

  return { sessions: data ?? [], isLoading, isError };
}

export function useTrainerParticipants(sessionId: string | null) {
  const { data, isLoading, isError } = useQuery<TrainerParticipant[]>({
    queryKey: ["trainer", "participants", sessionId],
    queryFn: () => api.get<TrainerParticipant[]>(`/trainer/sessions/${sessionId}/participants`),
    enabled: !!sessionId,
  });

  return { participants: data ?? [], isLoading, isError };
}
