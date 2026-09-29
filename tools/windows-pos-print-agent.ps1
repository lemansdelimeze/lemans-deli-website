param([switch]$Setup)

$ErrorActionPreference = "Stop"
$root = Join-Path $env:LOCALAPPDATA "LemansDeliPrint"
$configPath = Join-Path $root "config.json"
$agentPath = Join-Path $root "print-agent.ps1"
$logPath = Join-Path $root "agent.log"
$logoPath = Join-Path $root "logo-pos.png"
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
    $sourceLogo = Join-Path (Split-Path $PSScriptRoot -Parent) "public\logo-pos.png"
    if (-not (Test-Path $sourceLogo)) { throw "POS logosu bulunamadi: $sourceLogo" }
    Copy-Item -Path $sourceLogo -Destination $logoPath -Force

    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
        Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($agentPath) } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

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

function Wrap([string]$value, [int]$width = 27) {
    $lines = New-Object System.Collections.Generic.List[string]
    $current = ""
    foreach ($word in ($value -split '\s+')) {
        if (-not $word) { continue }
        if ($current -and ($current.Length + 1 + $word.Length -gt $width)) {
            $lines.Add($current)
            $current = ""
        }
        while ($word.Length -gt $width) {
            $lines.Add($word.Substring(0, $width))
            $word = $word.Substring($width)
        }
        if ($word) { $current = if ($current) { "$current $word" } else { $word } }
    }
    if ($current) { $lines.Add($current) }
    return $lines.ToArray()
}

function Money($value) {
    return ([decimal]$value).ToString("N2", [Globalization.CultureInfo]::GetCultureInfo("tr-TR")) + " ₺"
}

function Print-Job($job) {
    $data = $job.document
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($item in $data.items) {
        $label = if ([decimal]$item.quantity -gt 1) { "$($item.quantity) x $($item.name)" } else { [string]$item.name }
        $rows.Add(@{ Lines = @(Wrap $label 20); Price = Money $item.lineTotal })
    }
    $labelLines = @(Wrap ("Sipariş: " + $data.orderLabel) 36)
    $numberLines = @(Wrap ("Adisyon No: " + $data.receiptNumber) 36)
    $paymentLines = if ($data.paymentLabel) { @(Wrap ("Durum: " + $data.paymentLabel) 36) } else { @() }
    $noteLines = if ($data.orderNote) { @(Wrap ([string]$data.orderNote) 36) } else { @() }
    $rowHeight = 0.0
    foreach ($row in $rows) { $rowHeight += 4.0 + (3.5 * ($row.Lines.Count - 1)) }
    $paperMm = [Math]::Max(80, 98 + ($numberLines.Count + $labelLines.Count - 2 + $paymentLines.Count) * 3.7 + $rowHeight + $(if ([decimal]$data.discount -gt 0) { 4 } else { 0 }) + $(if ($noteLines.Count) { 8 + $noteLines.Count * 3.7 } else { 0 }))
    $document = New-Object System.Drawing.Printing.PrintDocument
    $regular = New-Object System.Drawing.Font -ArgumentList "Consolas", 6.5
    $bold = New-Object System.Drawing.Font -ArgumentList "Consolas", 7.5, ([System.Drawing.FontStyle]::Bold)
    $large = New-Object System.Drawing.Font -ArgumentList "Consolas", 10.5, ([System.Drawing.FontStyle]::Bold)
    $center = New-Object System.Drawing.StringFormat
    $center.Alignment = [System.Drawing.StringAlignment]::Center
    $right = New-Object System.Drawing.StringFormat
    $right.Alignment = [System.Drawing.StringAlignment]::Far
    $logo = $null
    try {
        if (Test-Path $logoPath) { $logo = [System.Drawing.Image]::FromFile($logoPath) }
        $document.PrinterSettings.PrinterName = $config.PrinterName
        if (-not $document.PrinterSettings.IsValid) { throw "Yazici kullanilamiyor: $($config.PrinterName)" }
        $document.PrintController = New-Object System.Drawing.Printing.StandardPrintController
        $height = [int][Math]::Ceiling($paperMm / 0.254)
        $document.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize -ArgumentList "58mm", 228, $height
        $document.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins -ArgumentList 0, 0, 0, 0
        $script:receiptData = $data
        $script:receiptRows = $rows
        $script:receiptLabelLines = $labelLines
        $script:receiptNumberLines = $numberLines
        $script:receiptPaymentLines = $paymentLines
        $script:receiptNoteLines = $noteLines
        $script:receiptRegular = $regular
        $script:receiptBold = $bold
        $script:receiptLarge = $large
        $script:receiptCenter = $center
        $script:receiptRight = $right
        $script:receiptLogo = $logo
        $document.add_PrintPage({
            param($sender, $page)
            $g = $page.Graphics
            $g.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
            $black = [System.Drawing.Brushes]::Black
            $y = 2.0
            if ($script:receiptLogo) { $g.DrawImage($script:receiptLogo, 3.0, $y, 42.0, 28.0); $y += 29.0 }
            else { $g.DrawString("Leman's Deli", $script:receiptLarge, $black, [System.Drawing.RectangleF]::new(2, $y, 44, 8), $script:receiptCenter); $y += 9.0 }
            $pen = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::Black), 0.18
            try {
                $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
                $g.DrawLine($pen, 2.0, $y, 46.0, $y); $y += 2.0
                foreach ($line in $script:receiptNumberLines) { $g.DrawString($line, $script:receiptRegular, $black, 2.0, $y); $y += 3.7 }
                $g.DrawString("Tarih: " + (Get-Date -Format "dd.MM.yyyy"), $script:receiptRegular, $black, 2.0, $y); $y += 3.7
                $g.DrawString("Saat: " + (Get-Date -Format "HH:mm"), $script:receiptRegular, $black, 2.0, $y); $y += 3.7
                foreach ($line in $script:receiptLabelLines) { $g.DrawString($line, $script:receiptRegular, $black, 2.0, $y); $y += 3.7 }
                $y += 1.0; $g.DrawLine($pen, 2.0, $y, 46.0, $y); $y += 2.0
                foreach ($row in $script:receiptRows) {
                    $g.DrawString($row.Price, $script:receiptBold, $black, [System.Drawing.RectangleF]::new(29, $y, 17, 4), $script:receiptRight)
                    foreach ($line in $row.Lines) { $g.DrawString($line, $script:receiptBold, $black, 2.0, $y); $y += 3.5 }
                    $y += 0.5
                }
                if ($script:receiptNoteLines.Count) {
                    $g.DrawLine($pen, 2.0, $y, 46.0, $y); $y += 2.0
                    $g.DrawString("SİPARİŞ NOTU", $script:receiptBold, $black, 2.0, $y); $y += 4.0
                    foreach ($line in $script:receiptNoteLines) { $g.DrawString($line, $script:receiptRegular, $black, 2.0, $y); $y += 3.7 }
                    $y += 1.0
                }
                $g.DrawLine($pen, 2.0, $y, 46.0, $y); $y += 2.0
                $g.DrawString("Ara toplam", $script:receiptRegular, $black, 2.0, $y)
                $g.DrawString((Money $script:receiptData.subtotal), $script:receiptRegular, $black, [System.Drawing.RectangleF]::new(28, $y, 18, 4), $script:receiptRight); $y += 4.0
                if ([decimal]$script:receiptData.discount -gt 0) {
                    $g.DrawString(("İndirim " + $script:receiptData.discountLabel), $script:receiptRegular, $black, 2.0, $y)
                    $g.DrawString(("-" + (Money $script:receiptData.discount)), $script:receiptRegular, $black, [System.Drawing.RectangleF]::new(28, $y, 18, 4), $script:receiptRight); $y += 4.0
                }
                $g.DrawString("TOPLAM", $script:receiptLarge, $black, 2.0, $y)
                $g.DrawString((Money $script:receiptData.total), $script:receiptLarge, $black, [System.Drawing.RectangleF]::new(23, $y, 23, 7), $script:receiptRight); $y += 7.0
                foreach ($line in $script:receiptPaymentLines) { $g.DrawString($line, $script:receiptBold, $black, 2.0, $y); $y += 3.7 }
                $y += 1.0; $g.DrawLine($pen, 2.0, $y, 46.0, $y); $y += 3.0
                $g.DrawString("BU BELGE MALİ DEĞERİ OLMAYAN", $script:receiptBold, $black, [System.Drawing.RectangleF]::new(2, $y, 44, 5), $script:receiptCenter); $y += 4.0
                $g.DrawString("BİLGİLENDİRME AMAÇLI", $script:receiptBold, $black, [System.Drawing.RectangleF]::new(2, $y, 44, 5), $script:receiptCenter); $y += 4.0
                $g.DrawString("ADİSYONDUR.", $script:receiptBold, $black, [System.Drawing.RectangleF]::new(2, $y, 44, 5), $script:receiptCenter); $y += 6.0
                $g.DrawString("Teşekkür ederiz.", $script:receiptRegular, $black, [System.Drawing.RectangleF]::new(2, $y, 44, 5), $script:receiptCenter); $y += 4.0
                $g.DrawString("@lemansdeli · Kaş", $script:receiptRegular, $black, [System.Drawing.RectangleF]::new(2, $y, 44, 5), $script:receiptCenter)
            } finally {
                $pen.Dispose()
            }
            $page.HasMorePages = $false
        })
        $document.Print()
    } finally {
        $document.Dispose()
        $regular.Dispose(); $bold.Dispose(); $large.Dispose()
        $center.Dispose(); $right.Dispose()
        if ($logo) { $logo.Dispose() }
    }
}

Log "Yazici uygulamasi basladi: $($config.PrinterName)"
while ($true) {
    try {
        # Windows PowerShell 5.1 can decode JSON without a charset as Latin-1.
        # Read the response bytes as UTF-8 so Turkish menu names remain intact.
        $response = Invoke-WebRequest -Uri ($api + "?workerId=" + $workerId) -Headers $headers -Method Get -UseBasicParsing -TimeoutSec 15
        $stream = $response.RawContentStream
        if ($stream.CanSeek) { $stream.Position = 0 }
        $reader = New-Object System.IO.StreamReader -ArgumentList $stream, ([System.Text.Encoding]::UTF8)
        try { $jsonText = $reader.ReadToEnd(); $result = ConvertFrom-Json -InputObject $jsonText }
        finally { $reader.Dispose() }
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
