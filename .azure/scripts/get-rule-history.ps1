param (
    [string]$AzFunctionBaseUrl,
    [string]$GenerateHistoryFileFunctionKey,
    [string]$outputFileName
)

cd SSW.Rules/

#GenerateHistoryFile - Read Data from Azure function and save to JSON
$Uri = $AzFunctionBaseUrl + 'GenerateHistoryFileFunction'
$Headers = @{'x-functions-key' = $GenerateHistoryFileFunctionKey}
$Response = Invoke-WebRequest -URI $Uri -Headers $Headers
$Response.Content | Out-File -FilePath ./$outputFileName
