# Windows 一键启动（PowerShell）
#
# 用法：右键「使用 PowerShell 运行」，或在项目根目录执行 .\start.ps1
#
# 说明：首次运行会自动安装依赖；已安装则直接启动开发服务器。

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host ''
Write-Host '  Nexus Admin · 通用管理后台模板' -ForegroundColor Cyan
Write-Host '  ────────────────────────────────────────' -ForegroundColor DarkGray

# 检查 Node 版本
$nodeVersion = (node -v) -replace 'v', ''
$major = [int]($nodeVersion.Split('.')[0])
if ($major -lt 20) {
    Write-Host "  ✗ Node 版本过低（当前 $nodeVersion，需要 >= 20.19）" -ForegroundColor Red
    Write-Host '    请到 https://nodejs.org 安装 LTS 版本' -ForegroundColor DarkGray
    exit 1
}
Write-Host "  ✓ Node $nodeVersion" -ForegroundColor Green

# 检查 pnpm
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host '  ! 未检测到 pnpm，正在通过 corepack 启用…' -ForegroundColor Yellow
    corepack enable
    corepack prepare pnpm@10.34.5 --activate
}
Write-Host "  ✓ pnpm $((pnpm -v))" -ForegroundColor Green

# 安装依赖
if (-not (Test-Path 'node_modules')) {
    Write-Host '  → 首次运行，正在安装依赖（约 30 秒）…' -ForegroundColor DarkGray
    pnpm install
}

Write-Host ''
Write-Host '  → 启动开发服务器：http://127.0.0.1:5173' -ForegroundColor Cyan
Write-Host '    演示账号 admin@nexus.dev / nexus123' -ForegroundColor DarkGray
Write-Host ''

pnpm dev
