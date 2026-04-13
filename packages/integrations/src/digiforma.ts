import { fetchWithRetry } from "./retry.js";

const ENDPOINT = "https://app.digiforma.com/api/v1/graphql";

export class DigiformaError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "DigiformaError";
  }
}

async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T | null> {
  const apiKey = process.env.DIGIFORMA_API_KEY;
  if (!apiKey) {
    throw new DigiformaError("DIGIFORMA_API_KEY is not configured");
  }

  const body: Record<string, unknown> = { query };
  if (variables) body.variables = variables;

  let res: Response;
  try {
    res = await fetchWithRetry(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      throw new DigiformaError(
        "DigiForma API timeout — the service may be unavailable"
      );
    }
    throw new DigiformaError(`DigiForma API network error: ${e.message}`);
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new DigiformaError(
        "DigiForma API authentication failed — check DIGIFORMA_API_KEY"
      );
    }
    throw new DigiformaError(`DigiForma API returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (data.errors?.length) {
    throw new DigiformaError("DigiForma query failed", data.errors);
  }

  return data.data ?? null;
}

export interface DigiformaTrainee {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string | null;
  phoneSecondary?: string | null;
  roadAddress?: string | null;
  city?: string | null;
  cityCode?: string | null;
  country?: string | null;
  countryCode?: string | null;
  birthdate?: string | null;
  nationality?: string | null;
  profession?: string | null;
  company?: { id: string; name: string } | null;
  trainingSessions?: DigiformaSession[];
}

export interface DigiformaSession {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  extranetUrl: string | null;
  place?: string | null;
  placeName?: string | null;
  remote?: boolean;
  program?: { id: string; name: string; code: string | null } | null;
  image?: { url: string; filename: string } | null;
  dates?: { date: string; startTime: string | null; endTime: string | null }[];
}

export interface DigiformaProgram {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  subtitle: string | null;
  durationInDays: number | null;
  durationInHours: number | null;
  duration: string | null;
  image: { url: string; filename: string } | null;
  goals: { text: string }[] | null;
  steps: { text: string; substeps: { text: string }[] }[] | null;
  assessments: { text: string }[] | null;
  costs: { cost: number }[] | null;
  capacity: { active: boolean; max: number | null; min: number | null } | null;
  satisfactionRate: { evaluationsCount: number; score: number } | null;
  category: { id: string; name: string } | null;
  certificationModality: string | null;
  certificationDetails: string | null;
  admissionModality: string | null;
  trainingModality: string | null;
  handicappedAccessibility: string | null;
  graduationModality: string | null;
  graduationTarget: string | null;
  version: number | null;
}

export interface DigiformaCalendarSession {
  id: string;
  name: string;
  code: string | null;
  startDate: string | null;
  endDate: string | null;
  place: string | null;
  placeName: string | null;
  remote: boolean;
  inter: boolean;
  program: { id: string; name: string; code: string | null } | null;
  image: { url: string; filename: string } | null;
  dates: { date: string; startTime: string | null; endTime: string | null }[];
  instructors?: { id: string; firstname: string; lastname: string; email?: string | null }[];
}

export async function findTraineeByEmail(
  email: string
): Promise<DigiformaTrainee | null> {
  const data = await gql<{ trainees: DigiformaTrainee[] }>(
    `
    query FindTrainee($email: String!) {
      trainees(filters: { email: $email }) {
        id firstname lastname email
        trainingSessions { id }
      }
    }
  `,
    { email }
  );

  const matches = data?.trainees ?? [];

  if (matches.length === 0) {
    const allData = await gql<{ trainees: DigiformaTrainee[] }>(`
      query {
        trainees {
          id firstname lastname email
          trainingSessions { id }
        }
      }
    `);
    const normalizedEmail = email.toLowerCase().trim();
    const fallbackMatches = (allData?.trainees ?? []).filter(
      (t) => t.email?.toLowerCase().trim() === normalizedEmail
    );
    if (fallbackMatches.length === 0) return null;
    return (
      fallbackMatches.find((t) => (t.trainingSessions?.length ?? 0) > 0) ??
      fallbackMatches[0]!
    );
  }

  return (
    matches.find((t) => (t.trainingSessions?.length ?? 0) > 0) ?? matches[0]!
  );
}

export async function findAllTraineeIdsByEmail(email: string): Promise<string[]> {
  const data = await gql<{ trainees: DigiformaTrainee[] }>(
    `
    query FindTrainee($email: String!) {
      trainees(filters: { email: $email }) {
        id email
      }
    }
  `,
    { email }
  );

  const matches = data?.trainees ?? [];
  if (matches.length > 0) return matches.map((t) => String(t.id));

  const allData = await gql<{ trainees: DigiformaTrainee[] }>(`
    query { trainees { id email } }
  `);
  const normalizedEmail = email.toLowerCase().trim();
  return (allData?.trainees ?? [])
    .filter((t) => t.email?.toLowerCase().trim() === normalizedEmail)
    .map((t) => String(t.id));
}

export async function getTraineeWithSessions(
  digiformaId: string
): Promise<DigiformaTrainee | null> {
  if (!/^\d+$/.test(digiformaId)) {
    return null;
  }

  const data = await gql<{ trainee: DigiformaTrainee }>(
    `
    query GetTrainee($id: ID!) {
      trainee(id: $id) {
        id firstname lastname email
        company { id name }
        trainingSessions {
          id name startDate endDate extranetUrl
          place: address placeName: addressName remote
          program { id name code }
          image { url filename }
          dates { date startTime endTime }
        }
      }
    }
  `,
    { id: digiformaId }
  );

  return data?.trainee ?? null;
}

const extranetCache = new Map<string, { url: string | null; timestamp: number }>();
const EXTRANET_CACHE_TTL = 10 * 60 * 1000;

export async function getExtranetUrl(email: string): Promise<string | null> {
  const cacheKey = email.toLowerCase().trim();
  const cached = extranetCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < EXTRANET_CACHE_TTL) {
    return cached.url;
  }

  try {
    const data = await gql<{
      customers: Array<{
        customerTrainees: Array<{
          extranetUrl: string | null;
          trainee?: { id: string; email: string };
        }>;
      }>;
    }>(`
      query {
        customers {
          customerTrainees {
            extranetUrl
            trainee { id email }
          }
        }
      }
    `);

    if (!data?.customers) {
      extranetCache.set(cacheKey, { url: null, timestamp: Date.now() });
      return null;
    }

    const normalizedEmail = cacheKey;

    for (const customer of data.customers) {
      for (const ct of customer.customerTrainees ?? []) {
        if (
          ct.extranetUrl &&
          ct.trainee?.email?.toLowerCase().trim() === normalizedEmail
        ) {
          extranetCache.set(cacheKey, {
            url: ct.extranetUrl,
            timestamp: Date.now(),
          });
          return ct.extranetUrl;
        }
      }
    }

    extranetCache.set(cacheKey, { url: null, timestamp: Date.now() });
    return null;
  } catch (err: unknown) {
    const details = (err as DigiformaError)?.details;
    const hasTraineeFieldError = Array.isArray(details) &&
      details.some((e: { message?: string }) =>
        e?.message?.includes?.("trainee")
      );

    if (hasTraineeFieldError) {
      try {
        const fallback = await gql<{
          customers: Array<{
            customerTrainees: Array<{ extranetUrl: string | null }>;
          }>;
        }>(`
          query {
            customers {
              customerTrainees {
                extranetUrl
              }
            }
          }
        `);
        if (fallback?.customers) {
          for (const customer of fallback.customers) {
            for (const ct of customer.customerTrainees ?? []) {
              if (ct.extranetUrl) {
                extranetCache.set(cacheKey, {
                  url: ct.extranetUrl,
                  timestamp: Date.now(),
                });
                return ct.extranetUrl;
              }
            }
          }
        }
      } catch {
        // swallow fallback error
      }
    }
    extranetCache.set(cacheKey, { url: null, timestamp: Date.now() });
    return null;
  }
}

export async function getAllTrainees(): Promise<DigiformaTrainee[]> {
  const data = await gql<{ trainees: DigiformaTrainee[] }>(`
    query {
      trainees {
        id firstname lastname email
        phone phoneSecondary
        roadAddress city cityCode
        country countryCode
        birthdate nationality profession
      }
    }
  `);
  return data?.trainees ?? [];
}

export async function getAllTraineesWithSessions(): Promise<DigiformaTrainee[]> {
  const data = await gql<{ trainees: DigiformaTrainee[] }>(`
    query {
      trainees {
        id firstname lastname email
        phone phoneSecondary
        roadAddress city cityCode
        country countryCode
        birthdate nationality profession
        company { id name }
        trainingSessions {
          id name startDate endDate
          program { id name code }
        }
      }
    }
  `);
  return data?.trainees ?? [];
}

export async function getAllPrograms(): Promise<DigiformaProgram[]> {
  const data = await gql<{ programs: DigiformaProgram[] }>(`
    query {
      programs(filters: { rootLevelOnly: true }) {
        id name code description subtitle
        durationInDays durationInHours duration
        image { url filename }
        goals { text }
        steps { text substeps { text } }
        assessments { text }
        costs { cost }
        capacity { active max min }
        satisfactionRate { evaluationsCount score }
        category { id name }
        certificationModality certificationDetails
        admissionModality trainingModality
        handicappedAccessibility
        graduationModality graduationTarget
        version
      }
    }
  `);
  return data?.programs ?? [];
}

export interface DigiformaProgramChild {
  id: string;
  code: string | null;
  name: string;
  parentId: string | null;
  parent: { id: string; code: string | null; name: string } | null;
}

export async function getAllProgramsWithParents(): Promise<DigiformaProgramChild[]> {
  const data = await gql<{ programs: DigiformaProgramChild[] }>(`
    query {
      programs {
        id code name
        parentId
        parent { id code name }
      }
    }
  `);
  return data?.programs ?? [];
}

export function buildChildToRootMap(
  allPrograms: DigiformaProgramChild[]
): Map<string, string> {
  const byId = new Map<string, DigiformaProgramChild>();
  for (const p of allPrograms) byId.set(p.id, p);

  const codeToRoot = new Map<string, string>();

  for (const p of allPrograms) {
    if (!p.code) continue;
    let current = p;
    const visited = new Set<string>();
    while (current.parent) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      const parent = byId.get(current.parent.id);
      if (!parent) break;
      current = parent;
    }
    if (current.code) {
      codeToRoot.set(p.code, current.code);
    }
  }

  return codeToRoot;
}

export async function createTrainee(params: {
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  roadAddress?: string;
  city?: string;
  cityCode?: string;
  countryCode?: string;
  birthdate?: string;
  nationality?: string;
  profession?: string;
}): Promise<DigiformaTrainee> {
  const data = await gql<{ createTrainee: DigiformaTrainee }>(
    `
    mutation CreateTrainee($input: TraineeInput!) {
      createTrainee(traineeInput: $input) {
        id firstname lastname email
      }
    }
  `,
    {
      input: {
        firstname: params.firstname,
        lastname: params.lastname,
        email: params.email,
        phone: params.phone || null,
        roadAddress: params.roadAddress || null,
        city: params.city || null,
        cityCode: params.cityCode || null,
        countryCode: params.countryCode || null,
        birthdate: params.birthdate || null,
        nationality: params.nationality || null,
        profession: params.profession || null,
      },
    }
  );
  if (!data?.createTrainee) {
    throw new DigiformaError("Failed to create trainee in DigiForma");
  }
  return data.createTrainee;
}

export async function addDraftTraineeToSession(
  traineeId: string,
  trainingSessionId: string
): Promise<{ id: string }> {
  const data = await gql<{
    createDraftSessionTrainee: { trainee: { id: string } };
  }>(
    `
    mutation AddDraftTrainee($input: DraftSessionTraineeInput!, $sessionId: ID!) {
      createDraftSessionTrainee(draftSessionTraineeInput: $input, trainingSessionId: $sessionId) {
        trainee {
          id
        }
      }
    }
  `,
    {
      input: { traineeId },
      sessionId: trainingSessionId,
    }
  );
  if (!data?.createDraftSessionTrainee?.trainee) {
    throw new DigiformaError("Failed to add trainee to training session");
  }
  return data.createDraftSessionTrainee.trainee;
}

export interface DigiformaInstructor {
  id: string;
  firstname: string;
  lastname: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  skills: string | null;
}

export async function getAllInstructors(): Promise<DigiformaInstructor[]> {
  const data = await gql<{ instructors: DigiformaInstructor[] }>(`
    query {
      instructors {
        id firstname lastname email phone bio skills
      }
    }
  `);
  return data?.instructors ?? [];
}

export async function getAllTrainingSessions(): Promise<
  DigiformaCalendarSession[]
> {
  try {
    const data = await gql<{ trainingSessions: DigiformaCalendarSession[] }>(`
      query {
        trainingSessions {
          id name code startDate endDate
          place: address placeName: addressName remote inter
          program { id name code }
          image { url filename }
          dates { date startTime endTime }
          instructors { id firstname lastname email }
        }
      }
    `);
    return data?.trainingSessions ?? [];
  } catch {
    const data = await gql<{ trainingSessions: DigiformaCalendarSession[] }>(`
      query {
        trainingSessions {
          id name code startDate endDate
          place: address placeName: addressName remote inter
          program { id name code }
          image { url filename }
          dates { date startTime endTime }
        }
      }
    `);
    return data?.trainingSessions ?? [];
  }
}

export async function updateTrainee(
  digiformaId: string,
  fields: Partial<{
    firstname: string;
    lastname: string;
    phone: string;
    roadAddress: string;
    city: string;
    cityCode: string;
    countryCode: string;
    birthdate: string;
    nationality: string;
    profession: string;
  }>
): Promise<DigiformaTrainee | null> {
  try {
    const data = await gql<{ updateTrainee: DigiformaTrainee }>(
      `
      mutation UpdateTrainee($id: ID!, $input: TraineeInput!) {
        updateTrainee(id: $id, traineeInput: $input) {
          id firstname lastname email
        }
      }
    `,
      { id: digiformaId, input: fields }
    );
    if (!data?.updateTrainee) {
      throw new DigiformaError("Failed to update trainee in DigiForma");
    }
    return data.updateTrainee;
  } catch (err) {
    if (isMutationUnsupported(err)) {
      return null;
    }
    throw err;
  }
}

export async function updateInstructor(
  digiformaId: string,
  fields: Partial<{
    firstname: string;
    lastname: string;
    phone: string;
    email: string;
  }>
): Promise<DigiformaInstructor | null> {
  try {
    const data = await gql<{ updateInstructor: DigiformaInstructor }>(
      `
      mutation UpdateInstructor($id: ID!, $input: InstructorInput!) {
        updateInstructor(id: $id, instructorInput: $input) {
          id firstname lastname email phone bio skills
        }
      }
    `,
      { id: digiformaId, input: fields }
    );
    if (!data?.updateInstructor) {
      throw new DigiformaError("Failed to update instructor in DigiForma");
    }
    return data.updateInstructor;
  } catch (err) {
    if (isMutationUnsupported(err)) {
      return null;
    }
    throw err;
  }
}

function isMutationUnsupported(err: unknown): boolean {
  if (!(err instanceof DigiformaError)) return false;
  const details = err.details;
  if (!Array.isArray(details)) return false;
  return details.some(
    (e: { message?: string }) =>
      typeof e?.message === "string" &&
      (e.message.includes("not found") ||
        e.message.includes("undefined field") ||
        e.message.includes("Cannot query") ||
        e.message.includes("unknown"))
  );
}

export async function removeTraineeFromSession(
  traineeId: string,
  trainingSessionId: string
): Promise<void> {
  // DigiForma mutation for removing a draft trainee from a session.
  // The trainee record in DigiForma is deleted; the trainee entity itself remains.
  try {
    await gql(
      `
      mutation RemoveTrainee($traineeId: ID!, $sessionId: ID!) {
        deleteDraftSessionTrainee(traineeId: $traineeId, trainingSessionId: $sessionId) {
          trainee { id }
        }
      }
    `,
      { traineeId, sessionId: trainingSessionId }
    );
  } catch (err) {
    throw err;
  }
}
