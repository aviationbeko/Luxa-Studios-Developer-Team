$json = Get-Content run_status_final.txt | ConvertFrom-Json
$run = $json.workflow_runs[0]
Write-Host "Status: $($run.status)"
Write-Host "Conclusion: $($run.conclusion)"
Write-Host "RunID: $($run.id)"
