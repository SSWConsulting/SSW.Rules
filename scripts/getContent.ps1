$ContentBranch=$args[0]

ls
while (!(Test-Path "./SSW.Rules.Content")) {
    ls
    git clone https://github.com/SSWConsulting/SSW.Rules.Content.git
}
ls
Set-Location ./SSW.Rules.Content
git checkout ($ContentBranch ?? "main") # Get CONTENT_BRANCH from env.development
git pull
