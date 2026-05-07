$json = Get-Content run_status_multi.txt | ConvertFrom-Json
foreach ($run in $json.workflow_runs) {
    Write-Host "ID: $($run.id) Status: $($run.status) Conclusion: $($run.conclusion)"
}
