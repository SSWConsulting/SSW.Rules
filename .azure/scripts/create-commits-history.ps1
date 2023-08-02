param (
    [string]$Token
)

$ErrorActionPreference = 'Stop'

git clone https://github.com/SSWConsulting/SSW.Rules.Content.git

cd SSW.Rules.Content/

#Step 1: Fetch all contributors - Retrieve from GitHub
$authors = @()
$apiUrl = "https://api.github.com/repos/SSWConsulting/SSW.Rules.Content/contributors?per_page=100&page="

for ($page = 1; $page -le 2; $page++) {
    $url = $apiUrl + $page
    $headers = @{
        "Authorization" = "Bearer $Token"
    }
    $response = Invoke-RestMethod -Uri $url -Method Get
    
    foreach ($contributor in $response) {
        $authors += $contributor.login
    }
}

#Step 2: Get all commit info of each contributor
function Get-Commits($author) {
    $url = "https://api.github.com/repos/SSWConsulting/SSW.Rules.Content/commits?author=$author"
    $headers = @{
        "Authorization" = "Bearer $Token"
    }
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

            $commitInfoObj = @{
                "CommitTime" = $commitTimeValue
                "FilesChanged" = @($filesChangedList) # Convert to an array
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
