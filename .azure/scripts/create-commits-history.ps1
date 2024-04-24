param (
    [string]$GithubOrg = "SSWConsulting",
    [string]$GithubRepo = "SSW.Rules.Content"
)

$ErrorActionPreference = 'Stop'
$rootFolder = "./SSW.Rules.Content/rules"
Push-Location -Path $rootFolder

Write-Host "Fetch all contributors"
$authors = gh api repos/$GithubOrg/$GithubRepo/contributors --paginate --jq ".[].login"

function Get-CommitInfo($sha) {
    Write-Host "Get-CommitInfo $pwd"
    $commitDetails = git show --pretty=format:"%H%n%ad%n%n%ae" --date=iso-strict $sha
    return $commitDetails
}

function Get-CommitDiffFiles($sha) {
    Write-Host "Get-CommitDiffFiles $pwd"
    $diff = git show --name-only --pretty="" $sha
    return $diff
}

Write-Host "Scan all the .md files"
$utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
$mdFiles = Get-ChildItem -Filter "*.md" -Recurse
$ruleLookupTable = @{}
foreach ($file in $mdFiles) {
    try {
        $key = 'rules/'+$file.FullName.Replace((Resolve-Path -Path $rootFolder).Path, "")

        $streamReader = New-Object System.IO.StreamReader -Arg $file.FullName, $utf8NoBomEncoding
        $content = $streamReader.ReadToEnd()
        $streamReader.Close()
        $streamReader.Dispose()

        $lines = $content -split "`n"
        $titleLine = $lines | Where-Object { $_.StartsWith('title:') }
        $title = $titleLine.Trim().Substring(7)
        $uriLine = $lines | Where-Object { $_.Trim().StartsWith('uri:') }
        $uri = $uriLine.Trim().Substring(5)

        $ruleLookupTable[$key] = @{
            uri = $uri
            title = $title
        }
    } catch {
        continue
    }
}

function Get-FileMetadata($currentFolder, $filesChangedList) {
    $updatedCommits = @()

    foreach ($fileChangedPath in $filesChangedList) {
        $updatedFilesChanged = @()

        try {
            $fileDetails = $ruleLookupTable[$fileChangedPath]

            $newFileChanged = @{
                uri = $uri
                title = $title
                path = $fileChangedPath
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
    $index = [array]::IndexOf($authors, $author) + 1
    Write-Host "($index/$($authors.Count)): Fetching commit data for $author..." -NoNewline
    $userCommits = @{
        "user" = $author
	    "authorName" = (gh api users/$author --jq ".name")
        "commits" = @()
    }

    # get all commits for the author
    $commits = gh api `
        -H "Accept: application/vnd.github+json" `
        -H "X-GitHub-Api-Version: 2022-11-28" `
        /repos/$GithubOrg/$GithubRepo/commits?author=$author`&per_page=1000 `
        --paginate --jq ".[] | { sha: .sha }" `
        | ConvertFrom-Json

    Write-Host "$($commits.Count) commits"

    foreach ($sha in $commits) {
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

Pop-Location

$jsonData = $commitInfo | ConvertTo-Json -Depth 100

#Step 4: Save the commit information to JSON
$file = [System.IO.Path]::Combine((Get-Location), "static/commits.json")
$utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($file, $jsonData, $utf8NoBomEncoding)
