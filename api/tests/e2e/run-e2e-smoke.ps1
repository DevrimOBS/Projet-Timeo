# Simple e2e smoke script (PowerShell)
# Usage: Open PowerShell in repo root and run: .\api\tests\e2e\run-e2e-smoke.ps1

$base = 'http://localhost:3000'
$adminToken = 'admin-dev-token'
$agentToken = 'agent-dev-token'

function PostJson($url, $token, $body) {
    try {
        $json = $body | ConvertTo-Json -Depth 10
        $resp = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' } -Body $json -TimeoutSec 10
        return @{ ok = $true; status = 200; body = $resp }
    } catch {
        $err = $_.Exception
        $status = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.Value__ } else { 0 }
        $text = ''
        try { if ($_.Exception.Response) { $stream = $_.Exception.Response.GetResponseStream(); $r = New-Object System.IO.StreamReader($stream); $text = $r.ReadToEnd() } } catch {}
        return @{ ok = $false; status = $status; error = $err.Message; body = $text }
    }
}

function GetJson($url, $token) {
    try {
        $resp = Invoke-RestMethod -Uri $url -Method Get -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 10
        return @{ ok = $true; status = 200; body = $resp }
    } catch {
        $status = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.Value__ } else { 0 }
        return @{ ok = $false; status = $status; error = $_.Exception.Message }
    }
}

Write-Host "[e2e] Starting smoke test against $base"

# 1) Create a scan task as admin
$taskBody = @{ mode = 'MANUAL_GLOBAL'; container_ids = @(); message = 'e2e smoke' }
$taskResp = PostJson "$base/api/scan-tasks" $adminToken $taskBody
Write-Host "Create task: status=$($taskResp.status) ok=$($taskResp.ok)"
if (-not $taskResp.ok) { Write-Host "Create task failed: $($taskResp.error) $($taskResp.body)"; exit 1 }
$taskId = $taskResp.body.id
Write-Host "Task ID: $taskId"

# 2) Agent attempts to claim
$claimResp = PostJson "$base/api/scan-tasks/claim" $agentToken @{}
Write-Host "Claim: status=$($claimResp.status) ok=$($claimResp.ok)"
if ($claimResp.ok -and $claimResp.body -ne $null) {
    Write-Host "Agent claimed task: $($claimResp.body.id)"
} else {
    if ($claimResp.status -eq 204) { Write-Host "No task available (204)" } else { Write-Host "Claim returned: $($claimResp.body)" }
}

# 3) Post a scan as agent (simulate report)
$scanBody = @{ agent_id = 'agent-1'; timestamp = (Get-Date).ToString("o"); scan_type = 'docker'; containers = @(); summary = @{ total_containers = 0; healthy_containers = 0; vulnerable_containers = 0; total_vulnerabilities = 0; global_risk_score = 0 } }
$scanResp = PostJson "$base/api/scans" $agentToken $scanBody
Write-Host "Post scan: status=$($scanResp.status) ok=$($scanResp.ok)"
if (-not $scanResp.ok) { Write-Host "Post scan failed: $($scanResp.error) $($scanResp.body)"; exit 1 }
$scanId = $scanResp.body.scanId
Write-Host "Scan ID: $scanId"

# 4) Complete the task if claimed
if ($claimResp.ok -and $claimResp.body -ne $null) {
    $claimedId = $claimResp.body.id
    $completeBody = @{ status = 'completed'; scan_id = $scanId }
    $completeResp = PostJson "$base/api/scan-tasks/$claimedId/complete" $agentToken $completeBody
    Write-Host "Complete: status=$($completeResp.status) ok=$($completeResp.ok)"
    if (-not $completeResp.ok) { Write-Host "Complete failed: $($completeResp.error) $($completeResp.body)"; exit 1 }
}

# 5) Verify task status
$getResp = GetJson "$base/api/scan-tasks" $adminToken
if (-not $getResp.ok) { Write-Host "List tasks failed: $($getResp.error)"; exit 1 }
$found = $false
foreach ($t in $getResp.body) { if ($t.id -eq $taskId) { Write-Host "Task $taskId status=$($t.status)"; $found = $true } }
if (-not $found) { Write-Host "Task $taskId not found in list"; exit 1 }

Write-Host "[e2e] Smoke test completed successfully"
exit 0
