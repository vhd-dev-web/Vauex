import type { ProviderId } from '../../../core/providers/types';
import type ClaudianPlugin from '../../../main';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';
import { getCodexProviderSettings } from '../settings';
import type { InitializeResult } from './codexAppServerTypes';
import { buildCodexLaunchSpec } from './CodexLaunchSpecBuilder';
import type { CodexLaunchSpec } from './codexLaunchTypes';
import type { CodexRpcTransport } from './CodexRpcTransport';

const CODEX_APP_SERVER_CLIENT_INFO = Object.freeze({
  name: 'vauex',
  version: '1.0.0',
});

export function getCodexAppServerWorkingDirectory(plugin: ClaudianPlugin): string {
  return getVaultPath(plugin.app) ?? process.cwd();
}

export function buildCodexAppServerEnvironment(
  plugin: ClaudianPlugin,
  providerId: ProviderId = 'codex',
): Record<string, string> {
  const customEnv = parseEnvironmentVariables(plugin.getActiveEnvironmentVariables(providerId));
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  const enhancedPath = getEnhancedPath(customEnv.PATH);

  return {
    ...baseEnv,
    ...customEnv,
    PATH: enhancedPath,
  };
}

export function resolveCodexAppServerLaunchSpec(
  plugin: ClaudianPlugin,
  providerId: ProviderId = 'codex',
): CodexLaunchSpec {
  const settings = plugin.settings as unknown as Record<string, unknown>;
  const codexSettings = getCodexProviderSettings(settings);
  const resolvedCliCommand = plugin.getResolvedProviderCliPath(providerId);
  if (!resolvedCliCommand && codexSettings.installationMethod !== 'wsl') {
    throw new Error(
      'Codex CLI not found. Install Codex, restart Obsidian, or set the Codex CLI path in Vauex settings. On Windows, use the native codex.exe path or switch Codex installation method to WSL.',
    );
  }

  return buildCodexLaunchSpec({
    settings,
    resolvedCliCommand,
    hostVaultPath: getCodexAppServerWorkingDirectory(plugin),
    env: buildCodexAppServerEnvironment(plugin, providerId),
  });
}

export async function initializeCodexAppServerTransport(
  transport: CodexRpcTransport,
): Promise<InitializeResult> {
  const result = await transport.request<InitializeResult>('initialize', {
    clientInfo: CODEX_APP_SERVER_CLIENT_INFO,
    capabilities: { experimentalApi: true },
  });

  transport.notify('initialized');
  return result;
}
