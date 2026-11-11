import { describe, expect, it } from 'vitest';
import { loadAtlas, loadSources } from '../src/atlas/load.ts';
import { SkillFile } from '../src/atlas/schema.ts';
import { atlasRedirects } from '../src/atlas/redirects.ts';
import { nodePath } from '../src/atlas/model.ts';

const atlas = loadAtlas();

describe('AI skills and contextual applications', () => {
  it('gives AI competencies a territory while keeping general skills cross-cutting', () => {
    expect(atlas.nodes.get('ai')).toMatchObject({ level: 'territory', name: 'AI', capabilities: ['ai-engineering', 'ai-assisted-work'] });
    expect(atlas.nodes.get('llm-fundamentals')).toMatchObject({ capability: 'ai-engineering', territory: 'ai' });
    expect(atlas.nodes.get('prompt-context-engineering')).toMatchObject({ capability: 'ai-engineering' });
    expect(atlas.nodes.get('ai-interaction-design')).toMatchObject({ territory: 'experience' });
    expect(atlas.nodes.get('delegating-to-agents')).toMatchObject({ capability: 'ai-assisted-work', territory: 'ai' });
    expect(atlas.nodes.get('verification')).toMatchObject({ capability: 'critical-thinking', territory: 'cross-cutting' });
    expect(atlas.nodes.get('workflow-automation')).toMatchObject({ capability: 'systems-thinking', territory: 'cross-cutting' });
  });

  it('preserves old capability and skill page URLs after moving their homes', () => {
    const redirects = atlasRedirects(atlas);
    for (const node of [...atlas.capabilities, ...atlas.skills]) {
      for (const previous of node.previousPaths) expect(redirects[previous]).toBe(nodePath(atlas, node));
    }
    expect(redirects['/atlas/engineering/ai-engineering/']).toBe('/atlas/ai/ai-engineering/');
    expect(redirects['/atlas/engineering/ai-engineering/llm-integration/']).toBe('/atlas/ai/ai-engineering/llm-integration/');
    expect(redirects['/atlas/cross-cutting/ai-assisted-work/']).toBe('/atlas/ai/ai-assisted-work/');
    expect(redirects['/atlas/cross-cutting/ai-assisted-work/verification/']).toBe('/atlas/cross-cutting/critical-thinking/verification/');
  });

  it('preserves concrete applications and evidence across every territory', () => {
    for (const territory of atlas.territories) {
      const skills = atlas.skills.filter((s) => s.territory === territory.id && s.aiLeverage);
      expect(skills.length, territory.id).toBeGreaterThan(0);
      for (const skill of skills) {
        expect(skill.technicalLeverage, skill.id).toBeTruthy();
        expect(skill.evidence?.checks.length, skill.id).toBeGreaterThan(0);
      }
    }
  });

  it('requires verification for a workflow without requiring a foundation', () => {
    const source = loadSources().territories.flatMap((t) => t.capabilities.flatMap((c) => c.skills))[0];
    const workflow = { workflow: 'Summarize notes', limitations: 'Missing context' };
    expect(SkillFile.safeParse({ ...source, aiLeverage: undefined }).success).toBe(true);
    expect(SkillFile.safeParse({ ...source, aiLeverage: workflow }).success).toBe(false);
    expect(SkillFile.safeParse({ ...source, aiLeverage: { ...workflow, verification: 'Check each finding against the source.' } }).success).toBe(true);
  });
});
