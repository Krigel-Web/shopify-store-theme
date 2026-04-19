# ============================================================
#  BlackWhole Magazine - Safe Push Script
#  Run this from C:\Users\PCZONE.GE\Desktop\BlackWhole
#  Usage: .\push.ps1
# ============================================================

$STORE = "eueerb-am.myshopify.com"
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd HH:mm"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  BlackWhole - Safe Push" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Commit message
$message = Read-Host "Describe what you changed (e.g. Fix vault CTA z-index)"
if ([string]::IsNullOrWhiteSpace($message)) {
    $message = "Update $TIMESTAMP"
}

# Step 2: Git backup
Write-Host ""
Write-Host "[ 1/2 ] Saving to GitHub..." -ForegroundColor Cyan

git add .
git commit -m "$message"
git push

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "GitHub push failed. Check the error above." -ForegroundColor Red
    $continue = Read-Host "Continue pushing to Shopify anyway? (y/n)"
    if ($continue -ne "y") {
        Write-Host "Aborted." -ForegroundColor Red
        exit
    }
} else {
    Write-Host "GitHub backup saved. OK" -ForegroundColor Green
}

# Step 3: Push to Shopify
Write-Host ""
Write-Host "[ 2/2 ] Pushing to Shopify..." -ForegroundColor Cyan
Write-Host ""

shopify theme push --store $STORE

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Shopify push failed." -ForegroundColor Red
    Write-Host "Your GitHub backup was already saved - nothing is lost." -ForegroundColor DarkGray
    exit
}

# Done
Write-Host ""
Write-Host "[ DONE ] Testing reminder:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] Open your live store and test the change" -ForegroundColor White
Write-Host "  [ ] Check on mobile too" -ForegroundColor White
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Live at: https://$STORE" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
