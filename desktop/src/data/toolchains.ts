/**
 * Toolchains reported by section 0 (CLI 5.2.0+). macleanup never uninstalls a
 * toolchain itself; for "remove" the app shows the toolchain's own uninstall
 * command for the user to run. Unknown tools get no invented command.
 */
export type ToolRole = 'languages' | 'mobile' | 'containers' | 'databases' | 'packages' | 'other';

const ROLE: Record<string, ToolRole> = {
  node: 'languages', nvm: 'languages', fnm: 'languages', volta: 'languages', bun: 'languages', deno: 'languages',
  python: 'languages', pyenv: 'languages', conda: 'languages', rustup: 'languages', rust: 'languages', go: 'languages',
  ruby: 'languages', rbenv: 'languages', java: 'languages', sdkman: 'languages', flutter: 'mobile', 'android-sdk': 'mobile',
  android: 'mobile', xcode: 'mobile', cocoapods: 'mobile', docker: 'containers', colima: 'containers', orbstack: 'containers',
  postgresql: 'databases', postgres: 'databases', mysql: 'databases', redis: 'databases', mongodb: 'databases',
  homebrew: 'packages', brew: 'packages', npm: 'packages', yarn: 'packages', pnpm: 'packages', pip: 'packages',
};

const OWN_UNINSTALL: Record<string, string> = {
  rustup: 'rustup self uninstall',
  rust: 'rustup self uninstall',
  homebrew: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"',
  brew: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"',
  cocoapods: 'sudo gem uninstall cocoapods',
  volta: 'rm -rf ~/.volta',
  sdkman: 'rm -rf ~/.sdkman',
};

/** The tool's role group. */
export const toolRole = (tool: string): ToolRole => ROLE[tool.toLowerCase()] ?? 'other';

/** The toolchain's own uninstall command, or null when macleanup does not know one. */
export function uninstallCommand(tool: string, path: string): string | null {
  const key = tool.toLowerCase();
  if (OWN_UNINSTALL[key]) return OWN_UNINSTALL[key] ?? null;
  if (/^\/(opt\/homebrew|usr\/local)\/(Cellar|opt)\//.test(path)) return `brew uninstall ${key}`;
  return null;
}
