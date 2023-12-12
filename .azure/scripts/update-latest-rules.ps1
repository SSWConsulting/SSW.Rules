param (
    [string]$AzFunctionBaseUrl,
    [string]$UpdateLatestRulesFunctionKey
)

$ErrorActionPreference = 'Stop'

$Uri = $AzFunctionBaseUrl + '/api/UpdateLatestRules'
$Headers = @{'x-functions-key' = $UpdateLatestRulesFunctionKey}

# Send a POST request 
Invoke-RestMethod -Uri $Uri -Method Post -Headers $Headers

$responseObject = ConvertFrom-Json -InputObject $ResponseBody
if ($responseObject.message -eq "Latest rules updated successfully.") {
    Write-Host "Latest rules updated successfully!"
} else {
    Write-Error "Error updating Latest rules: $responseObject.message"
}
