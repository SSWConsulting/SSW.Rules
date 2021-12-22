param (
    [string]$AzFunctionBaseUrl,
    [string]$GetHistorySyncCommitHashKey,
    [string]$UpdateRuleHistoryKey,
    [string]$UpdateHistorySyncCommitHashKey,
    [string]$endCommitHash = "HEAD",
    [string]$gitHubPAT
)

$ErrorActionPreference = 'Stop'

Set-Location SSW.Rules.Content/

#Step 0: Prep the Repo for git log
git commit-graph write --reachable --changed-paths

#Step 1: GetHistorySyncCommitHash - Retrieve CommitHash from AzureFunction and make GitHub Requests
$Uri = $AzFunctionBaseUrl + 'GetHistorySyncCommitHash'
$Headers = @{'x-functions-key' = $GetHistorySyncCommitHashKey }
$Response = Invoke-WebRequest -URI $Uri -Headers $Headers
$startCommitHash = $Response.Content
$ShortStartCommitHash = $startCommitHash.substring(0, 9)

$gitHubRequest = $null
$pageNumber = 1
$found = $false
$obj = @()

while (-not $found) {    
    Write-Output "GitHub Request: $($pageNumber)"
    $endpoint = "https://api.github.com/repos/SSWConsulting/SSW.Rules.Content/commits?page=$($pageNumber)&per_page=100"

    $gitHubRequest += Invoke-RestMethod -Method 'Get' -Uri $endpoint -Headers @{"Authorization" = "Bearer $($gitHubPAT)" }

    Foreach ($res in $gitHubRequest) {
        $shortSha = $res.sha.substring(0, 9)        
        $user = $res.author.login
        if ($shortSha -eq $ShortStartCommitHash) {
            $found = $true
            $obj += New-Object PSObject -Property @{
                User     = $user
                ShortSha = $shortSha
            }
            break
        }
    }

    ++$pageNumber
}

$filesProcessed = @{}
$historyFileArray = @()

#Step 2: Get commits within range 
$listOfCommits = git log --pretty="<HISTORY_ENTRY>%n%h%n%ad%n%aN%n%ae%n%H%n<FILES_CHANGED>" --name-only --date=iso-strict $startCommitHash^..$endCommitHash origin/main --
$historyChangeEntry = $listOfCommits -join "<LINE>"
$historyArray = $historyChangeEntry -split "<HISTORY_ENTRY>"

$commitSyncHash = "";
$historyArray | Foreach-Object {
    $historyEntry = $_ -split "<FILES_CHANGED>"
    $userDetails = $historyEntry[0] -split "<LINE>"
    $fileArray = $historyEntry[1] -split "<LINE>"

    if ($commitSyncHash -eq "" -and $userDetails[1].Length -gt 5) {
        $commitSyncHash = $userDetails[1]
    }

    $lastUpdated = $userDetails[2]
    $lastUpdatedBy = $userDetails[3]
    $lastUpdatedByEmail = $userDetails[4]
    $commitHash = $userDetails[5]
    
    $fileArray | Where-Object { $_ -Match "^*.md" } | Foreach-Object {
        if (!$filesProcessed.ContainsKey($_)) {
            $createdRecord = git log --diff-filter=A --reverse --pretty="%ad<LINE>%aN<LINE>%ae" --date=iso-strict -- $_
            $createdDetails = $createdRecord -split "<LINE>"
            $shortCommitHash = $commitHash.substring(0, 9)
            $commit = $obj | Where-Object ShortSha -eq $shortCommitHash #This wont work when HEAD is used...
            $gitHubUser = $commit.User

            $filesProcessed.Add($_, 0)
            $historyFileArray += @{
                file                  = $($_)
                lastUpdated           = $lastUpdated
                lastUpdatedBy         = $lastUpdatedBy
                lastUpdatedByUsername = $gitHubUser
                lastUpdatedByEmail    = $lastUpdatedByEmail
                created               = $createdDetails[0]
                createdBy             = $createdDetails[1]
                createdByEmail        = $createdDetails[2]
            }

            Write-Output $_
        }
    }
}

$historyFileContents = ConvertTo-Json $historyFileArray

#Step 3: UpdateRuleHistory - Send History Patch to AzureFunction
$Uri = $AzFunctionBaseUrl + 'UpdateRuleHistory'
$Headers = @{'x-functions-key' = $UpdateRuleHistoryKey }
$Response = Invoke-WebRequest -Uri $Uri -Method Post -Body $historyFileContents -Headers $Headers -ContentType 'application/json; charset=utf-8'

if (![string]::IsNullOrWhiteSpace($commitSyncHash)) {
    #Step 4: UpdateHistorySyncCommitHash - Update Commit Hash with AzureFunction
    $Uri = $AzFunctionBaseUrl + 'UpdateHistorySyncCommitHash'
    $Headers = @{'x-functions-key' = $UpdateHistorySyncCommitHashKey }
    $Body = @{
        commitHash = $commitSyncHash
    }
    Invoke-WebRequest -Uri $Uri -Method Post -Body $Body -Headers $Headers
}

Write-Output $historyFileContents
Write-Output $commitSyncHash
