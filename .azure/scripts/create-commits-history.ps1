param (
    [string]$Token,
    [string]$GithubOrg,
    [string]$GithubRepo
)

$ErrorActionPreference = 'Stop'

git clone https://github.com/$GithubOrg/$GithubRepo.git

cd SSW.Rules.Content/

#Step 1: Fetch all contributors - Retrieve from GitHub
$authors = gh api repos/$GithubOrg/$GithubRepo/contributors --paginate --jq ".[].login"

#Step 2: Get all commit info of each contributor
function Get-Commits($author) {
    $url = "https://api.github.com/repos/$GithubOrg/$GithubRepo/commits?author=$author"
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers
        return $response
    } catch {
        Write-Host "Failed to fetch commit data for $author. Status code: $($_.Exception.Response.StatusCode.value__)"
        return @()
    }
}

#Step 3: Get commit details for a given SHA
function Get-CommitInfo($sha) {
    $commitDetails = git show --pretty=format:"%H%n%ad%n%n%ae" --date=iso-strict $sha
    return $commitDetails
}

function Get-CommitDiffFiles($sha) {
    $diff = git show --name-only --pretty="" $sha
    return $diff
}

function Get-FileMetadata($currentFolder, $commits) {
    $updatedCommits = @()

    foreach ($commitPath in $commits) {
        $updatedFilesChanged = @()

        $fullPath = Join-Path $currentFolder $commitPath.Replace("rules/", "")

        try {
            $utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
            $streamReader = New-Object System.IO.StreamReader -Arg $fullPath, $utf8NoBomEncoding
            $content = $streamReader.ReadToEnd()
            $streamReader.Close()

            $lines = $content -split "`n"
            $titleLine = $lines | Where-Object { $_.StartsWith('title:') }
            $title = $titleLine.Trim().Substring(7)
            $uriLine = $lines | Where-Object { $_.Trim().StartsWith('uri:') }
            $uri = $uriLine.Trim().Substring(5)

            $newFileChanged = @{
                uri = $uri
                title = $title
                path = $commitPath
            }
            $updatedFilesChanged += $newFileChanged
            $updatedCommits += @($updatedFilesChanged)
        } catch {
            continue
        }
    }

    return $updatedCommits
}

$commitInfo = @()

foreach ($author in $authors) {
    $commits = Get-Commits $author
    $userCommits = @{
        "user" = $author
	    "authorName" = ""
        "commits" = @()
    }

    foreach ($commit in $commits) {
        $sha = $commit.sha
        $filesChangedList = Get-CommitDiffFiles $sha
        $commitDetails = Get-CommitInfo $sha

        if ($commitDetails) {
            $commitDetailsArray = $commitDetails -split '\r?\n'
            $commitTimeValue = $commitDetailsArray[1]
            $filesChangedList = $filesChangedList | Where-Object { $_ -like "*.md" } | Where-Object { $_ -ne '' }
            $newFilesChangedList = Get-FileMetadata $rootFolder $filesChangedList

            if ($newFilesChangedList.Count -eq 0) {
                continue
            }

            $commitInfoObj = @{
                "CommitTime" = $commitTimeValue
                "FilesChanged" = @($newFilesChangedList)
            }

            $userCommits["commits"] += $commitInfoObj
        }
    }

    if ($userCommits["commits"].Count -gt 0) {
	    $userCommits["authorName"] = $commit.commit[0].author.name
        $commitInfo += $userCommits
    }
}

$jsonData = $commitInfo | ConvertTo-Json -Depth 100

#Step 4: Save the commit information to JSON
$file = [System.IO.Path]::Combine((Get-Location), "../static/commits.json")
$utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($file, $jsonData, $utf8NoBomEncoding)
