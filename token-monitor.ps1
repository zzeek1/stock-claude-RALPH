$LOG_DIR = "D:\code\stock-claude-RALPH\.ralph\logs"

Write-Host "=== Token Monitor (refresh every 5s) ===" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to exit" -ForegroundColor Gray
Write-Host ""

while ($true) {
    $totalInput = 0
    $totalOutput = 0

    Get-ChildItem "$LOG_DIR\claude_output_*.log" | ForEach-Object {
        $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
        if ($content) {
            $inputs = [regex]::Matches($content, '"input_tokens":(\d+)')
            $outputs = [regex]::Matches($content, '"output_tokens":(\d+)')

            foreach ($match in $inputs) {
                $totalInput += [int]$match.Groups[1].Value
            }
            foreach ($match in $outputs) {
                $totalOutput += [int]$match.Groups[1].Value
            }
        }
    }

    $total = $totalInput + $totalOutput
    $inputCost = [math]::Round($totalInput * 0.003 / 1000, 2)
    $outputCost = [math]::Round($totalOutput * 0.015 / 1000, 2)
    $totalCost = [math]::Round($inputCost + $outputCost, 2)

    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] Input: $totalInput | Output: $totalOutput | Total: $total | Cost: `$$totalCost"

    Start-Sleep -Seconds 5
}
