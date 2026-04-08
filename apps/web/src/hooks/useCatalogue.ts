// Type definitions for catalogue programs as returned by GET /api/programs/:code

export interface PricingTier {
  id: string;
  pricingType: string;
  label: string;
  amount: string;
  unit: string;
  currency: string;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
}

export interface ProgramFeatureGrant {
  id: string;
  featureKey: string;
  credentialRequired: boolean;
}

export interface CatalogueProgram {
  code: string;
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  sortOrder: number | null;
  highlightLabel: string | null;
  published: boolean;
  tags: string[];
  pricingTiers: PricingTier[];
  featureGrants?: ProgramFeatureGrant[];
  [key: string]: unknown;
}
