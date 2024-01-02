param (
    [string]$AzFunctionBaseUrl,
    [string]$UpdateLatestRulesFunctionKey
)

$ErrorActionPreference = 'Stop'

$Uri = $AzFunctionBaseUrl + '/UpdateLatestRules'
$Headers = @{'x-functions-key' = $UpdateLatestRulesFunctionKey }

try {
    $StatusCode = $null
    Invoke-RestMethod -Uri $Uri -Method Post -Headers $Headers -StatusCodeVariable StatusCode

    if ($StatusCode -eq 200) {
        Write-Host "Latest rules updated successfully!"
    }
    else {
        Write-Error "Request failed with status code: $StatusCode"
    }
}
catch {
    Write-Error "Exception occurred: $_"
}
