$json = Get-Content run_status_3.txt | ConvertFrom-Json
$run = $json.workflow_runs[0]
Write-Host "Status: $($run.status)"
Write-Host "Conclusion: $($run.conclusion)"
