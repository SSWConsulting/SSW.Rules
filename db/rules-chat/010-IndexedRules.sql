-- One row per indexed rule. ContentHash covers the rule file, the chunking version and the embedding model, so the
-- index script can skip rules that haven't changed.
IF OBJECT_ID('dbo.IndexedRules') IS NULL
  CREATE TABLE dbo.IndexedRules (
    RuleUri NVARCHAR(400) NOT NULL PRIMARY KEY,
    RuleTitle NVARCHAR(500) NOT NULL,
    ContentHash CHAR(64) NOT NULL
  );
