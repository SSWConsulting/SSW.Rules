param (
    [string]$Token,
    [string]$GithubOrg,
    [string]$GithubRepo
)

$ErrorActionPreference = 'Stop'
$rootFolder = "./SSW.Rules.Content/rules"

cd SSW.Rules.Content/

Write-Host "Fetch all contributors"
$authors = (gh api repos/$GithubOrg/$GithubRepo/contributors --paginate --jq ".[].login") | ForEach-Object {
    $user = $_
    $name = (gh api users/$user --jq ".name")
    [PSCustomObject]@{
        login = $user
        name = $name
    }
} | Where-Object { $_.name -ne $null } | Select-Object -ExpandProperty login

Write-Host "Fetch all commit info"
$allCommits = gh api repos/$GithubOrg/$GithubRepo/commits --paginate --jq ".[] | {sha: .sha, author: .author.login}"

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
    $index = [array]::IndexOf($authors, $author) + 1
    Write-Host "($index/$($authors.Count)): Fetching commit data for $author.name"

    $commits = $allCommits | Where-Object { $_.author -eq $author.login } | ForEach-Object { $_.sha }
    $userCommits = @{
        "user" = $author
	    "authorName" = $author.name
        "commits" = @()
    }

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
        $commitInfo += $userCommits
    }
}

$jsonData = $commitInfo | ConvertTo-Json -Depth 100

#Step 4: Save the commit information to JSON
$file = [System.IO.Path]::Combine((Get-Location), "../static/commits.json")
$utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($file, $jsonData, $utf8NoBomEncoding)
