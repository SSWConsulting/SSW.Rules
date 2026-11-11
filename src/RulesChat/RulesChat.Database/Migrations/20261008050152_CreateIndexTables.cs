using Microsoft.Data.SqlTypes;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RulesChat.Database.Migrations
{
    /// <inheritdoc />
    public partial class CreateIndexTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IndexedRules",
                columns: table => new
                {
                    RuleUri = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    RuleTitle = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ContentHash = table.Column<string>(type: "char(64)", unicode: false, fixedLength: true, maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IndexedRules", x => x.RuleUri);
                });

            migrationBuilder.CreateTable(
                name: "RuleChunks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RuleUri = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    ChunkIndex = table.Column<int>(type: "int", nullable: false),
                    Heading = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Embedding = table.Column<SqlVector<float>>(type: "vector(1024)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RuleChunks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RuleChunks_IndexedRules_RuleUri",
                        column: x => x.RuleUri,
                        principalTable: "IndexedRules",
                        principalColumn: "RuleUri");
                });

            migrationBuilder.CreateIndex(
                name: "IX_RuleChunks_RuleUri",
                table: "RuleChunks",
                column: "RuleUri");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RuleChunks");

            migrationBuilder.DropTable(
                name: "IndexedRules");
        }
    }
}
