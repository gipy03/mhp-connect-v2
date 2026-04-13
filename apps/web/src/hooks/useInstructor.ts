import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface InstructorProfile {
  id: string;
  digiformaId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  photoUrl: string | null;
  website: string | null;
  specialties: string[];
  role: string | null;
  active: boolean;
  lastSyncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface InstructorSession {
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

export interface InstructorParticipant {
  assignmentId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  enrollmentStatus: string | null;
  assignmentStatus: string;
  participationMode: string | null;
}

export function useInstructorProfile() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<InstructorProfile>({
    queryKey: ["instructor", "profile"],
    queryFn: () => api.get<InstructorProfile>("/instructor/profile"),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Pick<InstructorProfile, "bio" | "photoUrl" | "website" | "specialties" | "phone">>) =>
      api.patch<InstructorProfile>("/instructor/profile", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor", "profile"] });
    },
  });

  return { profile: data ?? null, isLoading, isError, update: updateMutation };
}

export function useInstructorSessions() {
  const { data, isLoading, isError } = useQuery<InstructorSession[]>({
    queryKey: ["instructor", "sessions"],
    queryFn: () => api.get<InstructorSession[]>("/instructor/sessions"),
  });

  return { sessions: data ?? [], isLoading, isError };
}

export function useInstructorParticipants(sessionId: string | null) {
  const { data, isLoading, isError } = useQuery<InstructorParticipant[]>({
    queryKey: ["instructor", "participants", sessionId],
    queryFn: () => api.get<InstructorParticipant[]>(`/instructor/sessions/${sessionId}/participants`),
    enabled: !!sessionId,
  });

  return { participants: data ?? [], isLoading, isError };
}
