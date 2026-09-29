param([switch]$Setup)

$ErrorActionPreference = "Stop"
$root = Join-Path $env:LOCALAPPDATA "LemansDeliPrint"
$configPath = Join-Path $root "config.json"
$agentPath = Join-Path $root "print-agent.ps1"
$logPath = Join-Path $root "agent.log"
$api = "https://lemansdeli.com/api/pos/print-jobs"

function Log([string]$message) {
    $entry = (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + " " + $message
    Add-Content -Path $logPath -Value $entry -Encoding UTF8
}

if ($Setup) {
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    Write-Host "Yazicilar:"
    Get-Printer | Select-Object -ExpandProperty Name | ForEach-Object { Write-Host "  $_" }
    $printer = Read-Host "Adisyon yazicisinin adini yukaridaki gibi yazin"
    if (-not (Get-Printer -Name $printer -ErrorAction SilentlyContinue)) { throw "Yazici bulunamadi." }
    $secret = Read-Host "Sunucudaki POS_PRINT_WORKER_TOKEN degerini girin" -AsSecureString
    if ($secret.Length -lt 32) { throw "Anahtar en az 32 karakter olmali." }
    $encrypted = ConvertFrom-SecureString $secret
    @{ PrinterName = $printer; EncryptedToken = $encrypted } |
        ConvertTo-Json | Set-Content -Path $configPath -Encoding UTF8
    if ($PSCommandPath -ne $agentPath) { Copy-Item -Path $PSCommandPath -Destination $agentPath -Force }

    $startup = [Environment]::GetFolderPath("Startup")
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $startup "Lemans Deli Yazici.lnk"))
    $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $agentPath + '"'
    $shortcut.WorkingDirectory = $root
    $shortcut.Save()
    Start-Process -FilePath $shortcut.TargetPath -ArgumentList $shortcut.Arguments -WindowStyle Hidden
    Write-Host "Hazir. Yazici uygulamasi acildi ve Windows oturumu acildiginda baslayacak."
    Write-Host "Kayit: $logPath"
    return
}

if (-not (Test-Path $configPath)) { throw "Once -Setup ile kurulumu tamamlayin." }
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$secure = ConvertTo-SecureString $config.EncryptedToken
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$headers = @{ Authorization = "Bearer $token" }
$workerId = [uri]::EscapeDataString($env:COMPUTERNAME)

Add-Type -AssemblyName System.Drawing

function Wrap([string]$value, [int]$width = 31) {
    $lines = New-Object System.Collections.Generic.List[string]
    while ($value.Length -gt $width) {
        $lines.Add($value.Substring(0, $width))
        $value = $value.Substring($width)
    }
    $lines.Add($value)
    return $lines.ToArray()
}

function Money($value) {
    return ([decimal]$value).ToString("N2", [Globalization.CultureInfo]::GetCultureInfo("tr-TR")) + " TL"
}

function Print-Job($job) {
    $data = $job.document
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("LEMAN'S DELI - KAS")
    $lines.Add("--------------------------------")
    $lines.Add("Adisyon: " + $data.receiptNumber)
    $lines.Add("Tarih: " + (Get-Date -Format "dd.MM.yyyy HH:mm"))
    foreach ($line in (Wrap ("Siparis: " + $data.orderLabel))) { $lines.Add($line) }
    $lines.Add("--------------------------------")
    foreach ($item in $data.items) {
        foreach ($line in (Wrap (([string]$item.quantity) + " x " + $item.name))) { $lines.Add($line) }
        $lines.Add("   " + (Money $item.lineTotal))
    }
    $lines.Add("--------------------------------")
    $lines.Add("Ara toplam: " + (Money $data.subtotal))
    if ([decimal]$data.discount -gt 0) { $lines.Add("Indirim: -" + (Money $data.discount)) }
    $lines.Add("TOPLAM: " + (Money $data.total))
    foreach ($line in (Wrap ("Durum: " + $data.paymentLabel))) { $lines.Add($line) }
    $lines.Add("--------------------------------")
    $lines.Add("MALI DEGERI OLMAYAN ADISYONDUR")
    $lines.Add("@lemansdeli - Kas")

    $document = New-Object System.Drawing.Printing.PrintDocument
    $font = New-Object System.Drawing.Font -ArgumentList "Consolas", 8
    try {
        $document.PrinterSettings.PrinterName = $config.PrinterName
        if (-not $document.PrinterSettings.IsValid) { throw "Yazici kullanilamiyor: $($config.PrinterName)" }
        $document.PrintController = New-Object System.Drawing.Printing.StandardPrintController
        $height = [Math]::Min(32767, [Math]::Max(300, $lines.Count * 17 + 70))
        $document.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize -ArgumentList "58mm", 228, $height
        $document.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins -ArgumentList 3, 3, 3, 3
        $script:printLines = $lines
        $script:printFont = $font
        $document.add_PrintPage({
            param($sender, $page)
            $y = 6.0
            foreach ($line in $script:printLines) {
                $page.Graphics.DrawString($line, $script:printFont, [System.Drawing.Brushes]::Black, 4.0, $y)
                $y += 16.0
            }
            $page.HasMorePages = $false
        })
        $document.Print()
    } finally {
        $document.Dispose()
        $font.Dispose()
    }
}

Log "Yazici uygulamasi basladi: $($config.PrinterName)"
while ($true) {
    try {
        $result = Invoke-RestMethod -Uri ($api + "?workerId=" + $workerId) -Headers $headers -Method Get -TimeoutSec 15
        if ($null -ne $result.job) {
            $job = $result.job
            $outcome = @{ leaseToken = $job.leaseToken; ok = $true }
            try {
                Print-Job $job
                Log ("Yaziciya gonderildi: " + $job.document.receiptNumber + " / " + $job.id)
            } catch {
                $outcome.ok = $false
                $outcome.error = $_.Exception.Message.Substring(0, [Math]::Min(400, $_.Exception.Message.Length))
                Log ("Yazdirma hatasi: " + $job.id + " / " + $outcome.error)
            }
            Invoke-RestMethod -Uri ($api + "/" + $job.id + "/complete") -Headers $headers -Method Post `
                -ContentType "application/json; charset=utf-8" -Body ($outcome | ConvertTo-Json -Compress) -TimeoutSec 15 | Out-Null
        }
        Start-Sleep -Seconds 3
    } catch {
        Log ("Baglanti veya onay hatasi: " + $_.Exception.Message)
        Start-Sleep -Seconds 15
    }
}
