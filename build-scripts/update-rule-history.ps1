param (
    [string]$AzFunctionBaseUrl,
    [string]$GetHistorySyncCommitHashKey,
    [string]$UpdateRuleHistoryKey,
    [string]$UpdateHistorySyncCommitHashKey,
    [string]$endCommitHash = "HEAD",
    [string]$ShouldGenerateHistoryString = "true"  # Accepts string input
    # Do this if your PR is giant 
    # https://github.com/SSWConsulting/SSW.Rules/issues/1367
)

# Create a new boolean variable from the string input
$IsHistoryGenerationEnabled = [string]::Equals($ShouldGenerateHistoryString, "true", [System.StringComparison]::OrdinalIgnoreCase)

if ($IsHistoryGenerationEnabled) {
    Write-Output "Generating history"
} else {
    Write-Output "Skipping history generation"
}


$ErrorActionPreference = 'Stop'

cd SSW.Rules.Content/

#Step 0: Prep the Repo for git log
git commit-graph write --reachable --changed-paths

#Step 1: GetHistorySyncCommitHash - Retrieve CommitHash from AzureFunction
$Uri = $AzFunctionBaseUrl + '/api/GetHistorySyncCommitHash'
$Headers = @{'x-functions-key' = $GetHistorySyncCommitHashKey}
$Response = Invoke-WebRequest -URI $Uri -Headers $Headers
$startCommitHash = $Response.Content -replace '"', ''

$filesProcessed = @{}
$historyFileArray = @()

#Step 2: Get commits within range 
$listOfCommits = git log --pretty="<HISTORY_ENTRY>%n%h%n%ad%n%aN%n%ae%n<FILES_CHANGED>" --name-only --date=iso-strict $startCommitHash^..$endCommitHash origin/main --
$historyChangeEntry = $listOfCommits -join "<LINE>"
$historyArray = $historyChangeEntry -split "<HISTORY_ENTRY>"

$commitSyncHash = "";
$rulesContentFolder = ".

$historyArray | Foreach-Object {
    $historyEntry = $_ -split "<FILES_CHANGED>"
    $userDetails = $historyEntry[0] -split "<LINE>"
    $fileArray = $historyEntry[1] -split "<LINE>"

    if($commitSyncHash -eq "" -and $userDetails[1].Length -gt 5)
    {
        $commitSyncHash = $userDetails[1]
    }

    if ($IsHistoryGenerationEnabled) {
        Write-Output "Processing commit $userDetails[1]"
        $lastUpdated = $userDetails[2]
        $lastUpdatedBy = $userDetails[3]
        $lastUpdatedByEmail = $userDetails[4]
        
        $fileArray | Where-Object {$_ -Match "^*.md" } | Foreach-Object {
            if(!$filesProcessed.ContainsKey($_))
            {
                try {
                    $fullPath = Join-Path $rulesContentFolder $_
                    if (!(Test-Path $fullPath)) {
                        Write-Output "Skipping missing file: $fullPath"
                        continue
                    }
                    $createdRecord = git log --diff-filter=A --reverse --pretty="%ad<LINE>%aN<LINE>%ae<LINE>" --date=iso-strict -- $_
                    $createdDetails = $createdRecord -split "<LINE>"
    
                    # Read and parse Markdown file to set title, uri, and archived status
                    $utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
                    $streamReader = New-Object System.IO.StreamReader -Arg $fullPath, $utf8NoBomEncoding
                    $content = $streamReader.ReadToEnd()
                    $streamReader.Close()
    
                    $lines = $content -split "`n"
                    $title = ""
                    $uri = ""
                    $isArchived = $false
    
                    $titleLine = $lines | Where-Object { $_.StartsWith('title:') }
                    $title = $titleLine.Substring(6).Trim()
    
                    $uriLine = $lines | Where-Object { $_.Trim().StartsWith('uri:') }
                    $uri = $uriLine.Substring(4).Trim()
    
                    $archivedReasonLine = $lines | Where-Object { $_.Replace(' ', '').StartsWith('archivedreason:') }
                    if ($archivedReasonLine) {
                        $archivedReason = $archivedReasonLine.Trim().Substring(15).Trim()
                        $isArchived = $archivedReason -ne 'null' -and $archivedReason -ne ''
                    }

                    $filesProcessed.Add($_, 0)

                    $historyFileArray += @{
                        file = $($_)
                        title = $title
                        uri = $uri
                        isArchived = $isArchived
                        lastUpdated = $lastUpdated
                        lastUpdatedBy = $lastUpdatedBy
                        lastUpdatedByEmail = $lastUpdatedByEmail
                        created = $createdDetails[0] ?? $lastUpdated
                        createdBy = $createdDetails[1] ?? $lastUpdatedBy
                        createdByEmail = $createdDetails[2] ?? $lastUpdatedByEmail
                    }

                    Write-Output $_
                }
                catch {
                    Write-Output "Error processing file $_"
                }
            }
        }
    }
}


if ($IsHistoryGenerationEnabled) {
    #Step 3: UpdateRuleHistory - Send History Patch to AzureFunction
    $historyFileContents = ConvertTo-Json $historyFileArray
    $Uri = $AzFunctionBaseUrl + '/api/UpdateRuleHistory'
    $Headers = @{'x-functions-key' = $UpdateRuleHistoryKey}
    $Response = Invoke-WebRequest -Uri $Uri -Method Post -Body $historyFileContents -Headers $Headers -ContentType 'application/json; charset=utf-8'
}

if(![string]::IsNullOrWhiteSpace($commitSyncHash))
{
    #Step 4: UpdateHistorySyncCommitHash - Update Commit Hash with AzureFunction
    $Uri = $AzFunctionBaseUrl + '/api/UpdateHistorySyncCommitHash'
    $Headers = @{'x-functions-key' = $UpdateHistorySyncCommitHashKey}
    $Body = @{
        commitHash  = $commitSyncHash
    }
    $Result = Invoke-WebRequest -Uri $Uri -Method Post -Body $Body -Headers $Headers
}

if ($IsHistoryGenerationEnabled) {
    Write-Output $historyFileContents
}

Write-Output $commitSyncHash
