[CmdletBinding(SupportsShouldProcess=$true)]
param([Parameter(Mandatory=$true)][ValidateSet('claude','codex','gemini')][string]$Provider)
$ErrorActionPreference = 'Stop'
if (Get-Command $Provider -ErrorAction SilentlyContinue) {
  Write-Host "$Provider is already installed. Existing installation retained."
  exit 0
}
if ($Provider -eq 'claude') {
  if ($PSCmdlet.ShouldProcess('Claude Code', 'Download and run official installer from https://claude.ai/install.ps1')) {
    $installerPath = Join-Path ([IO.Path]::GetTempPath()) ('ai-hub-claude-' + [guid]::NewGuid() + '.ps1')
    Invoke-WebRequest 'https://claude.ai/install.ps1' -UseBasicParsing -OutFile $installerPath
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerPath
    if ($LASTEXITCODE -ne 0) { throw 'Claude installer failed. See the output above.' }
  }
} else {
  $package = if ($Provider -eq 'codex') { '@openai/codex' } else { '@google/gemini-cli' }
  if ($PSCmdlet.ShouldProcess($package, 'npm install --global')) {
    & npm.cmd install --global $package
    if ($LASTEXITCODE -ne 0) { throw "Provider installation failed: $package" }
  }
}
Write-Host 'Reopen AI Hub to refresh PATH, then use Accounts to sign in with your own account.'
