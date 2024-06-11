param (
    [string]$AzFunctionBaseUrl,
    [string]$GetHistorySyncCommitHashKey,
    [string]$UpdateRuleHistoryKey,
    [string]$UpdateHistorySyncCommitHashKey,
    [string]$endCommitHash = "HEAD",
    [bool]$SkipGenerateHistory = $false
    # Do this if your PR is giant 
    # https://github.com/SSWConsulting/SSW.Rules/issues/1367
)

if ($SkipGenerateHistory) {
    echo "Skipping history generation"
} else {
    echo "Generating history"
    echo $SkipGenerateHistory
    echo $SkipGenerateHistory == $true
}

$ErrorActionPreference = 'Stop'

cd SSW.Rules.Content/

#Step 0: Prep the Repo for git log
git commit-graph write --reachable --changed-paths

#Step 1: GetHistorySyncCommitHash - Retrieve CommitHash from AzureFunction
$Uri = $AzFunctionBaseUrl + 'GetHistorySyncCommitHash'
$Headers = @{'x-functions-key' = $GetHistorySyncCommitHashKey}
try {
    $Response = Invoke-WebRequest -URI $Uri -Headers $Headers
} catch {
    Write-Error "Failed to get response Azure Function $Uri: $_"
    exit 1
}
$startCommitHash = $Response.Content -replace '"', ''

$filesProcessed = @{}
$historyFileArray = @()

#Step 2: Get commits within range 
$listOfCommits = git log --pretty="<HISTORY_ENTRY>%n%h%n%ad%n%aN%n%ae%n<FILES_CHANGED>" --name-only --date=iso-strict $startCommitHash^..$endCommitHash origin/main --
$historyChangeEntry = $listOfCommits -join "<LINE>"
$historyArray = $historyChangeEntry -split "<HISTORY_ENTRY>"

$commitSyncHash = "";
$historyArray | Foreach-Object {
    $historyEntry = $_ -split "<FILES_CHANGED>"
    $userDetails = $historyEntry[0] -split "<LINE>"
    $fileArray = $historyEntry[1] -split "<LINE>"

    if($commitSyncHash -eq "" -and $userDetails[1].Length -gt 5)
    {
        $commitSyncHash = $userDetails[1]
    }

    if (!$SkipGenerateHistory) {
        $lastUpdated = $userDetails[2]
        $lastUpdatedBy = $userDetails[3]
        $lastUpdatedByEmail = $userDetails[4]
        
        $fileArray | Where-Object {$_ -Match "^*.md" } | Foreach-Object {
            if(!$filesProcessed.ContainsKey($_))
            {
                $createdRecord = git log --diff-filter=A --reverse --pretty="%ad<LINE>%aN<LINE>%ae" --date=iso-strict -- $_
                $createdDetails = $createdRecord -split "<LINE>"

                $filesProcessed.Add($_, 0)
                $historyFileArray += @{
                    file = $($_)
                    lastUpdated = $lastUpdated
                    lastUpdatedBy = $lastUpdatedBy
                    lastUpdatedByEmail = $lastUpdatedByEmail
                    created = $createdDetails[0]
                    createdBy = $createdDetails[1]
                    createdByEmail = $createdDetails[2]
                }

                echo $_
            }
        }
    }
}

if (!$SkipGenerateHistory) {
    #Step 3: UpdateRuleHistory - Send History Patch to AzureFunction
    $historyFileContents = ConvertTo-Json $historyFileArray
    $Uri = $AzFunctionBaseUrl + 'UpdateRuleHistory'
    $Headers = @{'x-functions-key' = $UpdateRuleHistoryKey}
    try {
        $Response = Invoke-WebRequest -Uri $Uri -Method Post -Body $historyFileContents -Headers $Headers -ContentType 'application/json; charset=utf-8'
    } catch {
        Write-Error "Failed to update rule history $Uri: $_"
    }
}

if(![string]::IsNullOrWhiteSpace($commitSyncHash))
{
    #Step 4: UpdateHistorySyncCommitHash - Update Commit Hash with AzureFunction
    $Uri = $AzFunctionBaseUrl + 'UpdateHistorySyncCommitHash'
    $Headers = @{'x-functions-key' = $UpdateHistorySyncCommitHashKey}
    $Body = @{
        commitHash  = $commitSyncHash
    }
    try {
        $Result = Invoke-WebRequest -Uri $Uri -Method Post -Body $JsonBody -Headers $Headers
    } catch {
        Write-Error "Failed to update history sync commit hash at $Uri: $_"
    }
}

if (!$SkipGenerateHistory) {
    echo $historyFileContents
}
echo $commitSyncHash
