param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9-]+$')][string]$Name,
  [string]$Adb = (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')
)
$ErrorActionPreference = 'Stop'
$reportDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\docs\auth-validation'))
New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
$xmlTarget = Join-Path $reportDirectory ($Name + '.xml')
function Read-FreshHierarchy {
  for ($attempt = 0; $attempt -lt 3; $attempt++) {
    & $Adb -e shell rm -f /sdcard/nodebt-validation.xml | Out-Null
    $dumpOutput = & $Adb -e shell uiautomator dump /sdcard/nodebt-validation.xml
    if ($dumpOutput -match 'dumped to') {
      & $Adb -e pull /sdcard/nodebt-validation.xml $xmlTarget | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'Unable to retrieve fresh hierarchy.' }
      return [IO.File]::ReadAllText($xmlTarget)
    }
    Start-Sleep -Seconds 2
  }
  throw 'Android did not provide a fresh accessibility hierarchy.'
}
$hierarchy = Read-FreshHierarchy
# The development menu may appear on a cold dev-client launch. Dismiss only that known menu.
if ($hierarchy.Contains('Runtime version: exposdk:')) {
  $tree = [xml]$hierarchy
  $close = $tree.SelectSingleNode("//node[@content-desc='Close']")
  if ($close -and $close.bounds -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
    $closeX = [int](($Matches[1] -as [int]) + ($Matches[3] -as [int])) / 2
    $closeY = [int](($Matches[2] -as [int]) + ($Matches[4] -as [int])) / 2
    & $Adb -e shell input tap ([int]$closeX) ([int]$closeY)
    $hierarchy = Read-FreshHierarchy
  }
}
& $Adb -e shell screencap -p /sdcard/nodebt-validation.png
& $Adb -e pull /sdcard/nodebt-validation.png (Join-Path $reportDirectory ($Name + '.png'))
if ($LASTEXITCODE -ne 0) { throw 'Unable to retrieve screenshot.' }
$tree = [xml]$hierarchy
$tree.SelectNodes('//node') | Where-Object { $_.'content-desc' -like 'Continue*' -or $_.text -like '*not available*' -or $_.text -eq 'Your money, clearly' } | ForEach-Object {
  [pscustomobject]@{ Label = $_.'content-desc'; Text = $_.text; Bounds = $_.bounds; Enabled = $_.enabled }
} | ConvertTo-Json -Compress
