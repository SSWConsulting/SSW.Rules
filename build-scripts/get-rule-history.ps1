param (
    [string]$AzFunctionBaseUrl,
    [string]$GenerateHistoryFileFunctionKey,
    [string]$outputFileName
)

$ErrorActionPreference = 'Stop'

#GenerateHistoryFile - Read Data from Azure function and save to JSON
$Uri = $AzFunctionBaseUrl + '/api/GenerateHistoryFileFunction'
$Headers = @{'x-functions-key' = $GenerateHistoryFileFunctionKey}
$Response = Invoke-WebRequest -URI $Uri -Headers $Headers
$Response.Content | Out-File -FilePath $outputFileName
