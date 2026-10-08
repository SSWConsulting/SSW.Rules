-- One row per chunk of a rule, with its embedding. The vector size is fixed: every embedding model the site uses is
-- configured to return 1024 dimensions.
IF OBJECT_ID('dbo.RuleChunks') IS NULL
  CREATE TABLE dbo.RuleChunks (
    Id INT IDENTITY PRIMARY KEY,
    RuleUri NVARCHAR(400) NOT NULL REFERENCES dbo.IndexedRules (RuleUri) ON DELETE CASCADE,
    ChunkIndex INT NOT NULL,
    Heading NVARCHAR(500) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    Embedding VECTOR(1024) NOT NULL,
    INDEX IX_RuleChunks_RuleUri (RuleUri)
  );
