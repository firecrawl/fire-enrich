# Prove TAM Filter Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the Prove TAM expansion filters to exclude retail and credit unions, while adding enhanced coverage for gig economy and marketplaces.

**Architecture:** Modify the `buildHighRecallFilter()` method in `tam-expansion-service.ts` to add industry exclusions for retail/credit unions and expand gig economy/marketplace segment keywords.

**Tech Stack:** TypeScript, CrustData CompanyDB API

---

## Summary of Changes

### Exclusions to Add
1. **Retail** - Add 'Retail' to `excludedIndustries` array
2. **Credit Unions** - Add 'Credit Unions' to `excludedIndustries` array

### Enhanced Coverage to Add
1. **Gig Economy** - Add additional keywords for broader coverage
2. **Marketplaces** - Add additional keywords and industry filters for broader coverage

---

## Task 1: Add Retail to Excluded Industries

**Files:**
- Modify: `src/tam-expansion-service.ts:504-510`

**Step 1: Read the current excludedIndustries array**

Current code at lines 503-510:
```typescript
// Industries to exclude (PE, VC, Hedge Funds, Asset Management, IT Consulting, etc.)
const excludedIndustries = [
  'Venture Capital and Private Equity Principals',
  'Capital Markets',
  'Investment Management',
  'Professional Networking',
  'IT Services and IT Consulting'
];
```

**Step 2: Add 'Retail' to the excludedIndustries array**

Update to:
```typescript
// Industries to exclude (PE, VC, Hedge Funds, Asset Management, IT Consulting, Retail, Credit Unions, etc.)
const excludedIndustries = [
  'Venture Capital and Private Equity Principals',
  'Capital Markets',
  'Investment Management',
  'Professional Networking',
  'IT Services and IT Consulting',
  'Retail'
];
```

**Step 3: Verify the change compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Task 2: Add Credit Unions to Excluded Industries

**Files:**
- Modify: `src/tam-expansion-service.ts:504-510`

**Step 1: Add 'Credit Unions' to the excludedIndustries array**

Update to:
```typescript
// Industries to exclude (PE, VC, Hedge Funds, Asset Management, IT Consulting, Retail, Credit Unions, etc.)
const excludedIndustries = [
  'Venture Capital and Private Equity Principals',
  'Capital Markets',
  'Investment Management',
  'Professional Networking',
  'IT Services and IT Consulting',
  'Retail',
  'Credit Unions'
];
```

**Step 2: Verify the change compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Task 3: Enhance Gig Economy Segment Keywords

**Files:**
- Modify: `src/tam-expansion-service.ts:326-358`

**Step 1: Read current Gig Economy segment**

Current keywords at lines 342-355:
```typescript
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'gig economy' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'gig worker' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'independent contractor' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'on-demand delivery' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'rideshare' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'ride-sharing' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'ride hailing' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'food delivery' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'grocery delivery' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'last-mile' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'delivery app' }
```

**Step 2: Add additional gig economy keywords**

Add these new keywords to capture broader gig economy coverage:
```typescript
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'gig economy' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'gig worker' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'gig platform' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'independent contractor' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'on-demand delivery' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'on-demand workforce' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'on-demand services' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'rideshare' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'ride-sharing' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'ride hailing' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'food delivery' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'grocery delivery' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'last-mile' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'delivery app' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'delivery platform' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'courier' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'flexible work' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: '1099 worker' }
```

**Step 3: Verify the change compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Task 4: Enhance Digital Marketplaces Segment Keywords

**Files:**
- Modify: `src/tam-expansion-service.ts:300-324`

**Step 1: Read current Digital Marketplaces segment**

Current keywords at lines 314-321:
```typescript
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'marketplace' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'two-sided platform' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'platform connecting' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'peer-to-peer' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'sharing economy' }
```

**Step 2: Add additional marketplace keywords**

Add these new keywords to capture broader marketplace coverage:
```typescript
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'marketplace' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'two-sided platform' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'two sided platform' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'platform connecting' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'peer-to-peer' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'sharing economy' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'connects buyers and sellers' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'b2b marketplace' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'b2c marketplace' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'online marketplace' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'digital marketplace' },
{ filter_type: 'linkedin_company_description', type: '(.)', value: 'platform economy' }
```

**Step 3: Verify the change compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Task 5: Add Logistics/Supply Chain Marketplace Segment

**Files:**
- Modify: `src/tam-expansion-service.ts:492` (insert before excludedCompanyTypes)

**Step 1: Add new segment for logistics and supply chain marketplaces**

Insert new segment before the `excludedCompanyTypes` definition:
```typescript
// ===== SEGMENT: Logistics & Supply Chain Marketplaces =====
// Captures: Flexport, Convoy, Uber Freight, Samsara, Project44, etc.
segmentConditions.push({
  op: 'and',
  conditions: [
    {
      op: 'or',
      conditions: [
        { filter_type: 'linkedin_industries', type: '(.)', value: 'Freight and Package Transportation' },
        { filter_type: 'linkedin_industries', type: '(.)', value: 'Transportation, Logistics, Supply Chain and Storage' },
        { filter_type: 'linkedin_industries', type: '(.)', value: 'Truck Transportation' },
        { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
        { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' }
      ]
    },
    {
      op: 'or',
      conditions: [
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'freight marketplace' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'logistics marketplace' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'trucking platform' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'freight platform' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'shipping platform' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'supply chain platform' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'logistics technology' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'fleet management' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'digital freight' }
      ]
    }
  ]
});
```

**Step 2: Verify the change compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Task 6: Add Healthcare Gig/Staffing Marketplace Segment

**Files:**
- Modify: `src/tam-expansion-service.ts:492` (insert after Logistics segment)

**Step 1: Add new segment for healthcare gig and staffing marketplaces**

Insert new segment:
```typescript
// ===== SEGMENT: Healthcare Gig & Staffing Marketplaces =====
// Captures: Nomad Health, Incredible Health, ShiftMed, CareRev, etc.
segmentConditions.push({
  op: 'and',
  conditions: [
    {
      op: 'or',
      conditions: [
        { filter_type: 'linkedin_industries', type: '(.)', value: 'Staffing and Recruiting' },
        { filter_type: 'linkedin_industries', type: '(.)', value: 'Hospitals and Health Care' },
        { filter_type: 'linkedin_industries', type: '(.)', value: 'Software Development' },
        { filter_type: 'linkedin_industries', type: '(.)', value: 'Technology, Information and Internet' }
      ]
    },
    {
      op: 'or',
      conditions: [
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'healthcare staffing' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'nurse staffing' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'medical staffing' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'healthcare marketplace' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'clinician marketplace' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'per diem nursing' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'travel nursing' },
        { filter_type: 'linkedin_company_description', type: '(.)', value: 'healthcare gig' }
      ]
    }
  ]
});
```

**Step 2: Verify the change compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Task 7: Update Documentation

**Files:**
- Modify: `docs/TAM-FILTER-LOGIC-AND-ICP.md`

**Step 1: Update the document to reflect new exclusions and segments**

Add section after "Industry Verticals" table:

```markdown
### Excluded Industries
| Industry | Reason for Exclusion |
|----------|---------------------|
| **Venture Capital and Private Equity Principals** | Institutional investors, not target market |
| **Capital Markets** | Investment banks, not consumer-facing |
| **Investment Management** | Asset managers, not target market |
| **Professional Networking** | Platform companies like LinkedIn |
| **IT Services and IT Consulting** | IT consultancies, low identity verification needs |
| **Retail** | Physical retail stores, not digital-first |
| **Credit Unions** | Traditional financial cooperatives, different buying patterns |
```

**Step 2: Update segment list in the document**

Add new segments to the high-level structure section:
```markdown
SEGMENT_15: Logistics & Supply Chain Marketplaces,
SEGMENT_16: Healthcare Gig & Staffing Marketplaces
```

---

## Task 8: Run Sample Extraction to Verify Changes

**Files:**
- None (validation only)

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run sample extraction**

Run: `npm run tam-expansion:sample`
Expected: Script completes without errors, outputs sample companies

**Step 3: Verify retail/credit unions are excluded**

Manually inspect output CSV to confirm no companies with 'Retail' or 'Credit Unions' in their linkedin_industries field.

---

## Task 9: Commit Changes

**Files:**
- `src/tam-expansion-service.ts`
- `docs/TAM-FILTER-LOGIC-AND-ICP.md`

**Step 1: Stage changes**

```bash
git add src/tam-expansion-service.ts docs/TAM-FILTER-LOGIC-AND-ICP.md
```

**Step 2: Commit**

```bash
git commit -m "feat: update Prove TAM filters - exclude retail/credit unions, enhance gig/marketplace coverage

- Add 'Retail' and 'Credit Unions' to excluded industries
- Add enhanced keywords for gig economy segment (on-demand workforce, courier, 1099 worker, etc.)
- Add enhanced keywords for marketplace segment (b2b/b2c marketplace, platform economy, etc.)
- Add new Logistics & Supply Chain Marketplaces segment
- Add new Healthcare Gig & Staffing Marketplaces segment
- Update documentation to reflect changes

$(printf '\n\xf0\x9f\xa4\x96 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>')"
```

---

## Verification Checklist

After completing all tasks:

- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] Sample extraction runs successfully (`npm run tam-expansion:sample`)
- [ ] Output CSV does not contain companies with 'Retail' industry
- [ ] Output CSV does not contain companies with 'Credit Unions' industry
- [ ] Output CSV contains gig economy companies (search for DoorDash, Uber, etc.)
- [ ] Output CSV contains marketplace companies (search for Airbnb, Etsy, etc.)
- [ ] Documentation updated to reflect changes
- [ ] Changes committed to git
