param (
    [string]$AzFunctionBaseUrl,
    [string]$GetHistorySyncCommitHashKey,
    [string]$UpdateRuleHistoryKey,
    [string]$UpdateHistorySyncCommitHashKey,
    [string]$endCommitHash = "HEAD"
)

$ErrorActionPreference = 'Stop'

cd SSW.Rules.Content/

#Step 0: Prep the Repo for git log
git commit-graph write --reachable --changed-paths

#Step 1: GetHistorySyncCommitHash - Retrieve CommitHash from AzureFunction
$Uri = $AzFunctionBaseUrl + 'GetHistorySyncCommitHash'
$Headers = @{'x-functions-key' = $GetHistorySyncCommitHashKey}
$Response = Invoke-WebRequest -URI $Uri -Headers $Headers
$startCommitHash = $Response.Content

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

$historyFileContents = ConvertTo-Json $historyFileArray

#Step 3: UpdateRuleHistory - Send History Patch to AzureFunction
$Uri = $AzFunctionBaseUrl + 'UpdateRuleHistory'
$Headers = @{'x-functions-key' = $UpdateRuleHistoryKey}
$Response = Invoke-WebRequest -Uri $Uri -Method Post -Body $historyFileContents -Headers $Headers

if(![string]::IsNullOrWhiteSpace($commitSyncHash))
{
    #Step 4: UpdateHistorySyncCommitHash - Update Commit Hash with AzureFunction
    $Uri = $AzFunctionBaseUrl + 'UpdateHistorySyncCommitHash'
    $Headers = @{'x-functions-key' = $UpdateHistorySyncCommitHashKey}
    $Body = @{
        commitHash  = $commitSyncHash
    }
    $Result = Invoke-WebRequest -Uri $Uri -Method Post -Body $Body -Headers $Headers
}

echo $historyFileContents
echo $commitSyncHash
