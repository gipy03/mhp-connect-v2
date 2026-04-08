import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { AuthUser } from "@/hooks/useAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  userId: string;
  slugId: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  roadAddress: string | null;
  city: string | null;
  cityCode: string | null;
  country: string | null;
  countryCode: string | null;
  birthdate: string | null;
  nationality: string | null;
  profession: string | null;
  practiceName: string | null;
  specialties: string[] | null;
  bio: string | null;
  website: string | null;
  profileImageUrl: string | null;
  directoryVisibility: "hidden" | "internal" | "public";
  showPhone: boolean;
  showEmail: boolean;
  showAddress: boolean;
  showOnMap: boolean;
  latitude: number | null;
  longitude: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AccredibleCredential {
  id: string;
  accredibleCredentialId: string | null;
  recipientName: string | null;
  groupName: string | null;
  credentialName: string;
  description: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  badgeUrl: string | null;
  certificateUrl: string | null;
  url: string | null;
}

export interface ProfileData {
  user: AuthUser;
  profile: UserProfile | null;
  credentials: AccredibleCredential[];
}

export type ProfilePatch = Partial<
  Pick<
    UserProfile,
    | "firstName"
    | "lastName"
    | "phone"
    | "phoneSecondary"
    | "roadAddress"
    | "city"
    | "cityCode"
    | "country"
    | "countryCode"
    | "birthdate"
    | "nationality"
    | "profession"
    | "practiceName"
    | "specialties"
    | "bio"
    | "website"
  >
>;

export const PROFILE_QUERY_KEY = ["profile"] as const;

// ---------------------------------------------------------------------------
// useProfile
// ---------------------------------------------------------------------------

export function useProfile() {
  const queryClient = useQueryClient();

  const query = useQuery<ProfileData>({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => api.get<ProfileData>("/profile/me"),
    staleTime: 5 * 60_000,
  });

  // ---- Update personal / address / practice fields -----------------------

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfilePatch) =>
      api.patch<UserProfile>("/profile/me", data),
    onSuccess: (updated) => {
      queryClient.setQueryData<ProfileData>(PROFILE_QUERY_KEY, (prev) =>
        prev ? { ...prev, profile: updated } : prev
      );
    },
  });

  // ---- Avatar upload (multipart) -----------------------------------------

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("avatar", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(
          res.status,
          (body as { error?: string }).error ?? "Upload échoué",
          body
        );
      }
      return res.json() as Promise<{ profileImageUrl: string }>;
    },
    onSuccess: ({ profileImageUrl }) => {
      queryClient.setQueryData<ProfileData>(PROFILE_QUERY_KEY, (prev) =>
        prev && prev.profile
          ? { ...prev, profile: { ...prev.profile, profileImageUrl } }
          : prev
      );
    },
  });

  // ---- Directory visibility ----------------------------------------------

  const updateVisibilityMutation = useMutation({
    mutationFn: (visibility: "hidden" | "internal" | "public") =>
      api.patch<UserProfile>("/directory/me/visibility", { visibility }),
    onSuccess: (updated) => {
      queryClient.setQueryData<ProfileData>(PROFILE_QUERY_KEY, (prev) =>
        prev ? { ...prev, profile: updated } : prev
      );
    },
  });

  // ---- Contact toggles ---------------------------------------------------

  const updateTogglesMutation = useMutation({
    mutationFn: (toggles: {
      showPhone?: boolean;
      showEmail?: boolean;
      showAddress?: boolean;
      showOnMap?: boolean;
    }) => api.patch<UserProfile>("/directory/me/contact-toggles", toggles),
    onSuccess: (updated) => {
      queryClient.setQueryData<ProfileData>(PROFILE_QUERY_KEY, (prev) =>
        prev ? { ...prev, profile: updated } : prev
      );
    },
  });

  // ---- Change password ---------------------------------------------------

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post<{ success: true }>("/auth/change-password", data),
  });

  return {
    profileData: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    updateProfile: updateProfileMutation,
    uploadAvatar: uploadAvatarMutation,
    updateVisibility: updateVisibilityMutation,
    updateToggles: updateTogglesMutation,
    changePassword: changePasswordMutation,
  };
}
