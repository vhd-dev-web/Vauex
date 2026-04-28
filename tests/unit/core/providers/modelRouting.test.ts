import '@/providers';

import { getEnabledProviderForModel, getProviderForModel } from '@/core/providers/modelRouting';
import { DEFAULT_CODEX_PRIMARY_MODEL } from '@/providers/codex/types/models';

describe('getProviderForModel', () => {
  it('routes Claude default models to claude', () => {
    expect(getProviderForModel('haiku')).toBe('claude');
    expect(getProviderForModel('sonnet')).toBe('claude');
    expect(getProviderForModel('opus')).toBe('claude');
  });

  it('routes unknown Claude version ids to the Codex-first default without settings context', () => {
    expect(getProviderForModel('claude-sonnet-4-5-20250514')).toBe('codex');
    expect(getProviderForModel('claude-opus-4-6-20250616')).toBe('codex');
  });

  it('routes Codex default models to codex', () => {
    expect(getProviderForModel(DEFAULT_CODEX_PRIMARY_MODEL)).toBe('codex');
  });

  it('routes unknown models to codex (default)', () => {
    expect(getProviderForModel('some-unknown-model')).toBe('codex');
  });

  it('routes models starting with gpt- to codex', () => {
    expect(getProviderForModel('gpt-4o')).toBe('codex');
    expect(getProviderForModel('gpt-custom')).toBe('codex');
  });

  it('routes models starting with o prefix to codex', () => {
    expect(getProviderForModel('o3')).toBe('codex');
    expect(getProviderForModel('o4-mini')).toBe('codex');
  });

  it('routes custom OPENAI_MODEL to codex when settings are provided', () => {
    const settings = { environmentVariables: 'OPENAI_MODEL=my-custom-model' };
    expect(getProviderForModel('my-custom-model', settings)).toBe('codex');
  });

  it('routes settings-defined custom Codex models to codex when settings are provided', () => {
    const settings = {
      providerConfigs: {
        codex: {
          enabled: true,
          customModels: 'my-custom-model',
        },
      },
    };

    expect(getProviderForModel('my-custom-model', settings)).toBe('codex');
  });

  it('routes custom OPENAI_MODEL to codex without settings (default context)', () => {
    expect(getProviderForModel('my-custom-model')).toBe('codex');
  });

  it('can resolve blank-tab routing within enabled providers only', () => {
    const settings = {
      settingsProvider: 'claude',
      providerConfigs: {
        claude: {
          environmentVariables: `ANTHROPIC_MODEL=${DEFAULT_CODEX_PRIMARY_MODEL}`,
        },
        codex: {
          enabled: false,
        },
      },
    };

    expect(getProviderForModel(DEFAULT_CODEX_PRIMARY_MODEL, settings)).toBe('claude');
    expect(getEnabledProviderForModel(DEFAULT_CODEX_PRIMARY_MODEL, settings)).toBe('claude');
  });
});
