// Schemas for the content files. One territory file holds its capabilities and skills,
// so each skill has exactly one home. Resources and tools are separate collections that
// skills and capabilities point to by id.
import { z } from 'astro/zod';

/** Lowercase kebab-case slug. Ids are permanent once published. */
export const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ids are lowercase kebab-case');
const Text = z.string().trim().min(1);
const IdList = z.array(Id).default([]);

export const SkillFile = z.object({
  id: Id,
  name: Text,
  summary: Text,
  description: Text,
  aliases: IdList,
  related: IdList,
  resources: IdList,
  tools: IdList,
});

export const CapabilityFile = z.object({
  id: Id,
  name: Text,
  description: Text,
  aliases: IdList,
  related: IdList,
  resources: IdList,
  tools: IdList,
  skills: z.array(SkillFile).min(1),
});

export const TerritoryFile = z.object({
  id: Id,
  order: z.number().int(),
  name: Text,
  tagline: Text,
  question: Text,
  description: Text,
  expected: Text,
  crossCutting: z.boolean().default(false),
  aliases: IdList,
  capabilities: z.array(CapabilityFile).min(1),
});

export const ResourceType = z.enum(['article', 'video', 'course', 'book', 'docs', 'talk', 'podcast', 'tool-guide']);
export const ResourceLevel = z.enum(['intro', 'deep']);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dates are YYYY-MM-DD');

export const ResourceFile = z.object({
  url: z.url(),
  title: Text,
  author: Text,
  type: ResourceType,
  length: Text.optional(),
  year: z.number().int().min(1950).max(2100).optional(),
  level: ResourceLevel,
  why: Text,
  paid: z.boolean().default(false),
  checked: IsoDate,
});

export const ToolPricing = z.enum(['open-source', 'free', 'freemium', 'paid']);

export const ToolFile = z.object({
  name: Text,
  url: z.url(),
  what: Text,
  pricing: ToolPricing,
  checked: IsoDate,
});

/** Resource and tool files are maps of id -> entry. */
export const ResourceMap = z.record(Id, ResourceFile);
export const ToolMap = z.record(Id, ToolFile);

export type SkillFile = z.infer<typeof SkillFile>;
export type CapabilityFile = z.infer<typeof CapabilityFile>;
export type TerritoryFile = z.infer<typeof TerritoryFile>;
export type ResourceFile = z.infer<typeof ResourceFile>;
export type ToolFile = z.infer<typeof ToolFile>;
export type ResourceType = z.infer<typeof ResourceType>;
export type ToolPricing = z.infer<typeof ToolPricing>;
