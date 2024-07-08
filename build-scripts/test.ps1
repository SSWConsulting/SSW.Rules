$createdRecord = cd ../../SSW.Rules.Content && git log --diff-filter=A --reverse --pretty="%ad<LINE>%aN<LINE>%ae" --date=iso-strict -- rules/conduct-a-test-please/rule.md
$createdDetails = $createdRecord -split "<LINE>"

$historyFileArray = @{
    file = 'test'
    created = $createdDetails[0] ?? $lastUpdated
    createdBy = $createdDetails[1]
    createdByEmail = $createdDetails[2]
}

echo $historyFileArray
