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

# Step 1: Confirm Shopify theme was duplicated
Write-Host "CHECKLIST - Before we push:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  [ ] 1. Shopify Admin, Themes, Duplicate live theme" -ForegroundColor White
Write-Host "         (creates a rollback snapshot on Shopify)" -ForegroundColor DarkGray
Write-Host ""
$confirm = Read-Host "Have you duplicated the theme in Shopify? (y/n)"
if ($confirm -ne "y") {
    Write-Host ""
    Write-Host "Please duplicate the theme first, then re-run this script." -ForegroundColor Red
    Write-Host "Admin, Online Store, Themes, ..., Duplicate" -ForegroundColor DarkGray
    Write-Host ""
    exit
}

# Step 2: Commit message
Write-Host ""
$message = Read-Host "Describe what you changed (e.g. Add vault CTA to reader)"
if ([string]::IsNullOrWhiteSpace($message)) {
    $message = "Update $TIMESTAMP"
}

# Step 3: Git backup
Write-Host ""
Write-Host "[ 1/3 ] Saving to GitHub..." -ForegroundColor Cyan

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

# Step 4: Push to Shopify
Write-Host ""
Write-Host "[ 2/3 ] Pushing to Shopify..." -ForegroundColor Cyan
Write-Host ""

shopify theme push --store $STORE

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Shopify push failed." -ForegroundColor Red
    Write-Host "Your GitHub backup was already saved - nothing is lost." -ForegroundColor DarkGray
    exit
}

# Step 5: Done
Write-Host ""
Write-Host "[ 3/3 ] Testing reminder:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [ ] Open your live store and test the change" -ForegroundColor White
Write-Host "  [ ] Check on mobile too" -ForegroundColor White
Write-Host "  [ ] If broken: Shopify Admin, Themes, Publish the duplicate" -ForegroundColor White
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Done! Live at: https://$STORE" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
